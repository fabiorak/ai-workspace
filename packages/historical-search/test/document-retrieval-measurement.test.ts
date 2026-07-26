import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_QUERIES,
  ITALIAN_QUERIES,
  buildDocumentIndex,
  buildRecords,
  collectDocuments,
  measureDocumentRetrieval,
  retrieveDocuments,
  splitIntoSections,
  withoutElapsed,
} from "../../../scripts/document-retrieval-measurement.ts";

/**
 * The corpus is the real documentation of this repository, so it grows over
 * time. These tests assert predeclared targets, invariants, and thresholds
 * rather than frozen percentages, and they fail loudly if the ground truth
 * stops matching the documents it points at.
 */

test("measures a document corpus long enough for the question to matter", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.equal(report.corpusId, "DOCUMENT_RETRIEVAL_REAL_REPOSITORY_V1");
  assert.equal(report.effect, "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER");
  assert.ok(report.fingerprint.documents >= 130);
  assert.ok(report.fingerprint.sections > 1_000);
  assert.ok(
    report.fingerprint.longestDocumentWords > 5_000,
    "the corpus must contain a document long enough to dilute its own terms",
  );
  assert.deepEqual(report.counts, {
    queries: 18,
    italianQueries: 10,
    englishQueries: 8,
    expectedPairs: 30,
    localizationQueries: 4,
    sameLanguageItalianQueries: 12,
  });
});

test("keeps the predeclared ground truth pointing at documents that exist", () => {
  const present = new Set(collectDocuments().map((document) => document.path));
  for (const query of DOCUMENT_QUERIES)
    for (const expected of query.expected)
      assert.ok(
        present.has(expected),
        `query ${query.id} expects ${expected}, which is not in the corpus`,
      );
});

test("requires section-level indexing, which a whole document cannot localize", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.equal(
    report.unitComparison.conclusion,
    "SECTION_LEVEL_INDEXING_REQUIRED",
  );
  assert.notEqual(report.unitComparison.bestUnit, "WHOLE_DOCUMENT");
  assert.equal(report.unitComparison.wholeDocumentLocalizationPercent, 0);
  assert.ok((report.unitComparison.sectionLocalizationPercent ?? 0) > 0);
});

test("records that lexical retrieval is bound to the language of the document", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.equal(
    report.languageGap.conclusion,
    "LEXICAL_RETRIEVAL_IS_LANGUAGE_BOUND",
  );
  assert.ok(
    report.languageGap.lexicalItalianRecallPercent <
      report.languageGap.lexicalEnglishRecallPercent,
    "Italian questions against English documents must be measured as harder",
  );
  assert.ok(report.recommendation.unresolvedByLexical.length > 0);
  for (const unresolved of report.recommendation.unresolvedByLexical) {
    const query = DOCUMENT_QUERIES.find((item) => item.id === unresolved);
    assert.equal(
      query?.language,
      "IT",
      `${unresolved} is unresolved, so it should be one of the cross-language questions`,
    );
  }
});

test("answers Italian questions about Italian documents without a model", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.equal(report.sameLanguageItalian.queries, ITALIAN_QUERIES.length);
  assert.ok(
    report.sameLanguageItalian.targetDocuments >= 3,
    "the same-language probe must cover every Italian document in the corpus",
  );
  assert.equal(
    report.sameLanguageItalian.conclusion,
    "ITALIAN_SAME_LANGUAGE_LEXICAL_SUFFICIENT",
  );
  assert.equal(report.sameLanguageItalian.lexical.documentRecallPercent, 100);
  assert.ok(
    report.sameLanguageItalian.lexical.precisionAtExpectedCountPercent >
      report.languageGap.lexicalItalianRecallPercent / 4,
    "same-language precision must not collapse the way cross-language recall does",
  );
  assert.ok(
    report.sameLanguageItalian.lexical.documentRecallPercent >
      report.languageGap.lexicalItalianRecallPercent,
    "the measured Italian weakness must be the language jump, not Italian itself",
  );
});

test("keeps the Italian ground truth pointing at headings that exist", () => {
  const documents = new Map(
    collectDocuments().map((document) => [document.path, document] as const),
  );
  for (const query of ITALIAN_QUERIES) {
    for (const expected of query.expected)
      assert.ok(
        documents.has(expected),
        `query ${query.id} expects ${expected}, which is not in the corpus`,
      );
    if (query.expectedHeading === null) continue;
    const headings = query.expected.flatMap((path) =>
      splitIntoSections(path, documents.get(path)?.text ?? "").map(
        (section) => section.headingPath,
      ),
    );
    assert.ok(
      headings.some((heading) => heading.includes(query.expectedHeading ?? "")),
      `query ${query.id} expects heading ${query.expectedHeading}, which no expected document has`,
    );
  }
});

test("bridges Italian questions to English documents through the glossary", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.ok(report.glossary.pairs > 40);
  assert.ok(
    report.glossary.crossLanguageRecallAfterPercent >
      report.glossary.crossLanguageRecallBeforePercent,
    "a translated term must reach documents the untranslated term cannot",
  );
  assert.ok(
    report.glossary.italianOnlyRecallUnchanged,
    "translating must not cost recall on questions that already worked in Italian",
  );
  assert.ok(
    report.glossary.precisionAfterPercent >=
      report.glossary.precisionBeforePercent,
    "the glossary must not buy recall by flooding the ranked list",
  );
  for (const unresolved of report.glossary.stillUnresolved)
    assert.ok(
      DOCUMENT_QUERIES.some(
        (query) => query.id === unresolved && query.language === "IT",
      ),
      `${unresolved} should be one of the cross-language questions`,
    );
});

test("adds a translation without removing the term the reader typed", () => {
  const index = buildDocumentIndex(
    buildRecords(collectDocuments(), "SECTION_HEADING_WEIGHTED"),
  );
  const query = "come navigo il quadro di sintesi";
  const withoutGlossary = retrieveDocuments(index, query).map(
    (result) => result.documentPath,
  );
  const withGlossary = retrieveDocuments(index, query, 10, true);
  assert.ok(
    withGlossary.some((result) => result.because.includes("tradotto in")),
    "a bridged result must say which term was translated",
  );
  assert.ok(
    withGlossary.some((result) =>
      withoutGlossary.includes(result.documentPath),
    ),
    "the untranslated meaning must survive alongside the translated one",
  );
});

test("weighting headings does not cost recall and buys precision", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  const plain = report.engines.find(
    (engine) => engine.engine === "INVERTED_SECTION",
  )?.quality;
  const weighted = report.engines.find(
    (engine) => engine.engine === "INVERTED_SECTION_HEADING_WEIGHTED",
  )?.quality;
  assert.ok(plain !== undefined && plain !== null);
  assert.ok(weighted !== undefined && weighted !== null);
  assert.ok(weighted.documentRecallPercent >= plain.documentRecallPercent);
  assert.ok(
    weighted.precisionAtExpectedCountPercent >
      plain.precisionAtExpectedCountPercent,
  );
});

test("degrades to lexical retrieval when no embedding service is used", async () => {
  const report = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.equal(report.dense.outcome, "SKIPPED_BY_PROFILE");
  assert.equal(report.dense.model, "bge-m3");
  assert.equal(report.recommendation.denseOnCriticalPath, false);
  assert.equal(report.recommendation.secondaryEngine, null);
  for (const engine of report.engines) {
    assert.equal(engine.availableWithoutRunningService, true);
    assert.equal(engine.withinInteractiveBudget, true);
  }
});

test("does not read a heading out of a fenced code block", () => {
  const sections = splitIntoSections(
    "example.md",
    [
      "# Title",
      "text",
      "```bash",
      "# not a heading",
      "```",
      "## Real",
      "more",
    ].join("\n"),
  );
  assert.deepEqual(
    sections.map((section) => section.headingPath),
    ["Title", "Title > Real"],
  );
  assert.ok(sections[0]?.body.includes("# not a heading"));
});

test("says why every result matched and where in the document it is", () => {
  const records = buildRecords(collectDocuments(), "SECTION");
  const index = buildDocumentIndex(records);
  const known = new Set(records.map((record) => record.id));
  const results = retrieveDocuments(index, "content addressed artifact store");
  assert.ok(results.length > 0);
  for (const result of results) {
    assert.ok(known.has(result.id));
    assert.ok(result.because.startsWith("corrisponde "));
    assert.ok(result.documentPath.endsWith(".md"));
  }
  assert.equal(
    results[0]?.documentPath,
    "docs/adr/0007-use-a-local-content-addressed-artifact-store.md",
  );
});

test("returns the same report twice for the same corpus", async () => {
  const first = await measureDocumentRetrieval("SMALL", "SKIP");
  const second = await measureDocumentRetrieval("SMALL", "SKIP");
  assert.deepEqual(withoutElapsed(first), withoutElapsed(second));
});
