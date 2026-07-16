import assert from "node:assert/strict";
import test from "node:test";

import {
  EntityCandidateError,
  evaluateEntityCandidateDiscovery,
  measureEntityCandidateDiscovery,
  proposeCombinedCandidates,
  proposeExactAliasCandidates,
  proposeStandardSyntaxCandidates,
} from "../../../scripts/entity-candidate-measurement.ts";

test("measures frozen exact-span candidates with predeclared decisions", () => {
  const report = measureEntityCandidateDiscovery();
  assert.equal(report.itemCount, 8);
  assert.equal(report.groundTruthCount, 12);
  assert.equal(report.invalidCases, 5);
  assert.deepEqual(
    report.measurements.map((entry) => ({
      candidate: entry.candidate,
      counts: entry.counts,
      precisionPercent: entry.precisionPercent,
      recallPercent: entry.recallPercent,
      decision: entry.decision,
    })),
    [
      {
        candidate: "STANDARD_SYNTAX",
        counts: {
          proposed: 9,
          groundTruth: 8,
          truePositive: 8,
          falsePositive: 1,
          falseNegative: 0,
        },
        precisionPercent: 88.89,
        recallPercent: 100,
        decision: "REFINE",
      },
      {
        candidate: "EXACT_ALIAS",
        counts: {
          proposed: 4,
          groundTruth: 4,
          truePositive: 4,
          falsePositive: 0,
          falseNegative: 0,
        },
        precisionPercent: 100,
        recallPercent: 100,
        decision: "ADOPT_FOR_REVIEW",
      },
      {
        candidate: "COMBINED",
        counts: {
          proposed: 13,
          groundTruth: 12,
          truePositive: 12,
          falsePositive: 1,
          falseNegative: 0,
        },
        precisionPercent: 92.31,
        recallPercent: 100,
        decision: "REFINE",
      },
    ],
  );
  for (const measurement of report.measurements)
    assert.deepEqual(measurement.structuralGates, {
      validUtf8Boundaries: true,
      deterministicPermutation: true,
      completeReconciliation: true,
      noDuplicateIdentity: true,
      invalidMatrixRejected: true,
      invalidMatrixNoEcho: true,
      restrictedDetectorRegression: true,
      productionEffects: 0,
    });
});

test("produces identical complete runs and aggregate-only reports", () => {
  const report = evaluateEntityCandidateDiscovery();
  assert.equal(report.deterministic, true);
  assert.deepEqual(report.decisions, {
    STANDARD_SYNTAX: "REFINE",
    EXACT_ALIAS: "ADOPT_FOR_REVIEW",
    COMBINED: "REFINE",
  });
  assert.deepEqual(report.runs[0], report.runs[1]);
  const encoded = JSON.stringify(report);
  for (const selected of [
    "maria.rossi",
    "Asteria Demo",
    "Résumé Δ",
    "+390255501234",
  ])
    assert.equal(encoded.includes(selected), false);
  assert.equal(report.effect, "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER");
});

test("preserves exact UTF-8 byte ranges for configured aliases", () => {
  const content = "Pré Résumé Δ fin";
  const [candidate] = proposeExactAliasCandidates(
    [{ id: "unicode", content }],
    [{ entityType: "PROJECT", alias: "Résumé Δ" }],
  );
  assert.ok(candidate);
  assert.equal(candidate.byteStart, Buffer.byteLength("Pré ", "utf8"));
  assert.equal(candidate.byteEnd, Buffer.byteLength("Pré Résumé Δ", "utf8"));
  assert.equal(candidate.entityType, "PROJECT");
});

test("fails closed for malformed, ambiguous, oversized, and overlapping input", () => {
  const canary = "SYNTHETIC_PRIVATE_CANARY";
  const invalidCases = [
    () =>
      proposeStandardSyntaxCandidates([
        { id: "duplicate", content: "first" },
        { id: "duplicate", content: "second" },
      ]),
    () =>
      proposeExactAliasCandidates(
        [{ id: "one", content: "Synthetic Alias" }],
        [
          { entityType: "CUSTOMER", alias: "Synthetic Alias" },
          { entityType: "PROJECT", alias: "Synthetic Alias" },
        ],
      ),
    () =>
      proposeExactAliasCandidates(
        [{ id: "one", content: canary }],
        [{ entityType: "CUSTOMER", alias: `${canary}\n` }],
      ),
    () =>
      proposeStandardSyntaxCandidates([
        { id: "large", content: "x".repeat(1_000_001) },
      ]),
    () =>
      proposeExactAliasCandidates(
        [{ id: "invalid-unicode", content: "broken\ud800content" }],
        [{ entityType: "CUSTOMER", alias: "broken" }],
      ),
    () =>
      proposeCombinedCandidates(
        [{ id: "one", content: "person@example.invalid" }],
        [{ entityType: "CUSTOMER", alias: "person@example.invalid" }],
      ),
  ];
  for (const invalidCase of invalidCases)
    assert.throws(
      invalidCase,
      (error: unknown) =>
        error instanceof EntityCandidateError &&
        !error.message.includes(canary) &&
        !error.message.includes("Synthetic Alias"),
    );
});

test("keeps token-embedded aliases and invalid syntax lookalikes unmatched", () => {
  assert.equal(
    proposeExactAliasCandidates(
      [{ id: "boundary", content: "preACMEpost" }],
      [{ entityType: "CUSTOMER", alias: "ACME" }],
    ).length,
    0,
  );
  assert.equal(
    proposeStandardSyntaxCandidates([
      {
        id: "lookalikes",
        content: "user@example 999.12.0.1 +0123456789",
      },
    ]).length,
    0,
  );
});
