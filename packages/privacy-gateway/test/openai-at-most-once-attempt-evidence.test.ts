import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  AtMostOnceEvidenceError,
  FakeResponsesCreateAdapter,
  SyntheticAttemptStore,
  encodeAttemptSnapshot,
  executeSyntheticAttempt,
  measureOpenAiAtMostOnceAttemptCorpus,
  validateAttemptRecord,
  validateFreshAttemptAfterUnknown,
  type CurrentAttemptEvidence,
} from "./openai-at-most-once-attempt-evidence.ts";

describe("OpenAI bounded at-most-once attempt evidence", () => {
  it("reproduces all frozen cases and adopts only the bounded prototype semantics", async () => {
    const first = await measureOpenAiAtMostOnceAttemptCorpus();
    const second = await measureOpenAiAtMostOnceAttemptCorpus();
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 28);
    assert.equal(first.passedCases, 28);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.gates.maximumCreateCallsPerAuthorization, 1);
    assert.equal(first.gates.automaticRetriesScheduled, 0);
    assert.equal(first.gates.providerExactlyOnceProven, false);
    assert.equal(first.gates.productionEligible, false);
    assert.equal(first.decision, "ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE");
  });

  it("normalizes case order to identical canonical evidence", async () => {
    assert.deepEqual(
      await measureOpenAiAtMostOnceAttemptCorpus("REVERSED"),
      await measureOpenAiAtMostOnceAttemptCorpus("REFERENCE"),
    );
  });

  it("claims the only create right before invoking the adapter", async () => {
    const value = fixture();
    const store = new SyntheticAttemptStore();
    store.add(value.record);
    const adapter = new FakeResponsesCreateAdapter();
    const result = await executeSyntheticAttempt({
      store,
      adapter,
      attemptId: value.record.attemptId,
      evidence: value.evidence,
      transformedRequest: value.request,
      now: new Date("2026-07-22T10:00:01.000Z"),
      mode: "TIMEOUT_AFTER_EXPOSURE",
    });
    assert.equal(result.state, "UNKNOWN_AFTER_EXPOSURE");
    assert.equal(result.exposureCount, 1);
    assert.deepEqual(adapter.evidence(), {
      createCalls: 1,
      scheduledRetries: 0,
    });
    await assert.rejects(
      executeSyntheticAttempt({
        store,
        adapter,
        attemptId: value.record.attemptId,
        evidence: value.evidence,
        transformedRequest: value.request,
        now: new Date("2026-07-22T10:00:02.000Z"),
        mode: "COMPLETE",
      }),
      AtMostOnceEvidenceError,
    );
    assert.equal(adapter.evidence().createCalls, 1);
  });

  it("recovers an in-flight snapshot as unknown without a resend", () => {
    const value = fixture();
    const store = new SyntheticAttemptStore();
    store.add(value.record);
    store.claimExposure(value.record.attemptId);
    const encoded = encodeAttemptSnapshot(store.snapshot());
    const restored = SyntheticAttemptStore.restore(
      JSON.parse(encoded) as unknown,
    );
    restored.recover();
    assert.equal(
      restored.read(value.record.attemptId).state,
      "UNKNOWN_AFTER_EXPOSURE",
    );
    const inspection = restored.inspect(value.record.attemptId);
    assert.equal(inspection.action, "INSPECTION_ONLY_NO_RESEND");
    for (const forbidden of [
      "requestBody",
      "responseBody",
      "prompt",
      "credential",
      "apiKey",
      "accountId",
      "endpoint",
      "path",
    ])
      assert.equal(encoded.includes(forbidden), false);
  });

  it("requires a fresh authorization and explicit duplicate-cost warning", () => {
    const value = fixture();
    const store = new SyntheticAttemptStore();
    store.add(value.record);
    store.claimExposure(value.record.attemptId);
    store.recover();
    const next = validateAttemptRecord({
      ...value.record,
      authorizationId: "authorization-fresh",
      attemptId: "attempt-fresh",
    });
    assert.equal(
      validateFreshAttemptAfterUnknown({
        previous: store.read(value.record.attemptId),
        next,
        warning: "EXPLICIT_DUPLICATE_AND_COST_WARNING_ACCEPTED",
      }).eligible,
      true,
    );
    assert.throws(
      () =>
        validateFreshAttemptAfterUnknown({
          previous: store.read(value.record.attemptId),
          next,
          warning: "WARNING_NOT_ACCEPTED",
        }),
      AtMostOnceEvidenceError,
    );
  });

  it("rejects a second attempt identity for the same authorization", () => {
    const value = fixture();
    const store = new SyntheticAttemptStore();
    store.add(value.record);
    assert.throws(
      () => store.add({ ...value.record, attemptId: "attempt-duplicate" }),
      AtMostOnceEvidenceError,
    );
    assert.throws(
      () =>
        SyntheticAttemptStore.restore({
          schemaVersion: 1,
          records: [
            value.record,
            { ...value.record, attemptId: "attempt-duplicate" },
          ],
          effect: "SYNTHETIC_NON_CONTENT_SNAPSHOT_NOT_PRODUCTION_PERSISTENCE",
        }),
      AtMostOnceEvidenceError,
    );
  });

  it("rejects malformed metadata without echoing private canaries", () => {
    const canary = "PRIVATE-ATTEMPT-CANARY";
    try {
      validateAttemptRecord({
        ...fixture().record,
        modelId: canary,
        extra: true,
      });
      assert.fail("expected validation failure");
    } catch (error) {
      assert.ok(error instanceof AtMostOnceEvidenceError);
      assert.equal(String(error).includes(canary), false);
    }
  });
});

function fixture(): Readonly<{
  record: ReturnType<typeof validateAttemptRecord>;
  evidence: CurrentAttemptEvidence;
  request: string;
}> {
  const request = "Review [[AW_CUSTOMER_1111111111111111]].";
  const record = validateAttemptRecord({
    schemaVersion: 1,
    authorizationId: "authorization-test",
    attemptId: "attempt-test",
    providerKind: "OPENAI_RESPONSES",
    transportEvidenceDate: "2026-07-22",
    issuedAt: "2026-07-22T10:00:00.000Z",
    expiresAt: "2026-07-22T10:01:00.000Z",
    projectId: "project-test",
    workItemId: "work-test",
    handoffId: "handoff-test",
    modelId: "model-reviewed",
    profileDigest: "a".repeat(64),
    policyDigest: "b".repeat(64),
    preflightAuditEventId: "audit-test",
    preflightAuditEventHash: "c".repeat(64),
    transformedRequestDigest: createHash("sha256")
      .update(request, "utf8")
      .digest("hex"),
    mappingSetId: "mapping-test",
    mappingSchemaVersion: 1,
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
      preflightDecision: "REVIEWABLE_NOT_AUTHORIZED",
      preflightAuditPresent: true,
      transformedRequestDigest: record.transformedRequestDigest,
      mappingSetId: record.mappingSetId,
      mappingSchemaVersion: record.mappingSchemaVersion,
      transformed: true,
    }),
    request,
  });
}
