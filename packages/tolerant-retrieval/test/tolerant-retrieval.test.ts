import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  CODE_QUERIES,
  CONFUSABLE_IDENTIFIERS,
  PUNCTUATION_PROBES,
  buildCodeRecords,
  collectSourceFiles,
} from "../../../scripts/code-retrieval-measurement.ts";
import {
  DOCUMENT_QUERIES,
  ITALIAN_QUERIES,
  buildRecords,
  collectDocuments,
} from "../../../scripts/document-retrieval-measurement.ts";
import {
  mergedBody,
  mergedQuery,
} from "../../../scripts/real-event-retrieval-measurement.ts";
import {
  CORPUS,
  LEXICAL_FAMILIES,
  QUERIES,
} from "../../../scripts/tolerant-search-measurement.ts";
import {
  UNIFIED_CORPUS,
  UNIFIED_QUERIES,
} from "../../../scripts/unified-retrieval-measurement.ts";
import {
  TolerantRetrievalError,
  TolerantRetrievalIndex,
  boundedDistance,
  codeTokens,
  isTypoOf,
  mergedQueryTerms,
  mergedTerms,
  readCanonicalPayload,
  fixesTranspositionsUnderBudget,
  stem,
  type RetrievalRecord,
  type RetrievalResult,
} from "../src/index.ts";

/**
 * The corpora of the four measurements are the fixtures here. The package was
 * extracted from the harnesses that produced the published figures, so the
 * question these tests answer is not "does retrieval work" — that was measured
 * — but "does the extracted package still do what was measured on the corpora
 * it was measured on".
 *
 * Where a floor appears on a real corpus it is a regression floor with room
 * under it: the corpus is this repository and grows with it, so a floor set at
 * today's exact score would fail for reasons that have nothing to do with
 * retrieval. The targets themselves stay in the measurements. On the synthetic
 * corpus, whose content is fixed, the assertion is the published target itself.
 */

const INTERACTIVE_BUDGET_MILLISECONDS = 150;

/** The bound the current adapter declares and refuses to index beyond. */
const DECLARED_EVENT_BOUND = 10_000;

function record(
  fields: Partial<RetrievalRecord> & Pick<RetrievalRecord, "id" | "text">,
): RetrievalRecord {
  return Object.freeze({
    location: Object.freeze({
      store: "TEST",
      path: fields.id,
      declaredName: null,
      position: null,
    }),
    occurredAt: "2026-01-01T00:00:00.000Z",
    admissibility: "CURRENT" as const,
    provenance: fields.id,
    ...fields,
  });
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)] ?? 0;
}

function recallPercent(
  found: readonly (readonly string[])[],
  expected: readonly (readonly string[])[],
): number {
  let reached = 0;
  let wanted = 0;
  for (const [position, wantedIds] of expected.entries()) {
    const results = new Set(found[position] ?? []);
    wanted += wantedIds.length;
    for (const id of wantedIds) if (results.has(id)) reached += 1;
  }
  return wanted === 0 ? 0 : (reached * 100) / wanted;
}

function everyResultStatesAReason(
  results: readonly RetrievalResult[],
): boolean {
  return results.every(
    (result) =>
      result.reasons.length > 0 &&
      result.reasons.every(
        (reason) => reason.term.length > 0 && reason.matched.length > 0,
      ),
  );
}

/* ------------------------------------------------------------------ */
/* Fixture 1 — the synthetic transcript corpus of the first measurement */
/* ------------------------------------------------------------------ */

function syntheticRecords(): readonly RetrievalRecord[] {
  return Object.freeze(
    CORPUS.map((entry) =>
      record({
        id: entry.id,
        text: entry.text,
        location: Object.freeze({
          store: "SESSION_EVENTS",
          path: entry.conversationId,
          declaredName: null,
          position: null,
        }),
        occurredAt: entry.occurredAt,
        provenance: entry.id,
      }),
    ),
  );
}

test("reaches the lexical families of the synthetic corpus", () => {
  const index = TolerantRetrievalIndex.build(syntheticRecords());
  const lexical = QUERIES.filter((query) =>
    (LEXICAL_FAMILIES as readonly string[]).includes(query.family),
  );
  const found = lexical.map((query) =>
    index.search(query.text).map((result) => result.id),
  );
  const recall = recallPercent(
    found,
    lexical.map((query) => query.expected),
  );
  assert.ok(
    recall >= 90,
    `lexical recall must stay at the measured target, got ${recall.toFixed(2)}`,
  );
});

test("returns no result whose reason cannot be stated", () => {
  const index = TolerantRetrievalIndex.build(syntheticRecords());
  for (const query of QUERIES)
    assert.ok(
      everyResultStatesAReason(index.search(query.text)),
      `${query.id} returned a result without a stated reason`,
    );
});

test("answers the same query with the same results twice", () => {
  const first = TolerantRetrievalIndex.build(syntheticRecords());
  const second = TolerantRetrievalIndex.build(syntheticRecords());
  for (const query of QUERIES)
    assert.deepEqual(first.search(query.text), second.search(query.text));
});

test("holds the interactive budget at the declared event bound", () => {
  const base = syntheticRecords();
  const scaled: RetrievalRecord[] = [];
  for (let position = 0; scaled.length < DECLARED_EVENT_BOUND; position += 1) {
    const source = base[position % base.length];
    if (source === undefined) break;
    const copy = position >= base.length;
    scaled.push(
      record({
        id: copy ? `filler-${position}` : source.id,
        text: copy
          ? `${source.text} riferimento ${position % 4_096}`
          : source.text,
        location: source.location,
        occurredAt: source.occurredAt,
        provenance: copy ? `filler-${position}` : source.provenance,
      }),
    );
  }
  const index = TolerantRetrievalIndex.build(scaled);
  assert.equal(index.recordCount, DECLARED_EVENT_BOUND);
  const elapsed: number[] = [];
  for (const query of QUERIES) {
    const started = performance.now();
    index.search(query.text);
    elapsed.push(performance.now() - started);
  }
  const p95 = percentile95(elapsed);
  assert.ok(
    p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
    `p95 was ${p95.toFixed(1)} ms at ${DECLARED_EVENT_BOUND} records`,
  );
});

/* --------------------------------------------------------------- */
/* Fixture 2 — the unified corpus: admissibility and provenance     */
/* --------------------------------------------------------------- */

function unifiedRecords(): readonly RetrievalRecord[] {
  return Object.freeze(
    UNIFIED_CORPUS.map((entry) =>
      record({
        id: entry.id,
        text: entry.text,
        location: Object.freeze({
          store: entry.origin === "MEMORY" ? "ACTIVE_MEMORY" : "SESSION_EVENTS",
          path: entry.projectId,
          declaredName: null,
          position: null,
        }),
        occurredAt: entry.occurredAt,
        admissibility: entry.admissible ? "CURRENT" : "SUPERSEDED",
        provenance: entry.id,
      }),
    ),
  );
}

test("never returns memory that has been superseded or invalidated", () => {
  const index = TolerantRetrievalIndex.build(unifiedRecords());
  const inadmissible = new Set(
    UNIFIED_CORPUS.filter((entry) => !entry.admissible).map(
      (entry) => entry.id,
    ),
  );
  assert.ok(
    inadmissible.size > 0,
    "the fixture must contain inadmissible records",
  );
  for (const query of UNIFIED_QUERIES)
    for (const result of index.search(query.text))
      assert.ok(
        !inadmissible.has(result.id),
        `${result.id} is not admissible and must not be ranked for ${query.id}`,
      );
});

test("returns one result for records that share a provenance", () => {
  const shared = "artifact://sha256/copied-between-two-stores";
  const index = TolerantRetrievalIndex.build([
    record({
      id: "event-copy",
      text: "la decisione sul totale del carrello",
      provenance: shared,
    }),
    record({
      id: "memory-copy",
      text: "la decisione sul totale del carrello",
      provenance: shared,
    }),
  ]);
  const results = index.search("decisione totale carrello");
  assert.equal(results.length, 1);
});

/* -------------------------------------------------------- */
/* Fixture 3 — the real documentation corpus of this clone   */
/* -------------------------------------------------------- */

function documentRecords(): readonly RetrievalRecord[] {
  return Object.freeze(
    buildRecords(collectDocuments(), "SECTION").map((entry) =>
      record({
        id: entry.id,
        text: entry.body,
        location: Object.freeze({
          store: "DOCUMENTS",
          path: entry.documentPath,
          declaredName: entry.headingPath,
          position: null,
        }),
        provenance: entry.id,
      }),
    ),
  );
}

test("reaches the documentation this clone contains, in both languages", () => {
  const records = documentRecords();
  assert.ok(
    records.length > 100,
    "the documentation corpus must be long enough",
  );
  const index = TolerantRetrievalIndex.build(records);
  const elapsed: number[] = [];
  const queries = [...DOCUMENT_QUERIES, ...ITALIAN_QUERIES];
  const found = queries.map((query) => {
    const started = performance.now();
    const results = index.search(query.text);
    elapsed.push(performance.now() - started);
    assert.ok(
      everyResultStatesAReason(results),
      `${query.id} returned a result without a stated reason`,
    );
    return Object.freeze([
      ...new Set(
        results.map((result) => result.location.path.replace(/\\/gu, "/")),
      ),
    ]);
  });
  const recall = recallPercent(
    found,
    queries.map((query) => query.expected),
  );
  assert.ok(
    recall >= 65,
    `documentation recall fell to ${recall.toFixed(2)}, measured at 71.43`,
  );
  const p95 = percentile95(elapsed);
  assert.ok(
    p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
    `p95 was ${p95.toFixed(1)} ms over ${records.length} sections`,
  );
});

test("says the glossary is why an Italian question reached an English document", () => {
  const index = TolerantRetrievalIndex.build(documentRecords());
  const kinds = new Set(
    ITALIAN_QUERIES.flatMap((query) =>
      index
        .search(query.text)
        .flatMap((result) => result.reasons.map((reason) => reason.kind)),
    ),
  );
  assert.ok(
    kinds.has("GLOSSARY"),
    "no Italian question was answered through the glossary",
  );
});

/* ------------------------------------------------- */
/* Fixture 4 — the real TypeScript of this repository */
/* ------------------------------------------------- */

function codeRecords(): readonly RetrievalRecord[] {
  return Object.freeze(
    buildCodeRecords(collectSourceFiles(), "SYMBOL").map((entry) =>
      record({
        id: entry.id,
        text: entry.body,
        location: Object.freeze({
          store: "SOURCE",
          path: entry.path,
          declaredName: entry.symbol,
          position: entry.startLine,
        }),
        provenance: entry.id,
      }),
    ),
  );
}

test("reaches the code of this repository by name, by word, and by punctuation", () => {
  const records = codeRecords();
  assert.ok(records.length > 500, "the code corpus must be long enough");
  const index = TolerantRetrievalIndex.build(records);
  const elapsed: number[] = [];
  const found = CODE_QUERIES.map((query) => {
    const started = performance.now();
    const results = index.search(query.text);
    elapsed.push(performance.now() - started);
    assert.ok(
      everyResultStatesAReason(results),
      `${query.id} returned a result without a stated reason`,
    );
    return Object.freeze([
      ...new Set(
        results.map((result) => result.location.path.replace(/\\/gu, "/")),
      ),
    ]);
  });
  const recall = recallPercent(
    found,
    CODE_QUERIES.map((query) => query.expected),
  );
  assert.ok(
    recall >= 90,
    `code recall fell to ${recall.toFixed(2)}, measured at 100.00`,
  );
  const p95 = percentile95(elapsed);
  assert.ok(
    p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
    `p95 was ${p95.toFixed(1)} ms over ${records.length} symbols`,
  );
  for (const probe of PUNCTUATION_PROBES)
    assert.ok(
      codeTokens(probe).includes(probe),
      `${probe} must survive tokenization as a term of its own`,
    );
  /**
   * Two names that differ by little are one word apart for typo tolerance, and
   * the splitter is what keeps them separable: `encode` and `decode` are
   * different terms even though the whole identifiers are two edits apart.
   */
  for (const [left, right] of CONFUSABLE_IDENTIFIERS) {
    if (left === undefined || right === undefined) continue;
    assert.notDeepEqual(codeTokens(left), codeTokens(right));
  }
});

/* ---------------------------------------------------- */
/* The three decisions ADR-0032 settled, fixed by test   */
/* ---------------------------------------------------- */

test("reduces a canonical payload to the content a person saw", () => {
  const payload = JSON.stringify({
    recordUuid: "3f1c2a5e-0000-4000-8000-000000000001",
    recordType: "assistant",
    isSidechain: false,
    isMeta: false,
    blockIndex: 0,
    blockType: "text",
    text: "prima riga\n\nseconda riga sul capitolato",
  });
  const extracted = readCanonicalPayload(payload);
  assert.equal(extracted.parsed, true);
  assert.equal(extracted.text, "prima riga\n\nseconda riga sul capitolato");
  const terms = new Set(mergedTerms(extracted.text));
  for (const provenance of ["recorduuid", "issidechain", "blockindex"])
    assert.ok(!terms.has(provenance), `${provenance} must not become a term`);
  assert.ok(new Set(mergedTerms(payload)).has("recorduuid"));
});

test("indexes the raw payload when it cannot be parsed, and says so", () => {
  const broken = '{"blockType":"text","text":"capitolato tronco';
  const extracted = readCanonicalPayload(broken);
  assert.equal(extracted.parsed, false);
  assert.equal(extracted.text, broken);
  const index = TolerantRetrievalIndex.build([
    record({ id: "broken", text: extracted.text }),
  ]);
  assert.equal(index.search("capitolato")[0]?.id, "broken");
});

test("compares a typo against the surface form, not against the stem", () => {
  assert.ok(isTypoOf("documentazine", "documentazione"));
  assert.ok(!isTypoOf(stem("documentazine"), stem("documentazione")));
  const index = TolerantRetrievalIndex.build([
    record({ id: "doc", text: "la documentazione del capitolato" }),
  ]);
  const results = index.search("documentazine");
  assert.equal(results[0]?.id, "doc");
  assert.equal(results[0]?.reasons[0]?.kind, "TYPO");
});

/**
 * The transposition case is the one plain Levenshtein could not pay for on a
 * short word, and short words are most of what anyone types. These are the terms
 * that were out of reach before it was added, so a regression to Levenshtein
 * fails here rather than showing up as a search that quietly finds less.
 */
test("reaches a transposition for one edit, at every matched length", () => {
  for (const [typed, indexed] of [
    ["cerac", "cerca"],
    ["indcie", "indice"],
    ["saerch", "search"],
    ["meomria", "memoria"],
    ["retrieev", "retrieve"],
  ]) {
    if (typed === undefined || indexed === undefined) continue;
    assert.equal(boundedDistance(typed, indexed), 1, `${typed} → ${indexed}`);
    assert.ok(isTypoOf(typed, indexed), `${typed} must reach ${indexed}`);
    assert.ok(fixesTranspositionsUnderBudget(indexed));
  }
  /** Below the minimum length nothing is inexact, transpositions included. */
  assert.ok(!fixesTranspositionsUnderBudget("gui"));
  assert.ok(!isTypoOf("iug", "gui"));
  /** One edit is spent on the transposition, so a second change is still too far. */
  assert.ok(!isTypoOf("cerack", "cerca"));
});

test("reaches a typo through the index, stating it as the reason", () => {
  const index = TolerantRetrievalIndex.build([
    record({ id: "hit", text: "la cerca del totale nel carrello" }),
  ]);
  const results = index.search("cerac");
  assert.equal(results[0]?.id, "hit");
  assert.equal(results[0]?.reasons[0]?.kind, "TYPO");
});

test("indexes one merged token set, the one the measurement merged", () => {
  const text = "La cache in memoria: resolveGuiLocale() !== null";
  assert.deepEqual(mergedTerms(text), codeTokens(mergedBody(text)));
  assert.deepEqual(mergedQueryTerms(text), codeTokens(mergedQuery(text)));
  const terms = new Set(mergedTerms(text));
  for (const expected of [
    "memoria",
    "memori",
    "resolveguilocale",
    "gui",
    "!==",
  ])
    assert.ok(terms.has(expected), `${expected} must be in the merged set`);
});

test("refuses to answer once it has been invalidated", () => {
  const index = TolerantRetrievalIndex.build([
    record({ id: "one", text: "il totale del carrello" }),
  ]);
  index.invalidate();
  assert.throws(() => index.search("totale"), TolerantRetrievalError);
  index.rebuild([record({ id: "one", text: "il totale del carrello" })]);
  assert.equal(index.search("totale")[0]?.id, "one");
});
