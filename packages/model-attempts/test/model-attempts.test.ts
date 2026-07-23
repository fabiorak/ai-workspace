import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ModelAttemptError,
  createModelAttemptRecord,
  transitionModelAttemptRecord,
  validateModelAttemptRecord,
  type ModelAttemptInput,
} from "../src/index.ts";

describe("model attempt contracts", () => {
  it("creates and transitions exact non-content evidence", () => {
    const prepared = createModelAttemptRecord(input(), 1, null);
    const exposed = transitionModelAttemptRecord(prepared, 2, {
      state: "EXPOSURE_STARTED",
      exposureCount: 1,
    });

    assert.equal(exposed.state, "EXPOSURE_STARTED");
    assert.equal(exposed.predecessorRecordHash, prepared.recordHash);
    assert.equal(exposed.automaticRetryScheduled, false);
    assert.deepEqual(validateModelAttemptRecord(exposed), exposed);
  });

  it("rejects extra fields and invalid transitions", () => {
    const prepared = createModelAttemptRecord(input(), 1, null);
    assert.throws(
      () => validateModelAttemptRecord({ ...prepared, requestBody: "no" }),
      ModelAttemptError,
    );
    assert.throws(
      () =>
        transitionModelAttemptRecord(prepared, 2, {
          state: "COMPLETED",
          exposureCount: 1,
          outputDigest: "f".repeat(64),
        }),
      ModelAttemptError,
    );
  });
});

function input(): ModelAttemptInput {
  return Object.freeze({
    schemaVersion: 1,
    projectId: "project-synthetic",
    authorizationId: "authorization-synthetic",
    attemptId: "attempt-synthetic",
    providerKind: "OPENAI_RESPONSES",
    requestDigest: "a".repeat(64),
    authorizationDigest: "b".repeat(64),
    preflightAuditEventHash: "c".repeat(64),
  });
}
