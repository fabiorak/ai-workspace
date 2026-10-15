import { createHash } from "node:crypto";

export { createCodexAgentProcessRunner } from "./process-runner.ts";
export type { CodexAgentProcessRunnerOptions } from "./process-runner.ts";
export * from "./compatibility.ts";

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_STREAM_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const ANNOUNCED_ITEMS: ReadonlySet<unknown> = new Set([
  "agent_message",
  "reasoning",
]);

/**
 * Product features turned off for an answer-only run. Each name was checked
 * on the reviewed release: `features list` with these options reports every
 * one as off. `unified_exec` is absent on purpose: that release keeps it on
 * despite `--disable`, so command execution stays possible and voids the
 * answer through the event check instead.
 */
export const CODEX_DISABLED_FEATURES: readonly string[] = Object.freeze([
  "shell_tool",
  "unified_exec_tty",
  "shell_snapshot",
  "view_image",
  "apps",
  "plugins",
  "remote_plugin",
  "hooks",
  "skill_search",
  "skill_mcp_dependency_install",
  "workspace_dependencies",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "computer_use",
  "in_app_browser",
  "multi_agent",
  "image_generation",
  "tool_suggest",
  "sleep_tool",
  "goals",
  "daemon_auto_start",
  "unbounded_connection_retries",
]);

export type CodexAgentInvocation = Readonly<{
  executable: "codex";
  args: readonly string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
}>;

export type CodexAgentObservation = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  processTreeTerminated: boolean;
  outputLimitExceeded: boolean;
  streamEncodingInvalid: boolean;
  /** A descendant outlived the leader or held its streams (ADR-0050). */
  lingeringProcesses: boolean;
  /** An answer-only run left files in its workspace (ADR-0050). */
  workspaceWritten: boolean;
}>;

export type CodexAgentRunner = (
  invocation: CodexAgentInvocation,
) => Promise<CodexAgentObservation>;

export type CodexAgentResult =
  | Readonly<{
      kind: "COMPLETED";
      text: string;
      invocationDigest: string;
      inputDigest: string;
      eventCount: number;
    }>
  | Readonly<{ kind: "REJECTED_BEFORE_EXECUTION" }>
  | Readonly<{ kind: "UNKNOWN_AFTER_EXECUTION" }>;

export class CodexAgentError extends Error {
  public constructor() {
    super("The bounded Codex agent invocation is invalid.");
    this.name = "CodexAgentError";
  }
}

/** This adapter owns argv/stdin/output validation only. The injected runner owns
 * process creation and tree cancellation; no default runner can touch a login. */
export class CodexAgentAdapter {
  readonly #runner: CodexAgentRunner;
  public constructor(runner: CodexAgentRunner) {
    this.#runner = runner;
  }

  public async execute(input: {
    model: string;
    text: string;
    isolatedWorkspace: string;
    timeoutMs: number;
  }): Promise<CodexAgentResult> {
    let invocation: CodexAgentInvocation;
    try {
      invocation = buildCodexAgentInvocation(input);
    } catch {
      return { kind: "REJECTED_BEFORE_EXECUTION" };
    }
    let observation: CodexAgentObservation;
    try {
      observation = await this.#runner(invocation);
    } catch {
      return { kind: "UNKNOWN_AFTER_EXECUTION" };
    }
    if (
      !validObservation(observation) ||
      !boundedStream(observation.stdout) ||
      !boundedStream(observation.stderr) ||
      observation.outputLimitExceeded ||
      observation.streamEncodingInvalid ||
      observation.lingeringProcesses ||
      observation.workspaceWritten ||
      (observation.timedOut && !observation.processTreeTerminated)
    )
      return { kind: "UNKNOWN_AFTER_EXECUTION" };
    if (observation.timedOut) return { kind: "UNKNOWN_AFTER_EXECUTION" };
    if (observation.exitCode !== 0) return { kind: "UNKNOWN_AFTER_EXECUTION" };
    const parsed = finalAnswer(observation.stdout);
    if (parsed === null) return { kind: "UNKNOWN_AFTER_EXECUTION" };
    return Object.freeze({
      kind: "COMPLETED" as const,
      text: parsed.text,
      invocationDigest: digest(
        JSON.stringify({
          executable: invocation.executable,
          args: invocation.args,
          cwd: invocation.cwd,
        }),
      ),
      inputDigest: digest(invocation.stdin),
      eventCount: parsed.eventCount,
    });
  }
}

export function buildCodexAgentInvocation(input: {
  model: string;
  text: string;
  isolatedWorkspace: string;
  timeoutMs: number;
}): CodexAgentInvocation {
  if (
    !bounded(input.model, 256) ||
    !input.text.trim() ||
    !input.text.isWellFormed() ||
    Buffer.byteLength(input.text, "utf8") > MAX_INPUT_BYTES ||
    !bounded(input.isolatedWorkspace, 4096) ||
    !input.isolatedWorkspace.startsWith("/") ||
    !Number.isInteger(input.timeoutMs) ||
    input.timeoutMs < 1 ||
    input.timeoutMs > 120_000
  )
    throw new CodexAgentError();
  return Object.freeze({
    executable: "codex" as const,
    args: Object.freeze([
      // Never attach to, or leave behind, the shared local app-server daemon.
      "--no-daemon",
      ...CODEX_DISABLED_FEATURES.flatMap((feature) => ["--disable", feature]),
      "--ask-for-approval",
      "never",
      "exec",
      "--ephemeral",
      "--json",
      "--sandbox",
      "read-only",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--model",
      input.model,
      "--cd",
      input.isolatedWorkspace,
      "-",
    ]),
    cwd: input.isolatedWorkspace,
    stdin: input.text,
    timeoutMs: input.timeoutMs,
  });
}

function finalAnswer(
  stdout: string,
): { text: string; eventCount: number } | null {
  const lines = stdout.split("\n").filter(Boolean);
  let text: string | null = null;
  let completed = false;
  let threadStarted = false;
  let turnStarted = false;
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return null;
    }
    if (!record(value) || typeof value.type !== "string" || completed)
      return null;
    if (value.type === "thread.started") {
      if (threadStarted || !boundedValue(value.thread_id, 256)) return null;
      threadStarted = true;
      continue;
    }
    if (value.type === "turn.started") {
      if (turnStarted) return null;
      turnStarted = true;
      continue;
    }
    if (value.type === "turn.completed") {
      if (text === null) return null;
      completed = true;
      continue;
    }
    // Reasoning is discarded unread, never stored or shown; only the two
    // answer-only item types may announce themselves. Any command, file,
    // tool, search, plan or unknown item still voids the answer.
    if (value.type === "item.started") {
      if (!record(value.item) || !ANNOUNCED_ITEMS.has(value.item.type))
        return null;
      continue;
    }
    if (value.type === "item.completed") {
      if (!record(value.item)) return null;
      if (value.item.type === "reasoning") continue;
      if (value.item.type !== "agent_message") return null;
      if (
        text !== null ||
        typeof value.item.text !== "string" ||
        !value.item.text.trim() ||
        !value.item.text.isWellFormed() ||
        Buffer.byteLength(value.item.text, "utf8") > MAX_OUTPUT_BYTES
      )
        return null;
      text = value.item.text;
      continue;
    }
    return null;
  }
  return completed && text !== null ? { text, eventCount: lines.length } : null;
}

const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const boundedStream = (value: string) =>
  value.isWellFormed() && Buffer.byteLength(value, "utf8") <= MAX_STREAM_BYTES;
const boundedValue = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.isWellFormed() &&
  Buffer.byteLength(value, "utf8") <= maximum;
const bounded = (value: string, maximum: number) =>
  typeof value === "string" &&
  value.trim() === value &&
  value.length > 0 &&
  Buffer.byteLength(value, "utf8") <= maximum &&
  !/\p{Cc}/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function validObservation(value: unknown): value is CodexAgentObservation {
  if (!record(value)) return false;
  return (
    typeof value.stdout === "string" &&
    typeof value.stderr === "string" &&
    (value.exitCode === null || Number.isInteger(value.exitCode)) &&
    typeof value.timedOut === "boolean" &&
    typeof value.processTreeTerminated === "boolean" &&
    typeof value.outputLimitExceeded === "boolean" &&
    typeof value.streamEncodingInvalid === "boolean" &&
    typeof value.lingeringProcesses === "boolean" &&
    typeof value.workspaceWritten === "boolean"
  );
}
