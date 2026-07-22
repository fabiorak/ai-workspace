import { createHash } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const MAX_TEXT = 256;
const MAX_RECORD_BYTES = 8 * 1024;
const MAX_SNAPSHOT_BYTES = 32 * 1024;
const AUTHORIZATION_LIFETIME_MS = 60_000;

export type AttemptState =
  | "PREPARED"
  | "FAILED_BEFORE_EXPOSURE"
  | "EXPOSURE_STARTED"
  | "ACKNOWLEDGED"
  | "COMPLETED"
  | "TERMINAL_REJECTED"
  | "UNKNOWN_AFTER_EXPOSURE";

export type AttemptRecord = Readonly<{
  schemaVersion: 1;
  authorizationId: string;
  attemptId: string;
  providerKind: "OPENAI_RESPONSES";
  transportEvidenceDate: "2026-07-22";
  issuedAt: string;
  expiresAt: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  profileDigest: string;
  policyDigest: string;
  preflightAuditEventId: string;
  preflightAuditEventHash: string;
  transformedRequestDigest: string;
  mappingSetId: string;
  mappingSchemaVersion: 1 | 2;
  state: AttemptState;
  revision: number;
  exposureCount: 0 | 1;
  providerRequestIdDigest: string | null;
  responseIdDigest: string | null;
  outputDigest: string | null;
  automaticRetryScheduled: false;
  effect: "SYNTHETIC_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH";
}>;

export type CurrentAttemptEvidence = Readonly<{
  authorizationId: string;
  providerKind: "OPENAI_RESPONSES";
  modelId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  profileDigest: string;
  policyDigest: string;
  preflightAuditEventId: string;
  preflightAuditEventHash: string;
  preflightDecision: "REVIEWABLE_NOT_AUTHORIZED" | "BLOCKED";
  preflightAuditPresent: boolean;
  transformedRequestDigest: string;
  mappingSetId: string;
  mappingSchemaVersion: 1 | 2;
  transformed: boolean;
}>;

export type AttemptSnapshot = Readonly<{
  schemaVersion: 1;
  records: readonly AttemptRecord[];
  effect: "SYNTHETIC_NON_CONTENT_SNAPSHOT_NOT_PRODUCTION_PERSISTENCE";
}>;

type AdapterMode =
  | "COMPLETE"
  | "TIMEOUT_AFTER_EXPOSURE"
  | "ACK_THEN_LOSS"
  | "MALFORMED_RECEIPT"
  | "TERMINAL_REJECTION"
  | "MISMATCHED_RECEIPT";

type CaseOutcome =
  | AttemptState
  | "BLOCKED"
  | "INSPECTION_ONLY"
  | "ELIGIBLE_NOT_SENT"
  | "ONE_COMPLETED_ONE_BLOCKED";

type MeasuredCase = Readonly<{
  id: string;
  expected: CaseOutcome;
  actual: CaseOutcome;
  createCalls: number;
  scheduledRetries: number;
  matchesExpected: boolean;
}>;

export class AtMostOnceEvidenceError extends Error {
  public constructor() {
    super(
      "The synthetic bounded attempt evidence is invalid, stale, altered, replayed, contradictory, or cross-scoped. No provider request occurred.",
    );
    this.name = "AtMostOnceEvidenceError";
  }
}

export class SyntheticAttemptStore {
  readonly #records = new Map<string, AttemptRecord>();

  public add(value: unknown): AttemptRecord {
    const record = validateAttemptRecord(value);
    if (
      record.state !== "PREPARED" ||
      this.#records.has(record.attemptId) ||
      [...this.#records.values()].some(
        (entry) => entry.authorizationId === record.authorizationId,
      )
    )
      throw invalid();
    this.#records.set(record.attemptId, record);
    return record;
  }

  public read(attemptId: string): AttemptRecord {
    const record = this.#records.get(attemptId);
    if (record === undefined) throw invalid();
    return record;
  }

  public failBeforeExposure(attemptId: string): AttemptRecord {
    return this.#replace(attemptId, "PREPARED", {
      state: "FAILED_BEFORE_EXPOSURE",
    });
  }

  public claimExposure(attemptId: string): AttemptRecord {
    return this.#replace(attemptId, "PREPARED", {
      state: "EXPOSURE_STARTED",
      exposureCount: 1,
    });
  }

  public acknowledge(
    attemptId: string,
    providerRequestId: string,
    responseId: string,
  ): AttemptRecord {
    if (!validText(providerRequestId) || !validText(responseId))
      throw invalid();
    return this.#replace(attemptId, "EXPOSURE_STARTED", {
      state: "ACKNOWLEDGED",
      providerRequestIdDigest: sha256(providerRequestId),
      responseIdDigest: sha256(responseId),
    });
  }

  public complete(attemptId: string, output: string): AttemptRecord {
    if (!validText(output)) throw invalid();
    const current = this.read(attemptId);
    const outputDigest = sha256(output);
    if (current.state === "COMPLETED") {
      if (current.outputDigest !== outputDigest) throw invalid();
      return current;
    }
    return this.#replace(attemptId, "ACKNOWLEDGED", {
      state: "COMPLETED",
      outputDigest,
    });
  }

  public markUnknown(attemptId: string): AttemptRecord {
    const current = this.read(attemptId);
    if (
      current.state !== "EXPOSURE_STARTED" &&
      current.state !== "ACKNOWLEDGED"
    )
      throw invalid();
    return this.#replace(attemptId, current.state, {
      state: "UNKNOWN_AFTER_EXPOSURE",
    });
  }

  public terminalReject(attemptId: string): AttemptRecord {
    return this.#replace(attemptId, "EXPOSURE_STARTED", {
      state: "TERMINAL_REJECTED",
    });
  }

  public recover(): void {
    for (const [attemptId, record] of this.#records) {
      if (
        record.state === "EXPOSURE_STARTED" ||
        record.state === "ACKNOWLEDGED"
      )
        this.#replace(attemptId, record.state, {
          state: "UNKNOWN_AFTER_EXPOSURE",
        });
    }
  }

  public inspect(attemptId: string): Readonly<{
    attemptId: string;
    authorizationId: string;
    state: AttemptState;
    revision: number;
    exposureCount: 0 | 1;
    transformedRequestDigest: string;
    providerRequestIdDigest: string | null;
    responseIdDigest: string | null;
    outputDigest: string | null;
    action: "INSPECTION_ONLY_NO_RESEND";
  }> {
    const record = this.read(attemptId);
    return Object.freeze({
      attemptId: record.attemptId,
      authorizationId: record.authorizationId,
      state: record.state,
      revision: record.revision,
      exposureCount: record.exposureCount,
      transformedRequestDigest: record.transformedRequestDigest,
      providerRequestIdDigest: record.providerRequestIdDigest,
      responseIdDigest: record.responseIdDigest,
      outputDigest: record.outputDigest,
      action: "INSPECTION_ONLY_NO_RESEND" as const,
    });
  }

  public snapshot(): AttemptSnapshot {
    return validateAttemptSnapshot({
      schemaVersion: 1,
      records: [...this.#records.values()].sort((left, right) =>
        left.attemptId.localeCompare(right.attemptId),
      ),
      effect: "SYNTHETIC_NON_CONTENT_SNAPSHOT_NOT_PRODUCTION_PERSISTENCE",
    });
  }

  public static restore(value: unknown): SyntheticAttemptStore {
    const snapshot = validateAttemptSnapshot(value);
    const store = new SyntheticAttemptStore();
    for (const record of snapshot.records)
      store.#records.set(record.attemptId, record);
    return store;
  }

  #replace(
    attemptId: string,
    expected: AttemptState,
    patch: Partial<AttemptRecord>,
  ): AttemptRecord {
    const current = this.read(attemptId);
    if (current.state !== expected) throw invalid();
    const next = validateAttemptRecord({
      ...current,
      ...patch,
      revision: current.revision + 1,
    });
    this.#records.set(attemptId, next);
    return next;
  }
}

export class FakeResponsesCreateAdapter {
  #createCalls = 0;
  #scheduledRetries = 0;

  public async create(
    mode: AdapterMode,
    attemptId: string,
  ): Promise<
    | Readonly<{
        kind: "COMPLETE";
        attemptId: string;
        providerRequestId: string;
        responseId: string;
        output: string;
      }>
    | Readonly<{
        kind: "ACK_THEN_LOSS";
        attemptId: string;
        providerRequestId: string;
        responseId: string;
      }>
    | Readonly<{ kind: "TERMINAL_REJECTION"; attemptId: string }>
    | Readonly<{ kind: "MALFORMED_RECEIPT"; attemptId: string }>
  > {
    this.#createCalls += 1;
    await Promise.resolve();
    if (mode === "TIMEOUT_AFTER_EXPOSURE") throw invalid();
    if (mode === "MALFORMED_RECEIPT")
      return Object.freeze({ kind: "MALFORMED_RECEIPT", attemptId });
    if (mode === "TERMINAL_REJECTION")
      return Object.freeze({ kind: "TERMINAL_REJECTION", attemptId });
    const receiptAttemptId =
      mode === "MISMATCHED_RECEIPT" ? `${attemptId}-other` : attemptId;
    if (mode === "ACK_THEN_LOSS")
      return Object.freeze({
        kind: "ACK_THEN_LOSS",
        attemptId: receiptAttemptId,
        providerRequestId: "request-synthetic",
        responseId: "response-synthetic",
      });
    return Object.freeze({
      kind: "COMPLETE",
      attemptId: receiptAttemptId,
      providerRequestId: "request-synthetic",
      responseId: "response-synthetic",
      output: "Synthetic bounded output.",
    });
  }

  public evidence(): Readonly<{
    createCalls: number;
    scheduledRetries: number;
  }> {
    return Object.freeze({
      createCalls: this.#createCalls,
      scheduledRetries: this.#scheduledRetries,
    });
  }
}

export async function executeSyntheticAttempt(
  input: Readonly<{
    store: SyntheticAttemptStore;
    adapter: FakeResponsesCreateAdapter;
    attemptId: string;
    evidence: CurrentAttemptEvidence;
    transformedRequest: string;
    now: Date;
    mode: AdapterMode | "FAIL_BEFORE_EXPOSURE";
  }>,
): Promise<AttemptRecord> {
  const record = input.store.read(input.attemptId);
  validateCurrentBinding(
    record,
    input.evidence,
    input.transformedRequest,
    input.now,
  );
  if (input.mode === "FAIL_BEFORE_EXPOSURE")
    return input.store.failBeforeExposure(input.attemptId);
  input.store.claimExposure(input.attemptId);
  let result: Awaited<ReturnType<FakeResponsesCreateAdapter["create"]>>;
  try {
    result = await input.adapter.create(input.mode, input.attemptId);
  } catch {
    return input.store.markUnknown(input.attemptId);
  }
  if (result.attemptId !== input.attemptId)
    return input.store.markUnknown(input.attemptId);
  if (result.kind === "MALFORMED_RECEIPT")
    return input.store.markUnknown(input.attemptId);
  if (result.kind === "TERMINAL_REJECTION")
    return input.store.terminalReject(input.attemptId);
  input.store.acknowledge(
    input.attemptId,
    result.providerRequestId,
    result.responseId,
  );
  if (result.kind === "ACK_THEN_LOSS")
    return input.store.markUnknown(input.attemptId);
  return input.store.complete(input.attemptId, result.output);
}

export function validateFreshAttemptAfterUnknown(
  input: Readonly<{
    previous: AttemptRecord;
    next: AttemptRecord;
    warning:
      "EXPLICIT_DUPLICATE_AND_COST_WARNING_ACCEPTED" | "WARNING_NOT_ACCEPTED";
  }>,
): Readonly<{
  eligible: true;
  effect: "ELIGIBLE_NOT_SENT_REQUIRES_NEW_EXPLICIT_AUTHORIZATION";
}> {
  const previous = validateAttemptRecord(input.previous);
  const next = validateAttemptRecord(input.next);
  if (
    previous.state !== "UNKNOWN_AFTER_EXPOSURE" ||
    next.state !== "PREPARED" ||
    previous.authorizationId === next.authorizationId ||
    previous.attemptId === next.attemptId ||
    input.warning !== "EXPLICIT_DUPLICATE_AND_COST_WARNING_ACCEPTED" ||
    previous.providerKind !== next.providerKind ||
    previous.projectId !== next.projectId ||
    previous.workItemId !== next.workItemId ||
    previous.handoffId !== next.handoffId ||
    previous.modelId !== next.modelId ||
    previous.transformedRequestDigest !== next.transformedRequestDigest ||
    previous.mappingSetId !== next.mappingSetId ||
    previous.mappingSchemaVersion !== next.mappingSchemaVersion
  )
    throw invalid();
  return Object.freeze({
    eligible: true as const,
    effect: "ELIGIBLE_NOT_SENT_REQUIRES_NEW_EXPLICIT_AUTHORIZATION" as const,
  });
}

const RECORD_KEYS = [
  "attemptId",
  "authorizationId",
  "automaticRetryScheduled",
  "effect",
  "expiresAt",
  "exposureCount",
  "handoffId",
  "issuedAt",
  "mappingSchemaVersion",
  "mappingSetId",
  "modelId",
  "outputDigest",
  "policyDigest",
  "preflightAuditEventHash",
  "preflightAuditEventId",
  "profileDigest",
  "projectId",
  "providerKind",
  "providerRequestIdDigest",
  "responseIdDigest",
  "revision",
  "schemaVersion",
  "state",
  "transformedRequestDigest",
  "transportEvidenceDate",
  "workItemId",
] as const;

const SNAPSHOT_KEYS = ["effect", "records", "schemaVersion"] as const;
const STATES: readonly AttemptState[] = [
  "ACKNOWLEDGED",
  "COMPLETED",
  "EXPOSURE_STARTED",
  "FAILED_BEFORE_EXPOSURE",
  "PREPARED",
  "TERMINAL_REJECTED",
  "UNKNOWN_AFTER_EXPOSURE",
];

export function validateAttemptRecord(value: unknown): AttemptRecord {
  if (
    !record(value) ||
    !exactKeys(value, RECORD_KEYS) ||
    value.schemaVersion !== 1 ||
    !validText(value.authorizationId) ||
    !validText(value.attemptId) ||
    value.providerKind !== "OPENAI_RESPONSES" ||
    value.transportEvidenceDate !== "2026-07-22" ||
    !validTimestamp(value.issuedAt) ||
    !validTimestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) - Date.parse(value.issuedAt) !==
      AUTHORIZATION_LIFETIME_MS ||
    !validText(value.projectId) ||
    !validText(value.workItemId) ||
    !validText(value.handoffId) ||
    !validText(value.modelId) ||
    !validDigest(value.profileDigest) ||
    !validDigest(value.policyDigest) ||
    !validText(value.preflightAuditEventId) ||
    !validDigest(value.preflightAuditEventHash) ||
    !validDigest(value.transformedRequestDigest) ||
    !validText(value.mappingSetId) ||
    ![1, 2].includes(value.mappingSchemaVersion as number) ||
    !STATES.includes(value.state as AttemptState) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    ![0, 1].includes(value.exposureCount as number) ||
    !nullableDigest(value.providerRequestIdDigest) ||
    !nullableDigest(value.responseIdDigest) ||
    !nullableDigest(value.outputDigest) ||
    value.automaticRetryScheduled !== false ||
    value.effect !== "SYNTHETIC_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH"
  )
    throw invalid();
  const candidate = Object.freeze({ ...(value as AttemptRecord) });
  validateStateShape(candidate);
  if (Buffer.byteLength(canonicalJson(candidate), "utf8") > MAX_RECORD_BYTES)
    throw invalid();
  return candidate;
}

export function validateAttemptSnapshot(value: unknown): AttemptSnapshot {
  if (
    !record(value) ||
    !exactKeys(value, SNAPSHOT_KEYS) ||
    value.schemaVersion !== 1 ||
    value.effect !==
      "SYNTHETIC_NON_CONTENT_SNAPSHOT_NOT_PRODUCTION_PERSISTENCE" ||
    !Array.isArray(value.records) ||
    value.records.length < 1 ||
    value.records.length > 16
  )
    throw invalid();
  const records = value.records.map(validateAttemptRecord);
  const ids = records.map((entry) => entry.attemptId);
  const authorizationIds = records.map((entry) => entry.authorizationId);
  if (
    new Set(ids).size !== ids.length ||
    new Set(authorizationIds).size !== authorizationIds.length ||
    ids.some((id, index) => index > 0 && ids[index - 1]!.localeCompare(id) >= 0)
  )
    throw invalid();
  const snapshot = Object.freeze({
    schemaVersion: 1 as const,
    records: Object.freeze(records),
    effect:
      "SYNTHETIC_NON_CONTENT_SNAPSHOT_NOT_PRODUCTION_PERSISTENCE" as const,
  });
  if (Buffer.byteLength(canonicalJson(snapshot), "utf8") > MAX_SNAPSHOT_BYTES)
    throw invalid();
  return snapshot;
}

export function encodeAttemptSnapshot(value: unknown): string {
  return `${canonicalJson(validateAttemptSnapshot(value))}\n`;
}

export type AtMostOnceMeasurementReport = Readonly<{
  schemaVersion: 1;
  evidenceDate: "2026-07-22";
  providerKind: "OPENAI_RESPONSES";
  corpusSha256: string;
  caseCount: 28;
  passedCases: 28;
  incorrectCases: 0;
  cases: readonly MeasuredCase[];
  gates: Readonly<{
    invalidPreExposureCalls: 0;
    maximumCreateCallsPerAuthorization: 1;
    automaticRetriesScheduled: 0;
    unknownAfterExposureExplicit: true;
    restartSafeWithoutResend: true;
    freshAuthorizationRequired: true;
    duplicateAndCostWarningRequired: true;
    providerExactlyOnceProven: false;
    productionEligible: false;
  }>;
  decision: "ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE";
  effect: "OFFLINE_TEST_ONLY_NO_OPENAI_REQUEST_CREDENTIAL_RESPONSE_OR_PRODUCTION_STORE";
}>;

export async function measureOpenAiAtMostOnceAttemptCorpus(
  order: "REFERENCE" | "REVERSED" = "REFERENCE",
): Promise<AtMostOnceMeasurementReport> {
  let cases = await buildCases();
  if (order === "REVERSED") cases = [...cases].reverse();
  cases.sort((left, right) => left.id.localeCompare(right.id));
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  const maximumCreateCalls = Math.max(
    ...cases.map((entry) => entry.createCalls),
  );
  const invalidPreExposureCalls = cases
    .filter((entry) =>
      [
        "03-malformed-attempt",
        "04-altered-bytes",
        "05-changed-model",
        "06-changed-mapping",
        "07-stale-audit",
        "08-before-exposure",
        "27-expired-authorization",
        "28-oversized-candidate",
      ].includes(entry.id),
    )
    .reduce((total, entry) => total + entry.createCalls, 0);
  const scheduledRetries = cases.reduce(
    (total, entry) => total + entry.scheduledRetries,
    0,
  );
  if (
    cases.length !== 28 ||
    incorrectCases !== 0 ||
    invalidPreExposureCalls !== 0 ||
    maximumCreateCalls > 1 ||
    scheduledRetries !== 0
  )
    throw invalid();
  const frozenCases = Object.freeze(cases);
  return Object.freeze({
    schemaVersion: 1 as const,
    evidenceDate: "2026-07-22" as const,
    providerKind: "OPENAI_RESPONSES" as const,
    corpusSha256: sha256(canonicalJson(frozenCases)),
    caseCount: 28 as const,
    passedCases: 28 as const,
    incorrectCases: 0 as const,
    cases: frozenCases,
    gates: Object.freeze({
      invalidPreExposureCalls: invalidPreExposureCalls as 0,
      maximumCreateCallsPerAuthorization: 1 as const,
      automaticRetriesScheduled: 0 as const,
      unknownAfterExposureExplicit: true as const,
      restartSafeWithoutResend: true as const,
      freshAuthorizationRequired: true as const,
      duplicateAndCostWarningRequired: true as const,
      providerExactlyOnceProven: false as const,
      productionEligible: false as const,
    }),
    decision: "ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE" as const,
    effect:
      "OFFLINE_TEST_ONLY_NO_OPENAI_REQUEST_CREDENTIAL_RESPONSE_OR_PRODUCTION_STORE" as const,
  });
}

type Fixture = Readonly<{
  record: AttemptRecord;
  evidence: CurrentAttemptEvidence;
  request: string;
  now: Date;
}>;

async function buildCases(): Promise<MeasuredCase[]> {
  const cases: MeasuredCase[] = [];
  cases.push(
    await executionCase("01-complete-v1", fixture(1), "COMPLETE", "COMPLETED"),
  );
  cases.push(
    await executionCase("02-complete-v2", fixture(2), "COMPLETE", "COMPLETED"),
  );
  cases.push(
    invalidRecordCase("03-malformed-attempt", {
      ...fixture(1).record,
      state: "INVALID",
    }),
  );
  cases.push(
    await changedCase("04-altered-bytes", fixture(1), {
      request: "Altered synthetic bytes.",
    }),
  );
  cases.push(
    await changedCase("05-changed-model", fixture(1), {
      evidence: { ...fixture(1).evidence, modelId: "model-other" },
    }),
  );
  cases.push(
    await changedCase("06-changed-mapping", fixture(1), {
      evidence: { ...fixture(1).evidence, mappingSetId: "mapping-other" },
    }),
  );
  cases.push(
    await changedCase("07-stale-audit", fixture(1), {
      evidence: {
        ...fixture(1).evidence,
        preflightAuditEventHash: digest("stale-audit"),
      },
    }),
  );
  cases.push(
    await executionCase(
      "08-before-exposure",
      fixture(1),
      "FAIL_BEFORE_EXPOSURE",
      "FAILED_BEFORE_EXPOSURE",
    ),
  );
  cases.push(
    await executionCase(
      "09-timeout-after-exposure",
      fixture(1),
      "TIMEOUT_AFTER_EXPOSURE",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
  );
  cases.push(crashAfterClaimCase("10-crash-after-claim", fixture(1)));
  cases.push(
    await executionCase(
      "11-acknowledgement-loss",
      fixture(1),
      "ACK_THEN_LOSS",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
  );
  cases.push(
    await executionCase(
      "12-malformed-receipt",
      fixture(1),
      "MALFORMED_RECEIPT",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
  );
  cases.push(
    await executionCase(
      "13-terminal-rejection",
      fixture(1),
      "TERMINAL_REJECTION",
      "TERMINAL_REJECTED",
    ),
  );
  cases.push(await replayCase("14-replay-completed", fixture(1), "COMPLETE"));
  cases.push(
    await replayCase("15-replay-unknown", fixture(1), "TIMEOUT_AFTER_EXPOSURE"),
  );
  cases.push(await concurrentCase("16-concurrent-consumption", fixture(1)));
  cases.push(
    await duplicateCompletionCase("17-duplicate-completion", fixture(1)),
  );
  cases.push(
    await restartStableCase(
      "18-completed-restart",
      fixture(1),
      "COMPLETE",
      "COMPLETED",
    ),
  );
  cases.push(
    await restartStableCase(
      "19-unknown-restart",
      fixture(1),
      "TIMEOUT_AFTER_EXPOSURE",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
  );
  cases.push(snapshotInvalidCase("20-corrupt-snapshot", "{not-json}"));
  cases.push(snapshotExtraFieldCase("21-extra-snapshot-field", fixture(1)));
  cases.push(
    await executionCase(
      "22-mismatched-receipt",
      fixture(1),
      "MISMATCHED_RECEIPT",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
  );
  cases.push(inspectionCase("23-manual-inspection", fixture(1)));
  cases.push(
    freshAuthorizationCase("24-fresh-warning-accepted", fixture(1), true),
  );
  cases.push(
    freshAuthorizationCase("25-fresh-warning-missing", fixture(1), false),
  );
  cases.push(await lateCallbackCase("26-late-callback", fixture(1)));
  cases.push(await expiredCase("27-expired-authorization", fixture(1)));
  cases.push(
    invalidRecordCase("28-oversized-candidate", {
      ...fixture(1).record,
      modelId: "x".repeat(MAX_TEXT + 1),
    }),
  );
  return cases;
}

function fixture(mappingSchemaVersion: 1 | 2): Fixture {
  const issuedAt = "2026-07-22T10:00:00.000Z";
  const request =
    mappingSchemaVersion === 1
      ? "Review [[AW_CUSTOMER_1111111111111111]]."
      : "Esamina [[AW_PROJECT_2222222222222222]].";
  const record = validateAttemptRecord({
    schemaVersion: 1,
    authorizationId: `authorization-v${mappingSchemaVersion}`,
    attemptId: `attempt-v${mappingSchemaVersion}`,
    providerKind: "OPENAI_RESPONSES",
    transportEvidenceDate: "2026-07-22",
    issuedAt,
    expiresAt: "2026-07-22T10:01:00.000Z",
    projectId: "project-synthetic",
    workItemId: "work-synthetic",
    handoffId: "handoff-synthetic",
    modelId: "model-reviewed",
    profileDigest: digest("profile"),
    policyDigest: digest("policy"),
    preflightAuditEventId: "audit-synthetic",
    preflightAuditEventHash: digest("audit"),
    transformedRequestDigest: sha256(request),
    mappingSetId: `mapping-v${mappingSchemaVersion}`,
    mappingSchemaVersion,
    state: "PREPARED",
    revision: 0,
    exposureCount: 0,
    providerRequestIdDigest: null,
    responseIdDigest: null,
    outputDigest: null,
    automaticRetryScheduled: false,
    effect: "SYNTHETIC_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH",
  });
  return Object.freeze({
    record,
    evidence: Object.freeze({
      authorizationId: record.authorizationId,
      providerKind: record.providerKind,
      modelId: record.modelId,
      projectId: record.projectId,
      workItemId: record.workItemId,
      handoffId: record.handoffId,
      profileDigest: record.profileDigest,
      policyDigest: record.policyDigest,
      preflightAuditEventId: record.preflightAuditEventId,
      preflightAuditEventHash: record.preflightAuditEventHash,
      preflightDecision: "REVIEWABLE_NOT_AUTHORIZED" as const,
      preflightAuditPresent: true,
      transformedRequestDigest: record.transformedRequestDigest,
      mappingSetId: record.mappingSetId,
      mappingSchemaVersion: record.mappingSchemaVersion,
      transformed: true,
    }),
    request,
    now: new Date("2026-07-22T10:00:01.000Z"),
  });
}

async function executionCase(
  id: string,
  value: Fixture,
  mode: AdapterMode | "FAIL_BEFORE_EXPOSURE",
  expected: CaseOutcome,
): Promise<MeasuredCase> {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  const adapter = new FakeResponsesCreateAdapter();
  let actual: CaseOutcome;
  try {
    actual = (
      await executeSyntheticAttempt({
        store,
        adapter,
        attemptId: value.record.attemptId,
        evidence: value.evidence,
        transformedRequest: value.request,
        now: value.now,
        mode,
      })
    ).state;
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, expected, actual, adapter);
}

async function changedCase(
  id: string,
  value: Fixture,
  patch: Readonly<{
    evidence?: CurrentAttemptEvidence;
    request?: string;
  }>,
): Promise<MeasuredCase> {
  return executionCase(
    id,
    Object.freeze({
      ...value,
      evidence: patch.evidence ?? value.evidence,
      request: patch.request ?? value.request,
    }),
    "COMPLETE",
    "BLOCKED",
  );
}

function invalidRecordCase(id: string, candidate: unknown): MeasuredCase {
  let actual: CaseOutcome = "PREPARED";
  try {
    validateAttemptRecord(candidate);
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, new FakeResponsesCreateAdapter());
}

function crashAfterClaimCase(id: string, value: Fixture): MeasuredCase {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  store.claimExposure(value.record.attemptId);
  const restored = SyntheticAttemptStore.restore(store.snapshot());
  restored.recover();
  return measured(
    id,
    "UNKNOWN_AFTER_EXPOSURE",
    restored.read(value.record.attemptId).state,
    new FakeResponsesCreateAdapter(),
  );
}

async function replayCase(
  id: string,
  value: Fixture,
  mode: AdapterMode,
): Promise<MeasuredCase> {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  const adapter = new FakeResponsesCreateAdapter();
  await executeSyntheticAttempt({
    store,
    adapter,
    attemptId: value.record.attemptId,
    evidence: value.evidence,
    transformedRequest: value.request,
    now: value.now,
    mode,
  });
  let actual: CaseOutcome = store.read(value.record.attemptId).state;
  try {
    await executeSyntheticAttempt({
      store,
      adapter,
      attemptId: value.record.attemptId,
      evidence: value.evidence,
      transformedRequest: value.request,
      now: value.now,
      mode: "COMPLETE",
    });
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, adapter);
}

async function concurrentCase(
  id: string,
  value: Fixture,
): Promise<MeasuredCase> {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  const adapter = new FakeResponsesCreateAdapter();
  const invoke = () =>
    executeSyntheticAttempt({
      store,
      adapter,
      attemptId: value.record.attemptId,
      evidence: value.evidence,
      transformedRequest: value.request,
      now: value.now,
      mode: "COMPLETE" as const,
    });
  const results = await Promise.allSettled([invoke(), invoke()]);
  const completed = results.filter(
    (entry) =>
      entry.status === "fulfilled" && entry.value.state === "COMPLETED",
  ).length;
  const blocked = results.filter((entry) => entry.status === "rejected").length;
  const actual: CaseOutcome =
    completed === 1 && blocked === 1 ? "ONE_COMPLETED_ONE_BLOCKED" : "BLOCKED";
  return measured(id, "ONE_COMPLETED_ONE_BLOCKED", actual, adapter);
}

async function duplicateCompletionCase(
  id: string,
  value: Fixture,
): Promise<MeasuredCase> {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  const adapter = new FakeResponsesCreateAdapter();
  const completed = await executeSyntheticAttempt({
    store,
    adapter,
    attemptId: value.record.attemptId,
    evidence: value.evidence,
    transformedRequest: value.request,
    now: value.now,
    mode: "COMPLETE",
  });
  const duplicate = store.complete(
    value.record.attemptId,
    "Synthetic bounded output.",
  );
  const actual: CaseOutcome =
    duplicate.revision === completed.revision ? duplicate.state : "BLOCKED";
  return measured(id, "COMPLETED", actual, adapter);
}

async function restartStableCase(
  id: string,
  value: Fixture,
  mode: AdapterMode,
  expected: "COMPLETED" | "UNKNOWN_AFTER_EXPOSURE",
): Promise<MeasuredCase> {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  const adapter = new FakeResponsesCreateAdapter();
  await executeSyntheticAttempt({
    store,
    adapter,
    attemptId: value.record.attemptId,
    evidence: value.evidence,
    transformedRequest: value.request,
    now: value.now,
    mode,
  });
  const restored = SyntheticAttemptStore.restore(store.snapshot());
  restored.recover();
  return measured(
    id,
    expected,
    restored.read(value.record.attemptId).state,
    adapter,
  );
}

function snapshotInvalidCase(id: string, source: string): MeasuredCase {
  let actual: CaseOutcome = "PREPARED";
  try {
    SyntheticAttemptStore.restore(JSON.parse(source) as unknown);
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, new FakeResponsesCreateAdapter());
}

function snapshotExtraFieldCase(id: string, value: Fixture): MeasuredCase {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  let actual: CaseOutcome = "PREPARED";
  try {
    SyntheticAttemptStore.restore({ ...store.snapshot(), extra: true });
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, new FakeResponsesCreateAdapter());
}

function inspectionCase(id: string, value: Fixture): MeasuredCase {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  store.claimExposure(value.record.attemptId);
  store.recover();
  const inspection = store.inspect(value.record.attemptId);
  const actual: CaseOutcome =
    inspection.action === "INSPECTION_ONLY_NO_RESEND" &&
    inspection.state === "UNKNOWN_AFTER_EXPOSURE"
      ? "INSPECTION_ONLY"
      : "BLOCKED";
  return measured(
    id,
    "INSPECTION_ONLY",
    actual,
    new FakeResponsesCreateAdapter(),
  );
}

function freshAuthorizationCase(
  id: string,
  value: Fixture,
  warningAccepted: boolean,
): MeasuredCase {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  store.claimExposure(value.record.attemptId);
  store.recover();
  const previous = store.read(value.record.attemptId);
  const next = validateAttemptRecord({
    ...value.record,
    authorizationId: "authorization-fresh",
    attemptId: "attempt-fresh",
  });
  let actual: CaseOutcome;
  try {
    validateFreshAttemptAfterUnknown({
      previous,
      next,
      warning: warningAccepted
        ? "EXPLICIT_DUPLICATE_AND_COST_WARNING_ACCEPTED"
        : "WARNING_NOT_ACCEPTED",
    });
    actual = "ELIGIBLE_NOT_SENT";
  } catch {
    actual = "BLOCKED";
  }
  return measured(
    id,
    warningAccepted ? "ELIGIBLE_NOT_SENT" : "BLOCKED",
    actual,
    new FakeResponsesCreateAdapter(),
  );
}

async function lateCallbackCase(
  id: string,
  value: Fixture,
): Promise<MeasuredCase> {
  const store = new SyntheticAttemptStore();
  store.add(value.record);
  const adapter = new FakeResponsesCreateAdapter();
  await executeSyntheticAttempt({
    store,
    adapter,
    attemptId: value.record.attemptId,
    evidence: value.evidence,
    transformedRequest: value.request,
    now: value.now,
    mode: "TIMEOUT_AFTER_EXPOSURE",
  });
  try {
    store.complete(value.record.attemptId, "Late synthetic output.");
  } catch {
    // A late callback cannot alter terminal unknown evidence.
  }
  return measured(
    id,
    "UNKNOWN_AFTER_EXPOSURE",
    store.read(value.record.attemptId).state,
    adapter,
  );
}

async function expiredCase(id: string, value: Fixture): Promise<MeasuredCase> {
  return executionCase(
    id,
    Object.freeze({ ...value, now: new Date(value.record.expiresAt) }),
    "COMPLETE",
    "BLOCKED",
  );
}

function measured(
  id: string,
  expected: CaseOutcome,
  actual: CaseOutcome,
  adapter: FakeResponsesCreateAdapter,
): MeasuredCase {
  const evidence = adapter.evidence();
  return Object.freeze({
    id,
    expected,
    actual,
    createCalls: evidence.createCalls,
    scheduledRetries: evidence.scheduledRetries,
    matchesExpected: expected === actual,
  });
}

function validateCurrentBinding(
  record: AttemptRecord,
  evidence: CurrentAttemptEvidence,
  request: string,
  now: Date,
): void {
  if (
    record.state !== "PREPARED" ||
    now.getTime() < Date.parse(record.issuedAt) ||
    now.getTime() >= Date.parse(record.expiresAt) ||
    evidence.preflightDecision !== "REVIEWABLE_NOT_AUTHORIZED" ||
    !evidence.preflightAuditPresent ||
    !evidence.transformed ||
    sha256(request) !== record.transformedRequestDigest ||
    evidence.transformedRequestDigest !== record.transformedRequestDigest ||
    evidence.authorizationId !== record.authorizationId ||
    evidence.providerKind !== record.providerKind ||
    evidence.modelId !== record.modelId ||
    evidence.projectId !== record.projectId ||
    evidence.workItemId !== record.workItemId ||
    evidence.handoffId !== record.handoffId ||
    evidence.profileDigest !== record.profileDigest ||
    evidence.policyDigest !== record.policyDigest ||
    evidence.preflightAuditEventId !== record.preflightAuditEventId ||
    evidence.preflightAuditEventHash !== record.preflightAuditEventHash ||
    evidence.mappingSetId !== record.mappingSetId ||
    evidence.mappingSchemaVersion !== record.mappingSchemaVersion
  )
    throw invalid();
}

function validateStateShape(value: AttemptRecord): void {
  const exposed =
    value.state !== "PREPARED" && value.state !== "FAILED_BEFORE_EXPOSURE";
  const acknowledged = ["ACKNOWLEDGED", "COMPLETED"].includes(value.state);
  const completed = value.state === "COMPLETED";
  const identifierPairValid =
    (value.providerRequestIdDigest === null &&
      value.responseIdDigest === null) ||
    (value.providerRequestIdDigest !== null && value.responseIdDigest !== null);
  const revisionValid =
    (value.state === "PREPARED" && value.revision === 0) ||
    (["FAILED_BEFORE_EXPOSURE", "EXPOSURE_STARTED"].includes(value.state) &&
      value.revision === 1) ||
    (value.state === "ACKNOWLEDGED" && value.revision === 2) ||
    (value.state === "COMPLETED" && value.revision === 3) ||
    (value.state === "TERMINAL_REJECTED" && value.revision === 2) ||
    (value.state === "UNKNOWN_AFTER_EXPOSURE" &&
      [2, 3].includes(value.revision));
  if (
    !revisionValid ||
    !identifierPairValid ||
    value.exposureCount !== (exposed ? 1 : 0) ||
    (acknowledged &&
      (value.providerRequestIdDigest === null ||
        value.responseIdDigest === null)) ||
    (!acknowledged &&
      value.state !== "UNKNOWN_AFTER_EXPOSURE" &&
      (value.providerRequestIdDigest !== null ||
        value.responseIdDigest !== null)) ||
    (completed ? value.outputDigest === null : value.outputDigest !== null)
  )
    throw invalid();
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
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

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function digest(value: string): string {
  return sha256(`synthetic:${value}`);
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= MAX_TEXT &&
    !/\p{Cc}/u.test(value)
  );
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function nullableDigest(value: unknown): boolean {
  return value === null || validDigest(value);
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    new Date(value).toISOString() === value
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function invalid(): AtMostOnceEvidenceError {
  return new AtMostOnceEvidenceError();
}
