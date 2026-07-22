import { createHash } from "node:crypto";

export const PRIVACY_AUDIT_SCHEMA_VERSION = 1 as const;
export const PRIVACY_AUDIT_EVENT_LIMIT = 1_000;
export const PRIVACY_AUDIT_PAGE_LIMIT = 100;
export const PRIVACY_AUDIT_EFFECT =
  "LOCAL_DECISION_AUDIT_NOT_AUTHORIZED_OR_DELIVERED" as const;

export type PrivacyAuditCounts = Readonly<{
  evaluatedItems: number;
  omittedItems: number;
  allowedItems: number;
  blockedItems: number;
  defaultedItems: number;
  restrictedItems: number;
  evaluatedItemBytes: number;
  sharedSourceTableBytes: number;
  contextPackIncludedBytes: number;
  omittedBytes: number;
}>;

export type PrivacyAuditEventInput = Readonly<{
  schemaVersion: 1;
  eventId: string;
  occurredAt: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  policyId: string;
  policyVersion: string;
  policyDigest: string;
  contextPackSchemaVersion: number;
  decision: "REVIEWABLE_NOT_AUTHORIZED" | "BLOCKED";
  counts: PrivacyAuditCounts;
  preflightReportDigest: string;
}>;

export type PrivacyAuditEvent = PrivacyAuditEventInput &
  Readonly<{
    predecessorEventHash: string | null;
    eventHash: string;
  }>;

export type PrivacyAuditPage = Readonly<{
  events: readonly PrivacyAuditEvent[];
  nextCursor: string | null;
  total: number;
  effect: typeof PRIVACY_AUDIT_EFFECT;
}>;

export type PrivacyAuditStore = Readonly<{
  append(input: PrivacyAuditEventInput): Promise<PrivacyAuditEvent>;
  find(projectId: string, eventId: string): Promise<PrivacyAuditEvent | null>;
  list(
    projectId: string,
    query: Readonly<{ limit: number; cursor?: string }>,
  ): Promise<PrivacyAuditPage>;
}>;

export class PrivacyAuditError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The local privacy decision audit is unavailable or integrity-invalid. Preserve its files, resolve permissions, capacity, lock, or corruption, then retry; no preflight report was returned.",
      options,
    );
    this.name = "PrivacyAuditError";
  }
}

export class PrivacyDecisionAudit {
  readonly #store: PrivacyAuditStore;
  readonly #ids: () => string;
  readonly #clock: () => Date;

  public constructor(
    dependencies: Readonly<{
      store: PrivacyAuditStore;
      ids: () => string;
      clock: () => Date;
    }>,
  ) {
    this.#store = dependencies.store;
    this.#ids = dependencies.ids;
    this.#clock = dependencies.clock;
  }

  public async record(
    input: Omit<
      PrivacyAuditEventInput,
      "schemaVersion" | "eventId" | "occurredAt"
    >,
  ): Promise<PrivacyAuditEvent> {
    try {
      const candidate = validatePrivacyAuditEventInput({
        schemaVersion: 1,
        eventId: this.#ids(),
        occurredAt: this.#clock().toISOString(),
        ...input,
      });
      const appended = await this.#store.append(candidate);
      const reread = await this.#store.find(
        candidate.projectId,
        candidate.eventId,
      );
      if (reread === null || canonicalJson(reread) !== canonicalJson(appended))
        throw new PrivacyAuditError();
      return reread;
    } catch (error) {
      if (error instanceof PrivacyAuditError) throw error;
      throw new PrivacyAuditError({ cause: error });
    }
  }

  public async list(
    projectId: string,
    query: Readonly<{ limit?: number; cursor?: string }> = {},
  ): Promise<PrivacyAuditPage> {
    try {
      validText(projectId);
      const limit = query.limit ?? 25;
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > PRIVACY_AUDIT_PAGE_LIMIT
      )
        throw new PrivacyAuditError();
      return await this.#store.list(projectId, {
        limit,
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      });
    } catch (error) {
      if (error instanceof PrivacyAuditError) throw error;
      throw new PrivacyAuditError({ cause: error });
    }
  }

  public async show(
    projectId: string,
    eventId: string,
  ): Promise<PrivacyAuditEvent> {
    try {
      validText(projectId);
      validText(eventId);
      const event = await this.#store.find(projectId, eventId);
      if (event === null) throw new PrivacyAuditError();
      return event;
    } catch (error) {
      if (error instanceof PrivacyAuditError) throw error;
      throw new PrivacyAuditError({ cause: error });
    }
  }
}

const INPUT_KEYS = [
  "contextPackSchemaVersion",
  "counts",
  "decision",
  "eventId",
  "handoffId",
  "modelId",
  "occurredAt",
  "policyDigest",
  "policyId",
  "policyVersion",
  "preflightReportDigest",
  "projectId",
  "schemaVersion",
  "workItemId",
] as const;
const EVENT_KEYS = [
  ...INPUT_KEYS,
  "eventHash",
  "predecessorEventHash",
] as const;
const COUNT_KEYS = [
  "allowedItems",
  "blockedItems",
  "contextPackIncludedBytes",
  "defaultedItems",
  "evaluatedItemBytes",
  "evaluatedItems",
  "omittedBytes",
  "omittedItems",
  "restrictedItems",
  "sharedSourceTableBytes",
] as const;
const DIGEST = /^[a-f0-9]{64}$/u;

export function validatePrivacyAuditEventInput(
  value: unknown,
): PrivacyAuditEventInput {
  if (!record(value) || !exactKeys(value, INPUT_KEYS))
    throw new PrivacyAuditError();
  validateCommon(value);
  return Object.freeze({
    ...(value as PrivacyAuditEventInput),
    counts: Object.freeze({ ...(value.counts as PrivacyAuditCounts) }),
  });
}

export function validatePrivacyAuditEvent(value: unknown): PrivacyAuditEvent {
  if (!record(value) || !exactKeys(value, EVENT_KEYS))
    throw new PrivacyAuditError();
  validateCommon(value);
  if (
    (value.predecessorEventHash !== null &&
      (typeof value.predecessorEventHash !== "string" ||
        !DIGEST.test(value.predecessorEventHash))) ||
    typeof value.eventHash !== "string" ||
    !DIGEST.test(value.eventHash)
  )
    throw new PrivacyAuditError();
  const event = Object.freeze({
    ...(value as PrivacyAuditEvent),
    counts: Object.freeze({ ...(value.counts as PrivacyAuditCounts) }),
  });
  if (hashPrivacyAuditEvent(event) !== event.eventHash)
    throw new PrivacyAuditError();
  return event;
}

export function hashPrivacyAuditEvent(
  event: PrivacyAuditEventInput &
    Readonly<{ predecessorEventHash: string | null }>,
): string {
  const hashable = Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== "eventHash"),
  );
  return sha256(canonicalJson(hashable));
}

export function digestCanonical(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function validateCommon(value: Record<string, unknown>): void {
  if (
    value.schemaVersion !== 1 ||
    !validText(value.eventId) ||
    !validTimestamp(value.occurredAt) ||
    !validText(value.projectId) ||
    !validText(value.workItemId) ||
    !validText(value.handoffId) ||
    !validText(value.modelId) ||
    !validText(value.policyId) ||
    !validText(value.policyVersion) ||
    typeof value.policyDigest !== "string" ||
    !DIGEST.test(value.policyDigest) ||
    !Number.isInteger(value.contextPackSchemaVersion) ||
    (value.contextPackSchemaVersion as number) < 1 ||
    !["REVIEWABLE_NOT_AUTHORIZED", "BLOCKED"].includes(
      String(value.decision),
    ) ||
    typeof value.preflightReportDigest !== "string" ||
    !DIGEST.test(value.preflightReportDigest) ||
    !record(value.counts) ||
    !validCounts(value.counts, value.decision)
  )
    throw new PrivacyAuditError();
}
function validCounts(
  value: Record<string, unknown>,
  decision: unknown,
): boolean {
  if (
    !exactKeys(value, COUNT_KEYS) ||
    !COUNT_KEYS.every(
      (key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0,
    )
  )
    return false;
  const counts = value as unknown as PrivacyAuditCounts;
  return (
    counts.evaluatedItems === counts.allowedItems + counts.blockedItems &&
    counts.contextPackIncludedBytes ===
      counts.evaluatedItemBytes + counts.sharedSourceTableBytes &&
    counts.defaultedItems <= counts.evaluatedItems &&
    counts.restrictedItems <= counts.blockedItems &&
    (decision === "REVIEWABLE_NOT_AUTHORIZED"
      ? counts.blockedItems === 0
      : counts.blockedItems > 0)
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
function validText(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    /\p{Cc}/u.test(value)
  )
    throw new PrivacyAuditError();
  return true;
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
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
