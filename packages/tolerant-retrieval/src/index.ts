export {
  CONTENT_FIELDS,
  PROVENANCE_FIELDS,
  readCanonicalPayload,
  type ExtractedText,
} from "./canonical-payload-reader.ts";
export {
  TolerantRetrievalIndex,
  buildIndex,
  searchIndex,
  type SearchOptions,
  type TolerantIndex,
} from "./engine.ts";
export { TolerantRetrievalError } from "./errors.ts";
export { declaredPairs, translationsOf } from "./glossary.ts";
export {
  ADMISSIBILITY,
  MATCH_KINDS,
  type Admissibility,
  type MatchKind,
  type MatchReason,
  type RecordLocation,
  type RetrievalRecord,
  type RetrievalResult,
} from "./model.ts";
export {
  STOPWORDS,
  contentTerms,
  normalizeTokens,
  stem,
} from "./normalization.ts";
export {
  codeTokens,
  mergedQueryTerms,
  mergedTerms,
  splitIdentifier,
} from "./tokenization.ts";
export {
  boundedDistance,
  editBudget,
  fixesTranspositionsUnderBudget,
  isTypoOf,
} from "./tolerance.ts";
