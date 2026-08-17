export {
  HistoricalEventNotFoundError,
  HistoricalSearchError,
} from "./errors.ts";
export { HistoricalSearch } from "./historical-search.ts";
export { TolerantHistoricalIndex } from "./tolerant-historical-index.ts";
export type {
  TolerantHistoricalFilter,
  TolerantHistoricalSearchOptions,
} from "./tolerant-historical-index.ts";
export { snippetOf } from "./snippet.ts";
/**
 * Re-exported so a consumer of search can name the reason type without taking
 * a dependency on the engine: what the engine is stays this package's business.
 */
export type { MatchReason } from "@ai-workspace/tolerant-retrieval";
/**
 * Re-exported for the same reason: a surface that has to show what a person
 * wrote needs the reader of ADR-0032, decision A, and stored payloads are the
 * shape this package already understands. Without it every reader outside the
 * engine would parse the canonical envelope again, and the two would drift.
 */
export { readCanonicalPayload } from "@ai-workspace/tolerant-retrieval";
export { RETRIEVAL_STORES } from "./model.ts";
export type {
  RetrievalStore,
  TolerantHistoricalReport,
  TolerantHistoricalResult,
} from "./model.ts";
export type {
  HistoricalEvent,
  GlobalHistoricalSearchQuery,
  GlobalHistoricalSearchReport,
  HistoricalSearchQuery,
  HistoricalSearchReport,
  HistoricalSearchResult,
  ScopedHistoricalSearchQuery,
  ScopedHistoricalSearchReport,
  ScopedHistoricalSearchResult,
  OpenedArtifact,
} from "./model.ts";
export type {
  ActiveMemoryReader,
  ArtifactResolver,
  HistoricalEventReader,
  HistoricalSearchDependencies,
} from "./ports.ts";
