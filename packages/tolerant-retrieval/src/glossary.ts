/**
 * Declared bilingual glossary. It **adds** the translation next to the term the
 * reader typed and never replaces it, because the measured gain is cross-lingual
 * recall and the measured risk is losing the exact word someone chose.
 *
 * It is vocabulary, not concept: it bridges "memoria" to "memory" and cannot
 * bridge a question whose gap is conceptual. Three questions stayed unanswered
 * in the document corpus for exactly that reason, and no entry here would have
 * closed them.
 */

const DECLARED_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(["memoria", "memory"] as const),
  Object.freeze(["ricerca", "search"] as const),
  Object.freeze(["evento", "event"] as const),
  Object.freeze(["eventi", "events"] as const),
  Object.freeze(["sessione", "session"] as const),
  Object.freeze(["progetto", "project"] as const),
  Object.freeze(["documento", "document"] as const),
  Object.freeze(["decisione", "decision"] as const),
  Object.freeze(["decisioni", "decisions"] as const),
  Object.freeze(["vincolo", "constraint"] as const),
  Object.freeze(["riservatezza", "privacy"] as const),
  Object.freeze(["credenziale", "credential"] as const),
  Object.freeze(["impostazioni", "settings"] as const),
  Object.freeze(["consegna", "delivery"] as const),
  Object.freeze(["fiducia", "trust"] as const),
  Object.freeze(["provenienza", "provenance"] as const),
  Object.freeze(["cronologia", "history"] as const),
  Object.freeze(["ripristino", "restoration"] as const),
  Object.freeze(["anonimizzazione", "pseudonymization"] as const),
  Object.freeze(["riepilogo", "summary"] as const),
]);

function buildLookup(): ReadonlyMap<string, readonly string[]> {
  const lookup = new Map<string, string[]>();
  for (const [italian, english] of DECLARED_PAIRS) {
    lookup.set(italian, [...(lookup.get(italian) ?? []), english]);
    lookup.set(english, [...(lookup.get(english) ?? []), italian]);
  }
  return new Map(
    [...lookup].map(([term, translations]) => [
      term,
      Object.freeze([...new Set(translations)]),
    ]),
  );
}

const LOOKUP = buildLookup();

/** The declared pairs, exposed so the glossary can be shown rather than guessed at. */
export function declaredPairs(): readonly (readonly [string, string])[] {
  return DECLARED_PAIRS;
}

/** Translations of a term, empty when the glossary says nothing about it. */
export function translationsOf(term: string): readonly string[] {
  return LOOKUP.get(term) ?? Object.freeze([]);
}
