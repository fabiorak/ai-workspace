/**
 * The passage a reader copies to another assistant, composed for a whole project on
 * demand.
 *
 * It moved out of the host facade rather than growing inside it: ADR-0035 caps the
 * three oversized presentation modules, and a zone that gains work gains a module.
 * Nothing about the composition changed in the move.
 *
 * This is deliberately not a handoff and not the restart point at the end of a
 * conversation. It asks for a project and, at most, the question just asked; it
 * selects nothing by hand, persists nothing, and is evidence of nothing. The
 * conversation's own restart point is the one that names a Work Item and could be
 * fixed — see `restart-points.ts`.
 */
import type { MemoryItem } from "@ai-workspace/active-memory";
import { composeRestartSummary } from "@ai-workspace/handoff";
import type { RegisteredProject } from "@ai-workspace/project-registry";

import type { GuiRestartSummary, GuiSearchReport } from "./view-models.ts";

export type ProjectRestartSummarySources = Readonly<{
  projects(): Promise<readonly RegisteredProject[]>;
  /** The project's notes, whatever their validity: the filter below is the caller's. */
  notes(projectId: string): Promise<readonly MemoryItem[]>;
  search(projectId: string, text: string): Promise<GuiSearchReport>;
}>;

export async function composeProjectRestartSummary(
  sources: ProjectRestartSummarySources,
  input: Readonly<{ projectId: string; question?: string }>,
): Promise<GuiRestartSummary> {
  const project = (await sources.projects()).find(
    (registered) => registered.id === input.projectId,
  );
  if (project === undefined)
    throw new Error("Select a registered local project first.");
  const notes = await sources.notes(input.projectId);
  const question =
    input.question === undefined || input.question.trim().length === 0
      ? null
      : input.question.trim();
  const findings =
    question === null
      ? []
      : (await sources.search(input.projectId, question)).results.map(
          (result) =>
            Object.freeze({
              eventId: result.eventId,
              occurredAt: result.occurredAt,
              snippet: result.snippet,
              why: result.reasons
                .slice(0, 2)
                .map((reason) => `"${reason.term}" reached "${reason.matched}"`)
                .join(" and "),
            }),
        );
  const summary = composeRestartSummary({
    projectName: project.name,
    branch: project.branch,
    headCommit: project.headCommit,
    isDirty: project.isDirty,
    question,
    decisions: notes
      .filter((item) => item.validity === "ACTIVE")
      .map((item) =>
        Object.freeze({
          content: item.content,
          verification: item.verification,
          sourceEventId: item.sources[0]?.eventId ?? null,
        }),
      ),
    findings,
  });
  return Object.freeze({
    projectId: input.projectId,
    text: summary.text,
    exactBytes: summary.exactBytes,
    omissions: summary.omissions,
    effect: "READ_ONLY_LOCAL_SUMMARY_NOT_PERSISTED_AND_NOT_SENT" as const,
  });
}

/**
 * The area, bound to its sources.
 *
 * It left `application.ts` when the restart point needed room to read the moments
 * ingestion keeps as files: a ceiling comes down when work moves out, and never goes
 * up. Nothing about what this does changed.
 */
export function projectRestartSummaryArea(
  sources: ProjectRestartSummarySources,
  guard: <T>(operation: () => Promise<T>, recovery: string) => Promise<T>,
): Readonly<{
  compose(
    input: Readonly<{ projectId: string; question?: string }>,
  ): Promise<GuiRestartSummary>;
}> {
  return Object.freeze({
    compose: async (
      input: Readonly<{ projectId: string; question?: string }>,
    ) =>
      guard(
        () => composeProjectRestartSummary(sources, input),
        "Select a registered project, then prepare the summary again.",
      ),
  });
}
