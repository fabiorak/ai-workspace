import { createHash } from "node:crypto";

export { createClaudeCodeAgentProcessRunner } from "./process-runner.ts";
export type { ClaudeCodeAgentProcessRunnerOptions } from "./process-runner.ts";

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_STREAM_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;

/**
 * ADR-0045 names the stable alias the first Claude Code target uses. It travels
 * in argv rather than being resolved here, so the alias a person reads in the
 * target is the alias the process receives.
 */
export const CLAUDE_CODE_DEFAULT_MODEL = "sonnet";

/** One reply, no tools, no file reads. Product and account instructions may
 * still exist, which is why the boundary never claims the supplied text is the
 * complete model-visible input. */
export const CLAUDE_CODE_SYSTEM_PROMPT =
  "Answer the supplied request in one reply. Use no tools, read no files and run no commands.";

/** The answer comes back as data, so a truncated or decorated reply is a parse
 * failure here instead of a sentence that looks like an answer. */
export const CLAUDE_CODE_ANSWER_SCHEMA =
  '{"type":"object","required":["answer"],"properties":{"answer":{"type":"string"}},"additionalProperties":false}';

/** Strictly empty, and strict about being empty: no server may be discovered
 * from user or project configuration. */
const EMPTY_MCP_CONFIG = '{"mcpServers":{}}';
const MAX_BUDGET_USD = "0.05";

/** The one initialization event must load none of these. A non-empty list is a
 * context this boundary did not review, so it fails closed rather than counting
 * as a plain answer. */
const LOADED_CONTEXT_KEYS = Object.freeze([
  "tools",
  "mcp_servers",
  "plugins",
  "hooks",
  "skills",
  "memory",
] as const);

export type ClaudeCodeAgentInvocation = Readonly<{
  executable: "claude";
  args: readonly string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
}>;

export type ClaudeCodeAgentObservation = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  processTreeTerminated: boolean;
  outputLimitExceeded: boolean;
  streamEncodingInvalid: boolean;
}>;

export type ClaudeCodeAgentRunner = (
  invocation: ClaudeCodeAgentInvocation,
) => Promise<ClaudeCodeAgentObservation>;

export type ClaudeCodeAgentResult =
  | Readonly<{
      kind: "COMPLETED";
      text: string;
      model: string;
      invocationDigest: string;
      inputDigest: string;
      eventCount: number;
    }>
  | Readonly<{ kind: "REJECTED_BEFORE_EXECUTION" }>
  | Readonly<{ kind: "UNKNOWN_AFTER_EXECUTION" }>;

export class ClaudeCodeAgentError extends Error {
  public constructor() {
    super("The bounded Claude Code agent invocation is invalid.");
    this.name = "ClaudeCodeAgentError";
  }
}

/**
 * This adapter owns argv/stdin/output validation only. The injected runner owns
 * process creation and tree cancellation; no default runner can touch a login.
 *
 * Managed login is the point: the subscription authorizes the product, and the
 * product owns its own credential. `--bare` is therefore never built here,
 * because it skips the OAuth and keychain reads that login depends on and would
 * need an API key instead (ADR-0045).
 */
export class ClaudeCodeAgentAdapter {
  readonly #runner: ClaudeCodeAgentRunner;
  public constructor(runner: ClaudeCodeAgentRunner) {
    this.#runner = runner;
  }

  public async execute(input: {
    model?: string;
    text: string;
    isolatedWorkspace: string;
    timeoutMs: number;
  }): Promise<ClaudeCodeAgentResult> {
    let invocation: ClaudeCodeAgentInvocation;
    let model: string;
    try {
      model = input.model ?? CLAUDE_CODE_DEFAULT_MODEL;
      invocation = buildClaudeCodeAgentInvocation({ ...input, model });
    } catch {
      return { kind: "REJECTED_BEFORE_EXECUTION" };
    }
    let observation: ClaudeCodeAgentObservation;
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
      model,
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

export function buildClaudeCodeAgentInvocation(input: {
  model?: string;
  text: string;
  isolatedWorkspace: string;
  timeoutMs: number;
}): ClaudeCodeAgentInvocation {
  const model = input.model ?? CLAUDE_CODE_DEFAULT_MODEL;
  if (
    !bounded(model, 256) ||
    !input.text.trim() ||
    !input.text.isWellFormed() ||
    Buffer.byteLength(input.text, "utf8") > MAX_INPUT_BYTES ||
    !bounded(input.isolatedWorkspace, 4096) ||
    !input.isolatedWorkspace.startsWith("/") ||
    !Number.isInteger(input.timeoutMs) ||
    input.timeoutMs < 1 ||
    input.timeoutMs > 120_000
  )
    throw new ClaudeCodeAgentError();
  return Object.freeze({
    executable: "claude" as const,
    args: Object.freeze([
      "-p",
      "--safe-mode",
      "--tools",
      "",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      CLAUDE_CODE_ANSWER_SCHEMA,
      "--system-prompt",
      CLAUDE_CODE_SYSTEM_PROMPT,
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      EMPTY_MCP_CONFIG,
      "--permission-mode",
      "dontAsk",
      "--max-budget-usd",
      MAX_BUDGET_USD,
      "--model",
      model,
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
  let initialized = false;
  let result: string | null = null;
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return null;
    }
    if (!record(value) || typeof value.type !== "string" || result !== null)
      return null;
    if (value.type === "system") {
      if (value.subtype !== "init" || initialized) return null;
      for (const key of LOADED_CONTEXT_KEYS) {
        const loaded = value[key];
        if (loaded === undefined) continue;
        if (!Array.isArray(loaded) || loaded.length > 0) return null;
      }
      initialized = true;
      continue;
    }
    if (value.type === "assistant") {
      if (!Array.isArray(value.content)) return null;
      // A tool call, a thinking block or anything else means the turn did more
      // than answer, which this boundary is not qualified to report.
      for (const block of value.content)
        if (!record(block) || block.type !== "text") return null;
      continue;
    }
    if (value.type === "result") {
      if (
        value.subtype !== "success" ||
        typeof value.result !== "string" ||
        !value.result.isWellFormed()
      )
        return null;
      result = value.result;
      continue;
    }
    // `retry` included: an automatic rerun is never accepted as a plain answer.
    return null;
  }
  if (!initialized || result === null) return null;
  const answer = schemaValidAnswer(result);
  return answer === null ? null : { text: answer, eventCount: lines.length };
}

/** The result carries the schema-valid object, not prose about it. */
function schemaValidAnswer(result: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(result);
  } catch {
    return null;
  }
  if (
    !record(value) ||
    Object.keys(value).length !== 1 ||
    typeof value.answer !== "string" ||
    !value.answer.trim() ||
    !value.answer.isWellFormed() ||
    Buffer.byteLength(value.answer, "utf8") > MAX_OUTPUT_BYTES
  )
    return null;
  return value.answer;
}

const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const boundedStream = (value: string) =>
  value.isWellFormed() && Buffer.byteLength(value, "utf8") <= MAX_STREAM_BYTES;
const bounded = (value: string, maximum: number) =>
  typeof value === "string" &&
  value.trim() === value &&
  value.length > 0 &&
  Buffer.byteLength(value, "utf8") <= maximum &&
  !/\p{Cc}/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function validObservation(value: unknown): value is ClaudeCodeAgentObservation {
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
