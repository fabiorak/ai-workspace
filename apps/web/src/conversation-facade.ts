/**
 * The facade of one domain area: the conversations the shell opens on.
 *
 * ADR-0035 splits the application facade per area and forbids the three oversized
 * presentation modules to grow, so an area that gains an operation gains it here
 * rather than in the host class. The host keeps what a facade owes its callers —
 * one entry point, no store internals, every failure carrying its own recovery.
 */
import type {
  ConversationMomentReading,
  ConversationPage,
  ConversationSources,
} from "./conversations.ts";
import {
  readConversation,
  readConversationMoment,
  readConversations,
} from "./conversations.ts";
import type { ConversationDetail } from "./conversation-detail.ts";

/**
 * How this area reports a failure. It is the host's own guard, passed in rather
 * than reimplemented, so one rule still turns every local failure into a message
 * with a recovery and no leaked path.
 */
export type FacadeGuard = <T>(
  operation: () => Promise<T>,
  recovery: string,
) => Promise<T>;

export type ConversationArea = Readonly<{
  list(limit?: number): Promise<ConversationPage>;
  /**
   * One conversation, or null when it is not there. A project-free id is a note,
   * which is why the caller states the project instead of the area guessing it.
   */
  open(
    query: Readonly<{ id: string; projectId: string | null; limit?: number }>,
  ): Promise<ConversationDetail | null>;
  /** Reads one separately stored moment, still scoped by its conversation. */
  openMoment(
    query: Readonly<{
      id: string;
      projectId: string | null;
      eventId: string;
    }>,
  ): Promise<ConversationMomentReading | null>;
}>;

export function conversationArea(
  sources: ConversationSources,
  guard: FacadeGuard,
): ConversationArea {
  return Object.freeze({
    list: async (limit?: number) =>
      guard(
        async () => readConversations(sources, limit),
        "Check local workspace permissions, then retry loading your conversations.",
      ),
    open: async (
      query: Readonly<{ id: string; projectId: string | null; limit?: number }>,
    ) =>
      guard(
        async () => readConversation(sources, query),
        "Return to your conversations and open another one from the list.",
      ),
    openMoment: async (query) =>
      guard(
        async () => readConversationMoment(sources, query),
        "Keep the conversation open, restore or reimport its local artifact, then retry.",
      ),
  });
}
