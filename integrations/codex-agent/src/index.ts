import { createHash } from "node:crypto";

export { createCodexAgentProcessRunner } from "./process-runner.ts";
export type { CodexAgentProcessRunnerOptions } from "./process-runner.ts";

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_STREAM_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;

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
    if (value.type === "item.completed") {
      if (!record(value.item) || value.item.type !== "agent_message")
        return null;
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
    typeof value.streamEncodingInvalid === "boolean"
  );
}
