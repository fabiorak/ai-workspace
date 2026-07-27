/**
 * The engine. It sees records of text that carry their own location, and it
 * knows nothing about payloads, stores, adapters, or how the text was obtained:
 * ADR-0032 puts that knowledge in a reader outside this boundary, so the same
 * engine serves transcripts, documents, and code.
 *
 * The index is in memory and derived. It is rebuilt from the canonical sources,
 * never persisted, and never a second source of truth.
 */

import { TolerantRetrievalError } from "./errors.ts";
import { translationsOf } from "./glossary.ts";
import { stem } from "./normalization.ts";
import type {
  MatchKind,
  MatchReason,
  RetrievalRecord,
  RetrievalResult,
} from "./model.ts";
import { mergedQueryTerms, mergedTerms } from "./tokenization.ts";
import { isTypoOf } from "./tolerance.ts";

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const DEFAULT_LIMIT = 20;

/**
 * How many times a declared name is repeated at the head of a record. Measured
 * on document headings and confirmed on symbol names: it buys precision without
 * costing recall. Weighting the *whole* identifier instead was measured and
 * rejected — it costs 14 points of precision and gains nothing.
 */
const DECLARED_NAME_WEIGHT = 3;

type Posting = ReadonlyMap<number, number>;

type IndexedRecord = Readonly<{
  record: RetrievalRecord;
  length: number;
}>;

export type TolerantIndex = Readonly<{
  records: readonly IndexedRecord[];
  postings: ReadonlyMap<string, Posting>;
  /** Every indexed term, in the order it was first seen. */
  dictionary: readonly string[];
  averageLength: number;
  /**
   * Three views of the same dictionary, built once so a query does not have to
   * walk all of it. They change nothing about which terms a query reaches: they
   * are the same rules, asked of a smaller set of candidates.
   *
   * Sorted by code unit, so the terms carrying a given prefix are contiguous.
   */
  sorted: readonly string[];
  /** Terms grouped by their stem, so a stem match is a lookup. */
  byStem: ReadonlyMap<string, readonly string[]>;
  /**
   * Terms grouped by length. A typo is bounded by two edits, so only lengths
   * within two of the typed term can be within the budget at all.
   */
  byLength: ReadonlyMap<number, readonly string[]>;
  /** Dictionary position of each term, so expansions can be put back in order. */
  order: ReadonlyMap<string, number>;
}>;

function indexedText(record: RetrievalRecord): string {
  const declared = record.location.declaredName;
  if (declared === null) return record.text;
  return `${`${declared}\n`.repeat(DECLARED_NAME_WEIGHT)}${record.text}`;
}

/**
 * Admissibility is settled before ranking, not by pushing weak records down:
 * a superseded decision that still scores well would otherwise reappear at the
 * top of a list a reader trusts.
 */
function admissible(record: RetrievalRecord): boolean {
  return record.admissibility === "CURRENT";
}

export function buildIndex(records: readonly RetrievalRecord[]): TolerantIndex {
  const indexed: IndexedRecord[] = [];
  const postings = new Map<string, Map<number, number>>();
  let totalLength = 0;
  for (const record of records) {
    if (!admissible(record)) continue;
    const terms = mergedTerms(indexedText(record));
    const position = indexed.length;
    indexed.push(Object.freeze({ record, length: terms.length }));
    totalLength += terms.length;
    for (const term of terms) {
      const entry = postings.get(term) ?? new Map<number, number>();
      entry.set(position, (entry.get(position) ?? 0) + 1);
      postings.set(term, entry);
    }
  }
  const dictionary = Object.freeze([...postings.keys()]);
  const byStem = new Map<string, string[]>();
  const byLength = new Map<number, string[]>();
  const order = new Map<string, number>();
  for (const [position, term] of dictionary.entries()) {
    order.set(term, position);
    const stemmed = stem(term);
    const sameStem = byStem.get(stemmed) ?? [];
    sameStem.push(term);
    byStem.set(stemmed, sameStem);
    const sameLength = byLength.get(term.length) ?? [];
    sameLength.push(term);
    byLength.set(term.length, sameLength);
  }
  return Object.freeze({
    records: Object.freeze(indexed),
    postings,
    dictionary,
    averageLength: totalLength / Math.max(1, indexed.length),
    sorted: Object.freeze([...dictionary].sort()),
    byStem,
    byLength,
    order,
  });
}

type Expansion = Readonly<{ candidate: string; kind: MatchKind }>;

/** The lowest position at which `prefix` could appear in a sorted dictionary. */
function lowerBound(sorted: readonly string[], prefix: string): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sorted[middle] ?? "") < prefix) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Which dictionary terms one typed term reaches, and by which rule. The rules
 * are tried in the order a reader would expect to be told about them — the term
 * itself, what it prefixes, what reduces to the same stem, what it is a typo of
 * — and the first rule that reaches a term is the reason reported for it.
 */
function reachedBy(
  index: TolerantIndex,
  term: string,
  into: Map<string, MatchKind>,
  kindWhenNew: MatchKind | null,
): void {
  const claim = (candidate: string, kind: MatchKind): void => {
    if (into.has(candidate)) return;
    into.set(candidate, kindWhenNew ?? kind);
  };
  if (index.postings.has(term)) claim(term, "EXACT");
  for (
    let position = lowerBound(index.sorted, term);
    position < index.sorted.length;
    position += 1
  ) {
    const candidate = index.sorted[position];
    if (candidate === undefined || !candidate.startsWith(term)) break;
    claim(candidate, "PREFIX");
  }
  for (const candidate of index.byStem.get(stem(term)) ?? [])
    claim(candidate, "STEM");
  for (let length = term.length - 2; length <= term.length + 2; length += 1)
    for (const candidate of index.byLength.get(length) ?? [])
      if (isTypoOf(term, candidate)) claim(candidate, "TYPO");
}

function inDictionaryOrder(
  index: TolerantIndex,
  matches: ReadonlyMap<string, MatchKind>,
): readonly Expansion[] {
  return [...matches]
    .sort(
      ([left], [right]) =>
        (index.order.get(left) ?? 0) - (index.order.get(right) ?? 0),
    )
    .map(([candidate, kind]) => Object.freeze({ candidate, kind }));
}

/**
 * Everything the typed term can reach, followed by what the declared glossary
 * translates it to — added, never substituted, and never displacing a term the
 * reader's own word already reached.
 */
function expand(index: TolerantIndex, term: string): readonly Expansion[] {
  const direct = new Map<string, MatchKind>();
  reachedBy(index, term, direct, null);
  const found = [...inDictionaryOrder(index, direct)];
  for (const translation of translationsOf(term)) {
    const translated = new Map<string, MatchKind>(direct);
    reachedBy(index, translation, translated, "GLOSSARY");
    const fresh = new Map(
      [...translated].filter(([candidate]) => !direct.has(candidate)),
    );
    found.push(...inDictionaryOrder(index, fresh));
    for (const [candidate, kind] of fresh) direct.set(candidate, kind);
  }
  return Object.freeze(found);
}

export type SearchOptions = Readonly<{ limit?: number }>;

export function searchIndex(
  index: TolerantIndex,
  query: string,
  options: SearchOptions = {},
): readonly RetrievalResult[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const scores = new Map<number, number>();
  const reasons = new Map<number, MatchReason[]>();
  for (const term of mergedQueryTerms(query)) {
    const frequencies = new Map<number, number>();
    const reached = new Map<number, MatchReason>();
    for (const { candidate, kind } of expand(index, term))
      for (const [position, count] of index.postings.get(candidate) ?? []) {
        frequencies.set(position, (frequencies.get(position) ?? 0) + count);
        if (!reached.has(position))
          reached.set(
            position,
            Object.freeze({ term, matched: candidate, kind }),
          );
      }
    if (frequencies.size === 0) continue;
    const inverse = Math.log(
      1 +
        (index.records.length - frequencies.size + 0.5) /
          (frequencies.size + 0.5),
    );
    for (const [position, termFrequency] of frequencies) {
      const indexed = index.records[position];
      if (indexed === undefined) continue;
      const normalization =
        termFrequency +
        BM25_K1 *
          (1 - BM25_B + (BM25_B * indexed.length) / index.averageLength);
      scores.set(
        position,
        (scores.get(position) ?? 0) +
          (inverse * (termFrequency * (BM25_K1 + 1))) / normalization,
      );
      const reason = reached.get(position);
      if (reason !== undefined)
        reasons.set(position, [...(reasons.get(position) ?? []), reason]);
    }
  }
  const ranked = [...scores.entries()]
    .map(([position, score]) => ({
      indexed: index.records[position],
      score,
      reasons: reasons.get(position) ?? [],
    }))
    .filter(
      (entry) =>
        entry.indexed !== undefined &&
        entry.score > 0 &&
        entry.reasons.length > 0,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.indexed?.record.occurredAt ?? "").localeCompare(
          left.indexed?.record.occurredAt ?? "",
          "en",
        ) ||
        (left.indexed?.record.id ?? "").localeCompare(
          right.indexed?.record.id ?? "",
          "en",
        ),
    );
  const kept: RetrievalResult[] = [];
  const takenProvenance = new Set<string>();
  for (const entry of ranked) {
    const indexed = entry.indexed;
    if (indexed === undefined) continue;
    if (takenProvenance.has(indexed.record.provenance)) continue;
    takenProvenance.add(indexed.record.provenance);
    kept.push(
      Object.freeze({
        id: indexed.record.id,
        score: entry.score,
        location: indexed.record.location,
        reasons: Object.freeze(entry.reasons),
      }),
    );
    if (kept.length >= limit) break;
  }
  return Object.freeze(kept);
}

/**
 * The index with its lifecycle. Invalidation is explicit and fails closed: a
 * stale index refuses to answer rather than answering from a state whose
 * sources have moved, because a plausible stale answer is the failure a reader
 * cannot see.
 */
export class TolerantRetrievalIndex {
  private index: TolerantIndex;
  private stale = false;

  private constructor(index: TolerantIndex) {
    this.index = index;
  }

  public static build(
    records: readonly RetrievalRecord[],
  ): TolerantRetrievalIndex {
    return new TolerantRetrievalIndex(buildIndex(records));
  }

  public get isStale(): boolean {
    return this.stale;
  }

  public get recordCount(): number {
    return this.index.records.length;
  }

  public get distinctTerms(): number {
    return this.index.dictionary.length;
  }

  public invalidate(): void {
    this.stale = true;
  }

  public rebuild(records: readonly RetrievalRecord[]): void {
    this.index = buildIndex(records);
    this.stale = false;
  }

  public search(
    query: string,
    options: SearchOptions = {},
  ): readonly RetrievalResult[] {
    if (this.stale)
      throw new TolerantRetrievalError(
        "index is invalidated and must be rebuilt before it can answer",
      );
    return searchIndex(this.index, query, options);
  }
}
