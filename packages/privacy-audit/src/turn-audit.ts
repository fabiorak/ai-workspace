import {
  canonicalJson,
  digestCanonical,
  PrivacyAuditError,
  type PrivacyAuditCounts,
} from "./index.ts";

/** Additive audit for turns without a kept handoff. Legacy v1 is untouched. */
export type TurnAuditScope =
  | Readonly<{ kind: "GENERAL" }>
  | Readonly<{ kind: "PROJECT"; projectId: string }>;
export type TurnPrivacyAuditInput = Readonly<{
  schemaVersion: 2;
  eventId: string;
  occurredAt: string;
  scope: TurnAuditScope;
  conversationId: string;
  modelId: string;
  policyId: string;
  policyVersion: string;
  policyDigest: string;
  decision: "REVIEWABLE_NOT_AUTHORIZED" | "BLOCKED";
  counts: PrivacyAuditCounts & Readonly<{ unknownByteOmissions: number }>;
  preflightReportDigest: string;
  payloadDigest: string;
}>;
export type TurnPrivacyAuditEvent = TurnPrivacyAuditInput &
  Readonly<{
    predecessorEventHash: string | null;
    eventHash: string;
  }>;
export type TurnPrivacyAuditStore = Readonly<{
  append(input: TurnPrivacyAuditInput): Promise<TurnPrivacyAuditEvent>;
  find(
    scope: TurnAuditScope,
    eventId: string,
  ): Promise<TurnPrivacyAuditEvent | null>;
  list(scope: TurnAuditScope): Promise<readonly TurnPrivacyAuditEvent[]>;
}>;

export class TurnPrivacyDecisionAudit {
  private readonly dependencies: Readonly<{
    store: TurnPrivacyAuditStore;
    ids: () => string;
    clock: () => Date;
  }>;
  constructor(
    dependencies: Readonly<{
      store: TurnPrivacyAuditStore;
      ids: () => string;
      clock: () => Date;
    }>,
  ) {
    this.dependencies = dependencies;
  }

  async record(
    input: Omit<
      TurnPrivacyAuditInput,
      "schemaVersion" | "eventId" | "occurredAt"
    >,
  ) {
    const candidate = validateTurnPrivacyAuditInput({
      ...input,
      schemaVersion: 2,
      eventId: this.dependencies.ids(),
      occurredAt: this.dependencies.clock().toISOString(),
    });
    const written = await this.dependencies.store.append(candidate);
    const reread = await this.dependencies.store.find(
      candidate.scope,
      candidate.eventId,
    );
    if (reread === null || canonicalJson(reread) !== canonicalJson(written))
      throw new PrivacyAuditError();
    const verified = validateTurnPrivacyAuditEvent(reread);
    const {
      eventHash: _hash,
      predecessorEventHash: _predecessor,
      ...persistedInput
    } = verified;
    void _hash;
    void _predecessor;
    if (canonicalJson(persistedInput) !== canonicalJson(candidate))
      throw new PrivacyAuditError();
    return verified;
  }
}

const INPUT_KEYS = [
  "schemaVersion",
  "eventId",
  "occurredAt",
  "scope",
  "conversationId",
  "modelId",
  "policyId",
  "policyVersion",
  "policyDigest",
  "decision",
  "counts",
  "preflightReportDigest",
  "payloadDigest",
];
const COUNT_KEYS = [
  "evaluatedItems",
  "omittedItems",
  "allowedItems",
  "blockedItems",
  "defaultedItems",
  "restrictedItems",
  "evaluatedItemBytes",
  "sharedSourceTableBytes",
  "contextPackIncludedBytes",
  "omittedBytes",
  "unknownByteOmissions",
];
const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 256 &&
  !/\p{Cc}/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

export function validateTurnAuditScope(value: unknown): TurnAuditScope {
  if (!record(value)) throw new PrivacyAuditError();
  if (value.kind === "GENERAL" && exact(value, ["kind"]))
    return Object.freeze({ kind: "GENERAL" });
  if (
    value.kind === "PROJECT" &&
    exact(value, ["kind", "projectId"]) &&
    text(value.projectId)
  )
    return Object.freeze({ kind: "PROJECT", projectId: value.projectId });
  throw new PrivacyAuditError();
}

export function validateTurnPrivacyAuditInput(
  value: unknown,
): TurnPrivacyAuditInput {
  if (
    !record(value) ||
    !exact(value, INPUT_KEYS) ||
    value.schemaVersion !== 2 ||
    ![
      value.eventId,
      value.conversationId,
      value.modelId,
      value.policyId,
      value.policyVersion,
    ].every(text) ||
    ![
      value.policyDigest,
      value.preflightReportDigest,
      value.payloadDigest,
    ].every(hash) ||
    !text(value.occurredAt) ||
    Number.isNaN(Date.parse(value.occurredAt)) ||
    new Date(value.occurredAt).toISOString() !== value.occurredAt ||
    !["REVIEWABLE_NOT_AUTHORIZED", "BLOCKED"].includes(
      String(value.decision),
    ) ||
    !record(value.counts) ||
    !exact(value.counts, COUNT_KEYS)
  )
    throw new PrivacyAuditError();
  const counts = value.counts as unknown as TurnPrivacyAuditInput["counts"];
  if (
    !Object.values(counts).every(
      (count) => Number.isSafeInteger(count) && count >= 0,
    ) ||
    counts.evaluatedItems !== counts.allowedItems + counts.blockedItems ||
    counts.contextPackIncludedBytes !==
      counts.evaluatedItemBytes + counts.sharedSourceTableBytes ||
    counts.defaultedItems > counts.evaluatedItems ||
    counts.restrictedItems > counts.blockedItems ||
    counts.unknownByteOmissions > counts.omittedItems ||
    (value.decision === "BLOCKED"
      ? counts.blockedItems === 0
      : counts.blockedItems !== 0)
  )
    throw new PrivacyAuditError();
  return Object.freeze({
    ...(value as TurnPrivacyAuditInput),
    scope: validateTurnAuditScope(value.scope),
    counts: Object.freeze({ ...counts }),
  });
}

export function hashTurnPrivacyAuditEvent(
  value: TurnPrivacyAuditInput &
    Readonly<{ predecessorEventHash: string | null }>,
): string {
  return digestCanonical(value);
}

export function validateTurnPrivacyAuditEvent(
  value: unknown,
): TurnPrivacyAuditEvent {
  if (
    !record(value) ||
    !exact(value, [...INPUT_KEYS, "predecessorEventHash", "eventHash"]) ||
    !hash(value.eventHash) ||
    !(value.predecessorEventHash === null || hash(value.predecessorEventHash))
  )
    throw new PrivacyAuditError();
  const { eventHash, predecessorEventHash, ...input } = value;
  const candidate = {
    ...validateTurnPrivacyAuditInput(input),
    predecessorEventHash,
  };
  if (hashTurnPrivacyAuditEvent(candidate) !== eventHash)
    throw new PrivacyAuditError();
  return Object.freeze({ ...candidate, eventHash });
}
