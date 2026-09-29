import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TurnPrivacyDecisionAudit,
  hashTurnPrivacyAuditEvent,
  validateTurnPrivacyAuditInput,
  type TurnPrivacyAuditInput,
  type TurnPrivacyAuditEvent,
} from "../src/index.ts";

const input: Omit<
  TurnPrivacyAuditInput,
  "schemaVersion" | "eventId" | "occurredAt"
> = {
  scope: { kind: "GENERAL" },
  conversationId: "conversation",
  modelId: "model",
  policyId: "policy",
  policyVersion: "1",
  policyDigest: "a".repeat(64),
  decision: "REVIEWABLE_NOT_AUTHORIZED",
  preflightReportDigest: "b".repeat(64),
  payloadDigest: "c".repeat(64),
  counts: {
    evaluatedItems: 1,
    omittedItems: 0,
    allowedItems: 1,
    blockedItems: 0,
    defaultedItems: 1,
    restrictedItems: 0,
    evaluatedItemBytes: 42,
    sharedSourceTableBytes: 0,
    contextPackIncludedBytes: 42,
    omittedBytes: 0,
    unknownByteOmissions: 0,
  },
};
const candidate = {
  ...input,
  schemaVersion: 2 as const,
  eventId: "event",
  occurredAt: "2026-09-22T10:00:00.000Z",
};
test("turn audit validates closed scope, counts, date and excludes content fields", () => {
  assert.deepEqual(validateTurnPrivacyAuditInput(candidate), candidate);
  for (const changed of [
    { ...candidate, scope: { kind: "GENERAL", projectId: "fake" } },
    { ...candidate, content: "private" },
    { ...candidate, occurredAt: "yesterday" },
    { ...candidate, counts: { ...candidate.counts, unknownByteOmissions: 1 } },
    {
      ...candidate,
      counts: { ...candidate.counts, contextPackIncludedBytes: 0 },
    },
  ])
    assert.throws(() => validateTurnPrivacyAuditInput(changed));
});
test("turn audit verifies reread and the exact submitted input, not only a valid returned hash", async () => {
  for (const behavior of ["valid", "missing", "substituted"] as const) {
    let persisted: TurnPrivacyAuditEvent | null = null;
    const audit = new TurnPrivacyDecisionAudit({
      ids: () => "event",
      clock: () => new Date(candidate.occurredAt),
      store: {
        append: async (value) => {
          const stored = {
            ...value,
            modelId: behavior === "substituted" ? "other-model" : value.modelId,
            predecessorEventHash: null,
          };
          persisted = {
            ...stored,
            eventHash: hashTurnPrivacyAuditEvent(stored),
          };
          return persisted;
        },
        find: async () => (behavior === "missing" ? null : persisted),
        list: async () => (persisted ? [persisted] : []),
      },
    });
    if (behavior === "valid")
      assert.equal((await audit.record(input)).eventId, "event");
    else await assert.rejects(audit.record(input));
  }
});
