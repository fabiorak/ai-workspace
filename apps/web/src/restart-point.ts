/**
 * The restart point that sits at the end of a work conversation, composed as pure
 * functions over already-read values.
 *
 * ADR-0037 makes composition continuous and silent: it goes through the
 * non-persisting preview path, so the packet a person looks at here is the packet
 * that would be fixed, and looking at it writes nothing. Fixing it is a separate,
 * deliberate confirmation and does not exist yet.
 *
 * What the view carries is what somebody resuming the work needs to read: what the
 * work is, what was decided, what is already known to have failed, where they were
 * looking, what the tests were last recorded as saying, and how the repository
 * stands. What it deliberately does not carry is
 * every identifier, digest, byte count and section-metadata constant the packet
 * holds — those are the technical surface, and a reader who wants them has the
 * handoff screens and the command line.
 *
 * Nothing here summarises or rewrites: each line is a stored value moved across.
 */
import type { WorkItem } from "@ai-workspace/core";
import type {
  Handoff,
  MemorySnapshot,
  NextActionDraft,
  TestObservation,
} from "@ai-workspace/handoff";

/**
 * How many recent moments say where the reader was. Five is enough to recognise
 * the thread again and short enough to read in one glance; the whole conversation
 * is right above, so this is a pointer rather than a second copy of it.
 */
export const LOOKED_AT_LIMIT = 5;

/**
 * How many stored notes travel with the point. It is the bound `Handoffs` already
 * applies to a memory selection, kept here so the count of what was left out can be
 * stated before the packet refuses to hold it.
 */
export const NOTE_LIMIT = 20;

export type RestartPointNote = Readonly<{
  content: string;
  /**
   * Whether the person confirmed this note against evidence. Kept as the domain
   * records it; the interface turns it into a word, because a reader deciding
   * whether to trust a line needs to know that much.
   */
  verification: MemorySnapshot["verification"];
}>;

/**
 * How much of a moment is quoted. A line is enough to recognise what was being
 * said; the conversation right above keeps the whole of it, so a longer quote here
 * would be a second copy rather than a reminder.
 */
export const MOMENT_TEXT_LIMIT = 160;

/**
 * How many changed files are named. A reader looking for where they were needs the
 * names, not an inventory: past this bound the rest is counted, like everything
 * else that does not fit.
 */
export const CHANGED_PATH_LIMIT = 5;

/**
 * How many recorded test runs are shown. The packet will hold fifty, which is an
 * inventory rather than a state; past this bound the rest is counted, like
 * everything else that does not fit.
 */
export const TEST_LIMIT = 5;

/**
 * One recorded test run, as the packet stored it.
 *
 * Nothing here is observed by this view, and nothing is inferred: a run nobody
 * recorded stays absent, and the absence is stated rather than left to be read as a
 * pass. A clean repository does not mean the tests were run, and a note that
 * mentions them is a note, not an outcome.
 */
export type RestartPointTest = Readonly<{
  command: string;
  outcome: TestObservation["outcome"];
  /** When the run was observed, or null when the record does not say. */
  observedAt: string | null;
}>;

export type RestartPointMoment = Readonly<{
  /** The stored event type. The interface says who spoke; no constant reaches a reader. */
  type: string;
  occurredAt: string | null;
  /**
   * One line of what was said, the canonical envelope taken off and the length
   * bounded. A speaker and a time say when the reader was there; this says what
   * they were in the middle of, which is what somebody resuming is looking for.
   */
  text: string;
  /**
   * False when the payload was not the canonical envelope, so the interface can say
   * the line is the raw stored text instead of pretending it read it. Also false
   * for a payload held as an artifact, which this view never opens.
   */
  fromCanonicalPayload: boolean;
}>;

/** What did not fit, counted rather than dropped in silence. */
export type RestartPointOmission = Readonly<{
  kind: "NOTES" | "MOMENTS" | "CHANGED_FILES" | "TESTS";
  count: number;
}>;

export type RestartPoint = Readonly<{
  available: true;
  conversationId: string;
  /** The objective of the Work Item the open conversation belongs to. */
  doing: string;
  workState: WorkItem["status"];
  decisions: readonly RestartPointNote[];
  constraints: readonly RestartPointNote[];
  failures: readonly RestartPointNote[];
  lookedAt: readonly RestartPointMoment[];
  /**
   * What the packet records about the tests, bounded by `TEST_LIMIT`. An empty list
   * means nothing was recorded, and the interface says so in a sentence: somebody
   * deciding whether this is safe to build on must not read silence as a pass.
   */
  tests: readonly RestartPointTest[];
  /**
   * The most recent moment of the conversation that reported a test outcome, or
   * null when none did.
   *
   * It is quoted, never interpreted. Every imported event is `UNTRUSTED` by
   * construction — this is what an assistant wrote in its own record, not what
   * somebody observed — so no outcome is derived from it and it never fills the
   * recorded runs above. It is here because the summary shows the last five moments
   * and an outcome further back would otherwise be nowhere at all, while it is the
   * first thing a reader wants to know.
   */
  saidAboutTests: RestartPointMoment | null;
  /**
   * The draft of what to do next, prefilled and always marked as needing review.
   *
   * At the first step this was assembled and deliberately withheld, because there
   * was nowhere to confirm it and a draft on screen with no confirmation reads as a
   * decision somebody already took. Now there is a place to review it, so it is
   * shown — still assembled out of the person's own words, never written by a
   * model, and carrying what it was put together from so the interface can say
   * where each part came from.
   */
  nextAction: NextActionDraft;
  /**
   * What this work has already fixed, or null when nothing has been.
   *
   * It carries the date of the most recent packet rather than its identity, because
   * a reader is told which summary a new one would follow and never asked to handle
   * an identifier. The command of its recorded run comes along so the field can be
   * offered already filled: a command is text the person wrote, and offering it back
   * repeats their words. No outcome is ever carried over — that is the part that
   * asserts something, and it is stated again every time or not at all.
   */
  fixed: Readonly<{
    count: number;
    at: string;
    testCommand: string | null;
  }> | null;
  /**
   * The repository as the bounded capture found it. The commit is left out on
   * purpose: it is a fingerprint, and this view speaks in branches and changes.
   */
  repository: Readonly<{
    branch: string | null;
    hasUnsavedChanges: boolean;
    changedFiles: number;
    /**
     * Which files they are, bounded by `CHANGED_PATH_LIMIT`. The count says how
     * much is unsaved; the names say where the work was left, and a path is
     * ordinary reading rather than a fingerprint.
     */
    changedPaths: readonly string[];
  }>;
  composedAt: string;
  omissions: readonly RestartPointOmission[];
  effect: "COMPOSED_LOCALLY_NOT_SAVED_AND_NOT_SENT";
}>;

/**
 * Why there is no restart point, when there is none.
 *
 * A conversation with no project is a note, and notes carry no work to resume. A
 * work session that no Work Item points at has no objective to state, and picking
 * one because it happens to be the only active candidate is exactly the inference
 * ADR-0010 forbids: the reader is told what is missing instead.
 */
export type RestartPointUnavailable = Readonly<{
  available: false;
  reason: "NOT_A_WORK_CONVERSATION" | "NO_LINKED_WORK" | "NOTHING_IMPORTED_YET";
}>;

export const NOT_A_WORK_CONVERSATION: RestartPointUnavailable = Object.freeze({
  available: false,
  reason: "NOT_A_WORK_CONVERSATION",
});
export const NO_LINKED_WORK: RestartPointUnavailable = Object.freeze({
  available: false,
  reason: "NO_LINKED_WORK",
});
/**
 * A session document with no moments in it. Composing would have to name a
 * canonical event, and there is none to name, so nothing is composed rather than a
 * point that cites evidence nobody imported.
 */
export const NOTHING_IMPORTED_YET: RestartPointUnavailable = Object.freeze({
  available: false,
  reason: "NOTHING_IMPORTED_YET",
});

/**
 * The Work Item the open conversation declares.
 *
 * The link is a stored one: `WorkItemSource` records the session an item came
 * from, so this reads a relationship rather than guessing at one. When several
 * items point at the same session the most recently updated one wins, mirroring
 * the rule the conversation list already shows a state with — one conversation
 * resumes into one objective, and the stale one would misinform.
 */
export function workForSession(
  items: readonly WorkItem[],
  sessionId: string,
): WorkItem | null {
  let chosen: WorkItem | null = null;
  for (const item of items)
    if (
      item.sources.some((source) => source.sessionId === sessionId) &&
      (chosen === null || chosen.updatedAt < item.updatedAt)
    )
      chosen = item;
  return chosen;
}

function noteOf(snapshot: MemorySnapshot): RestartPointNote {
  return Object.freeze({
    content: snapshot.content,
    verification: snapshot.verification,
  });
}

function notesOfType(
  snapshots: readonly MemorySnapshot[],
  type: MemorySnapshot["type"],
): readonly RestartPointNote[] {
  return Object.freeze(
    snapshots.filter((snapshot) => snapshot.type === type).map(noteOf),
  );
}

/**
 * Moves a recorded run across field by field, so a section that grows later cannot
 * carry something into the ordinary view without somebody deciding it belongs there.
 */
function testOf(observation: TestObservation): RestartPointTest {
  return Object.freeze({
    command: observation.command,
    outcome: observation.outcome,
    observedAt: observation.observedAt,
  });
}

/**
 * Turns the composed packet into what a reader sees.
 *
 * The packet is the source of every claim here, including the repository state,
 * so the view cannot disagree with the point that would be fixed. The moments and
 * the counts of what was left out arrive beside it, because they describe the
 * reading that produced the packet rather than the packet itself.
 */
export function restartPointOf(
  input: Readonly<{
    handoff: Handoff;
    conversationId: string;
    workState: WorkItem["status"];
    lookedAt: readonly RestartPointMoment[];
    saidAboutTests: RestartPointMoment | null;
    nextAction: NextActionDraft;
    fixed: RestartPoint["fixed"];
    omissions: readonly RestartPointOmission[];
  }>,
): RestartPoint {
  const selected = input.handoff.sections.selectedMemory.value;
  const changed = input.handoff.sections.repository.value.changedPaths;
  const named = changed.slice(0, CHANGED_PATH_LIMIT);
  const recorded = input.handoff.sections.testState.value;
  const runs = recorded.slice(0, TEST_LIMIT);
  /**
   * The files and the test runs that did not fit are counted here rather than by
   * the caller: the packet is the only thing that knows how many there were.
   */
  const omissions: readonly RestartPointOmission[] = [
    ...input.omissions,
    Object.freeze({
      kind: "CHANGED_FILES" as const,
      count: changed.length - named.length,
    }),
    Object.freeze({
      kind: "TESTS" as const,
      count: recorded.length - runs.length,
    }),
  ];
  return Object.freeze({
    available: true as const,
    conversationId: input.conversationId,
    doing: input.handoff.sections.objective.value,
    workState: input.workState,
    decisions: notesOfType(selected, "DECISION"),
    constraints: notesOfType(selected, "CONSTRAINT"),
    failures: Object.freeze(
      input.handoff.sections.knownFailures.value.map(noteOf),
    ),
    lookedAt: Object.freeze([...input.lookedAt]),
    tests: Object.freeze(runs.map(testOf)),
    saidAboutTests: input.saidAboutTests,
    nextAction: input.nextAction,
    fixed: input.fixed,
    repository: Object.freeze({
      branch: input.handoff.sections.repository.value.branch,
      hasUnsavedChanges: input.handoff.sections.repository.value.dirty,
      changedFiles: changed.length,
      changedPaths: Object.freeze([...named]),
    }),
    composedAt: input.handoff.createdAt,
    omissions: Object.freeze(
      omissions.filter((omission) => omission.count > 0),
    ),
    effect: "COMPOSED_LOCALLY_NOT_SAVED_AND_NOT_SENT" as const,
  });
}
