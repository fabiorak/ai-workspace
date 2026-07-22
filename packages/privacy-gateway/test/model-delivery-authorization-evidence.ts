import { createHash } from "node:crypto";

export const AUTHORIZATION_LIFETIME_MS = 60_000;
const MAX_CANONICAL_BYTES = 4 * 1024;
const DIGEST = /^[a-f0-9]{64}$/u;

export type AuthorizationIntent = Readonly<{
  schemaVersion: 1;
  authorizationId: string;
  issuedAt: string;
  expiresAt: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  profileDigest: string;
  policyDigest: string;
  preflightReportDigest: string;
  preflightAuditEventId: string;
  preflightAuditEventHash: string;
  contextPackSchemaVersion: number;
  transformedRequestDigest: string;
  mappingSetId: string;
  mappingSchemaVersion: 1 | 2;
  confirmation: "EXPLICIT_USER_CONFIRMATION";
  effect: "AUTHORIZATION_INTENT_NOT_DELIVERED";
}>;

export type CurrentAuthorizationEvidence = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  profileDigest: string;
  policyDigest: string;
  preflightReportDigest: string;
  preflightAuditEventId: string;
  preflightAuditEventHash: string;
  preflightDecision: "REVIEWABLE_NOT_AUTHORIZED" | "BLOCKED";
  preflightAuditPresent: boolean;
  contextPackSchemaVersion: number;
  mappingSetId: string;
  mappingSchemaVersion: 1 | 2;
  transformedRequestDigest: string;
  transformed: boolean;
}>;

type DeliveryFailurePhase =
  "NONE" | "BEFORE_EXPOSURE" | "AFTER_EXPOSURE" | "AFTER_ACCEPTANCE";
type IntentState = "AVAILABLE" | "RESERVED" | "CONSUMED";

export type SyntheticReceipt = Readonly<{
  authorizationId: string;
  transformedRequestDigest: string;
  syntheticReceiptId: string;
  localState: "CONSUMED";
  effect: "SYNTHETIC_CONSUMPTION_NOT_PROVIDER_DELIVERY_OR_ACCEPTANCE";
}>;

export class AuthorizationEvidenceError extends Error {
  public constructor() {
    super(
      "The synthetic delivery authorization is invalid, stale, expired, altered, replayed, incomplete, or cross-scoped. No production delivery occurred.",
    );
    this.name = "AuthorizationEvidenceError";
  }
}

export class InMemorySingleUseAuthorizationStore {
  readonly #entries = new Map<
    string,
    { intent: AuthorizationIntent; state: IntentState }
  >();

  public add(value: unknown): AuthorizationIntent {
    const intent = validateAuthorizationIntent(value);
    if (this.#entries.has(intent.authorizationId)) throw invalid();
    this.#entries.set(intent.authorizationId, { intent, state: "AVAILABLE" });
    return intent;
  }

  public reserve(authorizationId: string): AuthorizationIntent {
    const entry = this.#entries.get(authorizationId);
    if (entry === undefined || entry.state !== "AVAILABLE") throw invalid();
    entry.state = "RESERVED";
    return entry.intent;
  }

  public release(authorizationId: string): void {
    const entry = this.#entries.get(authorizationId);
    if (entry === undefined || entry.state !== "RESERVED") throw invalid();
    entry.state = "AVAILABLE";
  }

  public consume(authorizationId: string): void {
    const entry = this.#entries.get(authorizationId);
    if (entry === undefined || entry.state !== "RESERVED") throw invalid();
    entry.state = "CONSUMED";
  }

  public state(authorizationId: string): IntentState | null {
    return this.#entries.get(authorizationId)?.state ?? null;
  }
}

export class SyntheticInMemoryDeliveryAdapter {
  readonly #exposedDigests: string[] = [];
  readonly #acceptedDigests: string[] = [];

  public async deliver(
    request: string,
    phase: DeliveryFailurePhase = "NONE",
  ): Promise<string> {
    if (phase === "BEFORE_EXPOSURE") throw invalid();
    const digest = sha256(request);
    this.#exposedDigests.push(digest);
    await Promise.resolve();
    if (phase === "AFTER_EXPOSURE") throw invalid();
    this.#acceptedDigests.push(digest);
    if (phase === "AFTER_ACCEPTANCE") throw invalid();
    return `synthetic-receipt-${this.#acceptedDigests.length}`;
  }

  public evidence(): Readonly<{
    exposureCount: number;
    acceptanceCount: number;
    exposedDigests: readonly string[];
  }> {
    return Object.freeze({
      exposureCount: this.#exposedDigests.length,
      acceptanceCount: this.#acceptedDigests.length,
      exposedDigests: Object.freeze([...this.#exposedDigests]),
    });
  }
}

export async function consumeSyntheticAuthorization(
  input: Readonly<{
    store: InMemorySingleUseAuthorizationStore;
    adapter: SyntheticInMemoryDeliveryAdapter;
    authorizationId: string;
    evidence: CurrentAuthorizationEvidence;
    transformedRequest: string;
    now: Date;
    failurePhase?: DeliveryFailurePhase;
  }>,
): Promise<SyntheticReceipt> {
  let reserved = false;
  try {
    const intent = input.store.reserve(input.authorizationId);
    reserved = true;
    validateConsumption(
      intent,
      input.evidence,
      input.transformedRequest,
      input.now,
    );
    const before = input.adapter.evidence().exposureCount;
    let receiptId: string;
    try {
      receiptId = await input.adapter.deliver(
        input.transformedRequest,
        input.failurePhase,
      );
    } catch (error) {
      const wasExposed = input.adapter.evidence().exposureCount > before;
      if (wasExposed) input.store.consume(intent.authorizationId);
      else input.store.release(intent.authorizationId);
      reserved = false;
      throw error;
    }
    input.store.consume(intent.authorizationId);
    reserved = false;
    return Object.freeze({
      authorizationId: intent.authorizationId,
      transformedRequestDigest: intent.transformedRequestDigest,
      syntheticReceiptId: receiptId,
      localState: "CONSUMED" as const,
      effect:
        "SYNTHETIC_CONSUMPTION_NOT_PROVIDER_DELIVERY_OR_ACCEPTANCE" as const,
    });
  } catch (error) {
    if (reserved) input.store.release(input.authorizationId);
    if (error instanceof AuthorizationEvidenceError) throw error;
    throw invalid();
  }
}

const INTENT_KEYS = [
  "authorizationId",
  "confirmation",
  "contextPackSchemaVersion",
  "effect",
  "expiresAt",
  "handoffId",
  "issuedAt",
  "mappingSchemaVersion",
  "mappingSetId",
  "modelId",
  "policyDigest",
  "preflightAuditEventHash",
  "preflightAuditEventId",
  "preflightReportDigest",
  "profileDigest",
  "projectId",
  "schemaVersion",
  "transformedRequestDigest",
  "workItemId",
] as const;

export function validateAuthorizationIntent(
  value: unknown,
): AuthorizationIntent {
  if (
    !record(value) ||
    !exactKeys(value, INTENT_KEYS) ||
    value.schemaVersion !== 1 ||
    !validText(value.authorizationId) ||
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
    !validDigest(value.preflightReportDigest) ||
    !validText(value.preflightAuditEventId) ||
    !validDigest(value.preflightAuditEventHash) ||
    !Number.isSafeInteger(value.contextPackSchemaVersion) ||
    (value.contextPackSchemaVersion as number) < 1 ||
    !validDigest(value.transformedRequestDigest) ||
    !validText(value.mappingSetId) ||
    ![1, 2].includes(value.mappingSchemaVersion as number) ||
    value.confirmation !== "EXPLICIT_USER_CONFIRMATION" ||
    value.effect !== "AUTHORIZATION_INTENT_NOT_DELIVERED"
  )
    throw invalid();
  const intent = Object.freeze({ ...(value as AuthorizationIntent) });
  if (Buffer.byteLength(canonicalJson(intent), "utf8") > MAX_CANONICAL_BYTES)
    throw invalid();
  return intent;
}

export function encodeAuthorizationIntent(value: unknown): string {
  return `${canonicalJson(validateAuthorizationIntent(value))}\n`;
}

function validateConsumption(
  intent: AuthorizationIntent,
  evidence: CurrentAuthorizationEvidence,
  request: string,
  now: Date,
): void {
  if (
    !validTimestamp(now.toISOString()) ||
    now.getTime() < Date.parse(intent.issuedAt) ||
    now.getTime() >= Date.parse(intent.expiresAt) ||
    evidence.preflightDecision !== "REVIEWABLE_NOT_AUTHORIZED" ||
    !evidence.preflightAuditPresent ||
    !evidence.transformed ||
    sha256(request) !== intent.transformedRequestDigest ||
    evidence.transformedRequestDigest !== intent.transformedRequestDigest ||
    evidence.projectId !== intent.projectId ||
    evidence.workItemId !== intent.workItemId ||
    evidence.handoffId !== intent.handoffId ||
    evidence.modelId !== intent.modelId ||
    evidence.profileDigest !== intent.profileDigest ||
    evidence.policyDigest !== intent.policyDigest ||
    evidence.preflightReportDigest !== intent.preflightReportDigest ||
    evidence.preflightAuditEventId !== intent.preflightAuditEventId ||
    evidence.preflightAuditEventHash !== intent.preflightAuditEventHash ||
    evidence.contextPackSchemaVersion !== intent.contextPackSchemaVersion ||
    evidence.mappingSetId !== intent.mappingSetId ||
    evidence.mappingSchemaVersion !== intent.mappingSchemaVersion
  )
    throw invalid();
}

export type AuthorizationMeasurementReport = Readonly<{
  schemaVersion: 1;
  corpusSha256: string;
  caseCount: number;
  passedCases: number;
  incorrectCases: number;
  transientConfirmation: Readonly<{
    crossesProcessBoundary: false;
    restartSafe: false;
    productionEligible: false;
    decision: "REJECT";
  }>;
  persistedReusableGrant: Readonly<{
    replayPrevented: false;
    productionEligible: false;
    decision: "REJECT";
  }>;
  transactionCoupledSingleUse: Readonly<{
    exactBindingPassed: true;
    localReplayPrevented: true;
    concurrentReplayPrevented: true;
    afterExposureOutcomeKnowable: false;
    externalExactlyOnceProven: false;
    productionEligible: false;
    decision: "EVIDENCE_ONLY";
  }>;
  crashMatrix: readonly Readonly<{
    phase: DeliveryFailurePhase;
    byteExposure: boolean;
    providerOutcomeKnowable: boolean;
    automaticRetrySafe: boolean;
  }>[];
  cases: readonly Readonly<{
    id: string;
    expected: "CONSUMED" | "BLOCKED" | "AMBIGUOUS";
    actual: "CONSUMED" | "BLOCKED" | "AMBIGUOUS";
    exposureCount: number;
    acceptanceCount: number;
    matchesExpected: boolean;
  }>[];
  decision: "EVIDENCE_ONLY";
  effect: "DEVELOPMENT_ONLY_NO_PROVIDER_NETWORK_MODEL_OR_DELIVERY";
}>;

export async function measureModelDeliveryAuthorizationCorpus(): Promise<AuthorizationMeasurementReport> {
  const cases = [];
  cases.push(await validCase("01-valid-v1", fixture(1, 0)));
  cases.push(await validCase("02-valid-v2", fixture(2, 60_000)));
  const mutations: readonly [string, (value: Fixture) => Fixture][] = [
    [
      "03-blocked-preflight",
      (value) => mutateEvidence(value, { preflightDecision: "BLOCKED" }),
    ],
    [
      "04-missing-audit",
      (value) => mutateEvidence(value, { preflightAuditPresent: false }),
    ],
    [
      "05-changed-audit-hash",
      (value) =>
        mutateEvidence(value, {
          preflightAuditEventHash: digest("changed-audit"),
        }),
    ],
    [
      "06-stale-report",
      (value) =>
        mutateEvidence(value, {
          preflightReportDigest: digest("stale-report"),
        }),
    ],
    [
      "07-changed-policy",
      (value) =>
        mutateEvidence(value, { policyDigest: digest("changed-policy") }),
    ],
    [
      "08-changed-profile",
      (value) =>
        mutateEvidence(value, { profileDigest: digest("changed-profile") }),
    ],
    [
      "09-changed-handoff",
      (value) => mutateEvidence(value, { handoffId: "handoff-b" }),
    ],
    [
      "10-wrong-model",
      (value) => mutateEvidence(value, { modelId: "model-b" }),
    ],
    [
      "11-wrong-mapping",
      (value) => mutateEvidence(value, { mappingSetId: "mapping-b" }),
    ],
    [
      "12-raw-request",
      (value) => mutateEvidence(value, { transformed: false }),
    ],
    [
      "13-altered-bytes",
      (value) => ({ ...value, request: `${value.request} altered` }),
    ],
    [
      "14-cross-project",
      (value) => mutateEvidence(value, { projectId: "project-b" }),
    ],
  ];
  for (const [id, mutate] of mutations)
    cases.push(await blockedCase(id, mutate(fixture(1, 0))));
  cases.push(await expiredCase("15-expired", fixture(1, 0)));
  cases.push(await malformedExpiryCase("16-malformed-expiry", fixture(1, 0)));
  cases.push(await duplicateCase("17-duplicate-identity", fixture(1, 0)));
  cases.push(await replayCase("18-replay", fixture(1, 0)));
  cases.push(await concurrentCase("19-concurrent", fixture(1, 0)));
  cases.push(
    await crashCase(
      "20-crash-before-exposure",
      fixture(1, 0),
      "BEFORE_EXPOSURE",
      "BLOCKED",
    ),
  );
  cases.push(
    await crashCase(
      "21-crash-after-exposure",
      fixture(1, 0),
      "AFTER_EXPOSURE",
      "AMBIGUOUS",
    ),
  );
  cases.push(
    await crashCase(
      "22-crash-after-acceptance",
      fixture(1, 0),
      "AFTER_ACCEPTANCE",
      "AMBIGUOUS",
    ),
  );
  const canonicalCases = cases.map(
    ({ id, expected, actual, exposureCount, acceptanceCount }) => ({
      id,
      expected,
      actual,
      exposureCount,
      acceptanceCount,
    }),
  );
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  if (incorrectCases > 0)
    throw new Error(
      "The frozen authorization corpus did not reproduce its expected outcomes.",
    );
  return Object.freeze({
    schemaVersion: 1 as const,
    corpusSha256: sha256(canonicalJson(canonicalCases)),
    caseCount: cases.length,
    passedCases: cases.length - incorrectCases,
    incorrectCases,
    transientConfirmation: Object.freeze({
      crossesProcessBoundary: false as const,
      restartSafe: false as const,
      productionEligible: false as const,
      decision: "REJECT" as const,
    }),
    persistedReusableGrant: Object.freeze({
      replayPrevented: false as const,
      productionEligible: false as const,
      decision: "REJECT" as const,
    }),
    transactionCoupledSingleUse: Object.freeze({
      exactBindingPassed: true as const,
      localReplayPrevented: true as const,
      concurrentReplayPrevented: true as const,
      afterExposureOutcomeKnowable: false as const,
      externalExactlyOnceProven: false as const,
      productionEligible: false as const,
      decision: "EVIDENCE_ONLY" as const,
    }),
    crashMatrix: Object.freeze([
      Object.freeze({
        phase: "BEFORE_EXPOSURE" as const,
        byteExposure: false,
        providerOutcomeKnowable: true,
        automaticRetrySafe: false,
      }),
      Object.freeze({
        phase: "AFTER_EXPOSURE" as const,
        byteExposure: true,
        providerOutcomeKnowable: false,
        automaticRetrySafe: false,
      }),
      Object.freeze({
        phase: "AFTER_ACCEPTANCE" as const,
        byteExposure: true,
        providerOutcomeKnowable: false,
        automaticRetrySafe: false,
      }),
    ]),
    cases: Object.freeze(cases),
    decision: "EVIDENCE_ONLY" as const,
    effect: "DEVELOPMENT_ONLY_NO_PROVIDER_NETWORK_MODEL_OR_DELIVERY" as const,
  });
}

type Fixture = Readonly<{
  intent: AuthorizationIntent;
  evidence: CurrentAuthorizationEvidence;
  request: string;
  now: Date;
}>;
type MeasuredCase = AuthorizationMeasurementReport["cases"][number];

function fixture(mappingSchemaVersion: 1 | 2, offset: number): Fixture {
  const issuedAt = new Date(Date.parse("2026-07-22T09:00:00.000Z") + offset);
  const request =
    mappingSchemaVersion === 1
      ? "Review [[AW_CUSTOMER_1111111111111111]]."
      : "Esamina [[AW_PROJECT_2222222222222222]].";
  const intent = validateAuthorizationIntent({
    schemaVersion: 1,
    authorizationId: `authorization-v${mappingSchemaVersion}`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(
      issuedAt.getTime() + AUTHORIZATION_LIFETIME_MS,
    ).toISOString(),
    projectId: "project-a",
    workItemId: "work-a",
    handoffId: "handoff-a",
    modelId: "model-a",
    profileDigest: digest("profile-a"),
    policyDigest: digest("policy-a"),
    preflightReportDigest: digest("report-a"),
    preflightAuditEventId: "audit-a",
    preflightAuditEventHash: digest("audit-event-a"),
    contextPackSchemaVersion: 2,
    transformedRequestDigest: sha256(request),
    mappingSetId: `mapping-v${mappingSchemaVersion}`,
    mappingSchemaVersion,
    confirmation: "EXPLICIT_USER_CONFIRMATION",
    effect: "AUTHORIZATION_INTENT_NOT_DELIVERED",
  });
  const evidence: CurrentAuthorizationEvidence = Object.freeze({
    projectId: intent.projectId,
    workItemId: intent.workItemId,
    handoffId: intent.handoffId,
    modelId: intent.modelId,
    profileDigest: intent.profileDigest,
    policyDigest: intent.policyDigest,
    preflightReportDigest: intent.preflightReportDigest,
    preflightAuditEventId: intent.preflightAuditEventId,
    preflightAuditEventHash: intent.preflightAuditEventHash,
    preflightDecision: "REVIEWABLE_NOT_AUTHORIZED",
    preflightAuditPresent: true,
    contextPackSchemaVersion: intent.contextPackSchemaVersion,
    mappingSetId: intent.mappingSetId,
    mappingSchemaVersion: intent.mappingSchemaVersion,
    transformedRequestDigest: intent.transformedRequestDigest,
    transformed: true,
  });
  return Object.freeze({
    intent,
    evidence,
    request,
    now: new Date(issuedAt.getTime() + 1_000),
  });
}

function mutateEvidence(
  value: Fixture,
  patch: Partial<CurrentAuthorizationEvidence>,
): Fixture {
  return Object.freeze({
    ...value,
    evidence: Object.freeze({ ...value.evidence, ...patch }),
  });
}
async function validCase(id: string, value: Fixture): Promise<MeasuredCase> {
  return runCase(id, value, "CONSUMED");
}
async function blockedCase(id: string, value: Fixture): Promise<MeasuredCase> {
  return runCase(id, value, "BLOCKED");
}
async function runCase(
  id: string,
  value: Fixture,
  expected: MeasuredCase["expected"],
): Promise<MeasuredCase> {
  const store = new InMemorySingleUseAuthorizationStore();
  store.add(value.intent);
  const adapter = new SyntheticInMemoryDeliveryAdapter();
  let actual: MeasuredCase["actual"];
  try {
    await consumeSyntheticAuthorization({
      store,
      adapter,
      authorizationId: value.intent.authorizationId,
      evidence: value.evidence,
      transformedRequest: value.request,
      now: value.now,
    });
    actual = "CONSUMED";
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, expected, actual, adapter);
}
async function expiredCase(id: string, value: Fixture): Promise<MeasuredCase> {
  return blockedCase(id, { ...value, now: new Date(value.intent.expiresAt) });
}
async function malformedExpiryCase(
  id: string,
  value: Fixture,
): Promise<MeasuredCase> {
  const store = new InMemorySingleUseAuthorizationStore();
  let actual: MeasuredCase["actual"] = "CONSUMED";
  try {
    store.add({
      ...value.intent,
      expiresAt: new Date(Date.parse(value.intent.expiresAt) + 1).toISOString(),
    });
  } catch {
    actual = "BLOCKED";
  }
  return measured(
    id,
    "BLOCKED",
    actual,
    new SyntheticInMemoryDeliveryAdapter(),
  );
}
async function duplicateCase(
  id: string,
  value: Fixture,
): Promise<MeasuredCase> {
  const store = new InMemorySingleUseAuthorizationStore();
  store.add(value.intent);
  let actual: MeasuredCase["actual"] = "CONSUMED";
  try {
    store.add(value.intent);
  } catch {
    actual = "BLOCKED";
  }
  return measured(
    id,
    "BLOCKED",
    actual,
    new SyntheticInMemoryDeliveryAdapter(),
  );
}
async function replayCase(id: string, value: Fixture): Promise<MeasuredCase> {
  const store = new InMemorySingleUseAuthorizationStore();
  store.add(value.intent);
  const adapter = new SyntheticInMemoryDeliveryAdapter();
  await consumeSyntheticAuthorization({
    store,
    adapter,
    authorizationId: value.intent.authorizationId,
    evidence: value.evidence,
    transformedRequest: value.request,
    now: value.now,
  });
  let actual: MeasuredCase["actual"] = "CONSUMED";
  try {
    await consumeSyntheticAuthorization({
      store,
      adapter,
      authorizationId: value.intent.authorizationId,
      evidence: value.evidence,
      transformedRequest: value.request,
      now: value.now,
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
  const store = new InMemorySingleUseAuthorizationStore();
  store.add(value.intent);
  const adapter = new SyntheticInMemoryDeliveryAdapter();
  const input = {
    store,
    adapter,
    authorizationId: value.intent.authorizationId,
    evidence: value.evidence,
    transformedRequest: value.request,
    now: value.now,
  };
  const results = await Promise.allSettled([
    consumeSyntheticAuthorization(input),
    consumeSyntheticAuthorization(input),
  ]);
  const actual =
    results.filter((entry) => entry.status === "fulfilled").length === 1 &&
    adapter.evidence().exposureCount === 1
      ? "BLOCKED"
      : "CONSUMED";
  return measured(id, "BLOCKED", actual, adapter);
}
async function crashCase(
  id: string,
  value: Fixture,
  failurePhase: DeliveryFailurePhase,
  expected: MeasuredCase["expected"],
): Promise<MeasuredCase> {
  const store = new InMemorySingleUseAuthorizationStore();
  store.add(value.intent);
  const adapter = new SyntheticInMemoryDeliveryAdapter();
  let actual: MeasuredCase["actual"] = "CONSUMED";
  try {
    await consumeSyntheticAuthorization({
      store,
      adapter,
      authorizationId: value.intent.authorizationId,
      evidence: value.evidence,
      transformedRequest: value.request,
      now: value.now,
      failurePhase,
    });
  } catch {
    actual = adapter.evidence().exposureCount > 0 ? "AMBIGUOUS" : "BLOCKED";
  }
  return measured(id, expected, actual, adapter);
}
function measured(
  id: string,
  expected: MeasuredCase["expected"],
  actual: MeasuredCase["actual"],
  adapter: SyntheticInMemoryDeliveryAdapter,
): MeasuredCase {
  const evidence = adapter.evidence();
  return Object.freeze({
    id,
    expected,
    actual,
    exposureCount: evidence.exposureCount,
    acceptanceCount: evidence.acceptanceCount,
    matchesExpected: expected === actual,
  });
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
function digest(label: string): string {
  return sha256(`synthetic-${label}`);
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 256 &&
    !/\p{Cc}/u.test(value)
  );
}
function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}
function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
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
function invalid(): AuthorizationEvidenceError {
  return new AuthorizationEvidenceError();
}
