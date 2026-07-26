import assert from "node:assert/strict";
import test from "node:test";

import {
  MEMORY_CORPUS,
  UNIFIED_CORPUS,
  UNIFIED_QUERIES,
  buildFts5Engine,
  buildUnifiedIndex,
  measureUnifiedRetrieval,
  retrieveUnified,
} from "../../../scripts/unified-retrieval-measurement.ts";

test("measures both stores against predeclared ground truth", async () => {
  const report = await measureUnifiedRetrieval("SMALL", "SKIP");
  assert.equal(report.corpusId, "UNIFIED_RETRIEVAL_SYNTHETIC_V1");
  assert.equal(report.effect, "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER");
  assert.deepEqual(report.counts, {
    eventRecords: 13,
    memoryRecords: 7,
    admissibleRecords: 18,
    inadmissibleRecords: 2,
    queries: 8,
    groundTruthPairs: 11,
    forbiddenPairs: 4,
  });
  assert.deepEqual(
    report.engines.map((engine) => ({
      engine: engine.engine,
      recallPercent: engine.quality?.recallPercent ?? null,
      memoryRecallPercent: engine.quality?.memoryTargetRecallPercent ?? null,
      emptyResultQueries: engine.quality?.emptyResultQueries ?? null,
      decision: engine.decision,
    })),
    [
      {
        engine: "EVENTS_ONLY_INVERTED",
        recallPercent: 18.18,
        memoryRecallPercent: 0,
        emptyResultQueries: 1,
        decision: "REJECT",
      },
      {
        engine: "UNIFIED_INVERTED",
        recallPercent: 100,
        memoryRecallPercent: 100,
        emptyResultQueries: 0,
        decision: "ADOPT_AS_PRIMARY",
      },
      {
        engine: "UNIFIED_FTS5_UNICODE61",
        recallPercent: 81.82,
        memoryRecallPercent: 77.78,
        emptyResultQueries: 1,
        decision: "REFINE",
      },
      {
        engine: "UNIFIED_FTS5_TRIGRAM",
        recallPercent: 81.82,
        memoryRecallPercent: 77.78,
        emptyResultQueries: 1,
        decision: "REFINE",
      },
    ],
  );
});

test("records that searching events alone cannot answer a question about a decision", async () => {
  const report = await measureUnifiedRetrieval("SMALL", "SKIP");
  assert.deepEqual(report.storeGap, {
    memoryTargetsReachableByCurrentStores: false,
    memoryRecallEventsOnlyPercent: 0,
    memoryRecallUnifiedPercent: 100,
    conclusion: "UNIFICATION_REQUIRED_FOR_DECLARED_EXPERIENCE",
  });
});

test("degrades to the lexical engine when the embedding service is absent", async () => {
  const report = await measureUnifiedRetrieval("SMALL", "SKIP");
  assert.equal(report.dense.outcome, "SKIPPED_BY_PROFILE");
  assert.equal(report.dense.model, "bge-m3");
  assert.equal(report.recommendation.primaryEngine, "UNIFIED_INVERTED");
  assert.equal(report.recommendation.secondaryEngine, null);
  assert.equal(report.recommendation.denseOnCriticalPath, false);
  const lexical = report.engines.find(
    (engine) => engine.engine === "UNIFIED_INVERTED",
  );
  assert.equal(lexical?.gates?.availableWithoutRunningService, true);
  assert.equal(lexical?.quality?.recallPercent, 100);
});

test("never presents superseded or invalidated memory as a current answer", () => {
  const index = buildUnifiedIndex(UNIFIED_CORPUS);
  const inadmissible = MEMORY_CORPUS.filter(
    (item) => item.validity !== "ACTIVE",
  ).map((item) => item.id);
  assert.deepEqual(inadmissible, ["mem-client-total", "mem-wrong-penalty"]);
  for (const query of UNIFIED_QUERIES) {
    const returned = retrieveUnified(index, query.text).map(
      (result) => result.id,
    );
    for (const forbidden of [...inadmissible, ...query.forbidden])
      assert.equal(
        returned.includes(forbidden),
        false,
        `query ${query.id} returned ${forbidden}`,
      );
  }
  const engine = buildFts5Engine(UNIFIED_CORPUS, "unicode61");
  try {
    for (const query of UNIFIED_QUERIES)
      for (const result of engine.retrieve(query.text))
        assert.equal(inadmissible.includes(result.id), false);
  } finally {
    engine.close();
  }
});

test("says why every result matched and which store it came from", () => {
  const index = buildUnifiedIndex(UNIFIED_CORPUS);
  const results = retrieveUnified(index, "vincolo servizio esterno");
  assert.ok(results.length > 0);
  for (const result of results) {
    assert.ok(["EVENT", "MEMORY"].includes(result.origin));
    assert.ok(result.because.length > 0);
  }
  const positions = results.map((result) => result.id);
  assert.ok(positions.indexOf("mem-external-service") <= 1);
  assert.match(results[0]?.because ?? "", /servizio|esterno|vincolo/u);
});

test("counts when a memory item and its source event both come back", async () => {
  const report = await measureUnifiedRetrieval("SMALL", "SKIP");
  assert.equal(report.redundancy.memorySourcePairs, 7);
  assert.equal(
    report.redundancy.conclusion,
    "DEDUPLICATION_BY_PROVENANCE_REQUIRED",
  );
  assert.ok(report.redundancy.pairsReturnedTogether > 0);
  assert.ok(
    report.redundancy.examples.some((example) =>
      example.includes("mem-external-service con cache-constraint"),
    ),
  );
});

test("keeps every lexical engine inside the interactive budget at scale", async () => {
  const report = await measureUnifiedRetrieval("SMALL", "SKIP");
  const [step] = report.scale;
  assert.equal(step?.records, 1_000);
  assert.ok((step?.distinctTerms ?? 0) > 1_000);
  assert.deepEqual(
    step?.engines.map((engine) => engine.engine),
    ["UNIFIED_INVERTED", "UNIFIED_FTS5_UNICODE61", "UNIFIED_FTS5_TRIGRAM"],
  );
  for (const engine of step?.engines ?? [])
    assert.equal(engine.withinInteractiveBudget, true);
});
