/**
 * The facade of one domain area: declaring that a conversation is a piece of work.
 *
 * ADR-0035 splits the application facade per area and forbids the three oversized
 * presentation modules to grow, so this area owns its entry point rather than adding
 * its wiring to the host. What the host keeps is what a facade owes its callers: no
 * store internals, and every failure carrying its own recovery.
 */
import type { WorkItems } from "@ai-workspace/core";

import type { ConversationSources } from "./conversations.ts";
import type { FacadeGuard } from "./conversation-facade.ts";
import {
  startWorkFromConversation,
  type StartWorkInput,
  type StartWorkRefusal,
  type StartWorkResult,
} from "./work-from-conversation.ts";

export type WorkFromConversationArea = Readonly<{
  /**
   * Creates the work this conversation declares, and marks it as in progress. The
   * evidence is composed here from the session, so the caller supplies only the
   * objective the person wrote.
   */
  start(
    input: StartWorkInput,
  ): Promise<StartWorkResult | StartWorkRefusal | null>;
}>;

export function workFromConversationArea(
  stores: Readonly<{
    conversations: ConversationSources;
    workItems: WorkItems;
    guard: FacadeGuard;
    /** Wraps each domain write so the reader cannot keep answering from before it. */
    after: <T>(write: () => Promise<T>) => Promise<T>;
  }>,
): WorkFromConversationArea {
  return Object.freeze({
    start: async (input: StartWorkInput) =>
      stores.guard(
        async () =>
          startWorkFromConversation(
            {
              sessions: stores.conversations.sessions,
              workItems: stores.conversations.workItems,
            },
            {
              create: (created) =>
                stores.after(() => stores.workItems.create(created)),
              activate: (moved) =>
                stores.after(() => stores.workItems.activate(moved)),
            },
            input,
          ),
        "Nothing was saved. Reload the conversation, keep what you wrote, and declare the work again.",
      ),
  });
}
