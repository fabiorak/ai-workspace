/**
 * Measures retrieval over the real TypeScript source of this repository, to
 * answer one question with evidence instead of opinion: does the tolerant
 * lexical engine designed for prose also work on code, and does the search-mode
 * flag proposed for the GUI earn its place?
 *
 * The measurement is deliberately unkind to the prose engine. It runs the same
 * predeclared code questions through two tokenizations of the same records —
 * the prose one (diacritic folding, stemming, stopwords, typo tolerance) and a
 * code one (identifier splitting, significant punctuation, no stemming) — and
 * then runs the prose questions of the document measurement through both, so
 * the cost of leaving the flag in the wrong position is measured in both
 * directions rather than assumed.
 *
 * Development-only. No production consumer reads this file.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

import {
  DOCUMENT_QUERIES,
  ITALIAN_QUERIES,
  buildRecords,
  collectDocuments,
  dot,
  embed,
  percentile,
} from "./document-retrieval-measurement.ts";
import {
  contentTerms,
  isTypoOf,
  normalizeTokens,
  stem,
} from "./tolerant-search-measurement.ts";

export class CodeRetrievalMeasurementError extends Error {}

export const CODE_CORPUS_ID = "CODE_RETRIEVAL_REAL_REPOSITORY_V1";
export const SCHEMA_VERSION = 1;

/** Same interactive budget as the prose measurement, for comparability. */
const INTERACTIVE_BUDGET_MILLISECONDS = 150;

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CORPUS_ROOTS = Object.freeze([
  "apps",
  "integrations",
  "packages",
  "services",
  "scripts",
]);

/**
 * `dist` is excluded on purpose: the generated `.d.ts` files repeat every
 * exported name, and indexing them would inflate recall with copies of the
 * source rather than with source.
 */
const EXCLUDED_PATHS = Object.freeze([
  ".ai-workspace",
  "node_modules",
  ".git",
  "dist",
  "coverage",
]);

export const SEARCH_MODES = Object.freeze(["PROSE", "CODE"] as const);
export type SearchMode = (typeof SEARCH_MODES)[number];

export const CODE_UNITS = Object.freeze(["FILE", "SYMBOL"] as const);
export type CodeUnit = (typeof CODE_UNITS)[number];

export const CODE_ENGINES = Object.freeze([
  "PROSE_MODE_SYMBOL",
  "CODE_MODE_SYMBOL",
  "CODE_MODE_SYMBOL_TYPO_TOLERANT",
  "CODE_MODE_SYMBOL_EXACT_WEIGHTED",
  "CODE_MODE_SYMBOL_NAME_WEIGHTED",
  "CODE_MODE_FILE",
  "DENSE_SYMBOL",
  "HYBRID_SYMBOL",
] as const);
export type CodeEngineName = (typeof CODE_ENGINES)[number];

export const DENSE_MODEL = "bge-m3";
export const DENSE_ENDPOINT = "http://localhost:11434/api/embed";
export const DENSE_MODES = Object.freeze([
  "SKIP",
  "IF_AVAILABLE",
  "REQUIRE",
] as const);
export type DenseMode = (typeof DENSE_MODES)[number];

const DENSE_CHARACTER_LIMIT = 4_000;
/** Above this the embedding build stops being a measurement and starts being a wait. */
const DENSE_RECORD_CEILING = 6_000;

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const RRF_K = 60;
const RESULT_LIMIT = 10;

export const CODE_FAMILIES = Object.freeze([
  "IDENTIFIER_EXACT",
  "IDENTIFIER_WORDS",
  "FILE_NAME",
  "TYPE_NAME",
  "STRING_LITERAL",
  "TYPO",
  "DEFINITION_SITE",
  "CALL_SITE",
] as const);
export type CodeFamily = (typeof CODE_FAMILIES)[number];

export type CodeRecord = Readonly<{
  id: string;
  path: string;
  /** `null` for the module preamble, which owns imports but declares nothing. */
  symbol: string | null;
  unit: CodeUnit;
  body: string;
  startLine: number;
}>;

export type CodeQuery = Readonly<{
  id: string;
  text: string;
  family: CodeFamily;
  /** Every file a developer asking this would want to land in. */
  expected: readonly string[];
  /** Symbol a symbol-level answer should land on, when the question has one. */
  expectedSymbol: string | null;
}>;

/**
 * Predeclared questions, chosen by reading the source and verified by the test
 * that accompanies this script. They are the questions a developer actually
 * types: a name they half remember, words from a name, a message they saw at
 * runtime, a file they know by its kebab-case name, and the two graph questions
 * — where is this defined, who calls it — that no ranking function answers.
 */
export const CODE_QUERIES: readonly CodeQuery[] = Object.freeze([
  Object.freeze({
    id: "code-exact-inspect-with-policy",
    text: "inspectPseudonymizedOutputWithPolicy",
    family: "IDENTIFIER_EXACT",
    expected: Object.freeze([
      "packages/privacy-gateway/src/output-restoration.ts",
    ]),
    expectedSymbol: "inspectPseudonymizedOutputWithPolicy",
  }),
  Object.freeze({
    id: "code-words-inspect-with-policy",
    text: "inspect pseudonymized output with policy",
    family: "IDENTIFIER_WORDS",
    expected: Object.freeze([
      "packages/privacy-gateway/src/output-restoration.ts",
    ]),
    expectedSymbol: "inspectPseudonymizedOutputWithPolicy",
  }),
  Object.freeze({
    id: "code-words-gui-locale",
    text: "resolve gui locale",
    family: "IDENTIFIER_WORDS",
    expected: Object.freeze(["apps/web/src/localization.ts"]),
    expectedSymbol: "resolveGuiLocale",
  }),
  Object.freeze({
    id: "code-words-donut",
    text: "donut svg",
    family: "IDENTIFIER_WORDS",
    expected: Object.freeze(["apps/web/src/charts.ts"]),
    expectedSymbol: "donutSvg",
  }),
  Object.freeze({
    id: "code-words-arc-path",
    text: "arc path",
    family: "IDENTIFIER_WORDS",
    expected: Object.freeze(["apps/web/src/charts.ts"]),
    expectedSymbol: "arcPath",
  }),
  Object.freeze({
    id: "code-words-append-memory-operation",
    text: "append memory operation",
    family: "IDENTIFIER_WORDS",
    expected: Object.freeze([
      "integrations/local-active-memory/src/memory-log.ts",
    ]),
    expectedSymbol: "appendMemoryOperation",
  }),
  Object.freeze({
    id: "code-exact-validate-mapping-v2",
    text: "validatePseudonymMappingV2",
    family: "IDENTIFIER_EXACT",
    expected: Object.freeze([
      "packages/privacy-gateway/src/pseudonymization-v2.ts",
    ]),
    expectedSymbol: "validatePseudonymMappingV2",
  }),
  Object.freeze({
    id: "code-type-mapping-entry-v2",
    text: "PseudonymMappingEntryV2",
    family: "TYPE_NAME",
    expected: Object.freeze([
      "packages/privacy-gateway/src/pseudonymization-v2.ts",
    ]),
    expectedSymbol: "PseudonymMappingEntryV2",
  }),
  Object.freeze({
    id: "code-type-restoration-decision",
    text: "output restoration decision type",
    family: "TYPE_NAME",
    expected: Object.freeze([
      "packages/privacy-gateway/src/output-restoration.ts",
    ]),
    expectedSymbol: "OutputRestorationDecision",
  }),
  Object.freeze({
    id: "code-file-name-restricted-data-screen",
    text: "restricted data screen",
    family: "FILE_NAME",
    expected: Object.freeze([
      "integrations/local-session-ingestion/src/restricted-data-screen.ts",
    ]),
    expectedSymbol: null,
  }),
  Object.freeze({
    id: "code-literal-verified-once",
    text: "an item cannot be verified more than once",
    family: "STRING_LITERAL",
    expected: Object.freeze([
      "integrations/local-active-memory/src/memory-log.ts",
    ]),
    expectedSymbol: null,
  }),
  Object.freeze({
    id: "code-literal-revision-count",
    text: "revision must equal the operation count",
    family: "STRING_LITERAL",
    expected: Object.freeze([
      "integrations/local-active-memory/src/memory-log.ts",
    ]),
    expectedSymbol: null,
  }),
  /** An Italian string inside English code: the GUI messages are localized. */
  Object.freeze({
    id: "code-literal-italian-message",
    text: "modifiche non committate presenti",
    family: "STRING_LITERAL",
    expected: Object.freeze(["apps/web/src/localization.ts"]),
    expectedSymbol: null,
  }),
  Object.freeze({
    id: "code-typo-classify-restricted",
    text: "clasifyRestrictedData",
    family: "TYPO",
    expected: Object.freeze([
      "integrations/local-session-ingestion/src/restricted-data-screen.ts",
    ]),
    expectedSymbol: "classifyRestrictedData",
  }),
  Object.freeze({
    id: "code-typo-detect-restricted-words",
    text: "detct restricted data",
    family: "TYPO",
    expected: Object.freeze(["packages/privacy-gateway/src/index.ts"]),
    expectedSymbol: "detectRestrictedData",
  }),
  Object.freeze({
    id: "code-definition-canonical-json",
    text: "dove è definita canonicalJson",
    family: "DEFINITION_SITE",
    expected: Object.freeze(["packages/privacy-audit/src/index.ts"]),
    expectedSymbol: "canonicalJson",
  }),
  /**
   * The call-site questions are measured knowing BM25 cannot separate a
   * definition from a use: both mention the name. They are here to size that
   * gap, not to be passed.
   */
  Object.freeze({
    id: "code-call-site-classify-restricted",
    text: "chi chiama classifyRestrictedData",
    family: "CALL_SITE",
    expected: Object.freeze([
      "integrations/local-session-ingestion/src/index.ts",
      "integrations/local-session-ingestion/test/local-session-ingestion.test.ts",
    ]),
    expectedSymbol: null,
  }),
  Object.freeze({
    id: "code-call-site-canonical-json",
    text: "chi usa canonicalJson",
    family: "CALL_SITE",
    expected: Object.freeze([
      "packages/privacy-audit/test/privacy-audit.test.ts",
      "scripts/privacy-audit-measurement.ts",
    ]),
    expectedSymbol: null,
  }),
]);

/**
 * Punctuation-only queries. These are not scored for recall — the answer is
 * spread across a hundred files — but for whether the mode answers at all. The
 * prose tokenizer deletes every one of these, so `a ?? b` and `a || b` become
 * the same text.
 */
export const PUNCTUATION_PROBES = Object.freeze([
  "??",
  "===",
  "!==",
  "=>",
  "?.",
  "...",
]);

/**
 * Pairs of names that differ by little and mean different things. Typo
 * tolerance with a two-edit budget treats them as the same word once the whole
 * identifier is one token, which is what the prose tokenizer does.
 */
export const CONFUSABLE_IDENTIFIERS = Object.freeze([
  Object.freeze(["encodeMemoryLog", "decodeMemoryLog"]),
  Object.freeze(["validatePseudonymMapping", "validatePseudonymMappingV2"]),
  Object.freeze([
    "inspectPseudonymizedOutput",
    "inspectPseudonymizedOutputWithPolicy",
  ]),
]);

function isExcluded(path: string): boolean {
  return EXCLUDED_PATHS.some(
    (excluded) =>
      path.includes(`/${excluded}/`) || path.endsWith(`/${excluded}`),
  );
}

function walk(absolute: string): readonly string[] {
  if (isExcluded(absolute)) return Object.freeze([]);
  const stats = statSync(absolute);
  if (stats.isFile())
    return absolute.endsWith(".ts") && !absolute.endsWith(".d.ts")
      ? Object.freeze([absolute])
      : Object.freeze([]);
  if (!stats.isDirectory()) return Object.freeze([]);
  return Object.freeze(
    readdirSync(absolute)
      .sort()
      .flatMap((entry) => walk(join(absolute, entry))),
  );
}

/** Reads the corpus in a deterministic order so two runs agree. */
export function collectSourceFiles(): readonly Readonly<{
  path: string;
  text: string;
}>[] {
  return Object.freeze(
    CORPUS_ROOTS.flatMap((root) => walk(join(REPOSITORY_ROOT, root)))
      .map((absolute) =>
        Object.freeze({
          path: relative(REPOSITORY_ROOT, absolute),
          text: readFileSync(absolute, "utf8"),
        }),
      )
      .sort((left, right) => left.path.localeCompare(right.path)),
  );
}

const DECLARATION =
  /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|class|type|interface|enum|const|let|var)\s+([A-Za-z0-9_$]+)/u;

function countBackticks(line: string): number {
  let count = 0;
  for (let position = 0; position < line.length; position += 1)
    if (line[position] === "`" && line[position - 1] !== "\\") count += 1;
  return count;
}

/**
 * Splits a module into top-level declarations. A declaration owns the JSDoc
 * written above it, because that comment is where the words a developer would
 * search for usually live. Lines inside a multi-line template literal are not
 * read as declarations: `apps/web` writes HTML at column zero.
 */
export function splitIntoSymbols(text: string): readonly Readonly<{
  symbol: string | null;
  body: string;
  startLine: number;
}>[] {
  const lines = text.split("\n");
  const sections: {
    symbol: string | null;
    lines: string[];
    startLine: number;
  }[] = [{ symbol: null, lines: [], startLine: 1 }];
  let inTemplate = false;
  let comment: string[] = [];
  lines.forEach((line, position) => {
    const wasInTemplate = inTemplate;
    if (countBackticks(line) % 2 === 1) inTemplate = !inTemplate;
    const declaration = wasInTemplate ? null : DECLARATION.exec(line);
    const current = sections[sections.length - 1];
    if (declaration === null) {
      const trimmed = line.trimStart();
      const isComment =
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("//");
      if (!wasInTemplate && isComment) comment.push(line);
      else {
        current?.lines.push(...comment, line);
        comment = [];
      }
      return;
    }
    sections.push({
      symbol: declaration[1] ?? null,
      lines: [...comment, line],
      startLine: position + 1 - comment.length,
    });
    comment = [];
  });
  const last = sections[sections.length - 1];
  last?.lines.push(...comment);
  return Object.freeze(
    sections
      .filter((section) => section.lines.join("").trim().length > 0)
      .map((section) =>
        Object.freeze({
          symbol: section.symbol,
          body: section.lines.join("\n"),
          startLine: section.startLine,
        }),
      ),
  );
}

export function buildCodeRecords(
  files: readonly Readonly<{ path: string; text: string }>[],
  unit: CodeUnit,
): readonly CodeRecord[] {
  const records: CodeRecord[] = [];
  for (const file of files) {
    if (unit === "FILE") {
      records.push(
        Object.freeze({
          id: file.path,
          path: file.path,
          symbol: null,
          unit,
          body: file.text,
          startLine: 1,
        }),
      );
      continue;
    }
    let index = 0;
    for (const section of splitIntoSymbols(file.text)) {
      records.push(
        Object.freeze({
          id: `${file.path}#${String(index)}`,
          path: file.path,
          symbol: section.symbol,
          unit,
          body: section.body,
          startLine: section.startLine,
        }),
      );
      index += 1;
    }
  }
  return Object.freeze(records);
}

/**
 * Weight for the whole identifier against its own parts, and for the declared
 * name against the body it heads. Both are 3, the value the document
 * measurement found for headings, so the two measurements stay comparable.
 */
const WEIGHT = 3;

/**
 * Repeats the declared name at the head of the record, the same lever that
 * bought precision on document headings. A symbol is found by its name far more
 * often than by a word buried in its body.
 */
export function weightSymbolNames(
  records: readonly CodeRecord[],
): readonly CodeRecord[] {
  return Object.freeze(
    records.map((record) =>
      record.symbol === null
        ? record
        : Object.freeze({
            ...record,
            body: `${`${record.symbol}\n`.repeat(WEIGHT)}${record.body}`,
          }),
    ),
  );
}

/** Turns the Markdown corpus into code records, so both modes see the same shape. */
export function buildProseRecords(): readonly CodeRecord[] {
  return Object.freeze(
    buildRecords(collectDocuments(), "SECTION").map((record) =>
      Object.freeze({
        id: record.id,
        path: record.documentPath,
        symbol: record.headingPath,
        unit: "SYMBOL" as CodeUnit,
        body: `${record.headingPath}\n${record.body}`,
        startLine: 1,
      }),
    ),
  );
}

const PUNCTUATION_TOKENS = Object.freeze([
  "===",
  "!==",
  "??=",
  "...",
  "=>",
  "??",
  "?.",
  "&&",
  "||",
  "==",
  "!=",
  ">=",
  "<=",
]);

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/gu;

/**
 * Splits an identifier the way its author wrote it: camelCase boundaries,
 * acronym runs, underscores, and digits. `resolveGuiLocale` yields `resolve`,
 * `gui`, `locale`; `validatePseudonymMappingV2` keeps `v2` as its own word so a
 * version suffix can be searched for.
 */
export function splitIdentifier(identifier: string): readonly string[] {
  const parts = identifier
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/([A-Za-z])([0-9])/gu, "$1 $2")
    .split(/[\s_$]+/u)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 0);
  return Object.freeze(parts);
}

/**
 * Code tokenization. No stemming, because `mapping` and `mapped` are different
 * names, and no diacritic folding beyond lowercasing, because an identifier
 * has no accents. Whole identifiers are kept alongside their parts so an exact
 * name still outranks the files that merely share a word with it.
 */
export function codeTokens(
  text: string,
  splitting = true,
  wholeIdentifierWeight = 1,
): readonly string[] {
  const tokens: string[] = [];
  for (const punctuation of PUNCTUATION_TOKENS) {
    let from = 0;
    for (;;) {
      const found = text.indexOf(punctuation, from);
      if (found < 0) break;
      tokens.push(punctuation);
      from = found + punctuation.length;
    }
  }
  for (const match of text.matchAll(IDENTIFIER)) {
    const identifier = match[0];
    const lowered = identifier.toLowerCase();
    for (let repeat = 0; repeat < wholeIdentifierWeight; repeat += 1)
      tokens.push(lowered);
    if (!splitting) continue;
    const parts = splitIdentifier(identifier);
    if (parts.length > 1 || parts[0] !== lowered) tokens.push(...parts);
  }
  return Object.freeze(tokens);
}

function tokensFor(
  mode: SearchMode,
  text: string,
  splitting: boolean,
  wholeIdentifierWeight: number,
): readonly string[] {
  return mode === "CODE"
    ? codeTokens(text, splitting, wholeIdentifierWeight)
    : normalizeTokens(text).map(stem);
}

/**
 * The query is never weighted, only the index. Repeating a term in the query
 * would scale every candidate equally and change nothing.
 */
function queryTokensFor(
  mode: SearchMode,
  text: string,
  splitting: boolean,
): readonly string[] {
  return mode === "CODE"
    ? codeTokens(text, splitting)
    : contentTerms(text).map(stem);
}

type Posting = Readonly<{ record: number; frequency: number }>;

export type CodeIndex = Readonly<{
  mode: SearchMode;
  /** Whether `getUserById` also indexes `get`, `user`, `by`, `id`. */
  splitting: boolean;
  /** How many times the whole identifier counts against each of its parts. */
  wholeIdentifierWeight: number;
  records: readonly CodeRecord[];
  postings: ReadonlyMap<string, readonly Posting[]>;
  lengths: readonly number[];
  averageLength: number;
  terms: readonly string[];
}>;

export function buildCodeIndex(
  records: readonly CodeRecord[],
  mode: SearchMode,
  splitting = true,
  wholeIdentifierWeight = 1,
): CodeIndex {
  const postings = new Map<string, Posting[]>();
  const lengths: number[] = [];
  records.forEach((record, position) => {
    const tokens = tokensFor(
      mode,
      record.body,
      splitting,
      wholeIdentifierWeight,
    );
    lengths.push(tokens.length);
    const frequencies = new Map<string, number>();
    for (const token of tokens)
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    for (const [term, frequency] of frequencies) {
      const list = postings.get(term);
      if (list === undefined)
        postings.set(term, [{ record: position, frequency }]);
      else list.push({ record: position, frequency });
    }
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return Object.freeze({
    mode,
    splitting,
    wholeIdentifierWeight,
    records,
    postings,
    lengths: Object.freeze(lengths),
    averageLength: lengths.length === 0 ? 0 : total / lengths.length,
    terms: Object.freeze([...postings.keys()]),
  });
}

export type CodeResult = Readonly<{
  id: string;
  path: string;
  symbol: string | null;
  startLine: number;
  score: number;
  because: string;
}>;

function expandCodeTerm(
  index: CodeIndex,
  term: string,
  typoTolerance: boolean,
): readonly string[] {
  if (index.postings.has(term)) return Object.freeze([term]);
  if (!typoTolerance || term.length < 4) return Object.freeze([]);
  return Object.freeze(
    index.terms.filter((candidate) => isTypoOf(term, candidate)),
  );
}

export function searchCode(
  index: CodeIndex,
  query: string,
  limit = RESULT_LIMIT,
  typoTolerance = index.mode === "PROSE",
): readonly CodeResult[] {
  const queryTerms = queryTokensFor(index.mode, query, index.splitting);
  const scores = new Map<number, number>();
  const reasons = new Map<number, Set<string>>();
  for (const term of queryTerms) {
    for (const matched of expandCodeTerm(index, term, typoTolerance)) {
      const list = index.postings.get(matched) ?? [];
      const inverseFrequency = Math.log(
        1 + (index.records.length - list.length + 0.5) / (list.length + 0.5),
      );
      for (const posting of list) {
        const length = index.lengths[posting.record] ?? 0;
        const denominator =
          posting.frequency +
          BM25_K1 *
            (1 - BM25_B + BM25_B * (length / (index.averageLength || 1)));
        const contribution =
          (inverseFrequency * (posting.frequency * (BM25_K1 + 1))) /
          (denominator || 1);
        scores.set(
          posting.record,
          (scores.get(posting.record) ?? 0) + contribution,
        );
        const reason = reasons.get(posting.record) ?? new Set<string>();
        reason.add(matched === term ? term : `${term}~${matched}`);
        reasons.set(posting.record, reason);
      }
    }
  }
  return Object.freeze(
    [...scores.entries()]
      .map(([position, score]) => {
        const record = index.records[position];
        if (record === undefined)
          throw new CodeRetrievalMeasurementError(
            "the index referenced a record that does not exist",
          );
        return Object.freeze({
          id: record.id,
          path: record.path,
          symbol: record.symbol,
          startLine: record.startLine,
          score: Math.round(score * 1_000) / 1_000,
          because: `corrisponde ${[...(reasons.get(position) ?? [])].sort().join(", ")}`,
        });
      })
      .sort((left, right) =>
        right.score === left.score
          ? left.id.localeCompare(right.id)
          : right.score - left.score,
      )
      .slice(0, limit),
  );
}

function fuseByReciprocalRank(
  lexical: readonly CodeResult[],
  dense: readonly CodeResult[],
  limit: number,
): readonly CodeResult[] {
  const fused = new Map<string, { result: CodeResult; score: number }>();
  const add = (results: readonly CodeResult[], label: string): void => {
    results.forEach((result, position) => {
      const contribution = 1 / (RRF_K + position + 1);
      const existing = fused.get(result.id);
      if (existing === undefined)
        fused.set(result.id, {
          result: Object.freeze({
            ...result,
            because: `${label}: ${result.because}`,
          }),
          score: contribution,
        });
      else existing.score += contribution;
    });
  };
  add(lexical, "lessicale");
  add(dense, "denso");
  return Object.freeze(
    [...fused.values()]
      .sort((left, right) =>
        right.score === left.score
          ? left.result.id.localeCompare(right.result.id)
          : right.score - left.score,
      )
      .slice(0, limit)
      .map((entry) =>
        Object.freeze({
          ...entry.result,
          score: Math.round(entry.score * 10_000) / 10_000,
        }),
      ),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

type CodeRetriever = (query: string) => readonly CodeResult[];

export type CodeQuality = Readonly<{
  fileRecallPercent: number;
  symbolLocalizationPercent: number | null;
  precisionAtExpectedCountPercent: number;
  emptyResultQueries: number;
  worstFirstRelevantRank: number | null;
  perFamilyRecallPercent: Readonly<Record<CodeFamily, number | null>>;
}>;

/**
 * File recall asks whether the ranked list reaches the file. Symbol
 * localization asks the harder and more useful question: is the top result the
 * declaration the developer meant, rather than some other part of the right
 * file.
 */
function scoreCodeEngine(
  retrieve: CodeRetriever,
  queries: readonly CodeQuery[] = CODE_QUERIES,
): CodeQuality {
  let reached = 0;
  let empty = 0;
  let precisionTotal = 0;
  let worstRank: number | null = null;
  let localizationAsked = 0;
  let localizationHit = 0;
  const perFamily = new Map<CodeFamily, { hit: number; asked: number }>();
  for (const query of queries) {
    const results = retrieve(query.text);
    if (results.length === 0) empty += 1;
    const paths = results.map((result) => result.path);
    const firstRelevant = paths.findIndex((path) =>
      query.expected.includes(path),
    );
    const hit = firstRelevant >= 0;
    if (hit) {
      reached += 1;
      const rank = firstRelevant + 1;
      worstRank = worstRank === null ? rank : Math.max(worstRank, rank);
    }
    const cut = paths.slice(0, query.expected.length);
    precisionTotal +=
      cut.filter((path) => query.expected.includes(path)).length /
      Math.max(1, query.expected.length);
    if (query.expectedSymbol !== null) {
      localizationAsked += 1;
      const top = results.find((result) =>
        query.expected.includes(result.path),
      );
      if (top?.symbol === query.expectedSymbol) localizationHit += 1;
    }
    const family = perFamily.get(query.family) ?? { hit: 0, asked: 0 };
    perFamily.set(query.family, {
      hit: family.hit + (hit ? 1 : 0),
      asked: family.asked + 1,
    });
  }
  const families = Object.fromEntries(
    CODE_FAMILIES.map((family) => {
      const counted = perFamily.get(family);
      return [
        family,
        counted === undefined || counted.asked === 0
          ? null
          : round((counted.hit / counted.asked) * 100),
      ];
    }),
  ) as Record<CodeFamily, number | null>;
  return Object.freeze({
    fileRecallPercent: round((reached / Math.max(1, queries.length)) * 100),
    symbolLocalizationPercent:
      localizationAsked === 0
        ? null
        : round((localizationHit / localizationAsked) * 100),
    precisionAtExpectedCountPercent: round(
      (precisionTotal / Math.max(1, queries.length)) * 100,
    ),
    emptyResultQueries: empty,
    worstFirstRelevantRank: worstRank,
    perFamilyRecallPercent: Object.freeze(families),
  });
}

export type CodeEngineMeasurement = Readonly<{
  engine: CodeEngineName;
  mode: SearchMode;
  unit: CodeUnit;
  records: number;
  buildMilliseconds: number;
  perQueryP95Milliseconds: number;
  withinInteractiveBudget: boolean;
  availableWithoutRunningService: boolean;
  quality: CodeQuality | null;
  outcome: "MEASURED" | "SKIPPED_BY_PROFILE" | "SERVICE_UNAVAILABLE";
}>;

export type CodeRetrievalReport = Readonly<{
  schemaVersion: number;
  corpusId: string;
  profile: "SMALL" | "REFERENCE";
  fingerprint: Readonly<{
    files: number;
    symbols: number;
    lines: number;
    longestFileLines: number;
    distinctCodeTerms: number;
    distinctProseTerms: number;
  }>;
  counts: Readonly<{
    queries: number;
    expectedPairs: number;
    localizationQueries: number;
    punctuationProbes: number;
    confusablePairs: number;
  }>;
  engines: readonly CodeEngineMeasurement[];
  /**
   * The measured case for the search-mode flag the GUI would carry, in both
   * directions: the right mode on each domain and the wrong one.
   */
  modeFlag: Readonly<{
    codeQuestionsInCodeModePercent: number;
    codeQuestionsInProseModePercent: number;
    proseQuestionsInProseModePercent: number;
    proseQuestionsInCodeModePercent: number;
    wrongModeIsSilent: boolean;
    conclusion:
      "SEARCH_MODE_FLAG_JUSTIFIED" | "ONE_MODE_IS_ENOUGH_FOR_BOTH_DOMAINS";
  }>;
  /** What splitting identifiers buys, measured on the word-form questions. */
  identifierSplitting: Readonly<{
    wordQueryRecallWithSplittingPercent: number;
    wordQueryRecallWithoutSplittingPercent: number;
    wordQueryLocalizationWithSplittingPercent: number | null;
    wordQueryLocalizationWithoutSplittingPercent: number | null;
    conclusion:
      | "IDENTIFIER_SPLITTING_REQUIRED_TO_REACH_THE_FILE"
      | "IDENTIFIER_SPLITTING_REQUIRED_TO_REACH_THE_DECLARATION"
      | "IDENTIFIER_SPLITTING_CHANGES_NOTHING_MEASURED";
  }>;
  /**
   * What splitting identifiers *costs*, measured on the questions that type the
   * name in full. Splitting adds one term per part, so five weak parts can
   * outscore one strong exact match unless the whole identifier is weighted.
   */
  exactMatch: Readonly<{
    queries: readonly string[];
    unweightedRecallPercent: number;
    exactWeightedRecallPercent: number;
    nameWeightedRecallPercent: number;
    unweightedLocalizationPercent: number | null;
    exactWeightedLocalizationPercent: number | null;
    nameWeightedLocalizationPercent: number | null;
    conclusion:
      | "DECLARED_NAME_MUST_OUTWEIGH_THE_BODY"
      | "WHOLE_IDENTIFIER_MUST_OUTWEIGH_ITS_PARTS"
      | "SPLITTING_COSTS_NOTHING_ON_EXACT_NAMES";
  }>;
  /** Whether punctuation survives tokenization, per mode. */
  punctuation: Readonly<{
    probes: readonly string[];
    answeredInCodeMode: number;
    answeredInProseMode: number;
    conclusion: string;
  }>;
  /**
   * The measured cost of typo tolerance on names, and the measured cost of
   * turning it off, so the trade is visible instead of asserted.
   */
  typoTolerance: Readonly<{
    /** The engine the tolerance figures are measured on, not a weaker one. */
    measuredOn: CodeEngineName;
    confusablePairsConflatedInProseMode: number;
    confusablePairsConflatedInCodeMode: number;
    typoQueriesAnsweredWithTolerance: number;
    typoQueriesAnsweredWithoutTolerance: number;
    conclusion:
      | "TYPO_TOLERANCE_DOES_NOT_CONFLATE_NAMES_THAT_EXIST"
      | "SPLITTING_IDENTIFIERS_LIMITS_WHAT_TYPO_TOLERANCE_CAN_CONFLATE"
      | "TYPO_TOLERANCE_CONFLATES_NAMES_IN_BOTH_MODES";
  }>;
  /** Questions that are about the call graph, not about text. */
  graphQuestions: Readonly<{
    queries: readonly string[];
    bestRecallPercent: number;
    definitionOutranksUse: boolean;
    conclusion:
      | "CALL_GRAPH_NEEDS_A_DIFFERENT_INDEX"
      | "RANKING_ANSWERS_CALL_GRAPH_QUESTIONS";
  }>;
  dense: Readonly<{
    mode: DenseMode;
    outcome:
      | "MEASURED"
      | "SKIPPED_BY_PROFILE"
      | "SKIPPED_CORPUS_TOO_LARGE"
      | "SERVICE_UNAVAILABLE";
    model: string;
    dimensions: number | null;
    symbolsEmbedded: number | null;
    buildSeconds: number | null;
    queryEmbeddingMedianMilliseconds: number | null;
    queryEmbeddingP95Milliseconds: number | null;
    /** Excluded from the median and p95, and reported so it is not hidden. */
    firstQueryAfterBuildMilliseconds: number | null;
    queryEmbeddingWithinInteractiveBudget: boolean | null;
    truncatedSymbols: number | null;
    characterLimit: number;
    recordCeiling: number;
  }>;
  recommendation: Readonly<{
    codeMode: CodeEngineName;
    unit: CodeUnit;
    denseOnCriticalPath: boolean;
    unresolvedByLexical: readonly string[];
  }>;
  limits: readonly string[];
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
}>;

function countLines(text: string): number {
  return text.split("\n").length;
}

export async function measureCodeRetrieval(
  profile: "SMALL" | "REFERENCE" = "REFERENCE",
  denseMode: DenseMode = "IF_AVAILABLE",
): Promise<CodeRetrievalReport> {
  const files = collectSourceFiles();
  const symbolRecords = buildCodeRecords(files, "SYMBOL");
  const fileRecords = buildCodeRecords(files, "FILE");

  const engines: CodeEngineMeasurement[] = [];
  const measureLexical = (
    engine: CodeEngineName,
    mode: SearchMode,
    unit: CodeUnit,
    records: readonly CodeRecord[],
    typoTolerance: boolean,
    wholeIdentifierWeight = 1,
  ): CodeEngineMeasurement => {
    const buildStart = performance.now();
    const index = buildCodeIndex(records, mode, true, wholeIdentifierWeight);
    const buildMilliseconds =
      Math.round((performance.now() - buildStart) * 1_000) / 1_000;
    const durations: number[] = [];
    for (const query of CODE_QUERIES) {
      const start = performance.now();
      searchCode(index, query.text, RESULT_LIMIT, typoTolerance);
      durations.push(performance.now() - start);
    }
    const p95 = percentile(durations, 0.95);
    return Object.freeze({
      engine,
      mode,
      unit,
      records: records.length,
      buildMilliseconds,
      perQueryP95Milliseconds: p95,
      withinInteractiveBudget: p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
      availableWithoutRunningService: true,
      quality: scoreCodeEngine((text) =>
        searchCode(index, text, RESULT_LIMIT, typoTolerance),
      ),
      outcome: "MEASURED",
    });
  };

  const namedRecords = weightSymbolNames(symbolRecords);
  engines.push(
    measureLexical("PROSE_MODE_SYMBOL", "PROSE", "SYMBOL", symbolRecords, true),
    measureLexical("CODE_MODE_SYMBOL", "CODE", "SYMBOL", symbolRecords, false),
    measureLexical(
      "CODE_MODE_SYMBOL_TYPO_TOLERANT",
      "CODE",
      "SYMBOL",
      symbolRecords,
      true,
    ),
    measureLexical(
      "CODE_MODE_SYMBOL_EXACT_WEIGHTED",
      "CODE",
      "SYMBOL",
      symbolRecords,
      false,
      WEIGHT,
    ),
    measureLexical(
      "CODE_MODE_SYMBOL_NAME_WEIGHTED",
      "CODE",
      "SYMBOL",
      namedRecords,
      false,
    ),
    measureLexical("CODE_MODE_FILE", "CODE", "FILE", fileRecords, false),
  );

  const codeIndex = buildCodeIndex(symbolRecords, "CODE");
  const exactWeightedIndex = buildCodeIndex(
    symbolRecords,
    "CODE",
    true,
    WEIGHT,
  );
  const nameWeightedIndex = buildCodeIndex(namedRecords, "CODE");
  const proseIndexOnCode = buildCodeIndex(symbolRecords, "PROSE");

  /* The mode flag, measured in both directions on both domains. */
  const proseRecords = buildProseRecords();
  const proseIndexOnProse = buildCodeIndex(proseRecords, "PROSE");
  const codeIndexOnProse = buildCodeIndex(proseRecords, "CODE");
  const proseQuestions = Object.freeze(
    [...DOCUMENT_QUERIES, ...ITALIAN_QUERIES].map((query) =>
      Object.freeze({
        id: query.id,
        text: query.text,
        family: "IDENTIFIER_WORDS" as CodeFamily,
        expected: query.expected,
        expectedSymbol: null,
      }),
    ),
  );
  const codeInCode = scoreCodeEngine((text) =>
    searchCode(codeIndex, text, RESULT_LIMIT, false),
  );
  const codeInProse = scoreCodeEngine((text) =>
    searchCode(proseIndexOnCode, text, RESULT_LIMIT, true),
  );
  const proseInProse = scoreCodeEngine(
    (text) => searchCode(proseIndexOnProse, text, RESULT_LIMIT, true),
    proseQuestions,
  );
  const proseInCode = scoreCodeEngine(
    (text) => searchCode(codeIndexOnProse, text, RESULT_LIMIT, false),
    proseQuestions,
  );

  /* Identifier splitting, isolated on the word-form questions. */
  const wordQueries = CODE_QUERIES.filter(
    (query) => query.family === "IDENTIFIER_WORDS",
  );
  const noSplitIndex = buildCodeIndex(symbolRecords, "CODE", false);
  const withSplitting = scoreCodeEngine(
    (text) => searchCode(codeIndex, text, RESULT_LIMIT, false),
    wordQueries,
  );
  const withoutSplitting = scoreCodeEngine(
    (text) => searchCode(noSplitIndex, text, RESULT_LIMIT, false),
    wordQueries,
  );

  /* The other side of the same trade: questions that type the name in full. */
  const exactQueries = CODE_QUERIES.filter(
    (query) =>
      query.family === "IDENTIFIER_EXACT" ||
      (query.family === "TYPE_NAME" && !query.text.includes(" ")),
  );
  const exactUnweighted = scoreCodeEngine(
    (text) => searchCode(codeIndex, text, RESULT_LIMIT, false),
    exactQueries,
  );
  const exactWeighted = scoreCodeEngine(
    (text) => searchCode(exactWeightedIndex, text, RESULT_LIMIT, false),
    exactQueries,
  );
  const nameWeighted = scoreCodeEngine(
    (text) => searchCode(nameWeightedIndex, text, RESULT_LIMIT, false),
    exactQueries,
  );

  /* Punctuation: not recall, but whether the mode answers at all. */
  const answeredInCodeMode = PUNCTUATION_PROBES.filter(
    (probe) => searchCode(codeIndex, probe, RESULT_LIMIT, false).length > 0,
  ).length;
  const answeredInProseMode = PUNCTUATION_PROBES.filter(
    (probe) =>
      searchCode(proseIndexOnCode, probe, RESULT_LIMIT, true).length > 0,
  ).length;

  /* Typo tolerance on names: what it conflates, and what turning it off costs. */
  const conflates = (index: CodeIndex, typoTolerance: boolean): number =>
    CONFUSABLE_IDENTIFIERS.filter(([wanted, other]) => {
      if (wanted === undefined || other === undefined) return false;
      const results = searchCode(index, wanted, 3, typoTolerance);
      const wantedRank = results.findIndex(
        (result) => result.symbol === wanted,
      );
      const otherRank = results.findIndex((result) => result.symbol === other);
      return otherRank >= 0 && (wantedRank < 0 || otherRank < wantedRank);
    }).length;
  const conflatedInProse = conflates(proseIndexOnCode, true);
  const conflatedInCode = conflates(codeIndex, true);
  const typoQueries = CODE_QUERIES.filter((query) => query.family === "TYPO");
  const typoAnswered = (index: CodeIndex, typoTolerance: boolean): number =>
    typoQueries.filter((query) =>
      searchCode(index, query.text, RESULT_LIMIT, typoTolerance).some(
        (result) => query.expected.includes(result.path),
      ),
    ).length;

  /* Graph questions. */
  const graphQueries = CODE_QUERIES.filter(
    (query) => query.family === "CALL_SITE",
  );
  const graphQuality = scoreCodeEngine(
    (text) => searchCode(codeIndex, text, RESULT_LIMIT, false),
    graphQueries,
  );
  const definitionOutranksUse = graphQueries.some((query) => {
    const results = searchCode(codeIndex, query.text, RESULT_LIMIT, false);
    const firstUse = results.findIndex((result) =>
      query.expected.includes(result.path),
    );
    return firstUse !== 0;
  });

  let dense: CodeRetrievalReport["dense"] = Object.freeze({
    mode: denseMode,
    outcome: "SKIPPED_BY_PROFILE",
    model: DENSE_MODEL,
    dimensions: null,
    symbolsEmbedded: null,
    buildSeconds: null,
    queryEmbeddingMedianMilliseconds: null,
    queryEmbeddingP95Milliseconds: null,
    firstQueryAfterBuildMilliseconds: null,
    queryEmbeddingWithinInteractiveBudget: null,
    truncatedSymbols: null,
    characterLimit: DENSE_CHARACTER_LIMIT,
    recordCeiling: DENSE_RECORD_CEILING,
  });

  if (denseMode !== "SKIP" && profile === "REFERENCE") {
    const embeddable = symbolRecords.filter(
      (record) => record.body.trim().length >= 40,
    );
    if (embeddable.length > DENSE_RECORD_CEILING)
      dense = Object.freeze({ ...dense, outcome: "SKIPPED_CORPUS_TOO_LARGE" });
    else
      try {
        await embed(["riscaldamento del modello"]);
        const truncated = embeddable.filter(
          (record) => record.body.length > DENSE_CHARACTER_LIMIT,
        ).length;
        const buildStart = performance.now();
        const vectors: number[][] = [];
        const batch = 64;
        for (let start = 0; start < embeddable.length; start += batch) {
          const slice = embeddable.slice(start, start + batch);
          const embedded = await embed(
            slice.map((record) => `${record.path}\n${record.body}`),
          );
          for (const vector of embedded) vectors.push([...vector]);
        }
        const buildSeconds =
          Math.round(((performance.now() - buildStart) / 1_000) * 100) / 100;
        const queryDurations: number[] = [];
        const denseRetrieve = async (
          text: string,
        ): Promise<readonly CodeResult[]> => {
          const start = performance.now();
          const [queryVector] = await embed([text]);
          queryDurations.push(performance.now() - start);
          if (queryVector === undefined)
            throw new CodeRetrievalMeasurementError(
              "the embedding service answered no query vector",
            );
          return Object.freeze(
            embeddable
              .map((record, position) => {
                const vector = vectors[position];
                return Object.freeze({
                  id: record.id,
                  path: record.path,
                  symbol: record.symbol,
                  startLine: record.startLine,
                  score:
                    vector === undefined
                      ? 0
                      : Math.round(dot(queryVector, vector) * 10_000) / 10_000,
                  because: "vicinanza semantica",
                });
              })
              .sort((left, right) =>
                right.score === left.score
                  ? left.id.localeCompare(right.id)
                  : right.score - left.score,
              )
              .slice(0, RESULT_LIMIT),
          );
        };
        /**
         * The service is still busy right after embedding two thousand records,
         * and the first query pays for it: measured at about four seconds
         * against a few hundred milliseconds once the service is idle. Warming
         * again and reporting the first query separately keeps the interactive
         * figure honest instead of publishing the build's shadow as query
         * latency.
         *
         * What remains after that separation is genuine: direct probes of the
         * idle service on this machine ranged from about 200 to about 400 ms per
         * query on different occasions, so the median below is a figure for one
         * machine at one moment, not a property of the model. Every reading is
         * far outside the interactive budget, which is the conclusion that
         * matters and the one that does not move.
         */
        await embed(["riscaldamento dopo la costruzione"]);
        const denseByQuery = new Map<string, readonly CodeResult[]>();
        for (const query of CODE_QUERIES)
          denseByQuery.set(query.text, await denseRetrieve(query.text));
        const [firstQuery = null, ...steadyQueries] = queryDurations;
        const p95 = percentile(steadyQueries, 0.95);
        const median = percentile(steadyQueries, 0.5);
        engines.push(
          Object.freeze({
            engine: "DENSE_SYMBOL",
            mode: "CODE",
            unit: "SYMBOL",
            records: embeddable.length,
            buildMilliseconds: Math.round(buildSeconds * 1_000),
            perQueryP95Milliseconds: p95,
            withinInteractiveBudget: median <= INTERACTIVE_BUDGET_MILLISECONDS,
            availableWithoutRunningService: false,
            quality: scoreCodeEngine(
              (text) => denseByQuery.get(text) ?? Object.freeze([]),
            ),
            outcome: "MEASURED",
          }),
          Object.freeze({
            engine: "HYBRID_SYMBOL",
            mode: "CODE",
            unit: "SYMBOL",
            records: embeddable.length,
            buildMilliseconds: Math.round(buildSeconds * 1_000),
            perQueryP95Milliseconds: p95,
            withinInteractiveBudget: median <= INTERACTIVE_BUDGET_MILLISECONDS,
            availableWithoutRunningService: false,
            quality: scoreCodeEngine((text) =>
              fuseByReciprocalRank(
                searchCode(codeIndex, text, RESULT_LIMIT, false),
                denseByQuery.get(text) ?? Object.freeze([]),
                RESULT_LIMIT,
              ),
            ),
            outcome: "MEASURED",
          }),
        );
        dense = Object.freeze({
          mode: denseMode,
          outcome: "MEASURED",
          model: DENSE_MODEL,
          dimensions: vectors[0]?.length ?? null,
          symbolsEmbedded: embeddable.length,
          buildSeconds,
          queryEmbeddingMedianMilliseconds: median,
          queryEmbeddingP95Milliseconds: p95,
          firstQueryAfterBuildMilliseconds:
            firstQuery === null ? null : Math.round(firstQuery),
          queryEmbeddingWithinInteractiveBudget:
            median <= INTERACTIVE_BUDGET_MILLISECONDS,
          truncatedSymbols: truncated,
          characterLimit: DENSE_CHARACTER_LIMIT,
          recordCeiling: DENSE_RECORD_CEILING,
        });
      } catch (error) {
        if (denseMode === "REQUIRE") throw error;
        dense = Object.freeze({ ...dense, outcome: "SERVICE_UNAVAILABLE" });
        engines.push(
          Object.freeze({
            engine: "DENSE_SYMBOL",
            mode: "CODE",
            unit: "SYMBOL",
            records: 0,
            buildMilliseconds: 0,
            perQueryP95Milliseconds: 0,
            withinInteractiveBudget: false,
            availableWithoutRunningService: false,
            quality: null,
            outcome: "SERVICE_UNAVAILABLE",
          }),
        );
      }
  }

  /**
   * The recommendation follows the measurement. Symbol localization breaks the
   * tie, because a whole-file engine can reach every file and still make the
   * developer read it: file recall alone would pick the least useful engine.
   */
  const best = engines
    .filter(
      (engine) =>
        engine.availableWithoutRunningService && engine.quality !== null,
    )
    .reduce((left, right) => {
      const score = (engine: CodeEngineMeasurement): number =>
        (engine.quality?.fileRecallPercent ?? 0) +
        (engine.quality?.symbolLocalizationPercent ?? 0);
      return score(right) > score(left) ? right : left;
    });
  const bestIndex =
    best.engine === "CODE_MODE_SYMBOL_NAME_WEIGHTED"
      ? nameWeightedIndex
      : best.engine === "CODE_MODE_SYMBOL_EXACT_WEIGHTED"
        ? exactWeightedIndex
        : best.engine === "CODE_MODE_FILE"
          ? buildCodeIndex(fileRecords, "CODE")
          : best.engine === "PROSE_MODE_SYMBOL"
            ? proseIndexOnCode
            : codeIndex;
  const unresolved = CODE_QUERIES.filter(
    (query) =>
      !searchCode(
        bestIndex,
        query.text,
        RESULT_LIMIT,
        best.engine === "PROSE_MODE_SYMBOL" ||
          best.engine === "CODE_MODE_SYMBOL_TYPO_TOLERANT",
      ).some((result) => query.expected.includes(result.path)),
  ).map((query) => query.id);

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    corpusId: CODE_CORPUS_ID,
    profile,
    fingerprint: Object.freeze({
      files: files.length,
      symbols: symbolRecords.length,
      lines: files.reduce((sum, file) => sum + countLines(file.text), 0),
      longestFileLines: files.reduce(
        (longest, file) => Math.max(longest, countLines(file.text)),
        0,
      ),
      distinctCodeTerms: codeIndex.terms.length,
      distinctProseTerms: proseIndexOnCode.terms.length,
    }),
    counts: Object.freeze({
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
    }),
    engines: Object.freeze(engines),
    modeFlag: Object.freeze({
      codeQuestionsInCodeModePercent: codeInCode.fileRecallPercent,
      codeQuestionsInProseModePercent: codeInProse.fileRecallPercent,
      proseQuestionsInProseModePercent: proseInProse.fileRecallPercent,
      proseQuestionsInCodeModePercent: proseInCode.fileRecallPercent,
      /**
       * A wrong mode that returns nothing is a usable failure: the person sees
       * it and flips the flag. A wrong mode that returns plausible rubbish is
       * the dangerous one, so this records which kind it is.
       */
      wrongModeIsSilent: proseInCode.emptyResultQueries > 0,
      conclusion:
        codeInCode.fileRecallPercent > codeInProse.fileRecallPercent ||
        proseInProse.fileRecallPercent > proseInCode.fileRecallPercent
          ? "SEARCH_MODE_FLAG_JUSTIFIED"
          : "ONE_MODE_IS_ENOUGH_FOR_BOTH_DOMAINS",
    }),
    identifierSplitting: Object.freeze({
      wordQueryRecallWithSplittingPercent: withSplitting.fileRecallPercent,
      wordQueryRecallWithoutSplittingPercent:
        withoutSplitting.fileRecallPercent,
      wordQueryLocalizationWithSplittingPercent:
        withSplitting.symbolLocalizationPercent,
      wordQueryLocalizationWithoutSplittingPercent:
        withoutSplitting.symbolLocalizationPercent,
      /**
       * Reaching the file is the weaker question: a symbol's body usually
       * mentions the words of its own name anyway. Landing on the declaration is
       * where splitting has to earn its place.
       */
      conclusion:
        withSplitting.fileRecallPercent > withoutSplitting.fileRecallPercent
          ? "IDENTIFIER_SPLITTING_REQUIRED_TO_REACH_THE_FILE"
          : (withSplitting.symbolLocalizationPercent ?? 0) >
              (withoutSplitting.symbolLocalizationPercent ?? 0)
            ? "IDENTIFIER_SPLITTING_REQUIRED_TO_REACH_THE_DECLARATION"
            : "IDENTIFIER_SPLITTING_CHANGES_NOTHING_MEASURED",
    }),
    exactMatch: Object.freeze({
      queries: Object.freeze(exactQueries.map((query) => query.id)),
      unweightedRecallPercent: exactUnweighted.fileRecallPercent,
      exactWeightedRecallPercent: exactWeighted.fileRecallPercent,
      nameWeightedRecallPercent: nameWeighted.fileRecallPercent,
      unweightedLocalizationPercent: exactUnweighted.symbolLocalizationPercent,
      exactWeightedLocalizationPercent: exactWeighted.symbolLocalizationPercent,
      nameWeightedLocalizationPercent: nameWeighted.symbolLocalizationPercent,
      /**
       * Two different levers, and the measurement separates them: repeating the
       * whole identifier against its own parts, or repeating the declared name
       * against the body it heads. They are not the same fix.
       */
      conclusion:
        nameWeighted.fileRecallPercent > exactUnweighted.fileRecallPercent
          ? "DECLARED_NAME_MUST_OUTWEIGH_THE_BODY"
          : exactWeighted.fileRecallPercent > exactUnweighted.fileRecallPercent
            ? "WHOLE_IDENTIFIER_MUST_OUTWEIGH_ITS_PARTS"
            : "SPLITTING_COSTS_NOTHING_ON_EXACT_NAMES",
    }),
    punctuation: Object.freeze({
      probes: PUNCTUATION_PROBES,
      answeredInCodeMode,
      answeredInProseMode,
      conclusion:
        answeredInProseMode === 0 && answeredInCodeMode > 0
          ? "PUNCTUATION_IS_ONLY_SEARCHABLE_IN_CODE_MODE"
          : "PUNCTUATION_SURVIVES_BOTH_MODES",
    }),
    typoTolerance: Object.freeze({
      measuredOn: best.engine,
      confusablePairsConflatedInProseMode: conflatedInProse,
      confusablePairsConflatedInCodeMode: conflatedInCode,
      typoQueriesAnsweredWithTolerance: typoAnswered(bestIndex, true),
      typoQueriesAnsweredWithoutTolerance: typoAnswered(bestIndex, false),
      /**
       * Tolerance only expands terms the dictionary does not have, so a name
       * that exists is never rewritten into a different name that also exists.
       * The measured risk of confusing `encodeMemoryLog` with `decodeMemoryLog`
       * is therefore zero, which contradicts what I expected before measuring.
       */
      conclusion:
        conflatedInProse === 0 && conflatedInCode === 0
          ? "TYPO_TOLERANCE_DOES_NOT_CONFLATE_NAMES_THAT_EXIST"
          : conflatedInProse > conflatedInCode
            ? "SPLITTING_IDENTIFIERS_LIMITS_WHAT_TYPO_TOLERANCE_CAN_CONFLATE"
            : "TYPO_TOLERANCE_CONFLATES_NAMES_IN_BOTH_MODES",
    }),
    graphQuestions: Object.freeze({
      queries: Object.freeze(graphQueries.map((query) => query.id)),
      bestRecallPercent: graphQuality.fileRecallPercent,
      definitionOutranksUse,
      conclusion:
        graphQuality.fileRecallPercent < 100 || definitionOutranksUse
          ? "CALL_GRAPH_NEEDS_A_DIFFERENT_INDEX"
          : "RANKING_ANSWERS_CALL_GRAPH_QUESTIONS",
    }),
    dense,
    recommendation: Object.freeze({
      codeMode: best.engine,
      unit: best.unit,
      denseOnCriticalPath: false,
      unresolvedByLexical: Object.freeze(unresolved),
    }),
    limits: Object.freeze([
      "GROUND_TRUTH_PREDECLARED_BY_READING_NOT_BY_QUERYING",
      "CORPUS_GROWS_WITH_THE_REPOSITORY_SO_FIGURES_ARE_STATE_DEPENDENT",
      "ONLY_TYPESCRIPT_IS_MEASURED_SO_OTHER_LANGUAGES_ARE_UNPROBED",
      "SYMBOL_SPLITTING_IS_LINE_BASED_NOT_PARSED_SO_NESTED_DECLARATIONS_ARE_NOT_SEPARATE_RECORDS",
      "CALL_SITE_GROUND_TRUTH_COUNTS_TEXTUAL_MENTIONS_NOT_RESOLVED_REFERENCES",
      "A_SHORTER_RECORD_THAT_CALLS_A_NAME_CAN_OUTRANK_THE_RECORD_THAT_DECLARES_IT_BECAUSE_A_MENTION_IS_TEXTUALLY_INDISTINGUISHABLE_FROM_A_DECLARATION",
      "PUNCTUATION_PROBES_MEASURE_WHETHER_THE_MODE_ANSWERS_NOT_HOW_WELL_IT_RANKS",
      "THE_CORPUS_CONTAINS_DELIBERATE_TYPO_FIXTURES_SO_A_MISSPELLING_CAN_BE_A_LEGITIMATE_INDEXED_TERM_AND_SILENTLY_DISABLE_TOLERANCE",
      "EIGHTEEN_QUERIES_MAKE_P95_THE_WORST_CASE_NOT_THE_TYPICAL",
      "QUERY_LATENCY_MEASURED_IMMEDIATELY_AFTER_THE_EMBEDDING_BUILD_REFLECTS_THE_BUILD_NOT_INTERACTIVE_USE_SO_THE_FIRST_QUERY_IS_REPORTED_SEPARATELY_AND_EXCLUDED",
      "DENSE_QUERY_LATENCY_VARIES_WITH_MACHINE_STATE_BETWEEN_ROUGHLY_TWO_HUNDRED_AND_FOUR_HUNDRED_MILLISECONDS_SO_ONLY_THE_VERDICT_AGAINST_THE_BUDGET_IS_STABLE",
      "NO_GUI_OR_PRODUCT_CODE_IS_CHANGED_BY_THIS_MEASUREMENT",
    ]),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER",
  });
}

/** Strips timing so two runs can be compared for equality in a test. */
export function withoutElapsed(report: CodeRetrievalReport): unknown {
  return {
    ...report,
    engines: report.engines.map((engine) => ({
      engine: engine.engine,
      mode: engine.mode,
      unit: engine.unit,
      records: engine.records,
      withinInteractiveBudget: engine.withinInteractiveBudget,
      availableWithoutRunningService: engine.availableWithoutRunningService,
      quality: engine.quality,
      outcome: engine.outcome,
    })),
    dense: {
      ...report.dense,
      buildSeconds: null,
      queryEmbeddingMedianMilliseconds: null,
      queryEmbeddingP95Milliseconds: null,
      firstQueryAfterBuildMilliseconds: null,
      queryEmbeddingWithinInteractiveBudget: null,
    },
  };
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await measureCodeRetrieval();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
