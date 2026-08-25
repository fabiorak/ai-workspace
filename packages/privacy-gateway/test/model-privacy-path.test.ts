import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MODEL_EXECUTION_BOUNDARIES,
  MODEL_PRIVACY_PATH_EFFECT,
  planModelPrivacyPath,
} from "../src/index.ts";

describe("model privacy path", () => {
  it("publishes only the three declared execution boundaries", () => {
    assert.deepEqual(MODEL_EXECUTION_BOUNDARIES, [
      "LOCAL_ONLY",
      "EXTERNAL",
      "UNCLASSIFIED",
    ]);
    assert.equal(Object.isFrozen(MODEL_EXECUTION_BOUNDARIES), true);
  });

  it("keeps original content inside a declared local-only boundary", () => {
    const path = planModelPrivacyPath("LOCAL_ONLY");

    assert.deepEqual(path, {
      boundary: "LOCAL_ONLY",
      privacyPreflight: "REQUIRED",
      contentTreatment: "ORIGINAL",
      pseudonymization: "NOT_REQUIRED",
      outboundConfirmation: "NOT_REQUIRED",
      effect: MODEL_PRIVACY_PATH_EFFECT,
    });
    assert.equal(Object.isFrozen(path), true);
  });

  it("requires exact transformed-text review for an external boundary", () => {
    assert.deepEqual(planModelPrivacyPath("EXTERNAL"), {
      boundary: "EXTERNAL",
      privacyPreflight: "REQUIRED",
      contentTreatment: "PSEUDONYMIZED_EXACT_PREVIEW",
      pseudonymization: "REQUIRED",
      outboundConfirmation: "REQUIRED",
      effect: MODEL_PRIVACY_PATH_EFFECT,
    });
  });

  it("blocks an explicitly unclassified boundary before preflight", () => {
    assert.deepEqual(planModelPrivacyPath("UNCLASSIFIED"), {
      boundary: "UNCLASSIFIED",
      privacyPreflight: "BLOCKED_BEFORE_PREFLIGHT",
      contentTreatment: "NONE",
      pseudonymization: "BLOCKED",
      outboundConfirmation: "BLOCKED",
      effect: MODEL_PRIVACY_PATH_EFFECT,
    });
  });

  it("collapses malformed runtime values to the same fail-closed result", () => {
    const blocked = planModelPrivacyPath("UNCLASSIFIED");

    for (const value of [undefined, null, "LOCAL", "localhost", 1, {}]) {
      assert.strictEqual(planModelPrivacyPath(value), blocked);
    }
  });
});
