/**
 * The left-hand list: what a person has worked on, most recent first.
 *
 * ADR-0035 makes a conversation the unit of work, so this module turns stored
 * material into rows without asking anyone to create anything. Two kinds arrive
 * here: work sessions imported from transcripts, which exist on their own, and
 * project-free notes, which a person wrote. A linked Work Item contributes its
 * state as an attribute of the row, never as a separate concept.
 *
 * Everything here is a pure function over already-read values. That is
 * deliberate: the list is the first thing a reader sees, and its ordering and
 * titling rules deserve tests that do not need a filesystem, an index, or HTTP.
 */
import type { ImportedSession } from "@ai-workspace/session-ingestion";
import type { GeneralConversation } from "@ai-workspace/general-conversation";

/** How the title was obtained, so a reader is never told a summary is a quotation. */
export type ConversationTitleSource =
  "FIRST_QUESTION" | "GIVEN_TITLE" | "UNTITLED";

export type ConversationRow = Readonly<{
  id: string;
  kind: "WORK_SESSION" | "NOTES";
  projectId: string | null;
  projectName: string | null;
  title: string | null;
  titleSource: ConversationTitleSource;
  /** The most recent moment, which is what resuming needs. Null when no moment carries a time. */
  lastMomentAt: string | null;
  momentCount: number;
  /** Present only when a Work Item is linked; the lifecycle itself is unchanged. */
  workState: string | null;
  /**
   * Which model ran that session, exactly as ingestion recorded it, and which
   * agent produced it. Both are null for notes a person wrote themselves, because
   * no model was involved and saying otherwise would be a lie of omission.
   */
  model: string | null;
  agent: string | null;
}>;

export const TITLE_BUDGET = 72;

/**
 * Shortens a first question to a title on a word boundary.
 *
 * A title is a quotation, so it may lose its tail but never gain a word. Text is
 * collapsed to single spaces because a transcript question can carry newlines
 * that would otherwise break the row.
 */
export function titleFrom(text: string): string | null {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return null;
  if (collapsed.length <= TITLE_BUDGET) return collapsed;
  const cut = collapsed.slice(0, TITLE_BUDGET);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > TITLE_BUDGET / 2 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/**
 * The latest time in a group of moments.
 *
 * Imported events may carry no time at all, and a session of untimed moments is
 * not an error: it sorts last and says so by reporting null rather than a
 * fabricated timestamp.
 */
function latest(times: readonly (string | null)[]): string | null {
  return times.reduce<string | null>(
    (newest, value) =>
      value === null
        ? newest
        : newest === null || value > newest
          ? value
          : newest,
    null,
  );
}

/**
 * Turns imported session documents into rows, one per session.
 *
 * The title comes from the first thing the person wrote in that session, in
 * sequence order, and only when the payload is inline text: an artifact-backed
 * payload is not read here, because reading it would mean I/O in a pure function
 * and a title is not worth that. Such a session stays untitled and the caller
 * names it by its date.
 *
 * Model and agent are copied through verbatim. A model name is a proper name, so
 * shortening or prettifying it would mean showing something the session did not
 * record; when ingestion found none, the row says none rather than guessing from
 * the agent.
 */
export function sessionRows(
  input: Readonly<{
    projectName: string;
    sessions: readonly ImportedSession[];
    workStateBySession?: Readonly<Record<string, string>>;
  }>,
): readonly ConversationRow[] {
  return Object.freeze(
    input.sessions.map((session) => {
      const ordered = [...session.events].sort(
        (a, b) => a.sequence - b.sequence,
      );
      const question = ordered.find(
        (event) =>
          event.type === "USER_MESSAGE" && event.payload.kind === "INLINE_TEXT",
      );
      const title =
        question === undefined || question.payload.kind !== "INLINE_TEXT"
          ? null
          : titleFrom(question.payload.text);
      return Object.freeze({
        id: session.id,
        kind: "WORK_SESSION" as const,
        projectId: session.projectId,
        projectName: input.projectName,
        title,
        titleSource: (title === null
          ? "UNTITLED"
          : "FIRST_QUESTION") as ConversationTitleSource,
        lastMomentAt: latest([
          ...ordered.map((event) => event.occurredAt),
          session.startedAt,
        ]),
        momentCount: ordered.length,
        workState: input.workStateBySession?.[session.id] ?? null,
        model: session.model,
        agent: session.agent,
      });
    }),
  );
}

/**
 * Turns project-free notes into rows.
 *
 * A note carries a title its author wrote, so it is used as given. An empty
 * conversation keeps its title and reports zero moments instead of disappearing:
 * something a person created should not vanish from the list that represents
 * their work.
 */
export function noteRows(
  conversations: readonly GeneralConversation[],
): readonly ConversationRow[] {
  return Object.freeze(
    conversations.map((conversation) => {
      const title = titleFrom(conversation.title);
      return Object.freeze({
        id: conversation.id,
        kind: "NOTES" as const,
        projectId: null,
        projectName: null,
        title,
        titleSource: (title === null
          ? "UNTITLED"
          : "GIVEN_TITLE") as ConversationTitleSource,
        lastMomentAt: latest([
          ...conversation.events.map((event) => event.occurredAt),
          conversation.createdAt,
        ]),
        momentCount: conversation.events.length,
        workState: null,
        model: null,
        agent: null,
      });
    }),
  );
}

/**
 * Orders every row by the latest moment, newest first.
 *
 * Rows without any time sort last, in a stable order by identity, so a list read
 * twice reads the same way. Ties on time break the same way for the same reason:
 * an ordering that shuffles is an ordering a person cannot trust.
 */
export function orderConversations(
  rows: readonly ConversationRow[],
): readonly ConversationRow[] {
  return Object.freeze(
    [...rows].sort((a, b) => {
      if (a.lastMomentAt === b.lastMomentAt) return a.id < b.id ? -1 : 1;
      if (a.lastMomentAt === null) return 1;
      if (b.lastMomentAt === null) return -1;
      return a.lastMomentAt < b.lastMomentAt ? 1 : -1;
    }),
  );
}

export type ConversationGroupKey =
  "TODAY" | "YESTERDAY" | "EARLIER" | "UNDATED";

export type ConversationGroup = Readonly<{
  key: ConversationGroupKey;
  rows: readonly ConversationRow[];
}>;

/**
 * Splits the ordered list into the time groups the sidebar shows.
 *
 * `now` is a parameter because a grouping that reads the clock cannot be tested
 * twice with the same result. Comparison uses local calendar days, since "today"
 * to a reader means the day they are living, not a UTC interval.
 */
export function groupConversations(
  rows: readonly ConversationRow[],
  now: Date,
): readonly ConversationGroup[] {
  const day = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const today = day(now);
  const oneDay = 24 * 60 * 60 * 1000;
  const keyOf = (row: ConversationRow): ConversationGroupKey => {
    if (row.lastMomentAt === null) return "UNDATED";
    const moment = new Date(row.lastMomentAt);
    if (Number.isNaN(moment.getTime())) return "UNDATED";
    const distance = today - day(moment);
    if (distance <= 0) return "TODAY";
    if (distance === oneDay) return "YESTERDAY";
    return "EARLIER";
  };
  const order: readonly ConversationGroupKey[] = [
    "TODAY",
    "YESTERDAY",
    "EARLIER",
    "UNDATED",
  ];
  return Object.freeze(
    order
      .map((key) =>
        Object.freeze({
          key,
          rows: Object.freeze(
            orderConversations(rows).filter((row) => keyOf(row) === key),
          ),
        }),
      )
      .filter((group) => group.rows.length > 0),
  );
}
