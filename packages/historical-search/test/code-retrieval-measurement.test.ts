import assert from "node:assert/strict";
import test from "node:test";

import {
  CODE_QUERIES,
  CONFUSABLE_IDENTIFIERS,
  PUNCTUATION_PROBES,
  buildCodeIndex,
  buildCodeRecords,
  codeTokens,
  collectSourceFiles,
  measureCodeRetrieval,
  searchCode,
  splitIdentifier,
  splitIntoSymbols,
  weightSymbolNames,
  withoutElapsed,
} from "../../../scripts/code-retrieval-measurement.ts";

/**
 * The corpus is the real TypeScript of this repository, so it grows with the
 * repository. These tests assert predeclared targets, invariants, and
 * thresholds rather than frozen percentages, and they fail loudly if the ground
 * truth stops matching the code it points at — which is the failure mode that
 * would quietly turn this measurement into fiction.
 */

test("measures a source corpus large enough for ranking to matter", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(report.corpusId, "CODE_RETRIEVAL_REAL_REPOSITORY_V1");
  assert.equal(report.effect, "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER");
  assert.ok(report.fingerprint.files >= 150);
  assert.ok(report.fingerprint.symbols > 1_000);
  assert.ok(report.fingerprint.lines > 30_000);
  assert.ok(
    report.fingerprint.distinctCodeTerms >
      report.fingerprint.distinctProseTerms,
    "splitting identifiers must produce more distinct terms than prose does",
  );
  assert.deepEqual(report.counts, {
    queries: CODE_QUERIES.length,
    expectedPairs: CODE_QUERIES.reduce(
      (sum, query) => sum + query.expected.length,
      0,
    ),
    localizationQueries: CODE_QUERIES.filter(
      (query) => query.expectedSymbol !== null,
    ).length,
    punctuationProbes: PUNCTUATION_PROBES.length,
    confusablePairs: CONFUSABLE_IDENTIFIERS.length,
  });
});

test("keeps the predeclared ground truth pointing at code that exists", () => {
  const files = new Map(
    collectSourceFiles().map((file) => [file.path, file.text] as const),
  );
  for (const query of CODE_QUERIES) {
    for (const expected of query.expected)
      assert.ok(
        files.has(expected),
        `query ${query.id} expects ${expected}, which is not in the corpus`,
      );
    if (query.expectedSymbol === null) continue;
    const declared = query.expected.flatMap((path) =>
      splitIntoSymbols(files.get(path) ?? "").map((section) => section.symbol),
    );
    assert.ok(
      declared.includes(query.expectedSymbol),
      `query ${query.id} expects symbol ${query.expectedSymbol}, which no expected file declares`,
    );
  }
});

test("keeps the confusable pairs and literal questions true of the source", () => {
  const text = collectSourceFiles()
    .map((file) => file.text)
    .join("\n");
  for (const pair of CONFUSABLE_IDENTIFIERS)
    for (const name of pair)
      assert.ok(
        text.includes(name),
        `${name} is declared confusable but does not appear in the corpus`,
      );
  for (const query of CODE_QUERIES.filter(
    (item) => item.family === "STRING_LITERAL",
  ))
    assert.ok(
      text.includes(query.text),
      `query ${query.id} quotes a literal that is not in the corpus`,
    );
});

test("does not read a declaration out of a template literal", () => {
  const sections = splitIntoSymbols(
    [
      "export function first(): string {",
      "  return html`",
      "export function notADeclaration(): void {}",
      "  `;",
      "}",
      "export function second(): void {}",
    ].join("\n"),
  );
  assert.deepEqual(
    sections.map((section) => section.symbol),
    ["first", "second"],
  );
  assert.ok(sections[0]?.body.includes("notADeclaration"));
});

test("splits identifiers the way a developer types their parts", () => {
  assert.deepEqual(splitIdentifier("resolveGuiLocale"), [
    "resolve",
    "gui",
    "locale",
  ]);
  assert.deepEqual(splitIdentifier("validatePseudonymMappingV2"), [
    "validate",
    "pseudonym",
    "mapping",
    "v",
    "2",
  ]);
});

/**
 * Kebab-case is a path convention rather than an identifier convention, so it is
 * separated by the tokenizer that reads the path, not by the identifier splitter.
 */
test("reaches a file by the words of its kebab-case name", () => {
  const tokens = codeTokens(
    "integrations/local-session-ingestion/src/restricted-data-screen.ts",
    true,
    1,
  );
  for (const word of ["restricted", "data", "screen"])
    assert.ok(tokens.includes(word), `${word} must be a term of the path`);
});

test("requires the declared name to outweigh the body it heads", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(
    report.exactMatch.conclusion,
    "DECLARED_NAME_MUST_OUTWEIGH_THE_BODY",
  );
  assert.ok(
    report.exactMatch.nameWeightedRecallPercent >
      report.exactMatch.unweightedRecallPercent,
    "weighting the declared name must recover questions the plain index misses",
  );
  assert.ok(
    (report.exactMatch.nameWeightedLocalizationPercent ?? 0) >
      (report.exactMatch.unweightedLocalizationPercent ?? 0),
    "the point of the weight is landing on the declaration, not only on the file",
  );
});

test("weighting the declared name costs no recall on any question family", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  const plain = report.engines.find(
    (engine) => engine.engine === "CODE_MODE_SYMBOL",
  )?.quality;
  const weighted = report.engines.find(
    (engine) => engine.engine === "CODE_MODE_SYMBOL_NAME_WEIGHTED",
  )?.quality;
  assert.ok(plain !== undefined && plain !== null);
  assert.ok(weighted !== undefined && weighted !== null);
  assert.ok(weighted.fileRecallPercent >= plain.fileRecallPercent);
  assert.ok(
    (weighted.symbolLocalizationPercent ?? 0) >
      (plain.symbolLocalizationPercent ?? 0),
  );
  for (const [family, recall] of Object.entries(
    weighted.perFamilyRecallPercent,
  ))
    assert.equal(recall, 100, `family ${family} must be answered completely`);
});

test("earns the search-mode flag in both directions, and records that the wrong mode is not silent", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(report.modeFlag.conclusion, "SEARCH_MODE_FLAG_JUSTIFIED");
  assert.ok(
    report.modeFlag.codeQuestionsInCodeModePercent >
      report.modeFlag.codeQuestionsInProseModePercent,
    "code questions must be measurably better in code mode",
  );
  assert.ok(
    report.modeFlag.proseQuestionsInProseModePercent >
      report.modeFlag.proseQuestionsInCodeModePercent,
    "prose questions must be measurably better in prose mode",
  );
  assert.equal(
    report.modeFlag.wrongModeIsSilent,
    false,
    "the wrong mode returns plausible results rather than nothing, which is the failure the GUI must make visible",
  );
});

test("answers punctuation questions only in code mode", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(
    report.punctuation.answeredInCodeMode,
    PUNCTUATION_PROBES.length,
  );
  assert.equal(report.punctuation.answeredInProseMode, 0);
  assert.equal(
    report.punctuation.conclusion,
    "PUNCTUATION_IS_ONLY_SEARCHABLE_IN_CODE_MODE",
  );
});

test("measures typo tolerance on the recommended engine, not a weaker one", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(report.typoTolerance.measuredOn, report.recommendation.codeMode);
  assert.equal(report.typoTolerance.confusablePairsConflatedInCodeMode, 0);
  assert.ok(
    report.typoTolerance.typoQueriesAnsweredWithoutTolerance <=
      report.typoTolerance.typoQueriesAnsweredWithTolerance,
    "turning tolerance off must not be measured as an improvement",
  );
});

test("records that call-graph questions are out of reach of ranking", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(
    report.graphQuestions.conclusion,
    "CALL_GRAPH_NEEDS_A_DIFFERENT_INDEX",
  );
  assert.equal(report.graphQuestions.definitionOutranksUse, true);
  for (const id of report.graphQuestions.queries) {
    const query = CODE_QUERIES.find((item) => item.id === id);
    assert.ok(
      query?.family === "DEFINITION_SITE" || query?.family === "CALL_SITE",
      `${id} is counted as a graph question but is not one`,
    );
  }
});

test("degrades to lexical retrieval when no embedding service is used", async () => {
  const report = await measureCodeRetrieval("SMALL", "SKIP");
  assert.equal(report.dense.outcome, "SKIPPED_BY_PROFILE");
  assert.equal(report.dense.model, "bge-m3");
  assert.equal(report.dense.queryEmbeddingMedianMilliseconds, null);
  assert.equal(report.dense.firstQueryAfterBuildMilliseconds, null);
  assert.equal(report.recommendation.denseOnCriticalPath, false);
  assert.deepEqual(report.recommendation.unresolvedByLexical, []);
  for (const engine of report.engines) {
    assert.equal(engine.availableWithoutRunningService, true);
    assert.equal(engine.withinInteractiveBudget, true);
    assert.equal(engine.outcome, "MEASURED");
  }
});

test("says why every result matched and where in the file it is", () => {
  const records = weightSymbolNames(
    buildCodeRecords(collectSourceFiles(), "SYMBOL"),
  );
  const index = buildCodeIndex(records, "CODE");
  const results = searchCode(index, "inspectPseudonymizedOutputWithPolicy");
  assert.ok(results.length > 0);
  const known = new Set(records.map((record) => record.id));
  for (const result of results) {
    assert.ok(known.has(result.id));
    assert.ok(result.because.startsWith("corrisponde "));
    assert.ok(result.path.endsWith(".ts"));
    assert.ok(result.startLine >= 1);
  }
  assert.equal(
    results[0]?.path,
    "packages/privacy-gateway/src/output-restoration.ts",
    "an exactly typed name must at least land in the file that declares it",
  );
  assert.ok(
    results.some(
      (result) => result.symbol === "inspectPseudonymizedOutputWithPolicy",
    ),
    "the declaration itself must be among the results",
  );
  /**
   * Pinned deliberately, because it is a defect and not a preference: the record
   * ranked first is `inspectPseudonymizedOutput`, which *calls* the name that was
   * typed. A call site is textually indistinguishable from a declaration, and it
   * is shorter, so BM25 length normalization prefers it. This is why the
   * measurement reports symbol localization on exact names at 66.67 rather than
   * 100, and it is the reason a declared-name field — rather than a repeated name
   * in the body — is the next lever.
   */
  assert.equal(results[0]?.symbol, "inspectPseudonymizedOutput");
});

test("returns the same report twice for the same corpus", async () => {
  const first = await measureCodeRetrieval("SMALL", "SKIP");
  const second = await measureCodeRetrieval("SMALL", "SKIP");
  assert.deepEqual(withoutElapsed(first), withoutElapsed(second));
});
