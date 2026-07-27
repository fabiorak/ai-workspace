import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { TextEncoder } from "node:util";

import { HistoricalSearch } from "../packages/historical-search/src/index.ts";
import type { HistoricalEvent } from "../packages/historical-search/src/index.ts";
import type { SessionEvent } from "../packages/session-ingestion/src/index.ts";
import {
  STOPWORDS,
  boundedDistance,
  contentTerms,
  isTypoOf,
  normalizeTokens,
  stem,
} from "../packages/tolerant-retrieval/src/index.ts";

export const TOLERANT_SEARCH_CORPUS_ID = "TOLERANT_SEARCH_SYNTHETIC_V1";

export const PROBE_FAMILIES = [
  "LITERAL",
  "CASE_DIACRITICS",
  "INFLECTION",
  "TYPO",
  "WORD_ORDER",
  "PREFIX",
  "SYNONYM",
  "PARAPHRASE",
] as const;
export type ProbeFamily = (typeof PROBE_FAMILIES)[number];

export const LEXICAL_FAMILIES = Object.freeze([
  "LITERAL",
  "CASE_DIACRITICS",
  "INFLECTION",
  "TYPO",
  "WORD_ORDER",
  "PREFIX",
] as const satisfies readonly ProbeFamily[]);
export const BEYOND_LEXICAL_FAMILIES = Object.freeze([
  "SYNONYM",
  "PARAPHRASE",
] as const satisfies readonly ProbeFamily[]);

export const STRATEGY_NAMES = [
  "LITERAL_BASELINE",
  "NORMALIZED_TOKENS",
  "NORMALIZED_STEMMED",
  "TOLERANT_RANKED",
  "TOLERANT_INDEXED",
] as const;
export type StrategyName = (typeof STRATEGY_NAMES)[number];

export type CorpusRecord = Readonly<{
  id: string;
  projectId: string;
  conversationId: string;
  type: SessionEvent["type"];
  occurredAt: string;
  text: string;
}>;

export type CorpusQuery = Readonly<{
  id: string;
  family: ProbeFamily;
  text: string;
  expected: readonly string[];
}>;

export type FamilyScore = Readonly<{
  queries: number;
  recallPercent: number;
  precisionAtFivePercent: number;
  fullyAnsweredQueries: number;
  relevantFirstResultQueries: number;
  emptyResultQueries: number;
}>;

export type StrategyMeasurement = Readonly<{
  strategy: StrategyName;
  matching: string;
  ordering: string;
  families: Readonly<Record<ProbeFamily, FamilyScore>>;
  lexical: FamilyScore;
  beyondLexical: FamilyScore;
  decision: "ADOPT_FOR_ENGINE" | "REFINE" | "INSUFFICIENT";
}>;

export type ScaleMeasurement = Readonly<{
  records: number;
  distinctTerms: number;
  baseline:
    | Readonly<{
        outcome: "MEASURED";
        perQueryP95Milliseconds: number;
        withinInteractiveBudget: boolean;
      }>
    | Readonly<{
        outcome: "REFUSED_BY_DECLARED_BOUND";
        declaredEventBound: number;
      }>;
  tolerantScan: Readonly<{
    perQueryP95Milliseconds: number;
    withinInteractiveBudget: boolean;
  }>;
  tolerantIndexed: Readonly<{
    indexBuildMilliseconds: number;
    perQueryP95Milliseconds: number;
    withinInteractiveBudget: boolean;
  }>;
}>;

export type TolerantSearchReport = Readonly<{
  schemaVersion: 1;
  corpusId: typeof TOLERANT_SEARCH_CORPUS_ID;
  scaleProfile: ScaleProfile;
  counts: Readonly<{
    records: number;
    conversations: number;
    projects: number;
    queries: number;
    groundTruthPairs: number;
    perFamilyQueries: Readonly<Record<ProbeFamily, number>>;
  }>;
  corpusSha256: string;
  groundTruthSha256: string;
  strategies: readonly StrategyMeasurement[];
  residual: Readonly<{
    bestStrategy: StrategyName;
    familiesBelowTarget: readonly ProbeFamily[];
    unansweredQueries: readonly string[];
    gate:
      | "LEXICAL_WORK_FIRST"
      | "BEYOND_LEXICAL_EVALUATION_JUSTIFIED"
      | "KEEP_CURRENT_ENGINE";
  }>;
  scale: readonly ScaleMeasurement[];
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
}>;

const MAX_RECORDS = 20_000;
const MAX_RECORD_BYTES = 4_096;
const MAX_QUERY_BYTES = 256;
const RESULT_LIMIT = 20;
const TOP_RANKS = 5;
const RECALL_TARGET_PERCENT = 90;
const REFINE_TARGET_PERCENT = 70;
const FIRST_RESULT_TARGET_PERCENT = 80;
const INTERACTIVE_BUDGET_MILLISECONDS = 150;
const DECLARED_GLOBAL_EVENT_BOUND = 10_000;
export const SCALE_PROFILES = Object.freeze({
  SMALL: Object.freeze([1_000]),
  REFERENCE: Object.freeze([1_000, 9_000, 12_000]),
});
export type ScaleProfile = keyof typeof SCALE_PROFILES;
const SCALE_WARM_RUNS = 2;
const SCALE_MEASURED_RUNS = 3;
const SCALE_FILLER_TERMS = 4_096;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const encoder = new TextEncoder();

export class TolerantSearchMeasurementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TolerantSearchMeasurementError";
  }
}

/**
 * Predeclared synthetic corpus. Three conversations covering software work, an
 * infrastructure decision, and a document review, so retrieval is measured
 * without assuming that a project contains code.
 *
 * Canonical session events have no DECISION or CONSTRAINT type: those belong to
 * active memory, which the current search does not read. Decision-shaped and
 * constraint-shaped evidence therefore appears here as the conversation turn
 * that recorded it, which is also how the shipped engine would meet it today.
 */
export const CORPUS = Object.freeze([
  {
    id: "cart-question",
    projectId: "project-carrello",
    conversationId: "conv-carrello",
    type: "USER_MESSAGE",
    occurredAt: "2026-06-02T09:12:00.000Z",
    text: "Il carrello perde le quantità quando ricarico la pagina e il totale non torna.",
  },
  {
    id: "cart-tests",
    projectId: "project-carrello",
    conversationId: "conv-carrello",
    type: "TEST_RESULT",
    occurredAt: "2026-06-02T09:40:00.000Z",
    text: "12 test falliti in checkout/cart-total: il totale atteso non corrisponde.",
  },
  {
    id: "cart-error",
    projectId: "project-carrello",
    conversationId: "conv-carrello",
    type: "ERROR",
    occurredAt: "2026-06-02T09:41:00.000Z",
    text: "TypeError: cannot read properties of undefined reading quantity in cartTotal.",
  },
  {
    id: "cart-decision",
    projectId: "project-carrello",
    conversationId: "conv-carrello",
    type: "AGENT_MESSAGE",
    occurredAt: "2026-06-02T11:05:00.000Z",
    text: "Decisione registrata: il totale si calcola sul server, i client arrotondavano in modo diverso.",
  },
  {
    id: "cart-fix",
    projectId: "project-carrello",
    conversationId: "conv-carrello",
    type: "AGENT_MESSAGE",
    occurredAt: "2026-06-02T11:30:00.000Z",
    text: "Corretto l'arrotondamento del totale: adesso i test passano tutti.",
  },
  {
    id: "cache-question",
    projectId: "project-infra",
    conversationId: "conv-cache",
    type: "USER_MESSAGE",
    occurredAt: "2026-05-28T15:00:00.000Z",
    text: "Serve una cache esterna per le sessioni degli utenti?",
  },
  {
    id: "cache-decision",
    projectId: "project-infra",
    conversationId: "conv-cache",
    type: "AGENT_MESSAGE",
    occurredAt: "2026-05-28T16:20:00.000Z",
    text: "Deciso di non introdurre Redis: un servizio in più per un carico che sta in memoria.",
  },
  {
    id: "cache-constraint",
    projectId: "project-infra",
    conversationId: "conv-cache",
    type: "USER_MESSAGE",
    occurredAt: "2026-05-28T16:25:00.000Z",
    text: "Nessun servizio esterno entra senza una decisione registrata.",
  },
  {
    id: "cache-alternative",
    projectId: "project-infra",
    conversationId: "conv-cache",
    type: "AGENT_MESSAGE",
    occurredAt: "2026-05-28T16:40:00.000Z",
    text: "Scelta alternativa: conservazione nel processo con scadenza a cinque minuti.",
  },
  {
    id: "tender-question",
    projectId: "project-gare",
    conversationId: "conv-capitolato",
    type: "USER_MESSAGE",
    occurredAt: "2026-06-18T08:30:00.000Z",
    text: "Nel capitolato del Comune di Valdisole cerco le clausole sulle penali di ritardo.",
  },
  {
    id: "tender-section",
    projectId: "project-gare",
    conversationId: "conv-capitolato",
    type: "FILE_CHANGE",
    occurredAt: "2026-06-18T09:00:00.000Z",
    text: "capitolato-valdisole.md: aggiunta la sezione 7 sulle penalità per consegna tardiva.",
  },
  {
    id: "tender-gap",
    projectId: "project-gare",
    conversationId: "conv-capitolato",
    type: "ERROR",
    occurredAt: "2026-06-18T09:15:00.000Z",
    text: "Lacuna rilevata: la sezione 7 non indica il massimale delle penali.",
  },
  {
    id: "tender-decision",
    projectId: "project-gare",
    conversationId: "conv-capitolato",
    type: "AGENT_MESSAGE",
    occurredAt: "2026-06-18T10:00:00.000Z",
    text: "Decisione registrata: segnaliamo quattro lacune prima della scadenza.",
  },
] satisfies readonly CorpusRecord[]);

/**
 * Predeclared queries. Each one states the family of tolerance it requires and
 * the records a person would consider correct answers.
 */
export const QUERIES = Object.freeze([
  {
    id: "literal-tests",
    family: "LITERAL",
    text: "test falliti",
    expected: ["cart-tests"],
  },
  {
    id: "literal-redis",
    family: "LITERAL",
    text: "Redis",
    expected: ["cache-decision"],
  },
  {
    id: "diacritics-quantita",
    family: "CASE_DIACRITICS",
    text: "quantita",
    expected: ["cart-question"],
  },
  {
    id: "diacritics-penalita",
    family: "CASE_DIACRITICS",
    text: "PENALITA",
    expected: ["tender-question", "tender-section", "tender-gap"],
  },
  {
    id: "inflection-test-fallito",
    family: "INFLECTION",
    text: "test fallito",
    expected: ["cart-tests"],
  },
  {
    id: "inflection-decisioni",
    family: "INFLECTION",
    text: "decisioni sul totale",
    expected: ["cart-decision"],
  },
  {
    id: "inflection-penale",
    family: "INFLECTION",
    text: "penale",
    expected: ["tender-question", "tender-section", "tender-gap"],
  },
  {
    id: "typo-carrelo",
    family: "TYPO",
    text: "carrelo",
    expected: ["cart-question"],
  },
  {
    id: "typo-capitollato",
    family: "TYPO",
    text: "capitollato",
    expected: ["tender-question", "tender-section"],
  },
  {
    id: "order-totale-server",
    family: "WORD_ORDER",
    text: "totale server",
    expected: ["cart-decision"],
  },
  {
    id: "order-clausole-penali",
    family: "WORD_ORDER",
    text: "clausole penali capitolato",
    expected: ["tender-question"],
  },
  {
    id: "prefix-arrotond",
    family: "PREFIX",
    text: "arrotond",
    expected: ["cart-decision", "cart-fix"],
  },
  {
    id: "synonym-cache-memoria",
    family: "SYNONYM",
    text: "cache in memoria",
    expected: ["cache-decision", "cache-alternative"],
  },
  {
    id: "synonym-difetto-totale",
    family: "SYNONYM",
    text: "difetto del totale",
    expected: ["cart-tests", "cart-error"],
  },
  {
    id: "paraphrase-redis",
    family: "PARAPHRASE",
    text: "quando abbiamo lasciato perdere Redis",
    expected: ["cache-decision"],
  },
  {
    id: "paraphrase-bando",
    family: "PARAPHRASE",
    text: "cosa manca nel bando di gara",
    expected: ["tender-gap", "tender-decision"],
  },
] satisfies readonly CorpusQuery[]);

/**
 * The primitives moved to `@ai-workspace/tolerant-retrieval`, ported unchanged
 * from this harness, and are re-exported here so the package and the figures
 * below rest on one definition instead of two that could drift apart.
 */
export {
  STOPWORDS,
  boundedDistance,
  contentTerms,
  isTypoOf,
  normalizeTokens,
  stem,
};

type IndexedRecord = Readonly<{
  id: string;
  occurredAt: string;
  tokens: readonly string[];
  stems: readonly string[];
}>;

type MatchMode = "NORMALIZED" | "STEMMED" | "TOLERANT";

function indexRecords(
  records: readonly CorpusRecord[],
): readonly IndexedRecord[] {
  return Object.freeze(
    records.map((record) => {
      const tokens = normalizeTokens(record.text);
      return Object.freeze({
        id: record.id,
        occurredAt: record.occurredAt,
        tokens,
        stems: Object.freeze(tokens.map(stem)),
      });
    }),
  );
}

function termMatches(
  record: IndexedRecord,
  term: string,
  mode: MatchMode,
): number {
  const stemmed = stem(term);
  let matches = 0;
  for (const [position, token] of record.tokens.entries()) {
    const recordStem = record.stems[position] ?? token;
    const hit =
      token === term ||
      token.startsWith(term) ||
      (mode !== "NORMALIZED" && recordStem === stemmed) ||
      (mode === "TOLERANT" && isTypoOf(term, token));
    if (hit) matches += 1;
  }
  return matches;
}

function retrieveConjunctive(
  index: readonly IndexedRecord[],
  query: string,
  mode: Exclude<MatchMode, "TOLERANT">,
): readonly string[] {
  const terms = contentTerms(query);
  return Object.freeze(
    index
      .filter((record) =>
        terms.every((term) => termMatches(record, term, mode) > 0),
      )
      .sort(byRecencyThenId)
      .slice(0, RESULT_LIMIT)
      .map((record) => record.id),
  );
}

function retrieveRanked(
  index: readonly IndexedRecord[],
  query: string,
): readonly string[] {
  const terms = contentTerms(query);
  const frequencies = terms.map((term) =>
    index.reduce(
      (total, record) =>
        total + (termMatches(record, term, "TOLERANT") > 0 ? 1 : 0),
      0,
    ),
  );
  const averageLength =
    index.reduce((total, record) => total + record.tokens.length, 0) /
    Math.max(1, index.length);
  const scored: { id: string; occurredAt: string; score: number }[] = [];
  for (const record of index) {
    let score = 0;
    for (const [position, term] of terms.entries()) {
      const termFrequency = termMatches(record, term, "TOLERANT");
      if (termFrequency === 0) continue;
      const documentFrequency = frequencies[position] ?? 1;
      const inverse = Math.log(
        1 +
          (index.length - documentFrequency + 0.5) / (documentFrequency + 0.5),
      );
      const normalization =
        termFrequency +
        BM25_K1 *
          (1 - BM25_B + (BM25_B * record.tokens.length) / averageLength);
      score += (inverse * (termFrequency * (BM25_K1 + 1))) / normalization;
    }
    if (score > 0)
      scored.push({ id: record.id, occurredAt: record.occurredAt, score });
  }
  scored.sort(
    (left, right) =>
      right.score - left.score ||
      right.occurredAt.localeCompare(left.occurredAt, "en") ||
      left.id.localeCompare(right.id, "en"),
  );
  return Object.freeze(scored.slice(0, RESULT_LIMIT).map((entry) => entry.id));
}

export type InvertedIndex = Readonly<{
  records: readonly IndexedRecord[];
  averageLength: number;
  dictionary: readonly string[];
  postings: ReadonlyMap<string, ReadonlyMap<number, number>>;
}>;

/**
 * Same matching rules as the ranked scan, reached through a term dictionary and
 * posting lists instead of re-reading every record for every query term.
 */
export function buildInvertedIndex(
  records: readonly CorpusRecord[],
): InvertedIndex {
  const indexed = indexRecords(records);
  const postings = new Map<string, Map<number, number>>();
  let totalLength = 0;
  for (const [position, record] of indexed.entries()) {
    totalLength += record.tokens.length;
    for (const token of record.tokens) {
      const entry = postings.get(token) ?? new Map<number, number>();
      entry.set(position, (entry.get(position) ?? 0) + 1);
      postings.set(token, entry);
    }
  }
  return Object.freeze({
    records: indexed,
    averageLength: totalLength / Math.max(1, indexed.length),
    dictionary: Object.freeze([...postings.keys()]),
    postings,
  });
}

function expandTerm(index: InvertedIndex, term: string): readonly string[] {
  const stemmed = stem(term);
  return Object.freeze(
    index.dictionary.filter(
      (candidate) =>
        candidate === term ||
        candidate.startsWith(term) ||
        stem(candidate) === stemmed ||
        isTypoOf(term, candidate),
    ),
  );
}

export function retrieveIndexed(
  index: InvertedIndex,
  query: string,
): readonly string[] {
  const terms = contentTerms(query);
  const contributions = terms.map((term) => {
    const frequencies = new Map<number, number>();
    for (const candidate of expandTerm(index, term))
      for (const [position, count] of index.postings.get(candidate) ?? [])
        frequencies.set(position, (frequencies.get(position) ?? 0) + count);
    return frequencies;
  });
  const scores = new Map<number, number>();
  for (const frequencies of contributions) {
    const inverse = Math.log(
      1 +
        (index.records.length - frequencies.size + 0.5) /
          (frequencies.size + 0.5),
    );
    for (const [position, termFrequency] of frequencies) {
      const record = index.records[position];
      if (record === undefined) continue;
      const normalization =
        termFrequency +
        BM25_K1 *
          (1 - BM25_B + (BM25_B * record.tokens.length) / index.averageLength);
      scores.set(
        position,
        (scores.get(position) ?? 0) +
          (inverse * (termFrequency * (BM25_K1 + 1))) / normalization,
      );
    }
  }
  return Object.freeze(
    [...scores.entries()]
      .map(([position, score]) => ({ record: index.records[position], score }))
      .filter(
        (entry): entry is { record: IndexedRecord; score: number } =>
          entry.record !== undefined && entry.score > 0,
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.record.occurredAt.localeCompare(left.record.occurredAt, "en") ||
          left.record.id.localeCompare(right.record.id, "en"),
      )
      .slice(0, RESULT_LIMIT)
      .map((entry) => entry.record.id),
  );
}

function byRecencyThenId(left: IndexedRecord, right: IndexedRecord): number {
  return (
    right.occurredAt.localeCompare(left.occurredAt, "en") ||
    left.id.localeCompare(right.id, "en")
  );
}

function historicalEvents(
  records: readonly CorpusRecord[],
): readonly HistoricalEvent[] {
  return Object.freeze(
    records.map((record, position) =>
      Object.freeze({
        projectId: record.projectId,
        event: Object.freeze({
          id: record.id,
          sessionId: record.conversationId,
          sequence: position,
          type: record.type,
          occurredAt: record.occurredAt,
          trust: "UNTRUSTED",
          payload: Object.freeze({
            kind: "INLINE_TEXT" as const,
            text: record.text,
          }),
          source: Object.freeze({
            artifactId: `artifact://sha256/${"a".repeat(64)}`,
            sourceType: "synthetic",
            sourceSessionId: record.conversationId,
            position,
            recordHash: "d".repeat(64),
          }),
        }) satisfies SessionEvent,
      }),
    ),
  );
}

function productionEngine(records: readonly CorpusRecord[]): {
  readonly projectIds: readonly string[];
  readonly search: (query: string) => Promise<readonly string[]>;
} {
  const events = historicalEvents(records);
  const projectIds = Object.freeze([
    ...new Set(records.map((record) => record.projectId)),
  ]);
  const engine = new HistoricalSearch({
    events: {
      list: async (projectId) =>
        events.filter((entry) => entry.projectId === projectId),
      find: async (projectId, eventId) =>
        events.find(
          (entry) =>
            entry.projectId === projectId && entry.event.id === eventId,
        ) ?? null,
    },
    artifacts: { read: async () => encoder.encode("unused") },
    projects: {
      exists: async (projectId) => projectIds.includes(projectId),
    },
  });
  return {
    projectIds,
    search: async (query) => {
      const report = await engine.searchAcrossProjects({
        projectIds,
        text: query,
        limit: RESULT_LIMIT,
      });
      return report.results.map((result) => result.eventId);
    },
  };
}

function scoreQueries(
  outcomes: readonly Readonly<{
    query: CorpusQuery;
    returned: readonly string[];
  }>[],
): FamilyScore {
  let recallTotal = 0;
  let precisionTotal = 0;
  let fullyAnswered = 0;
  let relevantFirst = 0;
  let empty = 0;
  for (const { query, returned } of outcomes) {
    const relevant = new Set(query.expected);
    const found = returned.filter((id) => relevant.has(id));
    const top = returned.slice(0, TOP_RANKS);
    const topRelevant = top.filter((id) => relevant.has(id)).length;
    recallTotal += found.length / relevant.size;
    precisionTotal += top.length === 0 ? 0 : topRelevant / top.length;
    if (found.length === relevant.size) fullyAnswered += 1;
    if (returned[0] !== undefined && relevant.has(returned[0]))
      relevantFirst += 1;
    if (returned.length === 0) empty += 1;
  }
  const queries = outcomes.length;
  return Object.freeze({
    queries,
    recallPercent: percent(recallTotal, queries),
    precisionAtFivePercent: percent(precisionTotal, queries),
    fullyAnsweredQueries: fullyAnswered,
    relevantFirstResultQueries: relevantFirst,
    emptyResultQueries: empty,
  });
}

function decide(lexical: FamilyScore): StrategyMeasurement["decision"] {
  const firstResultShare = percent(
    lexical.relevantFirstResultQueries,
    lexical.queries,
  );
  if (
    lexical.recallPercent >= RECALL_TARGET_PERCENT &&
    firstResultShare >= FIRST_RESULT_TARGET_PERCENT
  )
    return "ADOPT_FOR_ENGINE";
  return lexical.recallPercent >= REFINE_TARGET_PERCENT
    ? "REFINE"
    : "INSUFFICIENT";
}

const STRATEGY_DESCRIPTIONS: Readonly<
  Record<StrategyName, Readonly<{ matching: string; ordering: string }>>
> = Object.freeze({
  LITERAL_BASELINE: Object.freeze({
    matching: "case-insensitive literal substring over canonical payload text",
    ordering: "source timestamp, session ID, sequence",
  }),
  NORMALIZED_TOKENS: Object.freeze({
    matching:
      "diacritic-folded token equality or prefix, every query term required",
    ordering: "most recent first",
  }),
  NORMALIZED_STEMMED: Object.freeze({
    matching:
      "normalized tokens plus rule-based Italian and English suffix reduction",
    ordering: "most recent first",
  }),
  TOLERANT_RANKED: Object.freeze({
    matching:
      "stemmed tokens plus bounded edit distance, any query term contributes",
    ordering: "BM25 relevance, most recent as tiebreak",
  }),
  TOLERANT_INDEXED: Object.freeze({
    matching:
      "identical rules reached through a term dictionary and posting lists",
    ordering: "BM25 relevance, most recent as tiebreak",
  }),
});

async function measureStrategy(
  strategy: StrategyName,
  retrieve: (query: string) => Promise<readonly string[]>,
): Promise<StrategyMeasurement> {
  const outcomes: Readonly<{
    query: CorpusQuery;
    returned: readonly string[];
  }>[] = [];
  for (const query of QUERIES)
    outcomes.push(
      Object.freeze({ query, returned: await retrieve(query.text) }),
    );
  const families = Object.fromEntries(
    PROBE_FAMILIES.map((family) => [
      family,
      scoreQueries(outcomes.filter((entry) => entry.query.family === family)),
    ]),
  ) as Record<ProbeFamily, FamilyScore>;
  const description = STRATEGY_DESCRIPTIONS[strategy];
  return Object.freeze({
    strategy,
    matching: description.matching,
    ordering: description.ordering,
    families: Object.freeze(families),
    lexical: scoreQueries(
      outcomes.filter((entry) =>
        LEXICAL_FAMILIES.includes(
          entry.query.family as (typeof LEXICAL_FAMILIES)[number],
        ),
      ),
    ),
    beyondLexical: scoreQueries(
      outcomes.filter((entry) =>
        BEYOND_LEXICAL_FAMILIES.includes(
          entry.query.family as (typeof BEYOND_LEXICAL_FAMILIES)[number],
        ),
      ),
    ),
    decision: decide(
      scoreQueries(
        outcomes.filter((entry) =>
          LEXICAL_FAMILIES.includes(
            entry.query.family as (typeof LEXICAL_FAMILIES)[number],
          ),
        ),
      ),
    ),
  });
}

async function unanswered(
  retrieve: (query: string) => Promise<readonly string[]>,
): Promise<readonly string[]> {
  const missed: string[] = [];
  for (const query of QUERIES) {
    const returned = await retrieve(query.text);
    if (!returned.some((id) => query.expected.includes(id)))
      missed.push(query.id);
  }
  return Object.freeze(missed);
}

function scaleCorpus(records: number): readonly CorpusRecord[] {
  if (records < 1 || records > MAX_RECORDS)
    throw new TolerantSearchMeasurementError(
      `Scale corpus must hold from 1 to ${MAX_RECORDS} records.`,
    );
  return Object.freeze(
    Array.from({ length: records }, (_, index) => {
      const template = CORPUS[index % CORPUS.length];
      if (template === undefined)
        throw new TolerantSearchMeasurementError(
          "Predeclared corpus must not be empty.",
        );
      const filler = `riempimento${String(index % SCALE_FILLER_TERMS).padStart(4, "0")}`;
      return Object.freeze({
        ...template,
        id: `${template.id}-${String(index).padStart(6, "0")}`,
        text: `${template.text} ${filler}`,
      });
    }),
  );
}

async function measureScale(records: number): Promise<ScaleMeasurement> {
  const corpus = scaleCorpus(records);
  assertBounds(corpus);
  const index = indexRecords(corpus);
  const distinctTerms = new Set(index.flatMap((record) => [...record.tokens]))
    .size;
  const engine = productionEngine(corpus);
  const baselineSamples: number[] = [];
  let baselineRefused = false;
  for (let run = 0; run < SCALE_WARM_RUNS + SCALE_MEASURED_RUNS; run += 1)
    for (const query of QUERIES) {
      const started = performance.now();
      try {
        await engine.search(query.text);
      } catch {
        baselineRefused = true;
        break;
      }
      if (run >= SCALE_WARM_RUNS)
        baselineSamples.push(performance.now() - started);
    }
  const scanSamples: number[] = [];
  for (let run = 0; run < SCALE_WARM_RUNS + SCALE_MEASURED_RUNS; run += 1)
    for (const query of QUERIES) {
      const started = performance.now();
      retrieveRanked(index, query.text);
      if (run >= SCALE_WARM_RUNS) scanSamples.push(performance.now() - started);
    }
  const buildStarted = performance.now();
  const inverted = buildInvertedIndex(corpus);
  const indexBuild = performance.now() - buildStarted;
  const indexedSamples: number[] = [];
  for (let run = 0; run < SCALE_WARM_RUNS + SCALE_MEASURED_RUNS; run += 1)
    for (const query of QUERIES) {
      const started = performance.now();
      retrieveIndexed(inverted, query.text);
      if (run >= SCALE_WARM_RUNS)
        indexedSamples.push(performance.now() - started);
    }
  const scanP95 = percentile95(scanSamples);
  const indexedP95 = percentile95(indexedSamples);
  return Object.freeze({
    records: corpus.length,
    distinctTerms,
    baseline: baselineRefused
      ? Object.freeze({
          outcome: "REFUSED_BY_DECLARED_BOUND" as const,
          declaredEventBound: DECLARED_GLOBAL_EVENT_BOUND,
        })
      : Object.freeze({
          outcome: "MEASURED" as const,
          perQueryP95Milliseconds: percentile95(baselineSamples),
          withinInteractiveBudget:
            percentile95(baselineSamples) <= INTERACTIVE_BUDGET_MILLISECONDS,
        }),
    tolerantScan: Object.freeze({
      perQueryP95Milliseconds: scanP95,
      withinInteractiveBudget: scanP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
    }),
    tolerantIndexed: Object.freeze({
      indexBuildMilliseconds: milliseconds(indexBuild),
      perQueryP95Milliseconds: indexedP95,
      withinInteractiveBudget: indexedP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
    }),
  });
}

function assertBounds(records: readonly CorpusRecord[]): void {
  if (records.length > MAX_RECORDS)
    throw new TolerantSearchMeasurementError(
      `Corpus must hold at most ${MAX_RECORDS} records.`,
    );
  const identities = new Set<string>();
  for (const record of records) {
    if (encoder.encode(record.text).byteLength > MAX_RECORD_BYTES)
      throw new TolerantSearchMeasurementError(
        `Corpus records must stay within ${MAX_RECORD_BYTES} UTF-8 bytes.`,
      );
    if (identities.has(record.id))
      throw new TolerantSearchMeasurementError(
        "Corpus record identities must be unique.",
      );
    identities.add(record.id);
  }
}

function assertQueries(): void {
  const identities = new Set<string>();
  const known = new Set(CORPUS.map((record) => record.id));
  for (const query of QUERIES) {
    if (encoder.encode(query.text).byteLength > MAX_QUERY_BYTES)
      throw new TolerantSearchMeasurementError(
        `Queries must stay within ${MAX_QUERY_BYTES} UTF-8 bytes.`,
      );
    if (identities.has(query.id))
      throw new TolerantSearchMeasurementError(
        "Query identities must be unique.",
      );
    identities.add(query.id);
    if (query.expected.length < 1)
      throw new TolerantSearchMeasurementError(
        "Every query must declare at least one expected record.",
      );
    for (const expected of query.expected)
      if (!known.has(expected))
        throw new TolerantSearchMeasurementError(
          "Expected records must exist in the predeclared corpus.",
        );
  }
}

export async function measureTolerantSearch(
  profile: ScaleProfile = "REFERENCE",
): Promise<TolerantSearchReport> {
  assertBounds(CORPUS);
  assertQueries();
  const index = indexRecords(CORPUS);
  const inverted = buildInvertedIndex(CORPUS);
  const engine = productionEngine(CORPUS);
  const retrievers: Readonly<
    Record<StrategyName, (query: string) => Promise<readonly string[]>>
  > = Object.freeze({
    LITERAL_BASELINE: engine.search,
    NORMALIZED_TOKENS: async (query) =>
      retrieveConjunctive(index, query, "NORMALIZED"),
    NORMALIZED_STEMMED: async (query) =>
      retrieveConjunctive(index, query, "STEMMED"),
    TOLERANT_RANKED: async (query) => retrieveRanked(index, query),
    TOLERANT_INDEXED: async (query) => retrieveIndexed(inverted, query),
  });
  const strategies: StrategyMeasurement[] = [];
  for (const strategy of STRATEGY_NAMES)
    strategies.push(await measureStrategy(strategy, retrievers[strategy]));
  const best = strategies.reduce((left, right) =>
    right.lexical.recallPercent >= left.lexical.recallPercent ? right : left,
  );
  const familiesBelowTarget = PROBE_FAMILIES.filter(
    (family) =>
      (best.families[family]?.recallPercent ?? 0) < REFINE_TARGET_PERCENT,
  );
  const lexicalBelowTarget = familiesBelowTarget.some((family) =>
    LEXICAL_FAMILIES.includes(family as (typeof LEXICAL_FAMILIES)[number]),
  );
  const scale: ScaleMeasurement[] = [];
  for (const step of SCALE_PROFILES[profile])
    scale.push(await measureScale(step));
  return Object.freeze({
    schemaVersion: 1,
    corpusId: TOLERANT_SEARCH_CORPUS_ID,
    scaleProfile: profile,
    counts: Object.freeze({
      records: CORPUS.length,
      conversations: new Set(CORPUS.map((record) => record.conversationId))
        .size,
      projects: new Set(CORPUS.map((record) => record.projectId)).size,
      queries: QUERIES.length,
      groundTruthPairs: QUERIES.reduce(
        (total, query) => total + query.expected.length,
        0,
      ),
      perFamilyQueries: Object.freeze(
        Object.fromEntries(
          PROBE_FAMILIES.map((family) => [
            family,
            QUERIES.filter((query) => query.family === family).length,
          ]),
        ) as Record<ProbeFamily, number>,
      ),
    }),
    corpusSha256: digest(CORPUS.map((record) => `${record.id} ${record.text}`)),
    groundTruthSha256: digest(
      QUERIES.map(
        (query) =>
          `${query.id} ${query.family} ${query.text} ${query.expected.join(",")}`,
      ),
    ),
    strategies: Object.freeze(strategies),
    residual: Object.freeze({
      bestStrategy: best.strategy,
      familiesBelowTarget: Object.freeze(familiesBelowTarget),
      unansweredQueries: await unanswered(retrievers[best.strategy]),
      gate: gateFor(familiesBelowTarget.length, lexicalBelowTarget),
    }),
    scale: Object.freeze(scale),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER",
  });
}

function gateFor(
  below: number,
  lexicalBelow: boolean,
): TolerantSearchReport["residual"]["gate"] {
  if (lexicalBelow) return "LEXICAL_WORK_FIRST";
  return below > 0
    ? "BEYOND_LEXICAL_EVALUATION_JUSTIFIED"
    : "KEEP_CURRENT_ENGINE";
}

export function withoutElapsed(report: TolerantSearchReport) {
  return Object.freeze({
    schemaVersion: report.schemaVersion,
    corpusId: report.corpusId,
    scaleProfile: report.scaleProfile,
    counts: report.counts,
    corpusSha256: report.corpusSha256,
    groundTruthSha256: report.groundTruthSha256,
    strategies: report.strategies,
    residual: report.residual,
    scale: Object.freeze(
      report.scale.map((step) =>
        Object.freeze({
          records: step.records,
          distinctTerms: step.distinctTerms,
          baselineOutcome: step.baseline.outcome,
        }),
      ),
    ),
    effect: report.effect,
  });
}

function digest(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part, "utf8");
  return hash.digest("hex");
}

function percent(value: number, total: number): number {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));
}

function milliseconds(value: number): number {
  return Number(value.toFixed(3));
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return milliseconds(
    ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await measureTolerantSearch(
    process.argv[2] === "SMALL" ? "SMALL" : "REFERENCE",
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
