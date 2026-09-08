import type { Handoffs } from "@ai-workspace/handoff";
import type { RestartPointSources } from "./restart-points.ts";
import { workForSession } from "./restart-point.ts";
import {
  composeHandoffProfile,
  type ProfileContextTarget,
} from "./profile-context.ts";

export type ContinuationQuery = Readonly<{
  conversationId: string;
  projectId: string | null;
}>;
export type ContinuationTarget = ProfileContextTarget &
  Readonly<{ destinationId: string }>;
export type ContinuationSources = Pick<RestartPointSources, "workItems"> &
  Readonly<{
    sessions: Readonly<{
      list(
        projectId: string,
      ): Promise<readonly Readonly<{ id: string; projectId: string }>[]>;
    }>;
    handoffs: Pick<Handoffs, "list" | "show" | "validateRepository">;
    compose: typeof composeHandoffProfile;
  }>;
const recoveries = {
  NOT_A_WORK_CONVERSATION: "OPEN_WORK_CONVERSATION",
  CONVERSATION_NOT_FOUND: "RELOAD_CONVERSATION",
  NO_LINKED_WORK: "DECLARE_WORK",
  NO_HANDOFF: "KEEP_RESTART_POINT",
  TARGET_NOT_CONFIGURED: "CONFIGURE_TARGET",
  INVALID_TARGET: "REVIEW_TARGET",
  INCOHERENT_DATA: "RELOAD_LOCAL_SOURCES",
} as const;
type Reason = keyof typeof recoveries;
const unavailable = (reason: Reason) =>
  Object.freeze({
    prepared: false as const,
    reason,
    recovery: recoveries[reason],
  });

/** Read-only preparation. Neither audit, persistence nor transport is a port. */
export async function prepareContinuation(
  sources: ContinuationSources,
  query: ContinuationQuery,
  target: ContinuationTarget | null,
) {
  if (query.projectId === null) return unavailable("NOT_A_WORK_CONVERSATION");
  try {
    const projectId = query.projectId;
    const session = (await sources.sessions.list(projectId)).find(
      (item) => item.id === query.conversationId,
    );
    if (!session) return unavailable("CONVERSATION_NOT_FOUND");
    if (session.projectId !== projectId) return unavailable("INCOHERENT_DATA");
    const work = workForSession(
      await sources.workItems.list(projectId),
      session.id,
    );
    if (!work) return unavailable("NO_LINKED_WORK");
    if (work.projectId !== projectId) return unavailable("INCOHERENT_DATA");
    const latest = (await sources.handoffs.list(projectId, work.id))[0];
    if (!latest) return unavailable("NO_HANDOFF");
    if (latest.projectId !== projectId || latest.workItemId !== work.id)
      return unavailable("INCOHERENT_DATA");
    const handoff = await sources.handoffs.show(projectId, work.id, latest.id);
    if (
      handoff.id !== latest.id ||
      handoff.projectId !== projectId ||
      handoff.workItemId !== work.id
    )
      return unavailable("INCOHERENT_DATA");
    if (!target) return unavailable("TARGET_NOT_CONFIGURED");
    const repository = await sources.handoffs.validateRepository(
      projectId,
      work.id,
      handoff.id,
    );
    try {
      if (!target.destinationId.trim() || target.destinationId.length > 256)
        return unavailable("INVALID_TARGET");
      const composition = await sources.compose(handoff, target);
      return Object.freeze({
        prepared: true as const,
        reason: null,
        authorized: false as const,
        projectId,
        conversationId: session.id,
        workItemId: work.id,
        handoffId: handoff.id,
        handoffCreatedAt: handoff.createdAt,
        destinationId: target.destinationId,
        model: target.model,
        ...composition,
        repository,
        effect: "READ_ONLY_NOT_AUTHORIZED_PERSISTED_OR_SENT" as const,
      });
    } catch {
      return unavailable("INVALID_TARGET");
    }
  } catch {
    return unavailable("INCOHERENT_DATA");
  }
}
