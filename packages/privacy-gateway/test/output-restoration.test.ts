import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inspectPseudonymizedOutput,
  measureOutputRestorationCorpus,
  OUTPUT_RESTORATION_MAX_BYTES,
  validatePseudonymMapping,
} from "../src/index.ts";
import { inspectPseudonymizedOutputWithPolicy } from "../src/output-restoration.ts";
import {
  frozenOutputRestorationCorpus,
  permutedOutputRestorationCorpus,
  UNKNOWN,
  V1_CUSTOMER,
  V1_MAPPING,
  V1_SCOPE,
  V2_MAPPING,
  V2_SCOPE,
} from "./synthetic-output-restoration.ts";

describe("pseudonymized output restoration", () => {
  it("meets the frozen strict gates deterministically", () => {
    const corpus = frozenOutputRestorationCorpus();
    const first = measureOutputRestorationCorpus(corpus);
    const second = measureOutputRestorationCorpus(
      permutedOutputRestorationCorpus(),
    );
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 13);
    assert.deepEqual(first.strict, {
      exactCases: 3,
      blockedCases: 9,
      noPseudonymCases: 1,
      incorrectCases: 0,
      partialBlockedOutputs: 0,
      decision: "ADOPT_FOR_LOCAL_INSPECTION",
    });
    assert.equal(first.baseline.partiallyRestoredAnomalyCases, 2);
    assert.equal(first.baseline.productionEligible, false);
  });

  it("preserves non-token UTF-8 bytes and restores repeats", () => {
    const output = `È ${V1_CUSTOMER} — ${V1_CUSTOMER}!`;
    const result = inspectPseudonymizedOutput({
      mapping: V1_MAPPING,
      scope: V1_SCOPE,
      output,
    });
    assert.equal(result.decision, "RESTORABLE_LOCAL_EVIDENCE");
    assert.equal(result.restoredTokens, 2);
    assert.equal(result.restoredContent, "È Customer Cedar — Customer Cedar!");
    assert.equal(result.inputBytes, Buffer.byteLength(output));
  });

  it("returns no partial output when a strict anomaly follows a known token", () => {
    const output = `${V1_CUSTOMER} and ${UNKNOWN}`;
    const strict = inspectPseudonymizedOutput({
      mapping: V1_MAPPING,
      scope: V1_SCOPE,
      output,
    });
    const baseline = inspectPseudonymizedOutputWithPolicy({
      mapping: V1_MAPPING,
      scope: V1_SCOPE,
      output,
      policy: "KNOWN_ONLY_BASELINE",
    });
    assert.deepEqual(
      [strict.decision, strict.restoredTokens, strict.restoredContent],
      ["BLOCKED_INTEGRITY_FAILURE", 0, null],
    );
    assert.equal(baseline.decision, "RESTORABLE_LOCAL_EVIDENCE");
    assert.equal(baseline.restoredContent, `Customer Cedar and ${UNKNOWN}`);
  });

  it("dispatches v1/v2 explicitly and rejects cross-scope requests", () => {
    assert.equal(
      inspectPseudonymizedOutput({
        mapping: V2_MAPPING,
        scope: V2_SCOPE,
        output: "No pseudonym here.",
      }).mappingSchemaVersion,
      2,
    );
    for (const field of [
      "mappingSetId",
      "projectId",
      "workItemId",
      "handoffId",
      "modelId",
    ] as const) {
      assert.throws(
        () =>
          inspectPseudonymizedOutput({
            mapping: V1_MAPPING,
            scope: { ...V1_SCOPE, [field]: "foreign-scope" },
            output: V1_CUSTOMER,
          }),
        /malformed, oversized, incompatible, or cross-scoped/u,
      );
    }
  });

  it("fails closed on conflicting originals, invalid UTF-16, and bounds", () => {
    const conflicting = validatePseudonymMapping({
      ...V1_MAPPING,
      entries: [
        V1_MAPPING.entries[0],
        {
          ...V1_MAPPING.entries[1],
          pseudonym: V1_MAPPING.entries[0]!.pseudonym,
          entityType: "CUSTOMER",
          transformedByteEnd:
            V1_MAPPING.entries[1]!.transformedByteStart +
            Buffer.byteLength(V1_MAPPING.entries[0]!.pseudonym),
        },
      ],
    });
    for (const output of [
      "\ud800",
      "x".repeat(OUTPUT_RESTORATION_MAX_BYTES + 1),
    ])
      assert.throws(() =>
        inspectPseudonymizedOutput({
          mapping: V1_MAPPING,
          scope: V1_SCOPE,
          output,
        }),
      );
    assert.throws(() =>
      inspectPseudonymizedOutput({
        mapping: conflicting,
        scope: V1_SCOPE,
        output: V1_CUSTOMER,
      }),
    );
    const invalidOriginal = validatePseudonymMapping({
      ...V1_MAPPING,
      entries: [
        {
          ...V1_MAPPING.entries[0],
          originalBase64: "/w==",
          originalByteEnd: V1_MAPPING.entries[0]!.originalByteStart + 1,
        },
      ],
    });
    assert.throws(() =>
      inspectPseudonymizedOutput({
        mapping: invalidOriginal,
        scope: V1_SCOPE,
        output: V1_CUSTOMER,
      }),
    );
  });

  it("keeps errors non-echoing", () => {
    const canary = "PRIVATE-OUTPUT-CANARY";
    try {
      inspectPseudonymizedOutput({
        mapping: V1_MAPPING,
        scope: { ...V1_SCOPE, projectId: canary },
        output: canary,
      });
      assert.fail("expected failure");
    } catch (error) {
      assert.equal(String(error).includes(canary), false);
    }
  });
});
