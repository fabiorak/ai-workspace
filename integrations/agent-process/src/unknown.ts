/**
 * Why an agent run's outcome is unknown, without any of its content (ADR-0049
 * amendment). The coordinator validates the same closed list again before it
 * reaches the attempt record, so an adapter cannot widen it.
 */
export const AGENT_UNKNOWN_REASONS = Object.freeze([
  "RUNNER_FAILED",
  "TIMED_OUT",
  "OUTPUT_LIMIT",
  "STREAM_ENCODING",
  "LINGERING_PROCESS",
  "WORKSPACE_WRITTEN",
  "EXIT_CODE",
  "MALFORMED_EVENT",
  "UNEXPECTED_EVENT",
  "CONTEXT_LOADED",
  "ERROR_RESULT",
  "NO_ANSWER",
  "UNRESOLVED",
] as const);

export type AgentUnknownReason = (typeof AGENT_UNKNOWN_REASONS)[number];

export type AgentUnknownOutcome = Readonly<{
  kind: "UNKNOWN_AFTER_EXECUTION";
  reason: AgentUnknownReason;
  /** Only the product's event type, such as `system/status`; never text. */
  unexpectedEvent: string | null;
}>;

/**
 * Identifier-like segments only, so a value can name an event type but cannot
 * carry a sentence, a path or a payload.
 */
const EVENT_NAME = /^[a-z][a-z0-9_.-]{0,47}(?:\/[a-z][a-z0-9_.-]{0,47}){0,2}$/u;

/** Joins the type parts the product declared; anything else becomes null. */
export function agentEventName(...parts: readonly unknown[]): string | null {
  const present = parts.filter((part) => part !== undefined && part !== null);
  if (present.some((part) => typeof part !== "string")) return null;
  const name = present.join("/");
  return EVENT_NAME.test(name) ? name : null;
}

export function validAgentEventName(value: unknown): value is string {
  return typeof value === "string" && EVENT_NAME.test(value);
}

export function unknownOutcome(
  reason: AgentUnknownReason,
  unexpectedEvent: string | null = null,
): AgentUnknownOutcome {
  return Object.freeze({
    kind: "UNKNOWN_AFTER_EXECUTION",
    reason,
    unexpectedEvent: reason === "UNEXPECTED_EVENT" ? unexpectedEvent : null,
  });
}

/**
 * The process-level checks both adapters apply before reading a single event,
 * in a fixed order, so the first failing check names the outcome.
 */
export function observationUnknown(
  value: unknown,
  maxStreamBytes: number,
): AgentUnknownOutcome | null {
  if (!validObservation(value)) return unknownOutcome("RUNNER_FAILED");
  if (
    value.outputLimitExceeded ||
    Buffer.byteLength(value.stdout, "utf8") > maxStreamBytes ||
    Buffer.byteLength(value.stderr, "utf8") > maxStreamBytes
  )
    return unknownOutcome("OUTPUT_LIMIT");
  if (
    value.streamEncodingInvalid ||
    !value.stdout.isWellFormed() ||
    !value.stderr.isWellFormed()
  )
    return unknownOutcome("STREAM_ENCODING");
  if (
    value.lingeringProcesses ||
    (value.timedOut && !value.processTreeTerminated)
  )
    return unknownOutcome("LINGERING_PROCESS");
  if (value.workspaceWritten) return unknownOutcome("WORKSPACE_WRITTEN");
  if (value.timedOut) return unknownOutcome("TIMED_OUT");
  if (value.exitCode !== 0) return unknownOutcome("EXIT_CODE");
  return null;
}

type Observation = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  processTreeTerminated: boolean;
  outputLimitExceeded: boolean;
  streamEncodingInvalid: boolean;
  lingeringProcesses: boolean;
  workspaceWritten: boolean;
}>;

function validObservation(value: unknown): value is Observation {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.stdout === "string" &&
    typeof candidate.stderr === "string" &&
    (candidate.exitCode === null || Number.isInteger(candidate.exitCode)) &&
    typeof candidate.timedOut === "boolean" &&
    typeof candidate.processTreeTerminated === "boolean" &&
    typeof candidate.outputLimitExceeded === "boolean" &&
    typeof candidate.streamEncodingInvalid === "boolean" &&
    typeof candidate.lingeringProcesses === "boolean" &&
    typeof candidate.workspaceWritten === "boolean"
  );
}
