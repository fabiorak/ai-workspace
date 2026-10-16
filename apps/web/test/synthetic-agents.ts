import { createHash } from "node:crypto";

import {
  buildClaudeCodeAgentInvocation,
  ClaudeCodeAgentAdapter,
  type ClaudeCodeAgentObservation,
} from "@ai-workspace/claude-code-agent";
import {
  buildCodexAgentInvocation,
  CodexAgentAdapter,
  type CodexAgentObservation,
} from "@ai-workspace/codex-agent";

import type { HostedAgentExecutor } from "../src/execution-host.ts";

/**
 * Synthetic Codex and Claude Code executors for tests and the offline demo.
 * The real adapters parse and validate; only the process observation is made
 * up here, and no program is started. They declare themselves SIMULATED.
 */
const WORKSPACE = "/nonexistent/ai-workspace-synthetic-agent-run";
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const clean = {
  stderr: "",
  exitCode: 0,
  timedOut: false,
  processTreeTerminated: false,
  outputLimitExceeded: false,
  streamEncodingInvalid: false,
  lingeringProcesses: false,
  workspaceWritten: false,
};

export type SyntheticAgentLog = {
  stdin: string[];
  models: string[];
  mode: "ANSWER" | "BROKEN";
};

export function syntheticAgents(log: SyntheticAgentLog) {
  const echo = (stdin: string, name: string) =>
    `${name} answer${/\[\[EMAIL_1\]\]/u.test(stdin) ? " for [[EMAIL_1]]" : ""}`;
  const codex: HostedAgentExecutor = {
    kind: "CODEX_CLI",
    launch: "SIMULATED",
    qualification: "codex-cli-synthetic-n7",
    plan: (request) => {
      const invocation = buildCodexAgentInvocation({
        ...request,
        isolatedWorkspace: WORKSPACE,
      });
      return {
        inputDigest: digest(invocation.stdin),
        invocationDigest: digest(JSON.stringify(invocation.args)),
      };
    },
    execute: async (request) => {
      const result = await new CodexAgentAdapter(
        async (invocation): Promise<CodexAgentObservation> => {
          log.stdin.push(invocation.stdin);
          const text = echo(invocation.stdin, "Synthetic Codex");
          return {
            ...clean,
            stdout:
              log.mode === "BROKEN"
                ? `{"type":"item.completed","item":{"type":"agent_message","text":"partial"}}\n`
                : `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } })}\n{"type":"turn.completed"}\n`,
          };
        },
      ).execute({ ...request, isolatedWorkspace: WORKSPACE });
      return result.kind === "COMPLETED"
        ? { kind: "COMPLETED", text: result.text, reportedModel: null }
        : result;
    },
  };
  const claude: HostedAgentExecutor = {
    kind: "CLAUDE_CODE",
    launch: "SIMULATED",
    qualification: "claude-code-synthetic-n7",
    plan: (request) => {
      const invocation = buildClaudeCodeAgentInvocation({
        ...request,
        isolatedWorkspace: WORKSPACE,
      });
      return {
        inputDigest: digest(invocation.stdin),
        invocationDigest: digest(JSON.stringify(invocation.args)),
      };
    },
    execute: async (request) => {
      const result = await new ClaudeCodeAgentAdapter(
        async (invocation): Promise<ClaudeCodeAgentObservation> => {
          log.stdin.push(invocation.stdin);
          log.models.push(invocation.args.at(-1) ?? "");
          const answer = echo(invocation.stdin, "Synthetic Claude");
          return {
            ...clean,
            stdout: [
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
                result: answer,
              },
            ]
              .map((event) => JSON.stringify(event))
              .join("\n"),
          };
        },
      ).execute({ ...request, isolatedWorkspace: WORKSPACE });
      return result.kind === "COMPLETED"
        ? { kind: "COMPLETED", text: result.text, reportedModel: null }
        : result;
    },
  };
  return [codex, claude];
}
