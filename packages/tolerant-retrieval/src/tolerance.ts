/**
 * Typo tolerance. ADR-0032 fixes the side of the pipeline this applies on: the
 * comparison is against **unstemmed surface forms**, never against stems.
 * Stemming a misspelled word is not the same as misspelling a stem — a
 * rule-based reduction strips the ending it recognizes off the correct term
 * while leaving the misspelling intact, so the two land two edits apart, above
 * the budget a short term gets, and the term becomes unreachable rather than
 * mis-ranked.
 *
 * The distance is bounded **Levenshtein**, which is what every published figure
 * was measured with, and it is named accurately here even though ADR-0031 calls
 * it Damerau: a transposition costs two edits, so it is reachable for terms of
 * eight characters or more and not below. `fixesTranspositionsUnderBudget()`
 * states that consequence where a reader will meet it.
 */

const FUZZY_MIN_LENGTH = 4;
const FUZZY_LONG_LENGTH = 8;

/** One edit from four to seven characters, two from eight, exact below four. */
export function editBudget(candidate: string): number {
  return candidate.length >= FUZZY_LONG_LENGTH ? 2 : 1;
}

/**
 * Returns the distance, or `budget + 1` as soon as the budget is exceeded. The
 * early exit is what keeps a per-term dictionary walk inside the interactive
 * budget; it also means the return value is not a distance once it is over.
 */
export function boundedDistance(left: string, right: string): number {
  const budget = editBudget(right);
  if (Math.abs(left.length - right.length) > budget) return budget + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row, ...new Array<number>(right.length).fill(0)];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
    }
    if (Math.min(...current) > budget) return budget + 1;
    previous = current;
  }
  return previous[right.length] ?? budget + 1;
}

/** Both sides must be long enough: below four characters, matching is exact. */
export function isTypoOf(term: string, candidate: string): boolean {
  if (candidate.length < FUZZY_MIN_LENGTH || term.length < FUZZY_MIN_LENGTH)
    return false;
  return boundedDistance(term, candidate) <= editBudget(candidate);
}

/**
 * Declared limit rather than a defect: a transposition is two edits under
 * Levenshtein, so `retrieve` reaches `retrieev` and `cerca` does not reach
 * `cerac`. Stated as a function so the boundary is testable and a later move to
 * true Damerau shows up as this returning true for short terms.
 */
export function fixesTranspositionsUnderBudget(candidate: string): boolean {
  return editBudget(candidate) >= 2;
}
