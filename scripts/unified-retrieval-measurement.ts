import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import type {
  MemoryItem,
  MemorySourceLink,
} from "../packages/active-memory/src/index.ts";
import type { SessionEvent } from "../packages/session-ingestion/src/index.ts";

import {
  CORPUS,
  PROBE_FAMILIES,
  QUERIES,
  type CorpusRecord,
  type ProbeFamily,
} from "./tolerant-search-measurement.ts";
import {
  contentTerms,
  isTypoOf,
  stem,
} from "../packages/tolerant-retrieval/src/index.ts";

export const UNIFIED_RETRIEVAL_CORPUS_ID = "UNIFIED_RETRIEVAL_SYNTHETIC_V1";

export const ENGINE_NAMES = [
  "EVENTS_ONLY_INVERTED",
  "UNIFIED_INVERTED",
  "UNIFIED_FTS5_UNICODE61",
  "UNIFIED_FTS5_TRIGRAM",
  "UNIFIED_DENSE",
  "UNIFIED_HYBRID",
] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

export const DENSE_ENGINES = Object.freeze([
  "UNIFIED_DENSE",
  "UNIFIED_HYBRID",
] as const satisfies readonly EngineName[]);

export const DENSE_MODEL = "bge-m3";
export const DENSE_ENDPOINT = "http://localhost:11434/api/embed";

/** Origin of a retrievable record. The product keeps the two stores apart. */
export const RECORD_ORIGINS = ["EVENT", "MEMORY"] as const;
export type RecordOrigin = (typeof RECORD_ORIGINS)[number];

export type UnifiedRecord = Readonly<{
  id: string;
  origin: RecordOrigin;
  label: SessionEvent["type"] | MemoryItem["type"];
  projectId: string;
  occurredAt: string;
  text: string;
  /**
   * Whether the record may be shown as a current answer. Superseded and
   * invalidated memory stays retrievable for audit but must never surface as if
   * it still held.
   */
  admissible: boolean;
}>;

export type UnifiedQuery = Readonly<{
  id: string;
  family: ProbeFamily;
  text: string;
  expected: readonly string[];
  /** Records that would be a wrong answer even though they match the words. */
  forbidden: readonly string[];
}>;

export type RetrievedRecord = Readonly<{
  id: string;
  origin: RecordOrigin;
  rank: number;
  /** Why this record matched, which the product must be able to show. */
  because: string;
}>;

export type EngineQuality = Readonly<{
  queries: number;
  recallPercent: number;
  /**
   * Precision over as many positions as the query has correct answers.
   * Precision at a fixed five positions would be structurally unreachable here,
   * because a query with one correct answer could never exceed twenty percent.
   */
  precisionAtExpectedCountPercent: number;
  /** Where the person finds the first correct answer, worst case over queries. */
  worstFirstRelevantRank: number | null;
  fullyAnsweredQueries: number;
  emptyResultQueries: number;
  memoryTargetRecallPercent: number;
  eventTargetRecallPercent: number;
}>;

export type EngineGates = Readonly<{
  noInadmissibleResults: boolean;
  originExposedOnEveryResult: boolean;
  matchReasonExposedOnEveryResult: boolean;
  deterministicAcrossRuns: boolean;
  availableWithoutRunningService: boolean;
}>;

export type EngineMeasurement = Readonly<{
  engine: EngineName;
  reads: readonly RecordOrigin[];
  matching: string;
  ordering: string;
  outcome: "MEASURED" | "SKIPPED_SERVICE_UNAVAILABLE";
  quality: EngineQuality | null;
  /** Null for a family these queries do not probe, so it reads apart from zero. */
  perFamilyRecallPercent: Readonly<Record<ProbeFamily, number | null>> | null;
  gates: EngineGates | null;
  decision:
    | "ADOPT_AS_PRIMARY"
    | "ADOPT_AS_SECONDARY"
    | "REFINE"
    | "REJECT"
    | "UNDECIDED_SERVICE_UNAVAILABLE";
}>;

export type DenseAvailability = Readonly<{
  requested: DenseMode;
  outcome:
    "MEASURED" | "SKIPPED_BY_PROFILE" | "UNAVAILABLE_DEGRADED_TO_LEXICAL";
  model: typeof DENSE_MODEL;
  endpoint: typeof DENSE_ENDPOINT;
  dimensions: number | null;
  /**
   * First call of this run. It equals the warm figure when the service still
   * holds the model in memory and rises to roughly a second and a half when the
   * model has to be loaded, which is the cost a person who searches once an hour
   * would actually meet.
   */
  firstCallMilliseconds: number | null;
  queryEmbeddingP95Milliseconds: number | null;
  queryEmbeddingWithinInteractiveBudget: boolean | null;
  buildRecordsPerSecond: number | null;
  qualityMeasuredOn: "REAL_RECORDS_ONLY";
  scaleVectors: "SYNTHETIC_DETERMINISTIC_FOR_LATENCY_ONLY";
}>;

export type EngineScaleStep = Readonly<{
  engine: EngineName;
  buildMilliseconds: number;
  perQueryP95Milliseconds: number;
  withinInteractiveBudget: boolean;
}>;

export type UnifiedScaleMeasurement = Readonly<{
  records: number;
  distinctTerms: number;
  /**
   * Latency grows with the terms in the question, not only with the corpus, so
   * the term count of the measured questions is part of the reading.
   */
  queryTermsMeasured: number;
  engines: readonly EngineScaleStep[];
}>;

export type UnifiedRetrievalReport = Readonly<{
  schemaVersion: 1;
  corpusId: typeof UNIFIED_RETRIEVAL_CORPUS_ID;
  scaleProfile: ScaleProfile;
  counts: Readonly<{
    eventRecords: number;
    memoryRecords: number;
    admissibleRecords: number;
    inadmissibleRecords: number;
    queries: number;
    groundTruthPairs: number;
    forbiddenPairs: number;
  }>;
  corpusSha256: string;
  groundTruthSha256: string;
  dense: DenseAvailability;
  engines: readonly EngineMeasurement[];
  storeGap: Readonly<{
    memoryTargetsReachableByCurrentStores: boolean;
    memoryRecallEventsOnlyPercent: number;
    memoryRecallUnifiedPercent: number;
    conclusion:
      | "UNIFICATION_REQUIRED_FOR_DECLARED_EXPERIENCE"
      | "EVENTS_ALONE_SUFFICIENT";
  }>;
  /**
   * A memory item is extracted from an event, so a unified search can return
   * the same information twice: once as the turn that said it and once as the
   * curated item. Counted here because the person would read it as two answers.
   */
  redundancy: Readonly<{
    memorySourcePairs: number;
    pairsReturnedTogether: number;
    examples: readonly string[];
    conclusion:
      "DEDUPLICATION_BY_PROVENANCE_REQUIRED" | "NO_REDUNDANCY_OBSERVED";
  }>;
  scale: readonly UnifiedScaleMeasurement[];
  recommendation: Readonly<{
    primaryEngine: EngineName;
    secondaryEngine: EngineName | null;
    denseOnCriticalPath: boolean;
    reason: string;
  }>;
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
}>;

export const SCALE_PROFILES = Object.freeze({
  SMALL: Object.freeze([1_000]),
  REFERENCE: Object.freeze([1_000, 9_000, 12_000]),
});
export type ScaleProfile = keyof typeof SCALE_PROFILES;

export const DENSE_MODES = ["SKIP", "IF_AVAILABLE", "REQUIRE"] as const;
export type DenseMode = (typeof DENSE_MODES)[number];

const RESULT_LIMIT = 20;
const INTERACTIVE_BUDGET_MILLISECONDS = 150;
const RECALL_TARGET_PERCENT = 90;
const REFINE_TARGET_PERCENT = 70;
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const RRF_K = 60;
const DENSE_BATCH_SIZE = 64;
const DENSE_TIMEOUT_MILLISECONDS = 120_000;
const DENSE_QUERY_SAMPLES = 5;
const DENSE_RATE_SAMPLE_SIZE = 128;
const SCALE_WARM_RUNS = 2;
const SCALE_MEASURED_RUNS = 3;
const SCALE_FILLER_TERMS = 4_096;
const MAX_RECORDS = 20_000;

export class UnifiedRetrievalMeasurementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UnifiedRetrievalMeasurementError";
  }
}

/**
 * Synthetic memory source link. The measurement never reads a real store, so
 * every provenance field is a declared constant rather than imported state.
 */
function syntheticSource(eventId: string): MemorySourceLink {
  return Object.freeze({
    eventId,
    sessionId: "synthetic-session",
    eventType: "AGENT_MESSAGE",
    trust: "UNTRUSTED",
    sourceArtifactId: "synthetic-artifact",
    sourcePosition: 0,
    sourceRecordHash: createHash("sha256").update(eventId).digest("hex"),
  } satisfies MemorySourceLink);
}

function memoryItem(
  input: Readonly<{
    id: string;
    projectId: string;
    type: MemoryItem["type"];
    content: string;
    validity: MemoryItem["validity"];
    sourceEventId: string;
    supersedes?: string;
  }>,
): MemoryItem {
  return Object.freeze({
    id: input.id,
    projectId: input.projectId,
    type: input.type,
    content: input.content,
    curation: "USER_CURATED",
    validity: input.validity,
    verification: "VERIFIED",
    confidence: "MEDIUM",
    version: 1,
    sources: Object.freeze([syntheticSource(input.sourceEventId)]),
    creationOperationId: `synthetic-operation-${input.id}`,
    createdBy: "LOCAL_USER",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    supersedes: input.supersedes ?? null,
    supersession: null,
    verifications: Object.freeze([]),
    invalidation: null,
  } satisfies MemoryItem);
}

/**
 * Predeclared synthetic memory corpus over the same three conversations as the
 * lexical measurement. It deliberately contains one superseded and one
 * invalidated item, because an engine that reaches memory must also refuse to
 * present memory that no longer holds.
 */
export const MEMORY_CORPUS: readonly MemoryItem[] = Object.freeze([
  memoryItem({
    id: "mem-server-total",
    projectId: "project-carrello",
    type: "DECISION",
    content:
      "Il totale del carrello si calcola sul server: i client arrotondavano in modo diverso.",
    validity: "ACTIVE",
    sourceEventId: "cart-decision",
    supersedes: "mem-client-total",
  }),
  memoryItem({
    id: "mem-client-total",
    projectId: "project-carrello",
    type: "DECISION",
    content:
      "Il totale del carrello si calcola sul client per ridurre le chiamate al server.",
    validity: "SUPERSEDED",
    sourceEventId: "cart-question",
  }),
  memoryItem({
    id: "mem-rounding-failure",
    projectId: "project-carrello",
    type: "FAILURE",
    content:
      "L'arrotondamento a due decimali applicato due volte faceva sparire un centesimo dal totale.",
    validity: "ACTIVE",
    sourceEventId: "cart-error",
  }),
  memoryItem({
    id: "mem-cache-memory",
    projectId: "project-infra",
    type: "DECISION",
    content:
      "Le sessioni restano in memoria nel processo: Redis scartato come servizio in più da gestire.",
    validity: "ACTIVE",
    sourceEventId: "cache-decision",
  }),
  memoryItem({
    id: "mem-external-service",
    projectId: "project-infra",
    type: "CONSTRAINT",
    content:
      "Nessun servizio esterno entra in produzione senza una decisione registrata.",
    validity: "ACTIVE",
    sourceEventId: "cache-constraint",
  }),
  memoryItem({
    id: "mem-penalty-cap",
    projectId: "project-gare",
    type: "CONSTRAINT",
    content:
      "Il massimale delle penali va sempre verificato sul capitolato firmato.",
    validity: "ACTIVE",
    sourceEventId: "tender-gap",
  }),
  memoryItem({
    id: "mem-wrong-penalty",
    projectId: "project-gare",
    type: "DECISION",
    content:
      "La penale massima del capitolato è il dieci per cento dell'importo contrattuale.",
    validity: "INVALIDATED",
    sourceEventId: "tender-section",
  }),
]);

/**
 * Predeclared queries whose correct answers live in memory, in events, or in
 * both. `forbidden` states which matching record would be a wrong answer.
 */
export const UNIFIED_QUERIES: readonly UnifiedQuery[] = Object.freeze([
  {
    id: "memory-literal-constraint",
    family: "LITERAL",
    text: "vincolo servizio esterno",
    expected: ["mem-external-service"],
    forbidden: [],
  },
  {
    id: "memory-typo-constraint",
    family: "TYPO",
    text: "vincolo servizzi esterni",
    expected: ["mem-external-service"],
    forbidden: [],
  },
  {
    id: "memory-inflection-decision",
    family: "INFLECTION",
    text: "decisioni registrate sul totale",
    expected: ["mem-server-total", "mem-external-service"],
    forbidden: ["mem-client-total"],
  },
  {
    id: "memory-paraphrase-failure",
    family: "PARAPHRASE",
    text: "perché spariva un centesimo",
    expected: ["mem-rounding-failure"],
    forbidden: [],
  },
  {
    id: "memory-synonym-cache",
    family: "SYNONYM",
    text: "perché abbiamo scartato Redis",
    expected: ["mem-cache-memory"],
    forbidden: [],
  },
  {
    id: "memory-superseded-total",
    family: "LITERAL",
    text: "totale calcolato sul client",
    expected: ["mem-server-total"],
    forbidden: ["mem-client-total"],
  },
  {
    id: "memory-invalidated-penalty",
    family: "LITERAL",
    text: "penale massima del capitolato",
    expected: ["mem-penalty-cap"],
    forbidden: ["mem-wrong-penalty"],
  },
  {
    id: "cross-store-total",
    family: "CASE_DIACRITICS",
    text: "Totale del Carrello",
    expected: ["cart-decision", "cart-fix", "mem-server-total"],
    forbidden: ["mem-client-total"],
  },
]);

function eventRecord(record: CorpusRecord): UnifiedRecord {
  return Object.freeze({
    id: record.id,
    origin: "EVENT",
    label: record.type,
    projectId: record.projectId,
    occurredAt: record.occurredAt,
    text: record.text,
    admissible: true,
  });
}

function memoryRecord(item: MemoryItem): UnifiedRecord {
  return Object.freeze({
    id: item.id,
    origin: "MEMORY",
    label: item.type,
    projectId: item.projectId,
    occurredAt: item.createdAt,
    text: item.content,
    admissible: item.validity === "ACTIVE",
  });
}

export const EVENT_RECORDS: readonly UnifiedRecord[] = Object.freeze(
  CORPUS.map(eventRecord),
);
export const MEMORY_RECORDS: readonly UnifiedRecord[] = Object.freeze(
  MEMORY_CORPUS.map(memoryRecord),
);
export const UNIFIED_CORPUS: readonly UnifiedRecord[] = Object.freeze([
  ...EVENT_RECORDS,
  ...MEMORY_RECORDS,
]);

type Posting = Readonly<{ id: string; frequency: number }>;

export type UnifiedIndex = Readonly<{
  records: readonly UnifiedRecord[];
  byId: ReadonlyMap<string, UnifiedRecord>;
  postings: ReadonlyMap<string, readonly Posting[]>;
  dictionary: readonly string[];
  lengths: ReadonlyMap<string, number>;
  averageLength: number;
}>;

/**
 * Inverted index over both stores. Same matching rules as the lexical
 * measurement, so the two engines stay comparable, with a term dictionary so
 * cost per query stops growing with the corpus.
 */
export function buildUnifiedIndex(
  records: readonly UnifiedRecord[],
): UnifiedIndex {
  if (records.length > MAX_RECORDS)
    throw new UnifiedRetrievalMeasurementError(
      `corpus exceeds the declared measurement bound of ${MAX_RECORDS} records`,
    );
  const postings = new Map<string, Posting[]>();
  const lengths = new Map<string, number>();
  const byId = new Map<string, UnifiedRecord>();
  let totalLength = 0;
  for (const record of records) {
    if (byId.has(record.id))
      throw new UnifiedRetrievalMeasurementError(
        "corpus contains a duplicate record identity",
      );
    byId.set(record.id, record);
    const terms = contentTerms(record.text).map(stem);
    lengths.set(record.id, terms.length);
    totalLength += terms.length;
    const frequencies = new Map<string, number>();
    for (const term of terms)
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    for (const [term, frequency] of frequencies) {
      const list = postings.get(term);
      if (list) list.push({ id: record.id, frequency });
      else postings.set(term, [{ id: record.id, frequency }]);
    }
  }
  return Object.freeze({
    records,
    byId,
    postings,
    dictionary: Object.freeze([...postings.keys()].sort()),
    lengths,
    averageLength: records.length === 0 ? 0 : totalLength / records.length,
  });
}

type TermExpansion = Readonly<{ term: string; reason: string }>;

function expandTerm(index: UnifiedIndex, rawTerm: string): TermExpansion[] {
  const stemmed = stem(rawTerm);
  const expansions: TermExpansion[] = [];
  for (const candidate of index.dictionary) {
    if (candidate === stemmed)
      expansions.push({ term: candidate, reason: "termine" });
    else if (candidate.startsWith(stemmed))
      expansions.push({ term: candidate, reason: "prefisso" });
    else if (isTypoOf(stemmed, candidate))
      expansions.push({ term: candidate, reason: "errore di battitura" });
  }
  return expansions;
}

/**
 * Ranked retrieval over the unified index. Inadmissible memory is filtered out
 * of the answer, and every result carries the terms that matched it.
 */
export function retrieveUnified(
  index: UnifiedIndex,
  queryText: string,
  limit = RESULT_LIMIT,
): readonly RetrievedRecord[] {
  const queryTerms = contentTerms(queryText);
  const scores = new Map<string, number>();
  const reasons = new Map<string, Set<string>>();
  const documentCount = index.records.length;
  for (const queryTerm of queryTerms)
    for (const expansion of expandTerm(index, queryTerm)) {
      const list = index.postings.get(expansion.term) ?? [];
      const inverseDocumentFrequency = Math.log(
        1 + (documentCount - list.length + 0.5) / (list.length + 0.5),
      );
      for (const posting of list) {
        const record = index.byId.get(posting.id);
        if (!record || !record.admissible) continue;
        const length = index.lengths.get(posting.id) ?? 0;
        const denominator =
          posting.frequency +
          BM25_K1 *
            (1 - BM25_B + (BM25_B * length) / (index.averageLength || 1));
        const contribution =
          inverseDocumentFrequency *
          ((posting.frequency * (BM25_K1 + 1)) / (denominator || 1));
        scores.set(posting.id, (scores.get(posting.id) ?? 0) + contribution);
        const reason = reasons.get(posting.id) ?? new Set<string>();
        reason.add(`${queryTerm} (${expansion.reason})`);
        reasons.set(posting.id, reason);
      }
    }
  return Object.freeze(
    [...scores.entries()]
      .sort(([leftId, leftScore], [rightId, rightScore]) => {
        if (rightScore !== leftScore) return rightScore - leftScore;
        const left = index.byId.get(leftId);
        const right = index.byId.get(rightId);
        const byTime = (right?.occurredAt ?? "").localeCompare(
          left?.occurredAt ?? "",
        );
        return byTime === 0 ? leftId.localeCompare(rightId) : byTime;
      })
      .slice(0, limit)
      .map(([id], position) => {
        const record = index.byId.get(id);
        return Object.freeze({
          id,
          origin: record?.origin ?? "EVENT",
          rank: position + 1,
          because: [...(reasons.get(id) ?? [])].sort().join(", "),
        });
      }),
  );
}

type Fts5Tokenizer = "unicode61" | "trigram";

export type Fts5Engine = Readonly<{
  retrieve(queryText: string, limit?: number): readonly RetrievedRecord[];
  close(): void;
}>;

/**
 * SQLite FTS5 over the same unified corpus. Node ships SQLite as an
 * experimental surface, which is a decision input rather than a measurement
 * detail, so the engine is measured exactly as the product would use it.
 */
export function buildFts5Engine(
  records: readonly UnifiedRecord[],
  tokenizer: Fts5Tokenizer,
): Fts5Engine {
  const database = new DatabaseSync(":memory:");
  const declaredTokenizer =
    tokenizer === "unicode61" ? "unicode61 remove_diacritics 2" : "trigram";
  database.exec(
    `create virtual table documents using fts5(
       record_id unindexed,
       origin unindexed,
       admissible unindexed,
       body,
       tokenize = "${declaredTokenizer}"
     )`,
  );
  const insert = database.prepare(
    "insert into documents(record_id, origin, admissible, body) values (?, ?, ?, ?)",
  );
  for (const record of records)
    insert.run(
      record.id,
      record.origin,
      record.admissible ? 1 : 0,
      record.text,
    );
  const select = database.prepare(
    `select record_id, origin, bm25(documents) as score
       from documents
      where documents match ? and admissible = 1
      order by score, record_id
      limit ?`,
  );
  return Object.freeze({
    retrieve(queryText: string, limit = RESULT_LIMIT) {
      const terms = contentTerms(queryText).filter((term) =>
        /^[a-z0-9]+$/u.test(term),
      );
      if (terms.length === 0) return Object.freeze([]);
      const expression = terms
        .map((term) => (tokenizer === "unicode61" ? `${term}*` : `"${term}"`))
        .join(" OR ");
      const rows = select.all(expression, limit);
      return Object.freeze(
        rows.map((row, position) => {
          const id = row["record_id"];
          if (typeof id !== "string")
            throw new UnifiedRetrievalMeasurementError(
              "FTS5 returned a row without a record identity",
            );
          return Object.freeze({
            id,
            origin: row["origin"] === "MEMORY" ? "MEMORY" : "EVENT",
            rank: position + 1,
            because: `FTS5 ${declaredTokenizer}: ${expression}`,
          } satisfies RetrievedRecord);
        }),
      );
    },
    close() {
      database.close();
    },
  });
}

type DenseVectors = ReadonlyMap<string, readonly number[]>;

async function embedTexts(
  texts: readonly string[],
): Promise<readonly (readonly number[])[]> {
  const vectors: (readonly number[])[] = [];
  for (let offset = 0; offset < texts.length; offset += DENSE_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + DENSE_BATCH_SIZE);
    const response = await fetch(DENSE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: DENSE_MODEL, input: batch }),
      signal: AbortSignal.timeout(DENSE_TIMEOUT_MILLISECONDS),
    });
    if (!response.ok)
      throw new UnifiedRetrievalMeasurementError(
        `embedding service answered with status ${response.status}`,
      );
    const body = (await response.json()) as Readonly<{
      embeddings?: readonly (readonly number[])[];
    }>;
    if (!body.embeddings || body.embeddings.length !== batch.length)
      throw new UnifiedRetrievalMeasurementError(
        "embedding service returned an unexpected number of vectors",
      );
    vectors.push(...body.embeddings);
  }
  return vectors;
}

function normalize(vector: readonly number[]): readonly number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

function similarity(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  for (let index = 0; index < left.length; index += 1)
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  return dot;
}

function retrieveDense(
  records: readonly UnifiedRecord[],
  vectors: DenseVectors,
  queryVector: readonly number[],
  limit = RESULT_LIMIT,
): readonly RetrievedRecord[] {
  const scored: { record: UnifiedRecord; score: number }[] = [];
  for (const record of records) {
    if (!record.admissible) continue;
    const vector = vectors.get(record.id);
    if (!vector) continue;
    scored.push({ record, score: similarity(vector, queryVector) });
  }
  scored.sort((left, right) =>
    right.score === left.score
      ? left.record.id.localeCompare(right.record.id)
      : right.score - left.score,
  );
  return Object.freeze(
    scored.slice(0, limit).map((entry, position) =>
      Object.freeze({
        id: entry.record.id,
        origin: entry.record.origin,
        rank: position + 1,
        because: `somiglianza ${DENSE_MODEL} ${entry.score.toFixed(3)}`,
      } satisfies RetrievedRecord),
    ),
  );
}

/**
 * Reciprocal rank fusion. Chosen over score mixing because it needs no scale
 * calibration between a BM25 score and a cosine similarity, and because the
 * contribution of each side stays explainable to the person reading results.
 */
function fuse(
  lexical: readonly RetrievedRecord[],
  dense: readonly RetrievedRecord[],
  limit = RESULT_LIMIT,
): readonly RetrievedRecord[] {
  const scores = new Map<string, number>();
  const reasons = new Map<string, string[]>();
  const origins = new Map<string, RecordOrigin>();
  for (const [source, results] of [
    ["lessicale", lexical],
    ["denso", dense],
  ] as const)
    for (const result of results) {
      scores.set(
        result.id,
        (scores.get(result.id) ?? 0) + 1 / (RRF_K + result.rank),
      );
      reasons.set(result.id, [
        ...(reasons.get(result.id) ?? []),
        `${source} al rango ${result.rank}`,
      ]);
      origins.set(result.id, result.origin);
    }
  return Object.freeze(
    [...scores.entries()]
      .sort(([leftId, leftScore], [rightId, rightScore]) =>
        rightScore === leftScore
          ? leftId.localeCompare(rightId)
          : rightScore - leftScore,
      )
      .slice(0, limit)
      .map(([id], position) =>
        Object.freeze({
          id,
          origin: origins.get(id) ?? "EVENT",
          rank: position + 1,
          because: (reasons.get(id) ?? []).join(" + "),
        } satisfies RetrievedRecord),
      ),
  );
}

type Retriever = (queryText: string) => readonly RetrievedRecord[];

function scoreEngine(
  retrieve: Retriever,
  queries: readonly UnifiedQuery[],
): Readonly<{
  quality: EngineQuality;
  perFamilyRecallPercent: Readonly<Record<ProbeFamily, number | null>>;
  gates: Omit<EngineGates, "availableWithoutRunningService">;
}> {
  let expectedTotal = 0;
  let foundTotal = 0;
  let precisionSum = 0;
  let fullyAnswered = 0;
  let empty = 0;
  let worstFirstRelevantRank: number | null = null;
  let memoryExpected = 0;
  let memoryFound = 0;
  let eventExpected = 0;
  let eventFound = 0;
  let noInadmissible = true;
  let originExposed = true;
  let reasonExposed = true;
  const familyExpected = new Map<ProbeFamily, number>();
  const familyFound = new Map<ProbeFamily, number>();
  const inadmissible = new Set(
    UNIFIED_CORPUS.filter((record) => !record.admissible).map(
      (record) => record.id,
    ),
  );
  for (const query of queries) {
    const first = retrieve(query.text);
    const second = retrieve(query.text);
    if (JSON.stringify(first) !== JSON.stringify(second))
      throw new UnifiedRetrievalMeasurementError(
        `engine answered ${query.id} differently across two identical runs`,
      );
    const returned = first.map((result) => result.id);
    for (const result of first) {
      if (inadmissible.has(result.id) || query.forbidden.includes(result.id))
        noInadmissible = false;
      if (!RECORD_ORIGINS.includes(result.origin)) originExposed = false;
      if (result.because.length === 0) reasonExposed = false;
    }
    const found = query.expected.filter((id) => returned.includes(id));
    expectedTotal += query.expected.length;
    foundTotal += found.length;
    familyExpected.set(
      query.family,
      (familyExpected.get(query.family) ?? 0) + query.expected.length,
    );
    familyFound.set(
      query.family,
      (familyFound.get(query.family) ?? 0) + found.length,
    );
    for (const id of query.expected) {
      const isMemory = id.startsWith("mem-");
      if (isMemory) memoryExpected += 1;
      else eventExpected += 1;
      if (returned.includes(id)) {
        if (isMemory) memoryFound += 1;
        else eventFound += 1;
      }
    }
    const top = returned.slice(0, query.expected.length);
    const relevantInTop = top.filter((id) =>
      query.expected.includes(id),
    ).length;
    precisionSum += top.length === 0 ? 0 : (relevantInTop / top.length) * 100;
    const firstRelevant = returned.findIndex((id) =>
      query.expected.includes(id),
    );
    if (firstRelevant >= 0)
      worstFirstRelevantRank = Math.max(
        worstFirstRelevantRank ?? 0,
        firstRelevant + 1,
      );
    if (found.length === query.expected.length) fullyAnswered += 1;
    if (returned.length === 0) empty += 1;
  }
  const percent = (found: number, expected: number): number =>
    expected === 0 ? 0 : Math.round((found / expected) * 10_000) / 100;
  const perFamily = Object.fromEntries(
    PROBE_FAMILIES.map((family) => {
      const expected = familyExpected.get(family) ?? 0;
      return [
        family,
        expected === 0 ? null : percent(familyFound.get(family) ?? 0, expected),
      ];
    }),
  ) as Record<ProbeFamily, number | null>;
  return Object.freeze({
    quality: Object.freeze({
      queries: queries.length,
      recallPercent: percent(foundTotal, expectedTotal),
      precisionAtExpectedCountPercent:
        Math.round((precisionSum / queries.length) * 100) / 100,
      worstFirstRelevantRank,
      fullyAnsweredQueries: fullyAnswered,
      emptyResultQueries: empty,
      memoryTargetRecallPercent: percent(memoryFound, memoryExpected),
      eventTargetRecallPercent: percent(eventFound, eventExpected),
    }),
    perFamilyRecallPercent: Object.freeze(perFamily),
    gates: Object.freeze({
      noInadmissibleResults: noInadmissible,
      originExposedOnEveryResult: originExposed,
      matchReasonExposedOnEveryResult: reasonExposed,
      deterministicAcrossRuns: true,
    }),
  });
}

function decide(
  quality: EngineQuality,
  gates: EngineGates,
  onCriticalPath: boolean,
): EngineMeasurement["decision"] {
  if (!gates.noInadmissibleResults) return "REJECT";
  if (quality.recallPercent < REFINE_TARGET_PERCENT) return "REJECT";
  if (quality.recallPercent < RECALL_TARGET_PERCENT) return "REFINE";
  if (!onCriticalPath) return "ADOPT_AS_SECONDARY";
  return gates.availableWithoutRunningService
    ? "ADOPT_AS_PRIMARY"
    : "ADOPT_AS_SECONDARY";
}

function fillerRecords(target: number): readonly UnifiedRecord[] {
  const records: UnifiedRecord[] = [...UNIFIED_CORPUS];
  /**
   * Filler repeats the real records and adds one distinct term each, the same
   * shape the lexical measurement uses. Filler made only of invented terms
   * would leave the posting lists of the queried words short and would flatter
   * the inverted index against the alternatives.
   */
  const templates = UNIFIED_CORPUS.filter((record) => record.admissible);
  while (records.length < target) {
    const index = records.length;
    const template = templates[index % templates.length];
    if (!template)
      throw new UnifiedRetrievalMeasurementError(
        "scale corpus needs at least one admissible template record",
      );
    const filler = `riempimento${String(index % SCALE_FILLER_TERMS).padStart(4, "0")}`;
    records.push(
      Object.freeze({
        ...template,
        id: `${template.id}-${String(index).padStart(6, "0")}`,
        text: `${template.text} ${filler}`,
      }),
    );
  }
  return Object.freeze(records);
}

function syntheticVectors(
  records: readonly UnifiedRecord[],
  dimensions: number,
): DenseVectors {
  const vectors = new Map<string, readonly number[]>();
  let seed = 11;
  for (const record of records) {
    const vector = new Array<number>(dimensions);
    for (let index = 0; index < dimensions; index += 1) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      vector[index] = seed / 2_147_483_648 - 0.5;
    }
    vectors.set(record.id, normalize(vector));
  }
  return vectors;
}

function percentile95(samples: readonly number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const position = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1,
  );
  return Math.round((sorted[Math.max(0, position)] ?? 0) * 1_000) / 1_000;
}

function measureRetrieverLatency(retrieve: Retriever): number {
  for (let run = 0; run < SCALE_WARM_RUNS; run += 1)
    for (const query of UNIFIED_QUERIES) retrieve(query.text);
  const samples: number[] = [];
  for (let run = 0; run < SCALE_MEASURED_RUNS; run += 1)
    for (const query of UNIFIED_QUERIES) {
      const started = performance.now();
      retrieve(query.text);
      samples.push(performance.now() - started);
    }
  return percentile95(samples);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Measures which engine can serve the declared experience: one search box over
 * both stores, tolerant of how a person writes, inside an interactive budget.
 */
export async function measureUnifiedRetrieval(
  profile: ScaleProfile = "REFERENCE",
  denseMode: DenseMode = "IF_AVAILABLE",
): Promise<UnifiedRetrievalReport> {
  const inadmissible = UNIFIED_CORPUS.filter((record) => !record.admissible);
  const eventsIndex = buildUnifiedIndex(EVENT_RECORDS);
  const unifiedIndex = buildUnifiedIndex(UNIFIED_CORPUS);
  const measurements: EngineMeasurement[] = [];

  const lexicalEngines = [
    {
      engine: "EVENTS_ONLY_INVERTED" as const,
      reads: Object.freeze(["EVENT"] as const),
      matching:
        "termini normalizzati, prefisso, radice, un errore di battitura entro budget",
      ordering: "BM25 con recenza a parità di punteggio",
      retrieve: (text: string) => retrieveUnified(eventsIndex, text),
    },
    {
      engine: "UNIFIED_INVERTED" as const,
      reads: Object.freeze(["EVENT", "MEMORY"] as const),
      matching:
        "termini normalizzati, prefisso, radice, un errore di battitura entro budget",
      ordering: "BM25 con recenza a parità di punteggio",
      retrieve: (text: string) => retrieveUnified(unifiedIndex, text),
    },
  ];
  for (const candidate of lexicalEngines) {
    const scored = scoreEngine(candidate.retrieve, UNIFIED_QUERIES);
    const gates: EngineGates = Object.freeze({
      ...scored.gates,
      availableWithoutRunningService: true,
    });
    measurements.push(
      Object.freeze({
        engine: candidate.engine,
        reads: candidate.reads,
        matching: candidate.matching,
        ordering: candidate.ordering,
        outcome: "MEASURED",
        quality: scored.quality,
        perFamilyRecallPercent: scored.perFamilyRecallPercent,
        gates,
        decision: decide(scored.quality, gates, true),
      }),
    );
  }

  for (const tokenizer of ["unicode61", "trigram"] as const) {
    const engine = buildFts5Engine(UNIFIED_CORPUS, tokenizer);
    try {
      const scored = scoreEngine(
        (text) => engine.retrieve(text),
        UNIFIED_QUERIES,
      );
      const gates: EngineGates = Object.freeze({
        ...scored.gates,
        availableWithoutRunningService: true,
      });
      measurements.push(
        Object.freeze({
          engine:
            tokenizer === "unicode61"
              ? "UNIFIED_FTS5_UNICODE61"
              : "UNIFIED_FTS5_TRIGRAM",
          reads: Object.freeze(["EVENT", "MEMORY"] as const),
          matching:
            tokenizer === "unicode61"
              ? "FTS5 unicode61 senza diacritici, espansione per prefisso"
              : "FTS5 trigram su sottostringhe",
          ordering: "BM25 di FTS5",
          outcome: "MEASURED",
          quality: scored.quality,
          perFamilyRecallPercent: scored.perFamilyRecallPercent,
          gates,
          decision: decide(scored.quality, gates, true),
        }),
      );
    } finally {
      engine.close();
    }
  }

  let dense: DenseAvailability = Object.freeze({
    requested: denseMode,
    outcome:
      denseMode === "SKIP"
        ? "SKIPPED_BY_PROFILE"
        : "UNAVAILABLE_DEGRADED_TO_LEXICAL",
    model: DENSE_MODEL,
    endpoint: DENSE_ENDPOINT,
    dimensions: null,
    firstCallMilliseconds: null,
    queryEmbeddingP95Milliseconds: null,
    queryEmbeddingWithinInteractiveBudget: null,
    buildRecordsPerSecond: null,
    qualityMeasuredOn: "REAL_RECORDS_ONLY",
    scaleVectors: "SYNTHETIC_DETERMINISTIC_FOR_LATENCY_ONLY",
  });
  let denseDimensions = 0;

  if (denseMode !== "SKIP")
    try {
      const firstCallStarted = performance.now();
      await embedTexts(["riscaldamento del modello"]);
      const firstCallMilliseconds =
        Math.round((performance.now() - firstCallStarted) * 1_000) / 1_000;
      const recordVectors = await embedTexts(
        UNIFIED_CORPUS.map((record) => record.text),
      );
      denseDimensions = recordVectors[0]?.length ?? 0;
      if (denseDimensions === 0)
        throw new UnifiedRetrievalMeasurementError(
          "embedding service returned empty vectors",
        );
      const vectors: DenseVectors = new Map(
        UNIFIED_CORPUS.map((record, index) => [
          record.id,
          normalize(recordVectors[index] ?? []),
        ]),
      );
      const queryVectors = new Map<string, readonly number[]>();
      const querySamples: number[] = [];
      for (const query of UNIFIED_QUERIES) {
        const started = performance.now();
        const [vector] = await embedTexts([query.text]);
        querySamples.push(performance.now() - started);
        queryVectors.set(query.id, normalize(vector ?? []));
      }
      for (let sample = 0; sample < DENSE_QUERY_SAMPLES; sample += 1) {
        const started = performance.now();
        await embedTexts([UNIFIED_QUERIES[0]?.text ?? "totale"]);
        querySamples.push(performance.now() - started);
      }
      const queryP95 = percentile95(querySamples);
      /**
       * The corpus is too small for its own build time to say anything about
       * indexing a real archive, where fixed per-call cost stops dominating, so
       * the rate comes from a larger batch measured after the warm-up.
       */
      const rateStarted = performance.now();
      await embedTexts(
        Array.from(
          { length: DENSE_RATE_SAMPLE_SIZE },
          (_, index) =>
            `record sintetico numero ${index} con un testo di lunghezza confrontabile a una conversazione`,
        ),
      );
      const rateMilliseconds = performance.now() - rateStarted;
      dense = Object.freeze({
        requested: denseMode,
        outcome: "MEASURED",
        model: DENSE_MODEL,
        endpoint: DENSE_ENDPOINT,
        dimensions: denseDimensions,
        firstCallMilliseconds,
        queryEmbeddingP95Milliseconds: queryP95,
        queryEmbeddingWithinInteractiveBudget:
          queryP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
        buildRecordsPerSecond:
          Math.round(
            (DENSE_RATE_SAMPLE_SIZE / (rateMilliseconds / 1_000)) * 100,
          ) / 100,
        qualityMeasuredOn: "REAL_RECORDS_ONLY",
        scaleVectors: "SYNTHETIC_DETERMINISTIC_FOR_LATENCY_ONLY",
      });
      const denseRetrieve: Retriever = (text) => {
        const query = UNIFIED_QUERIES.find((entry) => entry.text === text);
        const vector = query ? queryVectors.get(query.id) : undefined;
        if (!vector)
          throw new UnifiedRetrievalMeasurementError(
            "dense retrieval received an unembedded query",
          );
        return retrieveDense(UNIFIED_CORPUS, vectors, vector);
      };
      const hybridRetrieve: Retriever = (text) =>
        fuse(retrieveUnified(unifiedIndex, text), denseRetrieve(text));
      for (const candidate of [
        {
          engine: "UNIFIED_DENSE" as const,
          matching: `embedding ${DENSE_MODEL} su entrambi gli archivi`,
          ordering: "somiglianza del coseno",
          retrieve: denseRetrieve,
        },
        {
          engine: "UNIFIED_HYBRID" as const,
          matching: `indice invertito più embedding ${DENSE_MODEL}`,
          ordering: "fusione dei ranghi reciproci",
          retrieve: hybridRetrieve,
        },
      ]) {
        const scored = scoreEngine(candidate.retrieve, UNIFIED_QUERIES);
        const gates: EngineGates = Object.freeze({
          ...scored.gates,
          availableWithoutRunningService: false,
        });
        measurements.push(
          Object.freeze({
            engine: candidate.engine,
            reads: Object.freeze(["EVENT", "MEMORY"] as const),
            matching: candidate.matching,
            ordering: candidate.ordering,
            outcome: "MEASURED",
            quality: scored.quality,
            perFamilyRecallPercent: scored.perFamilyRecallPercent,
            gates,
            decision: decide(
              scored.quality,
              gates,
              queryP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
            ),
          }),
        );
      }
    } catch (error) {
      if (denseMode === "REQUIRE") throw error;
      for (const engine of DENSE_ENGINES)
        measurements.push(
          Object.freeze({
            engine,
            reads: Object.freeze(["EVENT", "MEMORY"] as const),
            matching: `embedding ${DENSE_MODEL} non raggiungibile`,
            ordering: "non misurato",
            outcome: "SKIPPED_SERVICE_UNAVAILABLE",
            quality: null,
            perFamilyRecallPercent: null,
            gates: null,
            decision: "UNDECIDED_SERVICE_UNAVAILABLE",
          }),
        );
    }

  const scale: UnifiedScaleMeasurement[] = [];
  for (const target of SCALE_PROFILES[profile]) {
    const records = fillerRecords(target);
    const steps: EngineScaleStep[] = [];
    const invertedStarted = performance.now();
    const index = buildUnifiedIndex(records);
    const invertedBuild = performance.now() - invertedStarted;
    const invertedP95 = measureRetrieverLatency((text) =>
      retrieveUnified(index, text),
    );
    steps.push(
      Object.freeze({
        engine: "UNIFIED_INVERTED",
        buildMilliseconds: Math.round(invertedBuild * 1_000) / 1_000,
        perQueryP95Milliseconds: invertedP95,
        withinInteractiveBudget: invertedP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
      }),
    );
    for (const tokenizer of ["unicode61", "trigram"] as const) {
      const started = performance.now();
      const engine = buildFts5Engine(records, tokenizer);
      const build = performance.now() - started;
      try {
        const p95 = measureRetrieverLatency((text) => engine.retrieve(text));
        steps.push(
          Object.freeze({
            engine:
              tokenizer === "unicode61"
                ? "UNIFIED_FTS5_UNICODE61"
                : "UNIFIED_FTS5_TRIGRAM",
            buildMilliseconds: Math.round(build * 1_000) / 1_000,
            perQueryP95Milliseconds: p95,
            withinInteractiveBudget: p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
          }),
        );
      } finally {
        engine.close();
      }
    }
    if (dense.outcome === "MEASURED" && denseDimensions > 0) {
      const started = performance.now();
      const vectors = syntheticVectors(records, denseDimensions);
      const build = performance.now() - started;
      const probe = normalize(
        Array.from({ length: denseDimensions }, (_, index) =>
          Math.cos(index + 1),
        ),
      );
      const scanP95 = measureRetrieverLatency(() =>
        retrieveDense(records, vectors, probe),
      );
      const embeddingCost = dense.queryEmbeddingP95Milliseconds ?? 0;
      const total = Math.round((scanP95 + embeddingCost) * 1_000) / 1_000;
      steps.push(
        Object.freeze({
          engine: "UNIFIED_DENSE",
          buildMilliseconds: Math.round(build * 1_000) / 1_000,
          perQueryP95Milliseconds: total,
          withinInteractiveBudget: total <= INTERACTIVE_BUDGET_MILLISECONDS,
        }),
      );
    }
    scale.push(
      Object.freeze({
        records: target,
        distinctTerms: index.dictionary.length,
        queryTermsMeasured: UNIFIED_QUERIES.reduce(
          (total, query) => total + contentTerms(query.text).length,
          0,
        ),
        engines: Object.freeze(steps),
      }),
    );
  }

  const memorySourcePairs = MEMORY_CORPUS.flatMap((item) =>
    item.sources.map((source) => ({
      memoryId: item.id,
      eventId: source.eventId,
    })),
  );
  const redundantExamples: string[] = [];
  for (const query of UNIFIED_QUERIES) {
    const returned = retrieveUnified(unifiedIndex, query.text).map(
      (result) => result.id,
    );
    for (const pair of memorySourcePairs)
      if (returned.includes(pair.memoryId) && returned.includes(pair.eventId))
        redundantExamples.push(
          `${query.id}: ${pair.memoryId} con ${pair.eventId}`,
        );
  }

  const eventsOnly = measurements.find(
    (entry) => entry.engine === "EVENTS_ONLY_INVERTED",
  );
  const unified = measurements.find(
    (entry) => entry.engine === "UNIFIED_INVERTED",
  );
  const memoryEventsOnly = eventsOnly?.quality?.memoryTargetRecallPercent ?? 0;
  const memoryUnified = unified?.quality?.memoryTargetRecallPercent ?? 0;
  const denseUsable =
    dense.outcome === "MEASURED" &&
    dense.queryEmbeddingWithinInteractiveBudget === true;
  const hybrid = measurements.find(
    (entry) => entry.engine === "UNIFIED_HYBRID",
  );

  return Object.freeze({
    schemaVersion: 1,
    corpusId: UNIFIED_RETRIEVAL_CORPUS_ID,
    scaleProfile: profile,
    counts: Object.freeze({
      eventRecords: EVENT_RECORDS.length,
      memoryRecords: MEMORY_RECORDS.length,
      admissibleRecords: UNIFIED_CORPUS.length - inadmissible.length,
      inadmissibleRecords: inadmissible.length,
      queries: UNIFIED_QUERIES.length,
      groundTruthPairs: UNIFIED_QUERIES.reduce(
        (total, query) => total + query.expected.length,
        0,
      ),
      forbiddenPairs: UNIFIED_QUERIES.reduce(
        (total, query) => total + query.forbidden.length,
        0,
      ),
    }),
    corpusSha256: digest(UNIFIED_CORPUS),
    groundTruthSha256: digest(UNIFIED_QUERIES),
    dense,
    engines: Object.freeze(measurements),
    storeGap: Object.freeze({
      memoryTargetsReachableByCurrentStores: memoryEventsOnly > 0,
      memoryRecallEventsOnlyPercent: memoryEventsOnly,
      memoryRecallUnifiedPercent: memoryUnified,
      conclusion:
        memoryUnified > memoryEventsOnly
          ? "UNIFICATION_REQUIRED_FOR_DECLARED_EXPERIENCE"
          : "EVENTS_ALONE_SUFFICIENT",
    }),
    redundancy: Object.freeze({
      memorySourcePairs: memorySourcePairs.length,
      pairsReturnedTogether: redundantExamples.length,
      examples: Object.freeze([...redundantExamples].sort()),
      conclusion:
        redundantExamples.length > 0
          ? "DEDUPLICATION_BY_PROVENANCE_REQUIRED"
          : "NO_REDUNDANCY_OBSERVED",
    }),
    scale: Object.freeze(scale),
    recommendation: Object.freeze({
      primaryEngine: "UNIFIED_INVERTED",
      secondaryEngine: hybrid?.outcome === "MEASURED" ? "UNIFIED_HYBRID" : null,
      denseOnCriticalPath: denseUsable,
      reason: denseUsable
        ? "il costo di trasformare la domanda in vettore rientra nel budget interattivo"
        : "trasformare la domanda in vettore costa più dell'intero budget interattivo, quindi il denso può solo aggiungersi su richiesta",
    }),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER",
  });
}

/** Drops elapsed figures so two runs can be compared for equality. */
export function withoutElapsed(report: UnifiedRetrievalReport): unknown {
  return {
    ...report,
    dense: {
      ...report.dense,
      queryEmbeddingP95Milliseconds: null,
      queryEmbeddingWithinInteractiveBudget: null,
      buildRecordsPerSecond: null,
    },
    scale: report.scale.map((step) => ({
      records: step.records,
      engines: step.engines.map((engine) => ({
        engine: engine.engine,
        withinInteractiveBudget: engine.withinInteractiveBudget,
      })),
    })),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await measureUnifiedRetrieval(
    "REFERENCE",
    (process.env["DENSE_MODE"] as DenseMode | undefined) ?? "IF_AVAILABLE",
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

/** Kept exported so the lexical corpus stays the single declared source. */
export { CORPUS, QUERIES };
