import { createHash } from "node:crypto";

import {
  agentEnvironment,
  createConfinedWorkspace,
  locateExecutable,
  privateDirectory,
  qualifyExecutable,
  releaseConfinedWorkspace,
  runAgentProcess,
  type AgentConfigVariable,
  type ExecutableIdentity,
  type QualifiedExecutable,
} from "@ai-workspace/agent-process";
import type { AgentExecutionKind } from "@ai-workspace/agent-execution";
import {
  buildClaudeCodeAgentInvocation,
  ClaudeCodeAgentAdapter,
  createClaudeCodeAgentProcessRunner,
  parseClaudeCodeVersion,
  QUALIFIED_CLAUDE_CODE_EXECUTABLES,
} from "@ai-workspace/claude-code-agent";
import {
  buildCodexAgentInvocation,
  CodexAgentAdapter,
  createCodexAgentProcessRunner,
  parseCodexVersion,
  QUALIFIED_CODEX_EXECUTABLES,
} from "@ai-workspace/codex-agent";

import type { HostedAgentExecutor } from "./execution-host.ts";

export type AgentExecutionEnvironment = Readonly<{
  AI_WORKSPACE_AGENT_EXECUTION?: string;
  AI_WORKSPACE_AGENT_RUN_ROOT?: string;
  AI_WORKSPACE_AGENT_PATH?: string;
  AI_WORKSPACE_CODEX_LOGIN_DIR?: string;
  AI_WORKSPACE_CLAUDE_LOGIN_DIR?: string;
}>;

export type AgentExecutorReport = Readonly<{
  kind: AgentExecutionKind;
  outcome: "OFFERED" | "NOT_QUALIFIED";
  reason: string | null;
}>;

type Product = Readonly<{
  name: "codex" | "claude";
  configVariable: AgentConfigVariable;
  loginVariable: keyof AgentExecutionEnvironment;
  parseVersion: (output: string) => string | null;
  reviewed: readonly QualifiedExecutable[];
}>;

const PRODUCTS: Readonly<Record<AgentExecutionKind, Product>> = Object.freeze({
  CODEX_CLI: {
    name: "codex",
    configVariable: "CODEX_HOME",
    loginVariable: "AI_WORKSPACE_CODEX_LOGIN_DIR",
    parseVersion: parseCodexVersion,
    reviewed: QUALIFIED_CODEX_EXECUTABLES,
  },
  CLAUDE_CODE: {
    name: "claude",
    configVariable: "CLAUDE_CONFIG_DIR",
    loginVariable: "AI_WORKSPACE_CLAUDE_LOGIN_DIR",
    parseVersion: parseClaudeCodeVersion,
    reviewed: QUALIFIED_CLAUDE_CODE_EXECUTABLES,
  },
});

/** Stands for the per-run directory in the planned invocation digest. */
const PLANNED_WORKSPACE = "/ai-workspace-confined-run/work";
const VERSION_TIMEOUT_MS = 10_000;

/**
 * Real agent execution is an exact process-level opt-in (ADR-0050). Without
 * `AI_WORKSPACE_AGENT_EXECUTION` nothing is read or located. With it, each
 * named kind is offered only if its installed file is on the adapter's
 * reviewed list: the digest is compared first, so an unreviewed file is never
 * started, not even for `--version`. Codex ships one reviewed release; the
 * Claude Code list is empty.
 */
export async function agentExecutorsFromEnvironment(
  environment: AgentExecutionEnvironment,
  reviewed: Partial<
    Record<AgentExecutionKind, readonly QualifiedExecutable[]>
  > = {},
): Promise<
  Readonly<{
    executors: readonly HostedAgentExecutor[];
    report: readonly AgentExecutorReport[];
  }>
> {
  const requested = environment.AI_WORKSPACE_AGENT_EXECUTION;
  if (requested === undefined)
    return Object.freeze({ executors: [], report: [] });
  const kinds = [...new Set(requested.split(","))];
  if (
    kinds.length === 0 ||
    kinds.some((kind) => !Object.hasOwn(PRODUCTS, kind))
  )
    throw new Error(
      "AI_WORKSPACE_AGENT_EXECUTION must list CODEX_CLI and/or CLAUDE_CODE.",
    );
  const root = environment.AI_WORKSPACE_AGENT_RUN_ROOT ?? "";
  await privateDirectory(root, "AI_WORKSPACE_AGENT_RUN_ROOT");
  const searchPath = (environment.AI_WORKSPACE_AGENT_PATH ?? "")
    .split(":")
    .filter(Boolean);
  const executors: HostedAgentExecutor[] = [];
  const report: AgentExecutorReport[] = [];
  for (const kind of kinds as AgentExecutionKind[]) {
    const product = PRODUCTS[kind];
    const list = reviewed[kind] ?? product.reviewed;
    const login = environment[product.loginVariable] ?? "";
    const located = await locateExecutable(product.name, searchPath);
    const refuse = (reason: string) =>
      report.push(Object.freeze({ kind, outcome: "NOT_QUALIFIED", reason }));
    if (typeof located === "string") {
      refuse(located);
      continue;
    }
    if (!list.some((entry) => entry.sha256 === located.sha256)) {
      refuse("DIGEST_NOT_QUALIFIED");
      continue;
    }
    const confined = async () => {
      const workspace = await createConfinedWorkspace(root);
      return {
        workspace,
        environment: await agentEnvironment({
          workspace,
          configVariable: product.configVariable,
          configDirectory: login,
          searchPath,
        }),
      };
    };
    const probe = await confined();
    let versionOutput: string | null = null;
    try {
      const observed = await runAgentProcess({
        executable: located,
        args: ["--version"],
        cwd: probe.workspace.work,
        stdin: "",
        timeoutMs: VERSION_TIMEOUT_MS,
        environment: probe.environment,
      });
      if (
        observed.exitCode === 0 &&
        !observed.timedOut &&
        !observed.lingeringProcesses
      )
        versionOutput = observed.stdout;
    } finally {
      await releaseConfinedWorkspace(probe.workspace);
    }
    const qualification = qualifyExecutable(
      located,
      versionOutput,
      product.parseVersion,
      list,
    );
    if (qualification.kind !== "QUALIFIED") {
      refuse(qualification.reason);
      continue;
    }
    executors.push(
      hostedExecutor(kind, located, qualification.version, confined),
    );
    report.push(Object.freeze({ kind, outcome: "OFFERED", reason: null }));
  }
  return Object.freeze({
    executors: Object.freeze(executors),
    report: Object.freeze(report),
  });
}

function hostedExecutor(
  kind: AgentExecutionKind,
  executable: ExecutableIdentity,
  version: string,
  confined: () => Promise<
    Readonly<{
      workspace: Awaited<ReturnType<typeof createConfinedWorkspace>>;
      environment: Awaited<ReturnType<typeof agentEnvironment>>;
    }>
  >,
): HostedAgentExecutor {
  const build =
    kind === "CODEX_CLI"
      ? buildCodexAgentInvocation
      : buildClaudeCodeAgentInvocation;
  return Object.freeze({
    kind,
    launch: "AVAILABLE",
    qualification: `${kind}:${version}:${executable.sha256.slice(0, 16)}`,
    plan: (request) => {
      const invocation = build({
        ...request,
        isolatedWorkspace: PLANNED_WORKSPACE,
      });
      return {
        inputDigest: digest(invocation.stdin),
        invocationDigest: digest(
          JSON.stringify({
            executable: executable.sha256,
            args: invocation.args,
          }),
        ),
      };
    },
    execute: async (request) => {
      const run = await confined();
      try {
        const options = { executable, environment: run.environment };
        const input = { ...request, isolatedWorkspace: run.workspace.work };
        const result =
          kind === "CODEX_CLI"
            ? await new CodexAgentAdapter(
                createCodexAgentProcessRunner(options),
              ).execute(input)
            : await new ClaudeCodeAgentAdapter(
                createClaudeCodeAgentProcessRunner(options),
              ).execute(input);
        // The requested alias stays the record; the product reports no model.
        return result.kind === "COMPLETED"
          ? { kind: "COMPLETED", text: result.text, reportedModel: null }
          : result;
      } finally {
        await releaseConfinedWorkspace(run.workspace);
      }
    },
  });
}

const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
