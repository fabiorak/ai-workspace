/**
 * The facade of one domain area: the restart point at the end of a work
 * conversation.
 *
 * ADR-0035 splits the application facade per area and forbids the three oversized
 * presentation modules to grow, so this area owns its own entry point. The host
 * keeps what a facade owes its callers: no store internals, and every failure
 * carrying its own recovery.
 */
import type { ActiveMemory } from "@ai-workspace/active-memory";
import type {
  CreateHandoffInput,
  Handoff,
  Handoffs,
} from "@ai-workspace/handoff";

import type { ConversationSources } from "./conversations.ts";
import type { FacadeGuard } from "./conversation-facade.ts";
import type { RestartPoint, RestartPointUnavailable } from "./restart-point.ts";
import {
  fixRestartPoint,
  type RestartPointFixInput,
  type RestartPointFixResult,
} from "./restart-point-fixing.ts";
import {
  readRestartPoint,
  type RestartPointSources,
} from "./restart-points.ts";

/**
 * Binds the area to the stores it reads, so the host does not spell out four
 * closures over its own private fields.
 *
 * Composing goes through `preview`, which never persists, and the fixed packets are
 * read through `list`, which only reads: the area is handed the two paths it is
 * allowed to take and cannot reach for the one that writes.
 */
export function restartPointSources(
  stores: Readonly<{
    conversations: ConversationSources;
    memory: ActiveMemory;
    handoffs: Handoffs;
  }>,
): RestartPointSources {
  return Object.freeze({
    sessions: stores.conversations.sessions,
    workItems: stores.conversations.workItems,
    notes: async (projectId: string, limit: number) =>
      (await stores.memory.list({ projectId, validity: "ACTIVE", limit }))
        .items,
    compose: (input) => stores.handoffs.preview(input),
    fixed: (projectId: string, workItemId: string) =>
      stores.handoffs.list(projectId, workItemId),
  });
}

export type RestartPointArea = Readonly<{
  /**
   * Fixes the summary of one conversation, which is the only write in this area.
   * The packet is composed again from the stores and refused when it no longer
   * matches what was read.
   */
  fix(input: RestartPointFixInput): Promise<RestartPointFixResult>;
  /**
   * The point of one conversation, or null when the conversation is not there. A
   * project-free id is a note, which is why the caller states the project instead
   * of the area guessing it.
   */
  open(
    query: Readonly<{ conversationId: string; projectId: string | null }>,
  ): Promise<RestartPoint | RestartPointUnavailable | null>;
}>;

export function restartPointArea(
  stores: Readonly<{
    conversations: ConversationSources;
    memory: ActiveMemory;
    handoffs: Handoffs;
    guard: FacadeGuard;
    /** The one path that persists, handed over separately from everything that reads. */
    write: (input: CreateHandoffInput) => Promise<Handoff>;
  }>,
): RestartPointArea {
  const sources = restartPointSources(stores);
  const guard = stores.guard;
  const write = stores.write;
  return Object.freeze({
    fix: async (input: RestartPointFixInput) =>
      guard(
        async () => fixRestartPoint(sources, write, input),
        "Nothing was written. Reload the conversation, read the summary as it stands now, and confirm again.",
      ),
    open: async (
      query: Readonly<{ conversationId: string; projectId: string | null }>,
    ) =>
      guard(
        async () => readRestartPoint(sources, query),
        "Nothing was saved. Reload the conversation, and check that its project and local notes are still readable.",
      ),
  });
}
