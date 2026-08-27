/**
 * The draft next action a composed restart point carries.
 *
 * ADR-0037 separates composing a restart summary from fixing one, and composition
 * goes through the non-persisting preview path. That path builds the whole packet,
 * and the packet has a `nextAction` section, so composing needs a next action even
 * while nobody has been asked for one yet.
 *
 * A model may not write it: the section carries `USER_INPUT` origin and
 * `USER_AUTHORED` observation, and generated prose under that metadata would make
 * the receiving assistant read invented text as curated instruction. So this
 * assembles the draft out of local text that already exists and was already
 * written by the person — the Work Item objective, and the last thing they asked —
 * quoted rather than paraphrased, with no sentence of its own added around it.
 *
 * The draft is always marked as needing review, and `assembledFrom` names what it
 * was built out of, so the interface can say where each part came from instead of
 * presenting it as somebody's decision. Nothing here persists, sends, or
 * authorizes anything: assembling the draft is a read.
 */
import { HandoffError } from "./handoffs.ts";

/** The same bound `Handoffs` applies to a next action, so a draft can never fail on length. */
const MAX_DRAFT = 4_096;
/**
 * How much of the last question travels with the draft. It is a reminder of where
 * the work was, not a transcript, and a question long enough to fill the field
 * would push the objective — the part that says what the work is — out of sight.
 */
const MAX_QUOTED_QUESTION = 500;

export type NextActionDraftSource = "WORK_ITEM_OBJECTIVE" | "LAST_QUESTION";

export type NextActionDraft = Readonly<{
  text: string;
  /**
   * Always true. It is a field rather than an implication because whatever holds
   * this draft has to keep the review obligation visible, and a value it can read
   * is harder to forget than a rule it has to remember.
   */
  needsReview: true;
  assembledFrom: readonly NextActionDraftSource[];
}>;

/**
 * Cuts a quoted passage at a word boundary.
 *
 * A cut mid-word reads as a typo rather than as a truncation, so the ellipsis is
 * placed after the last whole word that fits. A single word longer than the bound
 * is cut where it must be: there is no boundary to prefer.
 */
function quoted(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length <= MAX_QUOTED_QUESTION) return normalized;
  const cut = normalized.slice(0, MAX_QUOTED_QUESTION);
  const boundary = cut.lastIndexOf(" ");
  return `${boundary <= 0 ? cut : cut.slice(0, boundary)}…`;
}

/**
 * Assembles the draft, objective first.
 *
 * The objective is what a second assistant cannot reconstruct from anything else,
 * so it is never the part that gets dropped: the question is added only while the
 * whole stays inside the bound, and is left out otherwise rather than cutting into
 * the objective to make room for it.
 */
export function draftNextAction(
  input: Readonly<{ objective: string; lastQuestion: string | null }>,
): NextActionDraft {
  const objective = input.objective.trim();
  if (objective.length === 0)
    throw new HandoffError(
      "A next-action draft needs the Work Item objective, which is the one part of it nobody else can restate.",
    );
  const sources: NextActionDraftSource[] = ["WORK_ITEM_OBJECTIVE"];
  let text = objective.slice(0, MAX_DRAFT);
  const question =
    input.lastQuestion === null ? "" : quoted(input.lastQuestion);
  if (question.length > 0 && text.length + question.length + 2 <= MAX_DRAFT) {
    text = `${text}\n\n${question}`;
    sources.push("LAST_QUESTION");
  }
  return Object.freeze({
    text,
    needsReview: true as const,
    assembledFrom: Object.freeze(sources),
  });
}
