import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateGeneralLinkScale,
  measureGeneralLinkScale,
} from "../../../scripts/general-link-scale-measurement.ts";

test("measures deterministic General link validation and retrieval counts", async () => {
  const report = await measureGeneralLinkScale("SMALL");
  assert.deepEqual(report.counts, {
    conversationDocuments: 3,
    generalEvents: 12,
    projectIds: 3,
    linkDocuments: 6,
    linkedEvents: 3,
    queries: 5,
    perQueryGeneralEventValidations: 12,
    perQueryLinkValidations: 6,
    associatedQueryProjectChecks: 7,
  });
  assert.deepEqual(report.matches, {
    sharedGeneralOnly: 3,
    uniqueKnownItem: 1,
    allScopesAfterLimit: 3,
    associatedProject: 2,
    absent: 0,
  });
  assert.deepEqual(report.integrity, {
    knownItemMisses: 0,
    nonGeneralAssociationResults: 0,
    nonLinkOnlyAnnotations: 0,
    searchedEventCounts: [12, 12, 12, 2, 12],
  });
  assert.equal(report.gates.exactExpectations, true);
  assert.equal(report.gates.linearValidationCounts, true);
});

test("requires two complete deterministic executions for a no-change decision", async () => {
  const evaluation = await evaluateGeneralLinkScale("SMALL");
  assert.equal(evaluation.deterministicCounts, true);
  assert.equal(evaluation.decision, "NO_CHANGE");
});
