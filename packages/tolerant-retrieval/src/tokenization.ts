/**
 * Tokenization. ADR-0032 withdrew the per-query mode: every record carries the
 * terms of both token sets at once, so a reader never chooses between prose and
 * code and never has to be told which one answered.
 */

import { contentTerms, normalizeTokens, stem } from "./normalization.ts";

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
 * Code tokenization. No suffix reduction, because `mapping` and `mapped` are
 * different names, and no diacritic folding beyond lowercasing, because an
 * identifier has no accents. Whole identifiers are kept alongside their parts
 * so an exact name still outranks the files that merely share a word with it.
 *
 * The two parameters are the settled configuration by default. They stay
 * reachable only so the measurement harness can still produce the variants it
 * compared this one against — splitting off costs recall, and weighting the
 * whole identifier costs fourteen points of precision — from this definition
 * instead of a second copy of it that could drift.
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

/**
 * The merged token set of ADR-0032: the prose reduction of the text, then the
 * text itself, tokenized together. Both surface forms and stems end up in the
 * dictionary, which is what gives typo tolerance an unstemmed target to hit.
 */
export function mergedTerms(text: string): readonly string[] {
  return codeTokens(`${normalizeTokens(text).map(stem).join(" ")}\n${text}`);
}

/**
 * The query side of the same merge. Stopwords are dropped from the reduction —
 * with the all-stopword fallback — while the typed text is kept whole, because
 * a stopword can be part of an identifier a reader actually typed.
 */
export function mergedQueryTerms(text: string): readonly string[] {
  return codeTokens(`${contentTerms(text).map(stem).join(" ")} ${text}`);
}
