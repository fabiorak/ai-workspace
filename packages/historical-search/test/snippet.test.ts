import assert from "node:assert/strict";
import test from "node:test";

import type { MatchReason } from "@ai-workspace/tolerant-retrieval";

import { snippetOf } from "../src/snippet.ts";

function reason(
  term: string,
  matched: string,
  kind: MatchReason["kind"],
): MatchReason {
  return Object.freeze({ term, matched, kind });
}

const FILLER = "Testo di riempimento senza il termine cercato. ".repeat(6);

test("cuts around the strongest reason rather than the first one", () => {
  const text = `La memoria attiva apre il documento. ${FILLER}Il verdetto chiude la sessione.`;

  const snippet = snippetOf(text, [
    reason("verdetto", "verdetto", "EXACT"),
    reason("memoria", "memoria", "TYPO"),
  ]);

  assert.match(snippet, /verdetto/u);
  assert.doesNotMatch(snippet, /La memoria attiva apre/u);
});

test("marks both ends it cut and neither end it did not", () => {
  const short = snippetOf("Verdetto breve.", [
    reason("verdetto", "verdetto", "EXACT"),
  ]);
  assert.equal(short, "Verdetto breve.");

  const long = snippetOf(`${FILLER}Verdetto in coda.`, [
    reason("verdetto", "verdetto", "EXACT"),
  ]);
  assert.match(long, /^…/u);
  assert.doesNotMatch(long, /…$/u);
});

test("reaches a term the reader could not have typed literally", () => {
  /**
   * The indexed term is one part of an identifier, so it is not a substring
   * anybody could have searched for. Walking the words through the same
   * tokenization the index was built with is what finds it.
   */
  const snippet = snippetOf(`${FILLER}Chiama readCanonicalPayload e ritorna.`, [
    reason("canonical", "canonical", "EXACT"),
  ]);

  assert.match(snippet, /readCanonicalPayload/u);
});

test("shows the head of the text when no reason can be located", () => {
  /**
   * A glossary translation, or a stem, need not appear in the text at all. The
   * record did match, so a reader shown its opening can still judge it, while
   * an empty snippet would only hide the match.
   */
  const snippet = snippetOf(`Apertura del documento. ${FILLER}`, [
    reason("memory", "memoria", "GLOSSARY"),
  ]);

  assert.match(snippet, /^Apertura del documento\./u);
  assert.match(snippet, /…$/u);
});
