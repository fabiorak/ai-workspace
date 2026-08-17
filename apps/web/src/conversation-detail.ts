/**
 * The conversation a row opens on, composed as pure functions over already-read
 * values.
 *
 * ADR-0035 makes a conversation the unit of the shell, so a row that cannot be
 * opened leaves the list as a catalogue of things one may only look at. Opening
 * one shows its moments in the order they happened, each with the source that
 * proves it: the stored record's position and hash travel with the moment, so
 * what a reader sees can always be traced back to what was imported.
 *
 * The text of a moment is read through the reader of ADR-0032, decision A, for
 * the same reason the list titles are: ingestion stores the canonical envelope,
 * and the envelope is not what anybody wrote.
 *
 * Nothing here summarises, rewrites or interprets. A moment reads as it was
 * stored, or it does not appear at all.
 */
import { readCanonicalPayload } from "@ai-workspace/historical-search";
import type { GeneralConversation } from "@ai-workspace/general-conversation";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import {
  titleFrom,
  type ConversationTitleSource,
} from "./conversation-list.ts";

/**
 * Bounded like every other local read. A transcript can hold thousands of
 * records, and a screen that renders all of them is a screen that stops
 * answering; the count of what was left out travels with the page.
 */
export const MOMENT_LIMIT = 200;

export type ConversationMoment = Readonly<{
  id: string;
  /**
   * The stored event type, kept as the domain records it. The interface turns it
   * into words: no constant in that vocabulary reaches an ordinary view.
   */
  type: string;
  occurredAt: string | null;
  /** What a person wrote or read, with the canonical envelope taken off. */
  text: string;
  /**
   * False when the payload was not the canonical envelope, so the interface can
   * say that this is the raw stored text rather than pretend it read it.
   */
  fromCanonicalPayload: boolean;
  /**
   * Where the moment came from, so its integrity is checkable. Null for a note a
   * person wrote here, which has no imported source and never claimed one; its
   * own content hash stands in its place.
   */
  sourcePosition: number | null;
  contentHash: string | null;
}>;

export type ConversationDetail = Readonly<{
  id: string;
  kind: "WORK_SESSION" | "NOTES";
  projectId: string | null;
  projectName: string | null;
  title: string | null;
  titleSource: ConversationTitleSource;
  model: string | null;
  agent: string | null;
  moments: readonly ConversationMoment[];
  /** How many moments exist before the bound, so the interface can say what it left out. */
  total: number;
  limit: number;
}>;

/**
 * Orders moments as they happened, keeping the stored sequence as the tiebreak.
 *
 * A record without a time keeps its place in the sequence instead of sinking to
 * one end: an adapter that could not read a timestamp did not thereby move the
 * moment somewhere else in the conversation.
 */
function inOrder<T extends { sequence: number }>(events: readonly T[]): T[] {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

function momentOf(
  event: ImportedSession["events"][number],
): ConversationMoment {
  const read =
    event.payload.kind === "INLINE_TEXT"
      ? readCanonicalPayload(event.payload.text)
      : null;
  return Object.freeze({
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt,
    /**
     * A payload held as an artifact is not inlined here: reading it is a separate,
     * explicit act, and quoting a file this screen never opened would be a claim
     * about bytes nobody checked.
     */
    text: read === null ? "" : read.text,
    fromCanonicalPayload: read?.parsed ?? false,
    sourcePosition: event.source.position,
    contentHash: event.source.recordHash,
  });
}

/** The moments of an imported session, bounded, with the model that ran it. */
export function sessionDetail(
  input: Readonly<{
    session: ImportedSession;
    projectName: string | null;
    limit?: number | undefined;
  }>,
): ConversationDetail {
  const limit = input.limit ?? MOMENT_LIMIT;
  const ordered = inOrder(input.session.events);
  const question = ordered.find(
    (event) =>
      event.type === "USER_MESSAGE" && event.payload.kind === "INLINE_TEXT",
  );
  const title =
    question === undefined || question.payload.kind !== "INLINE_TEXT"
      ? null
      : titleFrom(readCanonicalPayload(question.payload.text).text);
  return Object.freeze({
    id: input.session.id,
    kind: "WORK_SESSION" as const,
    projectId: input.session.projectId,
    projectName: input.projectName,
    title,
    titleSource: (title === null
      ? "UNTITLED"
      : "FIRST_QUESTION") as ConversationTitleSource,
    model: input.session.model,
    agent: input.session.agent,
    moments: Object.freeze(ordered.slice(0, limit).map(momentOf)),
    total: ordered.length,
    limit,
  });
}

/**
 * The moments of a note a person wrote here.
 *
 * Its title was given rather than quoted, and it carries no model or agent: no
 * model was involved, and naming one would be a lie of omission.
 */
export function noteDetail(
  input: Readonly<{
    conversation: GeneralConversation;
    limit?: number | undefined;
  }>,
): ConversationDetail {
  const limit = input.limit ?? MOMENT_LIMIT;
  const ordered = inOrder(input.conversation.events);
  return Object.freeze({
    id: input.conversation.id,
    kind: "NOTES" as const,
    projectId: null,
    projectName: null,
    title: input.conversation.title,
    titleSource: "GIVEN_TITLE" as ConversationTitleSource,
    model: null,
    agent: null,
    moments: Object.freeze(
      ordered.slice(0, limit).map((event) =>
        Object.freeze({
          id: event.id,
          type: event.type,
          occurredAt: event.occurredAt,
          text: event.content,
          fromCanonicalPayload: false,
          sourcePosition: null,
          contentHash: event.contentSha256,
        }),
      ),
    ),
    total: ordered.length,
    limit,
  });
}
