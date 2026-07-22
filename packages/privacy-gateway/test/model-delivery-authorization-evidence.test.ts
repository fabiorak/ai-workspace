import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AuthorizationEvidenceError,
  InMemorySingleUseAuthorizationStore,
  SyntheticInMemoryDeliveryAdapter,
  consumeSyntheticAuthorization,
  encodeAuthorizationIntent,
  measureModelDeliveryAuthorizationCorpus,
  validateAuthorizationIntent,
} from "./model-delivery-authorization-evidence.ts";

describe("model-delivery authorization evidence", () => {
  it("reproduces every frozen outcome and remains evidence-only", async () => {
    const first = await measureModelDeliveryAuthorizationCorpus();
    const second = await measureModelDeliveryAuthorizationCorpus();
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 22);
    assert.equal(first.passedCases, 22);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.transientConfirmation.decision, "REJECT");
    assert.equal(first.persistedReusableGrant.decision, "REJECT");
    assert.equal(first.transactionCoupledSingleUse.localReplayPrevented, true);
    assert.equal(
      first.transactionCoupledSingleUse.externalExactlyOnceProven,
      false,
    );
    assert.equal(first.transactionCoupledSingleUse.productionEligible, false);
    assert.equal(first.decision, "EVIDENCE_ONLY");
  });

  it("encodes metadata canonically without request or provider fields", () => {
    const intent = validIntent();
    const encoded = encodeAuthorizationIntent(intent);
    const { effect, mappingSchemaVersion, ...rest } = intent;
    const permuted = {
      effect,
      mappingSchemaVersion,
      ...rest,
    };
    assert.equal(encodeAuthorizationIntent(permuted), encoded);
    for (const forbidden of [
      "content",
      "prompt",
      "response",
      "endpoint",
      "credential",
      "passphrase",
      "apiKey",
    ])
      assert.equal(
        Object.prototype.hasOwnProperty.call(intent, forbidden),
        false,
      );
  });

  it("rejects malformed, extra, oversized, and noncanonical lifetime input without echo", () => {
    const intent = validIntent();
    const canary = "PRIVATE-AUTHORIZATION-CANARY";
    for (const candidate of [
      { ...intent, extra: true },
      { ...intent, authorizationId: "x".repeat(257) },
      { ...intent, expiresAt: "2026-07-22T09:01:00.001Z" },
      { ...intent, projectId: canary, profileDigest: "bad" },
    ]) {
      try {
        validateAuthorizationIntent(candidate);
        assert.fail("expected failure");
      } catch (error) {
        assert.ok(error instanceof AuthorizationEvidenceError);
        assert.equal(String(error).includes(canary), false);
      }
    }
  });

  it("never returns request bytes in receipts or errors", async () => {
    const intent = validIntent();
    const store = new InMemorySingleUseAuthorizationStore();
    store.add(intent);
    const adapter = new SyntheticInMemoryDeliveryAdapter();
    const request = "Synthetic [[AW_CUSTOMER_1111111111111111]].";
    await assert.rejects(
      consumeSyntheticAuthorization({
        store,
        adapter,
        authorizationId: intent.authorizationId,
        evidence: {
          projectId: intent.projectId,
          workItemId: intent.workItemId,
          handoffId: intent.handoffId,
          modelId: intent.modelId,
          profileDigest: intent.profileDigest,
          policyDigest: intent.policyDigest,
          preflightReportDigest: intent.preflightReportDigest,
          preflightAuditEventId: intent.preflightAuditEventId,
          preflightAuditEventHash: intent.preflightAuditEventHash,
          preflightDecision: "BLOCKED",
          preflightAuditPresent: true,
          contextPackSchemaVersion: intent.contextPackSchemaVersion,
          mappingSetId: intent.mappingSetId,
          mappingSchemaVersion: intent.mappingSchemaVersion,
          transformedRequestDigest: intent.transformedRequestDigest,
          transformed: true,
        },
        transformedRequest: request,
        now: new Date("2026-07-22T09:00:01.000Z"),
      }),
      (error: unknown) =>
        error instanceof AuthorizationEvidenceError &&
        !String(error).includes(request),
    );
    assert.equal(adapter.evidence().exposureCount, 0);
  });
});

function validIntent() {
  return validateAuthorizationIntent({
    schemaVersion: 1,
    authorizationId: "authorization-test",
    issuedAt: "2026-07-22T09:00:00.000Z",
    expiresAt: "2026-07-22T09:01:00.000Z",
    projectId: "project-a",
    workItemId: "work-a",
    handoffId: "handoff-a",
    modelId: "model-a",
    profileDigest: "a".repeat(64),
    policyDigest: "b".repeat(64),
    preflightReportDigest: "c".repeat(64),
    preflightAuditEventId: "audit-a",
    preflightAuditEventHash: "d".repeat(64),
    contextPackSchemaVersion: 2,
    transformedRequestDigest: "e".repeat(64),
    mappingSetId: "mapping-v1",
    mappingSchemaVersion: 1,
    confirmation: "EXPLICIT_USER_CONFIRMATION",
    effect: "AUTHORIZATION_INTENT_NOT_DELIVERED",
  });
}
