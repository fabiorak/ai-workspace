import {
  canonicalJson,
  hashPrivacyAuditEvent,
  validatePrivacyAuditEvent,
  type PrivacyAuditEvent,
  type PrivacyAuditEventInput,
} from "../packages/privacy-audit/src/index.ts";

const reviewable: PrivacyAuditEventInput = {
  schemaVersion: 1,
  eventId: "reviewable-a",
  occurredAt: "2026-07-22T09:00:00.000Z",
  projectId: "project-a",
  workItemId: "work-a",
  handoffId: "handoff-a",
  modelId: "model-a",
  policyId: "fictional-balanced-policy",
  policyVersion: "1.0.0",
  policyDigest: "a".repeat(64),
  contextPackSchemaVersion: 2,
  decision: "REVIEWABLE_NOT_AUTHORIZED",
  counts: {
    evaluatedItems: 3,
    omittedItems: 1,
    allowedItems: 3,
    blockedItems: 0,
    defaultedItems: 1,
    restrictedItems: 0,
    evaluatedItemBytes: 120,
    sharedSourceTableBytes: 30,
    contextPackIncludedBytes: 150,
    omittedBytes: 20,
  },
  preflightReportDigest: "b".repeat(64),
};

function chained(
  input: PrivacyAuditEventInput,
  predecessorEventHash: string | null,
): PrivacyAuditEvent {
  const hashable = { ...input, predecessorEventHash };
  return validatePrivacyAuditEvent({
    ...hashable,
    eventHash: hashPrivacyAuditEvent(hashable),
  });
}

const first = chained(reviewable, null);
const second = chained(
  {
    ...reviewable,
    eventId: "blocked-b",
    occurredAt: "2026-07-22T09:00:01.000Z",
    decision: "BLOCKED",
    counts: {
      ...reviewable.counts,
      omittedItems: 0,
      allowedItems: 2,
      blockedItems: 1,
      defaultedItems: 0,
      restrictedItems: 1,
      omittedBytes: 0,
    },
    preflightReportDigest: "c".repeat(64),
  },
  first.eventHash,
);
const canonical = canonicalJson([first, second]);
const forbidden = [
  "content",
  "contentSha256",
  "detectorCategory",
  "path",
  "report",
  "mapping",
  "passphrase",
  "prompt",
  "response",
  "restoredContent",
];
const report = Object.freeze({
  schemaVersion: 1,
  caseCount: 2,
  decisions: Object.freeze({ reviewable: 1, blocked: 1 }),
  canonicalBytes: Buffer.byteLength(canonical, "utf8"),
  firstEventHash: first.eventHash,
  secondEventHash: second.eventHash,
  chainValid: second.predecessorEventHash === first.eventHash,
  deterministic:
    canonicalJson({ second, first }) === canonicalJson({ first, second }),
  forbiddenFieldCount: forbidden.filter((field) =>
    Object.prototype.hasOwnProperty.call(first, field),
  ).length,
  fixedEventBound: 1_000,
  decision: "ADOPT_SEPARATE_BOUNDED_JSON_AUDIT" as const,
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_OR_DELIVERY_AUTHORITY" as const,
});
if (
  !report.chainValid ||
  !report.deterministic ||
  report.forbiddenFieldCount !== 0
)
  throw new Error("The frozen privacy-audit corpus did not satisfy its gates.");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
