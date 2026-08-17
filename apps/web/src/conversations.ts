/**
 * Reading side of the conversation list.
 *
 * ADR-0035 splits the facade per domain area, and this is the area the new shell
 * opens on. It reads from authoritative stores and hands the values to the pure
 * functions in `conversation-list.ts`: nothing is persisted, no index is built,
 * and no snapshot is kept, so the list cannot drift from what the stores say.
 *
 * A linked Work Item contributes its status because `WorkItemSource` already
 * records the session it came from. That is the whole reason the state can appear
 * beside a title without inventing a relationship.
 */
import type { WorkItem } from "@ai-workspace/core";
import type { GeneralConversation } from "@ai-workspace/general-conversation";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import {
  noteRows,
  orderConversations,
  sessionRows,
  type ConversationRow,
} from "./conversation-list.ts";
import {
  noteDetail,
  sessionDetail,
  type ConversationDetail,
} from "./conversation-detail.ts";

/** Bounded like every other local read: a list nobody scrolls to the end of is still a cost. */
export const CONVERSATION_LIMIT = 50;

export type ConversationSources = Readonly<{
  projects(): Promise<readonly Readonly<{ id: string; name: string }>[]>;
  /**
   * Whole session documents rather than flattened events: the list shows which
   * model ran a session, and that field lives on the document.
   */
  sessions: Readonly<{
    list(projectId: string): Promise<readonly ImportedSession[]>;
  }>;
  notes: Readonly<{ list(): Promise<readonly GeneralConversation[]> }>;
  workItems: Readonly<{
    list(projectId: string): Promise<readonly WorkItem[]>;
  }>;
}>;

export type ConversationPage = Readonly<{
  rows: readonly ConversationRow[];
  /** How many rows exist before the bound, so the interface can say what it left out. */
  total: number;
  limit: number;
}>;

/**
 * Maps each session to the status of a Work Item linked to it.
 *
 * When several Work Items point at one session the most recently updated one
 * wins. That is a display choice, not a lifecycle change: the list shows one
 * state per row, and showing the stale one would misinform.
 */
function statesBySession(
  items: readonly WorkItem[],
): Readonly<Record<string, string>> {
  const chosen = new Map<string, WorkItem>();
  for (const item of items)
    for (const source of item.sources) {
      const current = chosen.get(source.sessionId);
      if (current === undefined || current.updatedAt < item.updatedAt)
        chosen.set(source.sessionId, item);
    }
  return Object.freeze(
    Object.fromEntries(
      [...chosen.entries()].map(([sessionId, item]) => [
        sessionId,
        item.status,
      ]),
    ),
  );
}

/**
 * Composes the list a reader sees on opening the product.
 *
 * A project that cannot be read does not empty the list: its rows are missing and
 * the rest still arrives, because a person resuming work is better served by the
 * conversations that are readable than by a single failure message.
 */
export async function readConversations(
  sources: ConversationSources,
  limit = CONVERSATION_LIMIT,
): Promise<ConversationPage> {
  const projects = await sources.projects();
  const perProject = await Promise.all(
    projects.map(async (project) => {
      try {
        const [sessions, items] = await Promise.all([
          sources.sessions.list(project.id),
          sources.workItems.list(project.id).catch(() => []),
        ]);
        return sessionRows({
          projectName: project.name,
          sessions,
          workStateBySession: statesBySession(items),
        });
      } catch {
        return [];
      }
    }),
  );
  const notes = await sources.notes.list().catch(() => []);
  const ordered = orderConversations([
    ...perProject.flat(),
    ...noteRows(notes),
  ]);
  return Object.freeze({
    rows: Object.freeze(ordered.slice(0, limit)),
    total: ordered.length,
    limit,
  });
}

/**
 * Reads one conversation, which is what a row in that list opens.
 *
 * Unlike the list, this reads a single project rather than every project: opening
 * one conversation is the most frequent act in the shell, and paying for the whole
 * workspace each time would make the cheapest gesture the most expensive one. A
 * conversation without a project is a note, and notes are read from their own
 * store.
 *
 * A conversation that is not there returns null rather than an empty one, so the
 * interface can say it is gone instead of showing a conversation with no moments.
 */
export async function readConversation(
  sources: ConversationSources,
  query: Readonly<{ id: string; projectId: string | null; limit?: number }>,
): Promise<ConversationDetail | null> {
  if (query.projectId === null) {
    const notes = await sources.notes.list();
    const note = notes.find((conversation) => conversation.id === query.id);
    return note === undefined
      ? null
      : noteDetail({ conversation: note, limit: query.limit });
  }
  const projectId = query.projectId;
  const sessions = await sources.sessions.list(projectId);
  const session = sessions.find((candidate) => candidate.id === query.id);
  if (session === undefined) return null;
  const projects = await sources.projects();
  return sessionDetail({
    session,
    projectName:
      projects.find((project) => project.id === projectId)?.name ?? null,
    limit: query.limit,
  });
}
