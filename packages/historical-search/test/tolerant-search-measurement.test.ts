import assert from "node:assert/strict";
import test from "node:test";

import {
  CORPUS,
  QUERIES,
  STOPWORDS,
  buildInvertedIndex,
  contentTerms,
  isTypoOf,
  measureTolerantSearch,
  normalizeTokens,
  retrieveIndexed,
  stem,
} from "../../../scripts/tolerant-search-measurement.ts";

test("measures the shipped literal engine against predeclared ground truth", async () => {
  const report = await measureTolerantSearch("SMALL");
  assert.equal(report.corpusId, "TOLERANT_SEARCH_SYNTHETIC_V1");
  assert.equal(report.effect, "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER");
  assert.deepEqual(
    {
      records: report.counts.records,
      conversations: report.counts.conversations,
      projects: report.counts.projects,
      queries: report.counts.queries,
      groundTruthPairs: report.counts.groundTruthPairs,
    },
    {
      records: 13,
      conversations: 3,
      projects: 3,
      queries: 16,
      groundTruthPairs: 25,
    },
  );
  assert.deepEqual(
    report.strategies.map((strategy) => ({
      strategy: strategy.strategy,
      lexicalRecallPercent: strategy.lexical.recallPercent,
      beyondLexicalRecallPercent: strategy.beyondLexical.recallPercent,
      emptyLexicalQueries: strategy.lexical.emptyResultQueries,
      decision: strategy.decision,
    })),
    [
      {
        strategy: "LITERAL_BASELINE",
        lexicalRecallPercent: 25,
        beyondLexicalRecallPercent: 0,
        emptyLexicalQueries: 9,
        decision: "INSUFFICIENT",
      },
      {
        strategy: "NORMALIZED_TOKENS",
        lexicalRecallPercent: 52.78,
        beyondLexicalRecallPercent: 0,
        emptyLexicalQueries: 5,
        decision: "INSUFFICIENT",
      },
      {
        strategy: "NORMALIZED_STEMMED",
        lexicalRecallPercent: 83.33,
        beyondLexicalRecallPercent: 0,
        emptyLexicalQueries: 2,
        decision: "REFINE",
      },
      {
        strategy: "TOLERANT_RANKED",
        lexicalRecallPercent: 100,
        beyondLexicalRecallPercent: 50,
        emptyLexicalQueries: 0,
        decision: "ADOPT_FOR_ENGINE",
      },
      {
        strategy: "TOLERANT_INDEXED",
        lexicalRecallPercent: 100,
        beyondLexicalRecallPercent: 50,
        emptyLexicalQueries: 0,
        decision: "ADOPT_FOR_ENGINE",
      },
    ],
  );
  assert.deepEqual(report.residual, {
    bestStrategy: "TOLERANT_INDEXED",
    familiesBelowTarget: ["SYNONYM", "PARAPHRASE"],
    unansweredQueries: ["paraphrase-bando"],
    gate: "BEYOND_LEXICAL_EVALUATION_JUSTIFIED",
  });
});

test("records that the current adapter refuses corpora beyond its declared bound", async () => {
  const report = await measureTolerantSearch("REFERENCE");
  const refused = report.scale.filter(
    (step) => step.baseline.outcome === "REFUSED_BY_DECLARED_BOUND",
  );
  assert.equal(refused.length, 1);
  assert.equal(refused[0]?.records, 12_000);
  for (const step of report.scale)
    assert.equal(step.tolerantIndexed.withinInteractiveBudget, true);
});

test("reaches identical results through posting lists and through a full scan", async () => {
  const index = buildInvertedIndex(CORPUS);
  const report = await measureTolerantSearch("SMALL");
  const scan = report.strategies.find(
    (strategy) => strategy.strategy === "TOLERANT_RANKED",
  );
  const indexed = report.strategies.find(
    (strategy) => strategy.strategy === "TOLERANT_INDEXED",
  );
  assert.deepEqual(indexed?.families, scan?.families);
  for (const query of QUERIES)
    assert.ok(
      retrieveIndexed(index, query.text).some((id) =>
        query.expected.includes(id),
      ) || query.id === "paraphrase-bando",
      `query ${query.id} returned nothing relevant`,
    );
});

test("folds diacritics, reduces inflection, and tolerates one typo", () => {
  assert.deepEqual(normalizeTokens("Perché le quantità"), [
    "perche",
    "le",
    "quantita",
  ]);
  assert.deepEqual(contentTerms("cache in memoria"), ["cache", "memoria"]);
  assert.equal(stem("falliti"), stem("fallito"));
  assert.equal(stem("penalita"), stem("penali"));
  assert.equal(stem("decisioni"), stem("decisione"));
  assert.equal(isTypoOf("carrelo", "carrello"), true);
  assert.equal(isTypoOf("capitollato", "capitolato"), true);
  assert.equal(isTypoOf("cache", "carrello"), false);
  assert.equal(STOPWORDS.has("perche"), true);
  assert.equal(STOPWORDS.has("penali"), false);
});

test("keeps a query usable when every term is a stopword", () => {
  assert.deepEqual(contentTerms("come e quando"), ["come", "e", "quando"]);
});
