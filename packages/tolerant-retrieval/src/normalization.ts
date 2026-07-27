/**
 * Prose normalization, ported unchanged from the measurement harness that
 * produced the figures in ADR-0031. Any change here moves published numbers, so
 * the rules are fixed by test rather than by intent.
 */

const FUZZY_MIN_LENGTH = 4;

export const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "abbiamo",
  "ai",
  "al",
  "alla",
  "alle",
  "an",
  "and",
  "are",
  "be",
  "che",
  "chi",
  "ci",
  "come",
  "con",
  "cosa",
  "da",
  "dal",
  "dei",
  "del",
  "della",
  "delle",
  "dello",
  "did",
  "do",
  "dove",
  "e",
  "ed",
  "for",
  "fra",
  "gli",
  "ha",
  "hanno",
  "ho",
  "how",
  "i",
  "il",
  "in",
  "is",
  "it",
  "la",
  "le",
  "lo",
  "mi",
  "ne",
  "nei",
  "nel",
  "nella",
  "non",
  "of",
  "on",
  "o",
  "or",
  "not",
  "per",
  "perche",
  "quando",
  "si",
  "sono",
  "su",
  "sul",
  "sulla",
  "that",
  "the",
  "this",
  "ti",
  "to",
  "tra",
  "un",
  "una",
  "uno",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "with",
]);

const ITALIAN_SUFFIXES = Object.freeze([
  "issimo",
  "issima",
  "issimi",
  "issime",
  "amente",
  "azione",
  "azioni",
  "mente",
  "sione",
  "sioni",
  "zione",
  "zioni",
  "iamo",
  "iate",
  "ando",
  "endo",
  "ante",
  "anti",
  "ente",
  "enti",
  "ione",
  "ioni",
  "ata",
  "ate",
  "ati",
  "ato",
  "ita",
  "ite",
  "iti",
  "ito",
  "uta",
  "ute",
  "uti",
  "uto",
]);

const ENGLISH_SUFFIXES = Object.freeze([
  "ingly",
  "edly",
  "ing",
  "ies",
  "ed",
  "es",
  "ly",
  "s",
]);

/** Decomposes, drops combining marks, lowercases, splits on non-alphanumerics. */
export function normalizeTokens(value: string): readonly string[] {
  return Object.freeze(
    value
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 0),
  );
}

/**
 * Stopword removal with the all-stopword fallback: a query made only of
 * stopwords keeps them, because returning nothing for "come si fa" is worse
 * than ranking badly.
 */
export function contentTerms(value: string): readonly string[] {
  const tokens = normalizeTokens(value);
  const kept = tokens.filter((token) => !STOPWORDS.has(token));
  return kept.length > 0 ? Object.freeze(kept) : tokens;
}

function stripFinalVowel(token: string): string {
  return token.length >= 5 && /[aeiou]$/u.test(token)
    ? token.slice(0, token.length - 1)
    : token;
}

/** Suffix reduction for Italian and English. Not a linguistic stemmer. */
export function stem(token: string): string {
  if (token.length < FUZZY_MIN_LENGTH) return token;
  for (const suffixes of [ITALIAN_SUFFIXES, ENGLISH_SUFFIXES])
    for (const suffix of suffixes)
      if (token.endsWith(suffix) && token.length - suffix.length >= 3)
        return stripFinalVowel(token.slice(0, token.length - suffix.length));
  return stripFinalVowel(token);
}
