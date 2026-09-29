import { createHash } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_TEXT = 256;

export const AGENT_ATTEMPT_SCHEMA_VERSION = 1 as const;
/** Each attempt appends two or three records; 256 keeps a scope document small. */
export const AGENT_ATTEMPT_RECORD_LIMIT = 256;
export const AGENT_ATTEMPT_EFFECT =
  "LOCAL_NON_CONTENT_AGENT_ATTEMPT_EVIDENCE_NOT_AGENT_TRUTH" as const;
export const AGENT_EXECUTION_KINDS = Object.freeze([
  "CODEX_CLI",
  "CLAUDE_CODE",
] as const);

export type AgentExecutionKind = (typeof AGENT_EXECUTION_KINDS)[number];

/**
 * ADR-0049. A process has no provider receipt, so there is no acknowledged
 * state: execution either produced a validated answer or its outcome is
 * unknown. A refusal is recorded only while no process was started.
 */
export type AgentAttemptState =
  | "PREPARED"
  | "REFUSED_BEFORE_EXECUTION"
  | "EXECUTION_STARTED"
  | "COMPLETED"
  | "UNKNOWN_AFTER_EXECUTION";

export type AgentAttemptInput = Readonly<{
  schemaVersion: typeof AGENT_ATTEMPT_SCHEMA_VERSION;
  /** The project, or the derived General scope, that owns the attempt. */
  scopeId: string;
  authorizationId: string;
  attemptId: string;
  executionClass: "AGENT_EXECUTION";
  kind: AgentExecutionKind;
  targetId: string;
  /** The qualified adapter and version the executor declares, never discovered. */
  qualification: string;
  inputDigest: string;
  invocationDigest: string;
  /** Selection, scope, policy, instructions, sources and protected text. */
  bindingDigest: string;
  preflightAuditEventHash: string;
  preparedAt: string;
}>;

export type AgentAttemptRecord = AgentAttemptInput &
  Readonly<{
    state: AgentAttemptState;
    revision: number;
    executionCount: 0 | 1;
    outputDigest: string | null;
    reportedModel: string | null;
    updatedAt: string;
    automaticRetryScheduled: false;
    predecessorRecordHash: string | null;
    recordHash: string;
    effect: typeof AGENT_ATTEMPT_EFFECT;
  }>;

export type AgentAttemptPatch = Readonly<
  Partial<
    Pick<
      AgentAttemptRecord,
      "state" | "executionCount" | "outputDigest" | "reportedModel"
    >
  > & { updatedAt: string }
>;

export type AgentAttemptSnapshot = Readonly<{
  schemaVersion: typeof AGENT_ATTEMPT_SCHEMA_VERSION;
  scopeId: string;
  revision: number;
  records: readonly AgentAttemptRecord[];
  effect: "LOCAL_AGENT_ATTEMPT_STORE_NOT_AGENT_EXECUTION";
}>;

export class AgentAttemptError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "Local agent attempt evidence is unavailable or integrity-invalid.",
      options,
    );
    this.name = "AgentAttemptError";
  }
}

const INPUT_KEYS = Object.freeze([
  "attemptId",
  "authorizationId",
  "bindingDigest",
  "executionClass",
  "inputDigest",
  "invocationDigest",
  "kind",
  "preflightAuditEventHash",
  "preparedAt",
  "qualification",
  "schemaVersion",
  "scopeId",
  "targetId",
]);
const RECORD_KEYS = Object.freeze([
  ...INPUT_KEYS,
  "automaticRetryScheduled",
  "effect",
  "executionCount",
  "outputDigest",
  "predecessorRecordHash",
  "recordHash",
  "reportedModel",
  "revision",
  "state",
  "updatedAt",
]);
const STATES: readonly AgentAttemptState[] = Object.freeze([
  "PREPARED",
  "REFUSED_BEFORE_EXECUTION",
  "EXECUTION_STARTED",
  "COMPLETED",
  "UNKNOWN_AFTER_EXECUTION",
]);
const NEXT: Readonly<Record<AgentAttemptState, readonly AgentAttemptState[]>> =
  Object.freeze({
    PREPARED: ["EXECUTION_STARTED", "REFUSED_BEFORE_EXECUTION"],
    REFUSED_BEFORE_EXECUTION: [],
    EXECUTION_STARTED: ["COMPLETED", "UNKNOWN_AFTER_EXECUTION"],
    COMPLETED: [],
    UNKNOWN_AFTER_EXECUTION: [],
  });

export function validateAgentAttemptInput(value: unknown): AgentAttemptInput {
  if (!record(value) || !exactKeys(value, INPUT_KEYS) || !validInput(value))
    throw new AgentAttemptError();
  return Object.freeze(pickInput(value));
}

export function validateAgentAttemptRecord(value: unknown): AgentAttemptRecord {
  if (
    !record(value) ||
    !exactKeys(value, RECORD_KEYS) ||
    !validInput(value) ||
    !STATES.includes(value.state as AgentAttemptState) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    ![0, 1].includes(value.executionCount as number) ||
    !nullableDigest(value.outputDigest) ||
    !(value.reportedModel === null || validText(value.reportedModel)) ||
    !validInstant(value.updatedAt) ||
    value.automaticRetryScheduled !== false ||
    !nullableDigest(value.predecessorRecordHash) ||
    !validDigest(value.recordHash) ||
    value.effect !== AGENT_ATTEMPT_EFFECT
  )
    throw new AgentAttemptError();
  const normalized: AgentAttemptRecord = Object.freeze({
    ...pickInput(value),
    state: value.state as AgentAttemptState,
    revision: value.revision as number,
    executionCount: value.executionCount as 0 | 1,
    outputDigest: value.outputDigest as string | null,
    reportedModel: value.reportedModel as string | null,
    updatedAt: value.updatedAt as string,
    automaticRetryScheduled: false,
    predecessorRecordHash: value.predecessorRecordHash as string | null,
    recordHash: value.recordHash,
    effect: AGENT_ATTEMPT_EFFECT,
  });
  const { recordHash, ...withoutHash } = normalized;
  if (hashAgentAttemptRecord(withoutHash) !== recordHash)
    throw new AgentAttemptError();
  validateState(normalized);
  return normalized;
}

export function createAgentAttemptRecord(
  input: AgentAttemptInput,
  revision: number,
  predecessorRecordHash: string | null,
): AgentAttemptRecord {
  const validated = validateAgentAttemptInput(input);
  const candidate = {
    ...validated,
    state: "PREPARED" as const,
    revision,
    executionCount: 0 as const,
    outputDigest: null,
    reportedModel: null,
    updatedAt: validated.preparedAt,
    automaticRetryScheduled: false as const,
    predecessorRecordHash,
    effect: AGENT_ATTEMPT_EFFECT,
  };
  return validateAgentAttemptRecord({
    ...candidate,
    recordHash: hashAgentAttemptRecord(candidate),
  });
}

/** The store supplies the scope log head, which may belong to another attempt. */
export function transitionAgentAttemptRecord(
  previous: AgentAttemptRecord,
  revision: number,
  patch: AgentAttemptPatch,
  predecessorRecordHash: string = previous.recordHash,
): AgentAttemptRecord {
  const withoutHash = Object.fromEntries(
    Object.entries({
      ...previous,
      ...patch,
      revision,
      predecessorRecordHash,
    }).filter(([key]) => key !== "recordHash"),
  );
  const next = validateAgentAttemptRecord({
    ...withoutHash,
    recordHash: hashAgentAttemptRecord(withoutHash),
  });
  validateAgentAttemptTransition(previous, next, predecessorRecordHash);
  return next;
}

export function validateAgentAttemptTransition(
  previous: AgentAttemptRecord | undefined,
  next: AgentAttemptRecord,
  predecessorRecordHash: string | null = previous?.recordHash ?? null,
): void {
  if (previous === undefined) {
    if (next.state !== "PREPARED") throw new AgentAttemptError();
    return;
  }
  if (
    next.revision <= previous.revision ||
    next.predecessorRecordHash !== predecessorRecordHash ||
    INPUT_KEYS.some(
      (key) =>
        previous[key as keyof AgentAttemptInput] !==
        next[key as keyof AgentAttemptInput],
    ) ||
    !NEXT[previous.state].includes(next.state)
  )
    throw new AgentAttemptError();
}

export function hashAgentAttemptRecord(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

function validateState(value: AgentAttemptRecord): void {
  const executed = value.executionCount === 1;
  const answered = value.outputDigest !== null;
  const valid =
    value.state === "PREPARED" || value.state === "REFUSED_BEFORE_EXECUTION"
      ? !executed && !answered && value.reportedModel === null
      : value.state === "COMPLETED"
        ? executed && answered
        : executed && !answered && value.reportedModel === null;
  if (!valid) throw new AgentAttemptError();
}

function validInput(value: Record<string, unknown>): boolean {
  return (
    value.schemaVersion === AGENT_ATTEMPT_SCHEMA_VERSION &&
    validText(value.scopeId) &&
    validText(value.authorizationId) &&
    validText(value.attemptId) &&
    value.executionClass === "AGENT_EXECUTION" &&
    (AGENT_EXECUTION_KINDS as readonly unknown[]).includes(value.kind) &&
    validText(value.targetId) &&
    validText(value.qualification) &&
    validDigest(value.inputDigest) &&
    validDigest(value.invocationDigest) &&
    validDigest(value.bindingDigest) &&
    validDigest(value.preflightAuditEventHash) &&
    validInstant(value.preparedAt)
  );
}

function pickInput(value: Record<string, unknown>): AgentAttemptInput {
  return {
    schemaVersion: AGENT_ATTEMPT_SCHEMA_VERSION,
    scopeId: value.scopeId as string,
    authorizationId: value.authorizationId as string,
    attemptId: value.attemptId as string,
    executionClass: "AGENT_EXECUTION",
    kind: value.kind as AgentExecutionKind,
    targetId: value.targetId as string,
    qualification: value.qualification as string,
    inputDigest: value.inputDigest as string,
    invocationDigest: value.invocationDigest as string,
    bindingDigest: value.bindingDigest as string,
    preflightAuditEventHash: value.preflightAuditEventHash as string,
    preparedAt: value.preparedAt as string,
  };
}

export function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TEXT &&
    value.trim() === value &&
    value.isWellFormed() &&
    !/\p{Cc}/u.test(value)
  );
}

export function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function nullableDigest(value: unknown): value is string | null {
  return value === null || validDigest(value);
}

export function validInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    INSTANT.test(value) &&
    new Date(value).toISOString() === value
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (record(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
