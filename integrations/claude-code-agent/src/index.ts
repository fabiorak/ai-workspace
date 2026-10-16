import { createHash } from "node:crypto";

import {
  agentEventName,
  observationUnknown,
  unknownOutcome,
  type AgentUnknownOutcome,
} from "@ai-workspace/agent-process";

export { createClaudeCodeAgentProcessRunner } from "./process-runner.ts";
export type { ClaudeCodeAgentProcessRunnerOptions } from "./process-runner.ts";
export * from "./compatibility.ts";

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

/** Strictly empty, and strict about being empty: no server may be discovered
 * from user or project configuration. */
const EMPTY_MCP_CONFIG = '{"mcpServers":{}}';
const MAX_BUDGET_USD = "0.05";

/**
 * Events that carry no answer and are discarded unread: a quota notice, and the
 * product's own retry of a failed API request. That retry is transport inside
 * one send, not a second turn (ADR-0050), as for Codex's network retries.
 */
const DISCARDED_EVENT = "rate_limit_event";
const DISCARDED_SYSTEM_SUBTYPE = "api_retry";

/** Reasoning is discarded unread, never stored or shown, as for Codex and the
 * local model. Every other non-text block voids the answer. */
const DISCARDED_BLOCKS: ReadonlySet<unknown> = new Set([
  "thinking",
  "redacted_thinking",
]);

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
  /** A descendant outlived the leader or held its streams (ADR-0050). */
  lingeringProcesses: boolean;
  /** An answer-only run left files in its workspace (ADR-0050). */
  workspaceWritten: boolean;
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
  | AgentUnknownOutcome;

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
      return unknownOutcome("RUNNER_FAILED");
    }
    const failed = observationUnknown(observation, MAX_STREAM_BYTES);
    if (failed !== null) return failed;
    const parsed = finalAnswer(observation.stdout);
    if ("kind" in parsed) return parsed;
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
      "--restricted",
      "--tools",
      "",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--no-chrome",
      "--output-format",
      "stream-json",
      "--verbose",
      "--system-prompt",
      CLAUDE_CODE_SYSTEM_PROMPT,
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      EMPTY_MCP_CONFIG,
      "--permission-mode",
      "dontAsk",
      "--permission-prompts",
      "none",
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

/**
 * The first event that fails names the outcome. Only event types and subtypes
 * the product declared are kept, and only through `agentEventName`.
 */
function finalAnswer(
  stdout: string,
): { text: string; eventCount: number } | AgentUnknownOutcome {
  const lines = stdout.split("\n").filter(Boolean);
  let initialized = false;
  let result: string | null = null;
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return unknownOutcome("MALFORMED_EVENT");
    }
    if (!record(value) || typeof value.type !== "string")
      return unknownOutcome("MALFORMED_EVENT");
    if (result !== null)
      return unknownOutcome(
        "UNEXPECTED_EVENT",
        agentEventName(value.type, value.subtype),
      );
    if (value.type === DISCARDED_EVENT) continue;
    if (value.type === "system") {
      if (value.subtype === DISCARDED_SYSTEM_SUBTYPE) continue;
      if (value.subtype !== "init" || initialized)
        return unknownOutcome(
          "UNEXPECTED_EVENT",
          agentEventName(value.type, value.subtype),
        );
      for (const key of LOADED_CONTEXT_KEYS) {
        const loaded = value[key];
        if (loaded === undefined) continue;
        if (!Array.isArray(loaded) || loaded.length > 0)
          return unknownOutcome("CONTEXT_LOADED");
      }
      initialized = true;
      continue;
    }
    if (value.type === "assistant") {
      // A subagent's message, a failed message or a block other than text or
      // reasoning means the turn did more than answer, which this boundary is
      // not qualified to report.
      if (
        (value.parent_tool_use_id !== undefined &&
          value.parent_tool_use_id !== null) ||
        value.error !== undefined
      )
        return unknownOutcome("UNEXPECTED_EVENT", "assistant");
      if (!record(value.message) || !Array.isArray(value.message.content))
        return unknownOutcome("MALFORMED_EVENT");
      for (const block of value.message.content) {
        if (!record(block)) return unknownOutcome("MALFORMED_EVENT");
        if (DISCARDED_BLOCKS.has(block.type)) continue;
        if (block.type !== "text")
          return unknownOutcome(
            "UNEXPECTED_EVENT",
            agentEventName("assistant", block.type),
          );
      }
      continue;
    }
    if (value.type === "result") {
      if (
        value.subtype !== "success" ||
        value.is_error === true ||
        (value.permission_denials !== undefined &&
          (!Array.isArray(value.permission_denials) ||
            value.permission_denials.length > 0))
      )
        return unknownOutcome("ERROR_RESULT");
      if (
        typeof value.result !== "string" ||
        !value.result.trim() ||
        !value.result.isWellFormed() ||
        Buffer.byteLength(value.result, "utf8") > MAX_OUTPUT_BYTES
      )
        return unknownOutcome("NO_ANSWER");
      result = value.result;
      continue;
    }
    return unknownOutcome(
      "UNEXPECTED_EVENT",
      agentEventName(value.type, value.subtype),
    );
  }
  if (!initialized || result === null) return unknownOutcome("NO_ANSWER");
  return { text: result, eventCount: lines.length };
}

const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const bounded = (value: string, maximum: number) =>
  typeof value === "string" &&
  value.trim() === value &&
  value.length > 0 &&
  Buffer.byteLength(value, "utf8") <= maximum &&
  !/\p{Cc}/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
