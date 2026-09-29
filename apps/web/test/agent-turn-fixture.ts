import { createHash, randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mock } from "node:test";

import {
  AgentAttempts,
  AgentExecution,
  type AgentExecutor,
} from "@ai-workspace/agent-execution";
import {
  buildClaudeCodeAgentInvocation,
  ClaudeCodeAgentAdapter,
} from "@ai-workspace/claude-code-agent";
import {
  buildCodexAgentInvocation,
  CodexAgentAdapter,
} from "@ai-workspace/codex-agent";
import {
  ConversationTurn,
  type ConversationTurnResult,
} from "@ai-workspace/conversation-turn";
import { GeneralConversations } from "@ai-workspace/general-conversation";
import { JsonAgentAttemptStore } from "@ai-workspace/local-agent-attempts";
import { JsonConversationTurnRegistry } from "@ai-workspace/local-conversation-turns";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { ModelAttempts } from "@ai-workspace/model-attempts";

import { conversationTurnRecovery } from "../src/conversation-turn-recovery.ts";

/**
 * This harness stands where an agent target is wired into the turn. It uses the
 * real registry, coordinator, stores and adapters; only the process runner is
 * synthetic and never starts a program.
 */
export const agentRequest = {
  conversationId: "n5-general",
  projectId: null,
  targetId: "codex",
  userText: "A synthetic agent recovery question",
  clientRequestId: "n5-gesture",
} as const;

export type AgentStage =
  | "normal"
  | "after-link"
  | "after-prepare"
  | "after-execution-claim"
  | "after-execution"
  | "before-append"
  | "after-append"
  | "duplicate-final"
  | "tool-event"
  | "save-fails";

const WORKSPACE = "/nonexistent/ai-workspace-n5-synthetic-workspace";
const BINDING = "b".repeat(64);
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function agentGeneral(home: string) {
  return new GeneralConversations({
    store: new JsonGeneralConversationStore(home),
    ids: randomUUID,
    clock: () => new Date(),
  });
}

const codexOutput = (stage: AgentStage) =>
  stage === "duplicate-final"
    ? '{"type":"item.completed","item":{"type":"agent_message","text":"one"}}\n{"type":"item.completed","item":{"type":"agent_message","text":"two"}}\n{"type":"turn.completed"}\n'
    : stage === "tool-event"
      ? '{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"turn.completed"}\n'
      : '{"type":"thread.started","thread_id":"synthetic"}\n{"type":"turn.started"}\n{"type":"item.completed","item":{"type":"agent_message","text":"Synthetic agent answer"}}\n{"type":"turn.completed"}\n';

const claudeOutput = () =>
  [
    {
      type: "system",
      subtype: "init",
      tools: [],
      mcp_servers: [],
      plugins: [],
      hooks: [],
      skills: [],
      memory: [],
    },
    {
      type: "result",
      subtype: "success",
      result: JSON.stringify({ answer: "Synthetic Claude answer" }),
    },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n") + "\n";

function executors(home: string, stage: AgentStage): readonly AgentExecutor[] {
  const observe = async (stdout: string) => {
    await appendFile(join(home, "synthetic-executions.log"), "execution\n");
    if (stage === "after-execution") process.exit(73);
    return {
      stdout,
      stderr: "",
      exitCode: 0,
      timedOut: false,
      processTreeTerminated: false,
      outputLimitExceeded: false,
      streamEncodingInvalid: false,
      lingeringProcesses: false,
      workspaceWritten: false,
    };
  };
  const planned = (invocation: {
    executable: string;
    args: readonly string[];
    cwd: string;
    stdin: string;
  }) => ({
    inputDigest: digest(invocation.stdin),
    invocationDigest: digest(
      JSON.stringify({
        executable: invocation.executable,
        args: invocation.args,
        cwd: invocation.cwd,
      }),
    ),
  });
  const codex = new CodexAgentAdapter(() => observe(codexOutput(stage)));
  const claude = new ClaudeCodeAgentAdapter(() => observe(claudeOutput()));
  return [
    {
      kind: "CODEX_CLI",
      qualification: "codex-cli-synthetic-runner",
      plan: (request) =>
        planned(
          buildCodexAgentInvocation({
            ...request,
            isolatedWorkspace: WORKSPACE,
          }),
        ),
      execute: async (request) => {
        const result = await codex.execute({
          ...request,
          isolatedWorkspace: WORKSPACE,
        });
        return result.kind === "COMPLETED"
          ? { kind: "COMPLETED", text: result.text, reportedModel: null }
          : result;
      },
    },
    {
      kind: "CLAUDE_CODE",
      qualification: "claude-code-synthetic-runner",
      plan: (request) =>
        planned(
          buildClaudeCodeAgentInvocation({
            ...request,
            isolatedWorkspace: WORKSPACE,
          }),
        ),
      execute: async (request) => {
        const result = await claude.execute({
          ...request,
          isolatedWorkspace: WORKSPACE,
        });
        // The alias requested stays the alias recorded; nothing is deduced.
        return result.kind === "COMPLETED"
          ? { kind: "COMPLETED", text: result.text, reportedModel: null }
          : result;
      },
    },
  ];
}

export function agentTurn(
  home: string,
  stage: AgentStage = "normal",
  kind: "CODEX_CLI" | "CLAUDE_CODE" = "CODEX_CLI",
) {
  const general = agentGeneral(home);
  const agentAttempts = new AgentAttempts(new JsonAgentAttemptStore(home));
  const execution = new AgentExecution({
    attempts: agentAttempts,
    executors: executors(home, stage),
  });
  const registry = new JsonConversationTurnRegistry(
    home,
    conversationTurnRecovery(
      {
        conversations: {
          projects: async () => [],
          sessions: { list: async () => [] },
          notes: { list: () => general.list() },
          workItems: { list: async () => [] },
        },
        general,
      },
      new ModelAttempts(new JsonModelAttemptStore(home)),
      agentAttempts,
    ),
  );
  return new ConversationTurn({
    scopes: {
      resolve: async (conversationId) => ({
        conversationId,
        projectId: null,
        workItemId: null,
        handoffId: null,
      }),
    },
    idempotency: registry,
    executor: {
      execute: async (turn, bound): Promise<ConversationTurnResult> => {
        const scopeId = `general-${digest(turn.scope.conversationId)}`;
        const prepared = execution.prepare({
          scopeId,
          targetId: turn.request.targetId,
          kind,
          model: kind === "CLAUDE_CODE" ? "sonnet" : "synthetic-codex-model",
          text: turn.request.userText,
          bindingDigest: BINDING,
          preflightAuditEventHash: "a".repeat(64),
          timeoutMs: 30_000,
        });
        const outcome = await execution.confirm(
          prepared.authorizationId,
          scopeId,
          async () => BINDING,
          bound.bindAttempt,
        );
        if (outcome.kind === "REFUSED_BEFORE_EXECUTION")
          return {
            kind: "REFUSED_BEFORE_EXPOSURE",
            reason: "LOCAL_EVIDENCE_UNAVAILABLE",
          };
        if (outcome.kind === "UNKNOWN_AFTER_EXECUTION")
          return {
            kind: "UNKNOWN_AFTER_EXPOSURE",
            attemptId: outcome.attemptId,
          };
        try {
          if (stage === "save-fails") throw new Error("synthetic save failure");
          if (stage === "before-append") process.exit(73);
          const conversation = await general.show(turn.scope.conversationId);
          const updated = await general.appendTurn({
            conversationId: conversation.id,
            expectedEventCount: conversation.events.length,
            userText: turn.request.userText,
            assistantText: outcome.text,
            attemptId: outcome.attemptId,
            displayName: kind === "CLAUDE_CODE" ? "Claude Code" : "Codex",
            model: kind === "CLAUDE_CODE" ? "sonnet" : "synthetic-codex-model",
            targetId: turn.request.targetId,
          });
          if (stage === "after-append") process.exit(73);
          const event = updated.events.at(-1)!;
          return {
            kind: "COMPLETED",
            assistantMessageId: event.id,
            effectiveModel: kind === "CLAUDE_CODE" ? "Claude Code" : "Codex",
            text: outcome.text,
            occurredAt: event.occurredAt,
          };
        } catch {
          return {
            kind: "RESPONSE_WITHHELD",
            attemptId: outcome.attemptId,
            reason: "SAVE_FAILED",
          };
        }
      },
    },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const home = process.argv[2]!;
  const stage = process.argv[3]! as AgentStage;
  // Fault injection is confined to this synthetic child. Each hook exits only
  // after the preceding real store operation has finished its durable writes.
  const prepare = JsonAgentAttemptStore.prototype.prepare;
  if (stage === "after-link" || stage === "after-prepare")
    mock.method(
      JsonAgentAttemptStore.prototype,
      "prepare",
      async function (
        this: JsonAgentAttemptStore,
        input: Parameters<typeof prepare>[0],
      ) {
        if (stage === "after-link") process.exit(73);
        await prepare.call(this, input);
        process.exit(73);
      },
    );
  const transition = JsonAgentAttemptStore.prototype.transition;
  if (stage === "after-execution-claim")
    mock.method(
      JsonAgentAttemptStore.prototype,
      "transition",
      async function (
        this: JsonAgentAttemptStore,
        ...args: Parameters<typeof transition>
      ) {
        const result = await transition.apply(this, args);
        if (result.state === "EXECUTION_STARTED") process.exit(73);
        return result;
      },
    );
  const result = await agentTurn(home, stage).run(agentRequest);
  process.stdout.write(JSON.stringify(result));
}
