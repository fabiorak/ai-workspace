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

import { momentTextOf, type ArtifactReader } from "./moment-text.ts";
import {
  KEPT_NOT_A_WORK_CONVERSATION,
  KEPT_NO_LINKED_WORK,
  LOOKED_AT_LIMIT,
  MOMENT_TEXT_LIMIT,
  MOMENT_TYPES_SHOWN,
  NOTE_LIMIT,
  NOTHING_IMPORTED_YET,
  NOTHING_KEPT_YET,
  NOT_A_WORK_CONVERSATION,
  NO_LINKED_WORK,
  keptRestartPointOf,
  restartPointOf,
  workForSession,
  type KeptRestartPoint,
  type KeptRestartPointMoment,
  type KeptRestartPointUnavailable,
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
  /**
   * Reads a stored artifact, for the moments ingestion did not inline. Optional: a
   * caller that cannot open artifacts still gets every inlined line, and a moment
   * held as a file says it carries no text rather than looking empty.
   */
  artifact?: ArtifactReader;
}>;

/**
 * Orders moments as they happened, keeping the stored sequence as the tiebreak,
 * exactly as the conversation above them is ordered. A record whose timestamp an
 * adapter could not read keeps its place instead of sinking to one end.
 */
export function inOrder(
  events: readonly ImportedSession["events"][number][],
): readonly ImportedSession["events"][number][] {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

/**
 * The moments the summary shows, and therefore the evidence anything built from this
 * conversation cites.
 *
 * One function because it is one rule: what a record cites is what somebody read. The
 * summary, the work a conversation declares, and every packet built afterwards all
 * ask here, so the three can never disagree about which moments were in front of the
 * person.
 */
export function momentsShown(
  ordered: readonly ImportedSession["events"][number][],
): readonly ImportedSession["events"][number][] {
  return ordered
    .filter((event) => MOMENT_TYPES_SHOWN.includes(event.type))
    .slice(-LOOKED_AT_LIMIT);
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
async function saidAboutTestsIn(
  ordered: readonly ImportedSession["events"][number][],
  readArtifact: ArtifactReader | null,
): Promise<RestartPointMoment | null> {
  for (let index = ordered.length - 1; index >= 0; index--) {
    const event = ordered[index]!;
    if (event.type === "TEST_RESULT") return momentOf(event, readArtifact);
  }
  return null;
}

async function momentOf(
  event: ImportedSession["events"][number],
  readArtifact: ArtifactReader | null,
): Promise<RestartPointMoment> {
  const read = await momentTextOf(event, MOMENT_TEXT_LIMIT, readArtifact);
  return Object.freeze({
    type: event.type,
    occurredAt: event.occurredAt,
    text: read.text,
    fromCanonicalPayload: read.fromCanonicalPayload,
    fromArtifact: read.fromArtifact,
  });
}

/**
 * What this work has already fixed, read from the packets themselves.
 *
 * The date says which summary a new one would follow; the identity stays out of the
 * view, as every other identity does. The run recorded in the most recent packet
 * travels whole: the command so the field can be offered filled, and the outcome so
 * the tests section can quote what was stated and when.
 *
 * Quoting it is not carrying it over. What the interface may never do is put that
 * outcome back in the field somebody is about to confirm, because a value already
 * chosen gets confirmed by inertia and would become an assertion about today that
 * nobody made. Beside its own date, in a line that says where it came from, it is
 * the answer to the first question a reader asks.
 */
function fixedOf(packets: readonly Handoff[]): RestartPoint["fixed"] {
  const latest = packets[0];
  if (latest === undefined) return null;
  const recorded = latest.sections.testState.value[0];
  return Object.freeze({
    count: packets.length,
    at: latest.createdAt,
    lastRecordedTest:
      recorded === undefined
        ? null
        : Object.freeze({
            command: recorded.command,
            outcome: recorded.outcome,
            observedAt: recorded.observedAt,
          }),
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
  const recent = momentsShown(ordered);
  if (recent.length === 0) return NOTHING_IMPORTED_YET;
  const notes = await sources.notes(projectId, NOTES_READ);
  const selected = notes.slice(0, NOTE_LIMIT);
  /**
   * The two reasons a moment is not here are counted apart: the mechanics of
   * execution were not this section's to show, and earlier talk did not fit.
   */
  const operations = ordered.filter(
    (event) => !MOMENT_TYPES_SHOWN.includes(event.type),
  ).length;
  const omissions: RestartPointOmission[] = [
    Object.freeze({
      kind: "NOTES" as const,
      count: notes.length - selected.length,
    }),
    Object.freeze({
      kind: "MOMENTS" as const,
      count: ordered.length - operations - recent.length,
    }),
    Object.freeze({ kind: "OPERATIONS" as const, count: operations }),
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
  const lookedAt = await Promise.all(
    recent.map((event) => momentOf(event, sources.artifact ?? null)),
  );
  return Object.freeze({
    point: restartPointOf({
      handoff,
      conversationId: session.id,
      workState: work.status,
      lookedAt,
      saidAboutTests: await saidAboutTestsIn(ordered, sources.artifact ?? null),
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

/**
 * Reads the moments a kept packet cites, from the sessions of its project.
 *
 * The packet stores the identity of each cited event and nothing of what it said,
 * so the line is read again rather than kept twice: no second copy of the text, and
 * no index. An event that cannot be read again keeps its place in the list and is
 * marked unreadable — the packet is permanent, so a citation it makes is part of
 * the record even when what it points at has gone.
 */
async function citedMoments(
  handoff: Handoff,
  sessions: readonly ImportedSession[],
  readArtifact: ArtifactReader | null,
): Promise<
  Readonly<{
    moments: readonly KeptRestartPointMoment[];
    omitted: number;
  }>
> {
  const cited = handoff.sections.sourceReferences.value;
  const shown = cited.slice(0, LOOKED_AT_LIMIT);
  const found = shown.map((reference) =>
    Object.freeze({
      reference,
      event: sessions
        .find((session) => session.id === reference.sessionId)
        ?.events.find((candidate) => candidate.id === reference.eventId),
    }),
  );
  /**
   * Back into the order they happened in.
   *
   * The stored order is not it: the persisted form holds the citations as sorted
   * identifiers, which is what lets it share one source table, so what comes back is
   * alphabetical. Under "where you were" that reads as five unrelated moments, and
   * the composed summary right above shows the same kind of list in sequence. The
   * stored sequence is the ordering rule the rest of the product already uses, so a
   * moment whose timestamp no adapter could read keeps its place rather than sinking
   * to one end.
   *
   * A citation that can no longer be read has no sequence to sort by. It goes last
   * and says it is unreadable, and it is the only line with no time beside it: what
   * cannot be read cannot be placed, and guessing a position would be inventing one.
   */
  const readable = await Promise.all(
    found
      .filter((entry) => entry.event !== undefined)
      .sort((left, right) => left.event!.sequence - right.event!.sequence)
      .map(async (entry) =>
        Object.freeze({
          ...(await momentOf(entry.event!, readArtifact)),
          readable: true,
        }),
      ),
  );
  const unreadable = found
    .filter((entry) => entry.event === undefined)
    .map((entry) =>
      Object.freeze({
        type: entry.reference.eventType,
        occurredAt: null,
        text: "",
        fromCanonicalPayload: false,
        readable: false,
      }),
    );
  return Object.freeze({
    moments: Object.freeze([...readable, ...unreadable]),
    omitted: cited.length - shown.length,
  });
}

/**
 * The most recent summary kept for the work this conversation belongs to.
 *
 * It reads the same relationships the composed summary reads — the session, then the
 * Work Item that declares it — so a photograph and the summary above it can never be
 * about two different pieces of work. Null means the conversation itself is gone;
 * everything else says what is missing, including a work that has kept nothing yet.
 *
 * Nothing here composes, previews or writes: the packet already exists, and this
 * reads it.
 */
export async function readKeptRestartPoint(
  sources: RestartPointSources,
  query: Readonly<{ conversationId: string; projectId: string | null }>,
): Promise<KeptRestartPoint | KeptRestartPointUnavailable | null> {
  if (query.projectId === null) return KEPT_NOT_A_WORK_CONVERSATION;
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
  if (work === null) return KEPT_NO_LINKED_WORK;
  const latest = (await sources.fixed(projectId, work.id))[0];
  if (latest === undefined) return NOTHING_KEPT_YET;
  const cited = await citedMoments(latest, sessions, sources.artifact ?? null);
  return keptRestartPointOf({
    handoff: latest,
    lookedAt: cited.moments,
    omissions: [
      Object.freeze({ kind: "MOMENTS" as const, count: cited.omitted }),
    ],
  });
}
