import { createHash } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_TEXT = 256;

export const LOCAL_MODEL_ATTEMPT_SCHEMA_VERSION = 1 as const;
/** Each attempt appends two or three records; 256 keeps a scope document small. */
export const LOCAL_MODEL_ATTEMPT_RECORD_LIMIT = 256;
export const LOCAL_MODEL_ATTEMPT_EFFECT =
  "LOCAL_NON_CONTENT_LOCAL_MODEL_ATTEMPT_EVIDENCE_NOT_MODEL_TRUTH" as const;
/** ADR-0051: written into every attempt, because protection was skipped. */
export const LOCAL_MODEL_PROTECTION =
  "PSEUDONYMIZATION_SKIPPED_LOCAL_MODEL_LOCAL_ONLY" as const;
export const LOCAL_MODEL_UNKNOWN_REASONS = Object.freeze([
  "RESPONSE_TOO_LARGE",
  "MALFORMED_RESPONSE",
  "NOT_ONE_CHOICE",
  "FINISH_REASON_NOT_STOP",
  "EMPTY_CONTENT",
  "ANSWER_TOO_LARGE",
  "REDIRECTED",
  "DISCONNECTED",
  "TIMED_OUT",
  "TRANSPORT_FAILED",
  "UNRESOLVED",
] as const);

export type LocalModelUnknownReason =
  (typeof LOCAL_MODEL_UNKNOWN_REASONS)[number];

/**
 * ADR-0051. A local server gives no receipt, so there is no acknowledged
 * state: the call either produced a validated answer or its outcome is
 * unknown. A refusal is recorded only while nothing was sent.
 */
export type LocalModelAttemptState =
  | "PREPARED"
  | "REFUSED_BEFORE_EXECUTION"
  | "EXECUTION_STARTED"
  | "COMPLETED"
  | "UNKNOWN_AFTER_EXECUTION";

export type LocalModelAttemptInput = Readonly<{
  schemaVersion: typeof LOCAL_MODEL_ATTEMPT_SCHEMA_VERSION;
  /** The project, or the derived General scope, that owns the attempt. */
  scopeId: string;
  authorizationId: string;
  attemptId: string;
  executionClass: "LOCAL_MODEL";
  kind: "LLAMA_SERVER_LOOPBACK";
  targetId: string;
  /** The qualified adapter and version the executor declares, never discovered. */
  qualification: string;
  protection: typeof LOCAL_MODEL_PROTECTION;
  inputDigest: string;
  invocationDigest: string;
  /** Selection, scope, policy, instructions, sources and protected text. */
  bindingDigest: string;
  preflightAuditEventHash: string;
  preparedAt: string;
}>;

export type LocalModelAttemptRecord = LocalModelAttemptInput &
  Readonly<{
    state: LocalModelAttemptState;
    revision: number;
    executionCount: 0 | 1;
    outputDigest: string | null;
    reportedModel: string | null;
    unknownReason: LocalModelUnknownReason | null;
    updatedAt: string;
    automaticRetryScheduled: false;
    predecessorRecordHash: string | null;
    recordHash: string;
    effect: typeof LOCAL_MODEL_ATTEMPT_EFFECT;
  }>;

export type LocalModelAttemptPatch = Readonly<
  Partial<
    Pick<
      LocalModelAttemptRecord,
      | "state"
      | "executionCount"
      | "outputDigest"
      | "reportedModel"
      | "unknownReason"
    >
  > & { updatedAt: string }
>;

export type LocalModelAttemptSnapshot = Readonly<{
  schemaVersion: typeof LOCAL_MODEL_ATTEMPT_SCHEMA_VERSION;
  scopeId: string;
  revision: number;
  records: readonly LocalModelAttemptRecord[];
  effect: "LOCAL_MODEL_ATTEMPT_STORE_NOT_MODEL_EXECUTION";
}>;

export class LocalModelAttemptError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "Local model attempt evidence is unavailable or integrity-invalid.",
      options,
    );
    this.name = "LocalModelAttemptError";
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
  "protection",
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
  "unknownReason",
  "updatedAt",
]);
const STATES: readonly LocalModelAttemptState[] = Object.freeze([
  "PREPARED",
  "REFUSED_BEFORE_EXECUTION",
  "EXECUTION_STARTED",
  "COMPLETED",
  "UNKNOWN_AFTER_EXECUTION",
]);
const NEXT: Readonly<
  Record<LocalModelAttemptState, readonly LocalModelAttemptState[]>
> = Object.freeze({
  PREPARED: ["EXECUTION_STARTED", "REFUSED_BEFORE_EXECUTION"],
  REFUSED_BEFORE_EXECUTION: [],
  EXECUTION_STARTED: ["COMPLETED", "UNKNOWN_AFTER_EXECUTION"],
  COMPLETED: [],
  UNKNOWN_AFTER_EXECUTION: [],
});

export function validateLocalModelAttemptInput(
  value: unknown,
): LocalModelAttemptInput {
  if (!record(value) || !exactKeys(value, INPUT_KEYS) || !validInput(value))
    throw new LocalModelAttemptError();
  return Object.freeze(pickInput(value));
}

export function validateLocalModelAttemptRecord(
  value: unknown,
): LocalModelAttemptRecord {
  if (
    !record(value) ||
    !exactKeys(value, RECORD_KEYS) ||
    !validInput(value) ||
    !STATES.includes(value.state as LocalModelAttemptState) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    ![0, 1].includes(value.executionCount as number) ||
    !nullableDigest(value.outputDigest) ||
    !(value.reportedModel === null || validText(value.reportedModel)) ||
    !(
      value.unknownReason === null ||
      (LOCAL_MODEL_UNKNOWN_REASONS as readonly unknown[]).includes(
        value.unknownReason,
      )
    ) ||
    !validInstant(value.updatedAt) ||
    value.automaticRetryScheduled !== false ||
    !nullableDigest(value.predecessorRecordHash) ||
    !validDigest(value.recordHash) ||
    value.effect !== LOCAL_MODEL_ATTEMPT_EFFECT
  )
    throw new LocalModelAttemptError();
  const normalized: LocalModelAttemptRecord = Object.freeze({
    ...pickInput(value),
    state: value.state as LocalModelAttemptState,
    revision: value.revision as number,
    executionCount: value.executionCount as 0 | 1,
    outputDigest: value.outputDigest as string | null,
    reportedModel: value.reportedModel as string | null,
    unknownReason: value.unknownReason as LocalModelUnknownReason | null,
    updatedAt: value.updatedAt as string,
    automaticRetryScheduled: false,
    predecessorRecordHash: value.predecessorRecordHash as string | null,
    recordHash: value.recordHash,
    effect: LOCAL_MODEL_ATTEMPT_EFFECT,
  });
  const { recordHash, ...withoutHash } = normalized;
  if (hashLocalModelAttemptRecord(withoutHash) !== recordHash)
    throw new LocalModelAttemptError();
  validateState(normalized);
  return normalized;
}

export function createLocalModelAttemptRecord(
  input: LocalModelAttemptInput,
  revision: number,
  predecessorRecordHash: string | null,
): LocalModelAttemptRecord {
  const validated = validateLocalModelAttemptInput(input);
  const candidate = {
    ...validated,
    state: "PREPARED" as const,
    revision,
    executionCount: 0 as const,
    outputDigest: null,
    reportedModel: null,
    unknownReason: null,
    updatedAt: validated.preparedAt,
    automaticRetryScheduled: false as const,
    predecessorRecordHash,
    effect: LOCAL_MODEL_ATTEMPT_EFFECT,
  };
  return validateLocalModelAttemptRecord({
    ...candidate,
    recordHash: hashLocalModelAttemptRecord(candidate),
  });
}

/** The store supplies the scope log head, which may belong to another attempt. */
export function transitionLocalModelAttemptRecord(
  previous: LocalModelAttemptRecord,
  revision: number,
  patch: LocalModelAttemptPatch,
  predecessorRecordHash: string = previous.recordHash,
): LocalModelAttemptRecord {
  const withoutHash = Object.fromEntries(
    Object.entries({
      ...previous,
      ...patch,
      revision,
      predecessorRecordHash,
    }).filter(([key]) => key !== "recordHash"),
  );
  const next = validateLocalModelAttemptRecord({
    ...withoutHash,
    recordHash: hashLocalModelAttemptRecord(withoutHash),
  });
  validateLocalModelAttemptTransition(previous, next, predecessorRecordHash);
  return next;
}

export function validateLocalModelAttemptTransition(
  previous: LocalModelAttemptRecord | undefined,
  next: LocalModelAttemptRecord,
  predecessorRecordHash: string | null = previous?.recordHash ?? null,
): void {
  if (previous === undefined) {
    if (next.state !== "PREPARED") throw new LocalModelAttemptError();
    return;
  }
  if (
    next.revision <= previous.revision ||
    next.predecessorRecordHash !== predecessorRecordHash ||
    INPUT_KEYS.some(
      (key) =>
        previous[key as keyof LocalModelAttemptInput] !==
        next[key as keyof LocalModelAttemptInput],
    ) ||
    !NEXT[previous.state].includes(next.state)
  )
    throw new LocalModelAttemptError();
}

export function hashLocalModelAttemptRecord(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

function validateState(value: LocalModelAttemptRecord): void {
  const executed = value.executionCount === 1;
  const answered = value.outputDigest !== null;
  const valid =
    value.state === "PREPARED" || value.state === "REFUSED_BEFORE_EXECUTION"
      ? !executed &&
        !answered &&
        value.reportedModel === null &&
        value.unknownReason === null
      : value.state === "COMPLETED"
        ? executed && answered && value.unknownReason === null
        : value.state === "EXECUTION_STARTED"
          ? executed &&
            !answered &&
            value.reportedModel === null &&
            value.unknownReason === null
          : executed &&
            !answered &&
            value.reportedModel === null &&
            value.unknownReason !== null;
  if (!valid) throw new LocalModelAttemptError();
}

function validInput(value: Record<string, unknown>): boolean {
  return (
    value.schemaVersion === LOCAL_MODEL_ATTEMPT_SCHEMA_VERSION &&
    validText(value.scopeId) &&
    validText(value.authorizationId) &&
    validText(value.attemptId) &&
    value.executionClass === "LOCAL_MODEL" &&
    value.kind === "LLAMA_SERVER_LOOPBACK" &&
    validText(value.targetId) &&
    validText(value.qualification) &&
    value.protection === LOCAL_MODEL_PROTECTION &&
    validDigest(value.inputDigest) &&
    validDigest(value.invocationDigest) &&
    validDigest(value.bindingDigest) &&
    validDigest(value.preflightAuditEventHash) &&
    validInstant(value.preparedAt)
  );
}

function pickInput(value: Record<string, unknown>): LocalModelAttemptInput {
  return {
    schemaVersion: LOCAL_MODEL_ATTEMPT_SCHEMA_VERSION,
    scopeId: value.scopeId as string,
    authorizationId: value.authorizationId as string,
    attemptId: value.attemptId as string,
    executionClass: "LOCAL_MODEL",
    kind: "LLAMA_SERVER_LOOPBACK",
    targetId: value.targetId as string,
    qualification: value.qualification as string,
    protection: LOCAL_MODEL_PROTECTION,
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
