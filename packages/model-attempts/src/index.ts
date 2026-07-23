import { createHash } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const MAX_TEXT = 256;

export const MODEL_ATTEMPT_SCHEMA_VERSION = 1 as const;
export const MODEL_ATTEMPT_RECORD_LIMIT = 64;
export const MODEL_ATTEMPT_EFFECT =
  "LOCAL_NON_CONTENT_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH" as const;

export type ModelAttemptState =
  | "PREPARED"
  | "EXPOSURE_STARTED"
  | "ACKNOWLEDGED"
  | "COMPLETED"
  | "TERMINAL_REJECTED"
  | "UNKNOWN_AFTER_EXPOSURE";

export type ModelAttemptInput = Readonly<{
  schemaVersion: 1;
  projectId: string;
  authorizationId: string;
  attemptId: string;
  providerKind: "OPENAI_RESPONSES";
  requestDigest: string;
  authorizationDigest: string;
  preflightAuditEventHash: string;
}>;

export type ModelAttemptRecord = ModelAttemptInput &
  Readonly<{
    state: ModelAttemptState;
    revision: number;
    exposureCount: 0 | 1;
    providerRequestIdDigest: string | null;
    responseIdDigest: string | null;
    outputDigest: string | null;
    automaticRetryScheduled: false;
    predecessorRecordHash: string | null;
    recordHash: string;
    effect: typeof MODEL_ATTEMPT_EFFECT;
  }>;

export type ModelAttemptSnapshot = Readonly<{
  schemaVersion: 1;
  projectId: string;
  revision: number;
  records: readonly ModelAttemptRecord[];
  effect: "LOCAL_ATTEMPT_STORE_NOT_MODEL_DELIVERY";
}>;

export type ModelAttemptStore = Readonly<{
  prepare(input: ModelAttemptInput): Promise<ModelAttemptRecord>;
  transition(
    projectId: string,
    attemptId: string,
    allowed: readonly ModelAttemptState[],
    patch: Readonly<
      Partial<
        Pick<
          ModelAttemptRecord,
          | "state"
          | "exposureCount"
          | "providerRequestIdDigest"
          | "responseIdDigest"
          | "outputDigest"
        >
      >
    >,
  ): Promise<ModelAttemptRecord>;
  recover(projectId: string): Promise<ModelAttemptSnapshot>;
  inspect(projectId: string, attemptId: string): Promise<ModelAttemptRecord>;
  list(projectId: string): Promise<ModelAttemptSnapshot>;
}>;

export class ModelAttemptError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "Local model attempt evidence is unavailable or integrity-invalid.",
      options,
    );
    this.name = "ModelAttemptError";
  }
}

export class ModelAttempts {
  readonly #store: ModelAttemptStore;

  public constructor(store: ModelAttemptStore) {
    this.#store = store;
  }

  public prepare(input: ModelAttemptInput): Promise<ModelAttemptRecord> {
    return this.#run(() =>
      this.#store.prepare(validateModelAttemptInput(input)),
    );
  }

  public claimExposure(
    projectId: string,
    attemptId: string,
  ): Promise<ModelAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(projectId, attemptId, ["PREPARED"], {
        state: "EXPOSURE_STARTED",
        exposureCount: 1,
      }),
    );
  }

  public acknowledge(
    projectId: string,
    attemptId: string,
    providerRequestId: string,
    responseId: string,
  ): Promise<ModelAttemptRecord> {
    requireText(providerRequestId);
    requireText(responseId);
    return this.#run(() =>
      this.#store.transition(projectId, attemptId, ["EXPOSURE_STARTED"], {
        state: "ACKNOWLEDGED",
        providerRequestIdDigest: sha256(providerRequestId),
        responseIdDigest: sha256(responseId),
      }),
    );
  }

  public complete(
    projectId: string,
    attemptId: string,
    output: string,
  ): Promise<ModelAttemptRecord> {
    requireText(output);
    return this.#run(() =>
      this.#store.transition(projectId, attemptId, ["ACKNOWLEDGED"], {
        state: "COMPLETED",
        outputDigest: sha256(output),
      }),
    );
  }

  public terminalReject(
    projectId: string,
    attemptId: string,
  ): Promise<ModelAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(projectId, attemptId, ["EXPOSURE_STARTED"], {
        state: "TERMINAL_REJECTED",
      }),
    );
  }

  public markUnknown(
    projectId: string,
    attemptId: string,
  ): Promise<ModelAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(
        projectId,
        attemptId,
        ["EXPOSURE_STARTED", "ACKNOWLEDGED"],
        { state: "UNKNOWN_AFTER_EXPOSURE" },
      ),
    );
  }

  public recover(projectId: string): Promise<ModelAttemptSnapshot> {
    return this.#run(() => this.#store.recover(projectId));
  }

  public inspect(
    projectId: string,
    attemptId: string,
  ): Promise<ModelAttemptRecord> {
    return this.#run(() => this.#store.inspect(projectId, attemptId));
  }

  public list(projectId: string): Promise<ModelAttemptSnapshot> {
    return this.#run(() => this.#store.list(projectId));
  }

  async #run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ModelAttemptError) {
        throw error;
      }
      throw new ModelAttemptError({ cause: error });
    }
  }
}

export function validateModelAttemptInput(value: unknown): ModelAttemptInput {
  if (
    !record(value) ||
    !exactKeys(value, [
      "authorizationDigest",
      "authorizationId",
      "attemptId",
      "preflightAuditEventHash",
      "projectId",
      "providerKind",
      "requestDigest",
      "schemaVersion",
    ]) ||
    !validInputFields(value)
  ) {
    throw new ModelAttemptError();
  }
  return Object.freeze({ ...(value as ModelAttemptInput) });
}

export function validateModelAttemptRecord(value: unknown): ModelAttemptRecord {
  if (
    !record(value) ||
    !exactKeys(value, [
      "authorizationDigest",
      "authorizationId",
      "attemptId",
      "automaticRetryScheduled",
      "effect",
      "exposureCount",
      "outputDigest",
      "predecessorRecordHash",
      "preflightAuditEventHash",
      "projectId",
      "providerKind",
      "providerRequestIdDigest",
      "recordHash",
      "requestDigest",
      "responseIdDigest",
      "revision",
      "schemaVersion",
      "state",
    ])
  ) {
    throw new ModelAttemptError();
  }
  if (!validInputFields(value)) {
    throw new ModelAttemptError();
  }
  const input = Object.freeze({
    schemaVersion: 1 as const,
    projectId: value.projectId,
    authorizationId: value.authorizationId,
    attemptId: value.attemptId,
    providerKind: "OPENAI_RESPONSES" as const,
    requestDigest: value.requestDigest,
    authorizationDigest: value.authorizationDigest,
    preflightAuditEventHash: value.preflightAuditEventHash,
  });
  if (
    !STATES.includes(value.state as ModelAttemptState) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    ![0, 1].includes(value.exposureCount as number) ||
    !nullableDigest(value.providerRequestIdDigest) ||
    !nullableDigest(value.responseIdDigest) ||
    !nullableDigest(value.outputDigest) ||
    value.automaticRetryScheduled !== false ||
    !nullableDigest(value.predecessorRecordHash) ||
    !validDigest(value.recordHash) ||
    value.effect !== MODEL_ATTEMPT_EFFECT
  ) {
    throw new ModelAttemptError();
  }
  const normalized = Object.freeze({
    ...input,
    state: value.state as ModelAttemptState,
    revision: value.revision as number,
    exposureCount: value.exposureCount as 0 | 1,
    providerRequestIdDigest: value.providerRequestIdDigest as string | null,
    responseIdDigest: value.responseIdDigest as string | null,
    outputDigest: value.outputDigest as string | null,
    automaticRetryScheduled: false as const,
    predecessorRecordHash: value.predecessorRecordHash as string | null,
    recordHash: value.recordHash,
    effect: MODEL_ATTEMPT_EFFECT,
  });
  const { recordHash, ...withoutHash } = normalized;
  if (hashModelAttemptRecord(withoutHash) !== recordHash) {
    throw new ModelAttemptError();
  }
  validateState(normalized);
  return normalized;
}

export function createModelAttemptRecord(
  input: ModelAttemptInput,
  revision: number,
  predecessorRecordHash: string | null,
): ModelAttemptRecord {
  const candidate = {
    ...validateModelAttemptInput(input),
    state: "PREPARED" as const,
    revision,
    exposureCount: 0 as const,
    providerRequestIdDigest: null,
    responseIdDigest: null,
    outputDigest: null,
    automaticRetryScheduled: false as const,
    predecessorRecordHash,
    effect: MODEL_ATTEMPT_EFFECT,
  };
  return validateModelAttemptRecord({
    ...candidate,
    recordHash: hashModelAttemptRecord(candidate),
  });
}

export function transitionModelAttemptRecord(
  previous: ModelAttemptRecord,
  revision: number,
  patch: Readonly<
    Partial<
      Pick<
        ModelAttemptRecord,
        | "state"
        | "exposureCount"
        | "providerRequestIdDigest"
        | "responseIdDigest"
        | "outputDigest"
      >
    >
  >,
): ModelAttemptRecord {
  const candidate = {
    ...previous,
    ...patch,
    revision,
    predecessorRecordHash: previous.recordHash,
  };
  const withoutHash = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => key !== "recordHash"),
  );
  const next = validateModelAttemptRecord({
    ...withoutHash,
    recordHash: hashModelAttemptRecord(withoutHash),
  });
  validateModelAttemptTransition(previous, next);
  return next;
}

export function validateModelAttemptTransition(
  previous: ModelAttemptRecord | undefined,
  next: ModelAttemptRecord,
): void {
  if (previous === undefined) {
    if (next.state !== "PREPARED") {
      throw new ModelAttemptError();
    }
    return;
  }
  if (
    next.revision <= previous.revision ||
    next.predecessorRecordHash !== previous.recordHash ||
    next.projectId !== previous.projectId ||
    next.authorizationId !== previous.authorizationId ||
    next.attemptId !== previous.attemptId ||
    next.providerKind !== previous.providerKind ||
    next.requestDigest !== previous.requestDigest ||
    next.authorizationDigest !== previous.authorizationDigest ||
    next.preflightAuditEventHash !== previous.preflightAuditEventHash
  ) {
    throw new ModelAttemptError();
  }
  const allowed =
    (previous.state === "PREPARED" && next.state === "EXPOSURE_STARTED") ||
    (previous.state === "EXPOSURE_STARTED" &&
      ["ACKNOWLEDGED", "TERMINAL_REJECTED", "UNKNOWN_AFTER_EXPOSURE"].includes(
        next.state,
      )) ||
    (previous.state === "ACKNOWLEDGED" &&
      ["COMPLETED", "UNKNOWN_AFTER_EXPOSURE"].includes(next.state));
  if (!allowed) {
    throw new ModelAttemptError();
  }
}

export function hashModelAttemptRecord(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

const STATES: readonly ModelAttemptState[] = [
  "PREPARED",
  "EXPOSURE_STARTED",
  "ACKNOWLEDGED",
  "COMPLETED",
  "TERMINAL_REJECTED",
  "UNKNOWN_AFTER_EXPOSURE",
];

function validateState(value: ModelAttemptRecord): void {
  const noReceipt =
    value.providerRequestIdDigest === null && value.responseIdDigest === null;
  if (
    (value.state === "PREPARED" &&
      (value.exposureCount !== 0 ||
        !noReceipt ||
        value.outputDigest !== null)) ||
    ((value.state === "EXPOSURE_STARTED" ||
      value.state === "TERMINAL_REJECTED") &&
      (value.exposureCount !== 1 ||
        !noReceipt ||
        value.outputDigest !== null)) ||
    (value.state === "ACKNOWLEDGED" &&
      (value.exposureCount !== 1 ||
        value.providerRequestIdDigest === null ||
        value.responseIdDigest === null ||
        value.outputDigest !== null)) ||
    (value.state === "COMPLETED" &&
      (value.exposureCount !== 1 ||
        value.providerRequestIdDigest === null ||
        value.responseIdDigest === null ||
        value.outputDigest === null)) ||
    (value.state === "UNKNOWN_AFTER_EXPOSURE" &&
      (value.exposureCount !== 1 || value.outputDigest !== null))
  ) {
    throw new ModelAttemptError();
  }
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TEXT &&
    !/\p{Cc}/u.test(value)
  );
}

function validInputFields(
  value: Record<string, unknown>,
): value is Record<string, unknown> & ModelAttemptInput {
  return (
    value.schemaVersion === 1 &&
    validText(value.projectId) &&
    validText(value.authorizationId) &&
    validText(value.attemptId) &&
    value.providerKind === "OPENAI_RESPONSES" &&
    validDigest(value.requestDigest) &&
    validDigest(value.authorizationDigest) &&
    validDigest(value.preflightAuditEventHash)
  );
}

function requireText(value: unknown): asserts value is string {
  if (!validText(value)) {
    throw new ModelAttemptError();
  }
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function nullableDigest(value: unknown): value is string | null {
  return value === null || validDigest(value);
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
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (record(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
