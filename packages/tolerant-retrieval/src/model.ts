/** Whether a record is allowed to compete for a rank at all. */
export const ADMISSIBILITY = Object.freeze([
  "CURRENT",
  "SUPERSEDED",
  "INVALIDATED",
] as const);

export type Admissibility = (typeof ADMISSIBILITY)[number];

/**
 * Where a record is, carried by the record itself. ADR-0031 requires the
 * indexing unit to know its own position, so a result can be opened at source
 * instead of sending a reader to look for it.
 */
export type RecordLocation = Readonly<{
  /** The authoritative store this came from, stated in every result. */
  store: string;
  /** Document path, file path, or the identity of the session. */
  path: string;
  /** Heading path for prose, symbol name for code, null when neither. */
  declaredName: string | null;
  /** Start line, sequence number, or null when the store has no position. */
  position: number | null;
}>;

/** How a typed term reached an indexed term. Never inferred after the fact. */
export const MATCH_KINDS = Object.freeze([
  "EXACT",
  "PREFIX",
  "STEM",
  "TYPO",
  "GLOSSARY",
] as const);

export type MatchKind = (typeof MATCH_KINDS)[number];

export type MatchReason = Readonly<{
  /** The term as the reader typed it, after tokenization. */
  term: string;
  /** The indexed term it reached. */
  matched: string;
  kind: MatchKind;
}>;

export type RetrievalRecord = Readonly<{
  id: string;
  text: string;
  location: RecordLocation;
  /** Sortable timestamp, used only for the deterministic tiebreak. */
  occurredAt: string;
  admissibility: Admissibility;
  /**
   * Deduplication key. Two records that say the same thing because one store
   * copied it from another share it, and only the best-scoring one is returned.
   */
  provenance: string;
}>;

export type RetrievalResult = Readonly<{
  id: string;
  score: number;
  location: RecordLocation;
  /** Always at least one. A result whose reason cannot be stated is dropped. */
  reasons: readonly MatchReason[];
}>;
