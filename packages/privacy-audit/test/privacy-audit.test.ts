import assert from "node:assert/strict";
import test from "node:test";
import {
  PrivacyAuditError,
  PrivacyDecisionAudit,
  canonicalJson,
  digestCanonical,
  type PrivacyAuditEvent,
  type PrivacyAuditEventInput,
  type PrivacyAuditStore,
} from "../src/index.ts";

test("canonical JSON and report digests ignore object insertion order", () => {
  assert.equal(
    canonicalJson({ z: 1, a: { y: 2, b: 3 } }),
    '{"a":{"b":3,"y":2},"z":1}',
  );
  assert.equal(
    digestCanonical({ b: 2, a: 1 }),
    digestCanonical({ a: 1, b: 2 }),
  );
});

test("record requires append reread verification and keeps failures generic", async () => {
  let saved: PrivacyAuditEvent | null = null;
  let rereadEnabled = true;
  const store: PrivacyAuditStore = {
    append: async (input: PrivacyAuditEventInput) => {
      saved = Object.freeze({
        ...input,
        predecessorEventHash: null,
        eventHash: "a".repeat(64),
      });
      return saved;
    },
    find: async () => (rereadEnabled ? saved : null),
    list: async () => ({
      events: [],
      nextCursor: null,
      total: 0,
      effect: "LOCAL_DECISION_AUDIT_NOT_AUTHORIZED_OR_DELIVERED",
    }),
  };
  const audit = new PrivacyDecisionAudit({
    store,
    ids: () => "event-a",
    clock: () => new Date("2026-07-22T09:00:00.000Z"),
  });
  const input = {
    projectId: "project-a",
    workItemId: "work-a",
    handoffId: "handoff-a",
    modelId: "model-a",
    policyId: "fictional-policy",
    policyVersion: "1.0.0",
    policyDigest: "b".repeat(64),
    contextPackSchemaVersion: 2,
    decision: "REVIEWABLE_NOT_AUTHORIZED" as const,
    counts: {
      evaluatedItems: 1,
      omittedItems: 0,
      allowedItems: 1,
      blockedItems: 0,
      defaultedItems: 0,
      restrictedItems: 0,
      evaluatedItemBytes: 12,
      sharedSourceTableBytes: 5,
      contextPackIncludedBytes: 17,
      omittedBytes: 0,
    },
    preflightReportDigest: "c".repeat(64),
  };
  assert.equal((await audit.record(input)).eventId, "event-a");
  rereadEnabled = false;
  await assert.rejects(() => audit.record(input), PrivacyAuditError);
});
