/**
 * Writing side of the restart point: the one deliberate confirmation of ADR-0037.
 *
 * Composing is continuous and writes nothing. This is the other half — a person has
 * read a summary, revised the draft of what to do next, and asked for it to be
 * fixed. Everything else about the packet comes from the same composition they read,
 * recomposed here rather than accepted from the browser: the work, the notes and the
 * evidence are read again from the stores, so a caller cannot name a Work Item, add a
 * note or cite a moment of its own choosing.
 *
 * What is fixed is what was read. The composition carries an opaque mark, and a
 * confirmation that hands back a mark which no longer matches is refused without
 * writing anything. That is not required by ADR-0034, which governs what leaves the
 * computer; it is required by ADR-0012, because a packet is never rewritten — so a
 * packet that cites what nobody looked at stays wrong for good.
 *
 * The write itself is passed in rather than reached for, exactly as the composing
 * path is: this module receives the one function that persists, and the reading
 * sources beside it hold no such function at all.
 */
import type {
  CreateHandoffInput,
  Handoff,
  TestObservation,
} from "@ai-workspace/handoff";

import type { RestartPointUnavailable } from "./restart-point.ts";
import {
  composeRestartPoint,
  type RestartPointSources,
} from "./restart-points.ts";

/** What the person stated about the tests, or null when they stated nothing. */
export type RestartPointTestInput = Readonly<{
  command: string;
  outcome: TestObservation["outcome"] | null;
  observedAt: string | null;
}>;

export type RestartPointFixInput = Readonly<{
  conversationId: string;
  projectId: string | null;
  /** The mark of the composition that was read, handed back untouched. */
  composition: string;
  /** The exact text that will be stored, as the person left it. */
  nextAction: string;
  /** Absent and null both mean the same thing here: nothing was stated. */
  test?: RestartPointTestInput | null;
}>;

/**
 * Why a confirmation was refused, when it was.
 *
 * Each of these is a state the person can leave: something arrived while they were
 * reading, the field they were asked to review is empty, or half a test observation
 * was written. None of them writes anything, and none of them is a failure of the
 * local workspace.
 */
export type RestartPointRefusal = Readonly<{
  fixed: false;
  reason: "COMPOSITION_CHANGED" | "EMPTY_NEXT_ACTION" | "INCOMPLETE_TEST";
}>;

export type RestartPointFixed = Readonly<{
  fixed: true;
  at: string;
  /** Whether this packet followed one that already existed. */
  followsOne: boolean;
}>;

export type RestartPointFixResult =
  RestartPointFixed | RestartPointRefusal | RestartPointUnavailable | null;

const refusal = (reason: RestartPointRefusal["reason"]): RestartPointRefusal =>
  Object.freeze({ fixed: false, reason });

/**
 * Turns what the person stated into an observation, or refuses half of one.
 *
 * A command with no outcome and an outcome with no command are both refused rather
 * than quietly dropped: they are something somebody wrote, and writing a packet that
 * silently ignores it would be worse than saying so. Stating nothing at all is not
 * an error — it records no run, which is exactly what it means.
 */
function observationOf(
  test: RestartPointTestInput | null | undefined,
): readonly TestObservation[] | "INCOMPLETE" {
  if (test === null || test === undefined) return [];
  const command = test.command.trim();
  if (command.length === 0 && test.outcome === null) return [];
  if (command.length === 0 || test.outcome === null) return "INCOMPLETE";
  return Object.freeze([
    Object.freeze({
      command,
      outcome: test.outcome,
      observedAt: test.observedAt,
    }),
  ]);
}

export async function fixRestartPoint(
  sources: RestartPointSources,
  write: (input: CreateHandoffInput) => Promise<Handoff>,
  input: RestartPointFixInput,
): Promise<RestartPointFixResult> {
  const nextAction = input.nextAction.trim();
  if (nextAction.length === 0) return refusal("EMPTY_NEXT_ACTION");
  const observations = observationOf(input.test);
  if (observations === "INCOMPLETE") return refusal("INCOMPLETE_TEST");
  const composed = await composeRestartPoint(sources, {
    conversationId: input.conversationId,
    projectId: input.projectId,
  });
  if (composed === null || "available" in composed) return composed;
  if (composed.point.composition !== input.composition)
    return refusal("COMPOSITION_CHANGED");
  /**
   * Immutability is ADR-0012's, not this module's: nothing existing is touched, and
   * a packet that already exists for this work becomes the predecessor of the new
   * one. The identifier is used here and never shown.
   */
  const packet = await write({
    ...composed.built,
    nextAction,
    ...(observations.length === 0 ? {} : { testState: observations }),
    ...(composed.predecessorId === null
      ? {}
      : { predecessorId: composed.predecessorId }),
  });
  return Object.freeze({
    fixed: true as const,
    at: packet.createdAt,
    followsOne: composed.predecessorId !== null,
  });
}
