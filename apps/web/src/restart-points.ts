/**
 * Reading side of the restart point.
 *
 * ADR-0037 decides that composition is continuous and writes nothing, and that it
 * goes through the preview path rather than a second construction of its own: the
 * packet a reader sees at the end of a conversation is built, validated and
 * repository-captured exactly like the one a confirmation would fix, and then not
 * stored. Every value below comes from an authoritative store; no index is built
 * and no snapshot is kept, so a point cannot drift from what the stores say.
 *
 * The Work Item is the one the open conversation declares. That is the person's own
 * act, not a guess, which is what keeps this clear of the inference ADR-0010
 * forbids.
 */
import { createHash } from "node:crypto";

import { readCanonicalPayload } from "@ai-workspace/historical-search";
import type { MemoryItem } from "@ai-workspace/active-memory";
import type { WorkItem } from "@ai-workspace/core";
import {
  draftNextAction,
  type CreateHandoffInput,
  type Handoff,
} from "@ai-workspace/handoff";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import {
  LOOKED_AT_LIMIT,
  MOMENT_TEXT_LIMIT,
  NOTE_LIMIT,
  NOTHING_IMPORTED_YET,
  NOT_A_WORK_CONVERSATION,
  NO_LINKED_WORK,
  restartPointOf,
  workForSession,
  type RestartPoint,
  type RestartPointMoment,
  type RestartPointOmission,
  type RestartPointUnavailable,
} from "./restart-point.ts";

/**
 * How many active notes are read before the selection is bounded. It is the
 * largest page the memory store will answer with, so the count of what was left
 * out is a real count up to that page rather than a guess.
 */
const NOTES_READ = 100;

export type RestartPointSources = Readonly<{
  sessions: Readonly<{
    list(projectId: string): Promise<readonly ImportedSession[]>;
  }>;
  workItems: Readonly<{
    list(projectId: string): Promise<readonly WorkItem[]>;
  }>;
  /** The project's ACTIVE notes, most recent first, bounded by the caller. */
  notes(projectId: string, limit: number): Promise<readonly MemoryItem[]>;
  /**
   * The non-persisting path of ADR-0037. It is passed in rather than reached for,
   * so this module cannot accidentally hold the one that writes.
   */
  compose(input: CreateHandoffInput): Promise<Handoff>;
  /**
   * The packets already fixed for this work, most recent first, as `Handoffs.list`
   * orders them. A read: nothing here creates, replaces or supersedes one.
   */
  fixed(projectId: string, workItemId: string): Promise<readonly Handoff[]>;
}>;

/**
 * Orders moments as they happened, keeping the stored sequence as the tiebreak,
 * exactly as the conversation above them is ordered. A record whose timestamp an
 * adapter could not read keeps its place instead of sinking to one end.
 */
function inOrder(
  events: readonly ImportedSession["events"][number][],
): readonly ImportedSession["events"][number][] {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

/** The last thing the person themselves asked, read through the canonical reader. */
function lastQuestionOf(
  ordered: readonly ImportedSession["events"][number][],
): string | null {
  for (let index = ordered.length - 1; index >= 0; index--) {
    const event = ordered[index]!;
    if (event.type !== "USER_MESSAGE" || event.payload.kind !== "INLINE_TEXT")
      continue;
    const text = readCanonicalPayload(event.payload.text).text.trim();
    if (text.length > 0) return text;
  }
  return null;
}

/**
 * One readable line of a stored moment: line breaks collapsed, and a marked tail
 * when it did not fit. Nothing is rewritten or summarised — the text is the stored
 * text, cut where the bound falls.
 */
function oneLine(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= MOMENT_TEXT_LIMIT
    ? collapsed
    : `${collapsed.slice(0, MOMENT_TEXT_LIMIT - 1)}…`;
}

/**
 * The most recent moment that reported a test outcome, wherever it sits.
 *
 * It is searched over the whole conversation rather than over the five moments
 * shown, which is the entire reason it exists: an outcome twenty moments back is
 * the answer to the first question a reader asks and today appears nowhere. It is
 * quoted through the same reader as every other moment and never interpreted — the
 * event is `UNTRUSTED`, so what it says is what an assistant wrote, not an
 * observation. A moment already among the five shown is still returned here: the
 * tests section has to answer on its own, because this summary is meant to be
 * readable away from the conversation it sits under.
 */
function saidAboutTestsIn(
  ordered: readonly ImportedSession["events"][number][],
): RestartPointMoment | null {
  for (let index = ordered.length - 1; index >= 0; index--) {
    const event = ordered[index]!;
    if (event.type === "TEST_RESULT") return momentOf(event);
  }
  return null;
}

function momentOf(
  event: ImportedSession["events"][number],
): RestartPointMoment {
  /**
   * A payload held as an artifact is not inlined, exactly as the conversation above
   * does not inline it: quoting a file this view never opened would be a claim
   * about bytes nobody checked.
   */
  const read =
    event.payload.kind === "INLINE_TEXT"
      ? readCanonicalPayload(event.payload.text)
      : null;
  return Object.freeze({
    type: event.type,
    occurredAt: event.occurredAt,
    text: read === null ? "" : oneLine(read.text),
    fromCanonicalPayload: read?.parsed ?? false,
  });
}

/**
 * What this work has already fixed, read from the packets themselves.
 *
 * The date says which summary a new one would follow; the identity stays out of the
 * view, as every other identity does. The command of the most recent recorded run
 * travels so the field can be offered filled — that is the person's own text handed
 * back — while the outcome never does: it is the part that asserts something, and an
 * assertion carried over from a week ago would be somebody else's claim about today.
 */
function fixedOf(packets: readonly Handoff[]): RestartPoint["fixed"] {
  const latest = packets[0];
  if (latest === undefined) return null;
  return Object.freeze({
    count: packets.length,
    at: latest.createdAt,
    testCommand: latest.sections.testState.value[0]?.command ?? null,
  });
}

/**
 * Composes the restart point of one conversation, or says why there is none.
 *
 * Null means the conversation itself is gone, which the interface answers
 * differently from a conversation that is there and carries no work.
 *
 * The recent moments do double duty: they are what the reader sees under "where
 * you were", and they are the canonical evidence the packet cites. Naming the same
 * few moments for both is what keeps the citation honest — the point refers to what
 * it showed. Each one is revalidated by the canonical reader inside the preview
 * path, which is why this names five rather than the twenty the packet would allow.
 *
 * The next-action draft is assembled because the packet cannot be built without
 * one, and is now returned as well: there is a place to review it. It stays what it
 * was — the person's own words, the objective and the last thing they asked, quoted
 * rather than paraphrased, with no model anywhere near it — and it travels with the
 * mark that says it has to be reviewed.
 *
 * No test observation is passed, so the packet records none and the point says so,
 * beside the quoted moment that reported one: an outcome is something a person
 * states, and
 * composing asks nothing and writes nothing, so there is nowhere yet to state one.
 * The alternatives were both refused — running anything is out of scope, and
 * reading an outcome off a clean repository or a note that mentions the tests is
 * the inference ADR-0010 forbids. Asking for it belongs to the deliberate
 * confirmation, where the person already reviews the exact text that gets stored.
 */
/**
 * Everything one composition produced: what a reader sees, and what would be
 * written if they confirmed it.
 *
 * The two travel together because they must not be composed twice. Reading returns
 * the point; confirming needs the same composition again, plus the memory and
 * evidence identifiers the packet was assembled from, which the ordinary view never
 * carries. A second construction would be a second read of moving stores, and the
 * packet that got written could then cite something nobody looked at.
 */
export type RestartPointComposition = Readonly<{
  point: RestartPoint;
  built: CreateHandoffInput;
  workItemId: string;
  fixedCount: number;
  predecessorId: string | null;
}>;

/**
 * The mark of one composition, produced here and never by the caller.
 *
 * It covers exactly what a confirmation would write — every section of the packet,
 * including the evidence each one cites — plus the lines of the moments the reader
 * was shown. The packet's own identity and creation time are left out, because they
 * are new on every composition and would make every mark differ from the last.
 *
 * It is a value the browser hands back untouched, so that a confirmation can be
 * refused when it no longer describes what somebody read. It is never displayed.
 */
function markOf(
  handoff: Handoff,
  shown: readonly RestartPointMoment[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ sections: handoff.sections, shown }), "utf8")
    .digest("hex");
}

export async function composeRestartPoint(
  sources: RestartPointSources,
  query: Readonly<{ conversationId: string; projectId: string | null }>,
): Promise<RestartPointComposition | RestartPointUnavailable | null> {
  if (query.projectId === null) return NOT_A_WORK_CONVERSATION;
  const projectId = query.projectId;
  const sessions = await sources.sessions.list(projectId);
  const session = sessions.find(
    (candidate) => candidate.id === query.conversationId,
  );
  if (session === undefined) return null;
  const work = workForSession(
    await sources.workItems.list(projectId),
    session.id,
  );
  if (work === null) return NO_LINKED_WORK;
  const ordered = inOrder(session.events);
  const recent = ordered.slice(-LOOKED_AT_LIMIT);
  if (recent.length === 0) return NOTHING_IMPORTED_YET;
  const notes = await sources.notes(projectId, NOTES_READ);
  const selected = notes.slice(0, NOTE_LIMIT);
  const omissions: RestartPointOmission[] = [
    Object.freeze({
      kind: "NOTES" as const,
      count: notes.length - selected.length,
    }),
    Object.freeze({
      kind: "MOMENTS" as const,
      count: ordered.length - recent.length,
    }),
  ];
  const draft = draftNextAction({
    objective: work.objective,
    lastQuestion: lastQuestionOf(ordered),
  });
  const built: CreateHandoffInput = {
    projectId,
    workItemId: work.id,
    memoryIds: selected.map((note) => note.id),
    nextAction: draft.text,
    sourceEventIds: recent.map((event) => event.id),
  };
  const handoff = await sources.compose(built);
  const already = await sources.fixed(projectId, work.id);
  const lookedAt = recent.map(momentOf);
  return Object.freeze({
    point: restartPointOf({
      handoff,
      conversationId: session.id,
      workState: work.status,
      lookedAt,
      saidAboutTests: saidAboutTestsIn(ordered),
      nextAction: draft,
      fixed: fixedOf(already),
      composition: markOf(handoff, lookedAt),
      omissions,
    }),
    built,
    workItemId: work.id,
    fixedCount: already.length,
    predecessorId: already[0]?.id ?? null,
  });
}

export async function readRestartPoint(
  sources: RestartPointSources,
  query: Readonly<{ conversationId: string; projectId: string | null }>,
): Promise<RestartPoint | RestartPointUnavailable | null> {
  const composed = await composeRestartPoint(sources, query);
  return composed === null || "available" in composed
    ? composed
    : composed.point;
}
