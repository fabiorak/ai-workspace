/**
 * The facade of one domain area: the Work Item lifecycle.
 *
 * ADR-0035 splits the application facade per area, and the host may not grow: this
 * moved out of `application.ts` when the work of declaring a conversation as work
 * needed room, which is the direction that rule allows — a ceiling comes down when
 * something leaves, and never goes up.
 *
 * Nothing changed in what these do. Each one still carries the recovery its failure
 * needs, and none of them reaches for a store the host did not hand over.
 */
import type { WorkItem, WorkItems } from "@ai-workspace/core";

import type { FacadeGuard } from "./conversation-facade.ts";

export type WorkItemArea = Readonly<{
  list(projectId: string): Promise<readonly WorkItem[]>;
  show(projectId: string, workItemId: string): Promise<WorkItem>;
  create(input: Parameters<WorkItems["create"]>[0]): Promise<WorkItem>;
  /**
   * One lifecycle move. The action is named by the caller because the domain decides
   * which moves are legal from where, and refuses the rest.
   */
  transition(
    action: "activate" | "block" | "complete" | "reopen",
    input: Parameters<WorkItems["activate"]>[0],
  ): Promise<WorkItem>;
}>;

export function workItemArea(
  workItems: WorkItems,
  guard: FacadeGuard,
): WorkItemArea {
  return Object.freeze({
    list: async (projectId: string) =>
      guard(
        () => workItems.list(projectId),
        "Keep the selected project and retry loading Work Items.",
      ),
    show: async (projectId: string, workItemId: string) =>
      guard(
        () => workItems.show(projectId, workItemId),
        "Return to this project's Work Item list and retry.",
      ),
    create: async (input: Parameters<WorkItems["create"]>[0]) =>
      guard(
        () => workItems.create(input),
        "Keep the objective, select same-project canonical evidence, and retry.",
      ),
    transition: async (
      action: "activate" | "block" | "complete" | "reopen",
      input: Parameters<WorkItems["activate"]>[0],
    ) =>
      guard(
        () => workItems[action](input),
        "Reload the Work Item, select current evidence, and choose a valid lifecycle action.",
      ),
  });
}
