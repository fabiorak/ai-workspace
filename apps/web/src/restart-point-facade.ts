/**
 * The facade of one domain area: the restart point at the end of a work
 * conversation.
 *
 * ADR-0035 splits the application facade per area and forbids the three oversized
 * presentation modules to grow, so this area owns its own entry point. The host
 * keeps what a facade owes its callers: no store internals, and every failure
 * carrying its own recovery.
 */
import type { FacadeGuard } from "./conversation-facade.ts";
import type { RestartPoint, RestartPointUnavailable } from "./restart-point.ts";
import {
  readRestartPoint,
  type RestartPointSources,
} from "./restart-points.ts";

export type RestartPointArea = Readonly<{
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
  sources: RestartPointSources,
  guard: FacadeGuard,
): RestartPointArea {
  return Object.freeze({
    open: async (
      query: Readonly<{ conversationId: string; projectId: string | null }>,
    ) =>
      guard(
        async () => readRestartPoint(sources, query),
        "Nothing was saved. Reload the conversation, and check that its project and local notes are still readable.",
      ),
  });
}
