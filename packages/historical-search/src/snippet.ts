/**
 * The snippet of a tolerant result. A literal scan cut its snippet around the
 * offset `indexOf` returned; tolerant matching has no such offset, because the
 * term a reader typed may have reached the record through a stem, a typing
 * error, or the declared glossary, and may not appear in the text at all.
 *
 * The cut is therefore made around the strongest reason the result already
 * declares. The rule lives here, beside the surface that owns the reasons,
 * rather than in whichever caller renders the text, so every caller cuts the
 * same way and the choice is testable on its own.
 */

import {
  MATCH_KINDS,
  mergedTerms,
  type MatchReason,
} from "@ai-workspace/tolerant-retrieval";

/** Characters kept either side of the term the snippet is cut around. */
const SNIPPET_CONTEXT = 72;

const WORD = /[\p{L}\p{N}]+/gu;

type Located = Readonly<{ at: number; length: number }>;

/**
 * How direct a reason is, in the order `MATCH_KINDS` declares: the term itself
 * first, what it prefixes next, then what reduced to the same stem, then what
 * it was a typing error for, and last what the glossary translated it to. A
 * reader looking for the reason a passage was returned is best served by the
 * least mediated one.
 */
function strength(reason: MatchReason): number {
  const rank = MATCH_KINDS.indexOf(reason.kind);
  return rank < 0 ? MATCH_KINDS.length : rank;
}

/**
 * Where an indexed term sits in the original text. The text is walked word by
 * word and each word is put through the same tokenization the index was built
 * with, because an indexed term can be a stem, or one part of an identifier,
 * and neither is a substring anybody could search for literally.
 *
 * The walk stops at the first word that reaches the term. It is bounded by the
 * length of one record, and it runs only for the results actually returned.
 */
function locate(text: string, matched: string): Located | null {
  for (const found of text.matchAll(WORD)) {
    const at = found.index;
    if (at === undefined) continue;
    if (mergedTerms(found[0]).includes(matched))
      return Object.freeze({ at, length: found[0].length });
  }
  return null;
}

/**
 * The passage to show for a result, cut around its strongest locatable reason.
 *
 * When no reason can be located the snippet is the head of the text rather than
 * nothing: the record did match, and a reader who is shown its opening can
 * still judge it, while an empty snippet only hides the match.
 */
export function snippetOf(
  text: string,
  reasons: readonly MatchReason[],
): string {
  const ordered = [...reasons].sort(
    (left, right) => strength(left) - strength(right),
  );
  let located: Located = Object.freeze({ at: 0, length: 0 });
  for (const reason of ordered) {
    const found = locate(text, reason.matched);
    if (found !== null) {
      located = found;
      break;
    }
  }
  const start = Math.max(0, located.at - SNIPPET_CONTEXT);
  const end = Math.min(
    text.length,
    located.at + located.length + SNIPPET_CONTEXT,
  );
  const body = text.slice(start, end).replace(/\s+/gu, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}
