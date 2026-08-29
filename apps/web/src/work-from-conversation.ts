/**
 * Declaring that an open conversation is a piece of work.
 *
 * A conversation already says what is being worked on, and until now saying so to
 * the product meant leaving it: search the history, open a canonical event, read its
 * trust and its position in the source file, then go to another page and create a
 * Work Item. The measurement of 2026-08-29 found the predictable result — a real
 * transcript imported thirty-five days earlier that no Work Item declared, and so a
 * summary that could only say what was missing.
 *
 * Nothing here infers anything. ADR-0010 forbids deciding on somebody's behalf which
 * work a session belongs to, and that stands: the objective is written by the person,
 * and this module refuses rather than guesses whenever what it needs is absent. What
 * changes is only where the declaration is made — on the thing being looked at,
 * instead of on a technical surface.
 *
 * The evidence is the same few moments the restart point shows, for the reason the
 * first step already settled: what a record cites has to be what somebody read. Those
 * moments become the sources of the Work Item, and from there the sources of the
 * objective section of every packet this work will ever produce.
 *
 * The operations that write are handed in rather than reached for, exactly as the
 * fixing side does, so this module cannot persist anything it was not given.
 */
import type { ImportedSession } from "@ai-workspace/session-ingestion";
import type { WorkItem } from "@ai-workspace/core";

import { workForSession } from "./restart-point.ts";
import { inOrder, momentsShown } from "./restart-points.ts";

export type WorkFromConversationSources = Readonly<{
  sessions: Readonly<{
    list(projectId: string): Promise<readonly ImportedSession[]>;
  }>;
  workItems: Readonly<{
    list(projectId: string): Promise<readonly WorkItem[]>;
  }>;
}>;

/**
 * The two writes of the domain this needs, named separately.
 *
 * They are two because the domain is: `create` always produces a proposed item, and
 * only `activate` moves it. One gesture drives both, which is a decision about what
 * the person is saying, not a shortcut around the lifecycle.
 */
export type WorkFromConversationWrites = Readonly<{
  create(
    input: Readonly<{
      projectId: string;
      objective: string;
      sourceEventIds: readonly string[];
    }>,
  ): Promise<WorkItem>;
  activate(
    input: Readonly<{
      projectId: string;
      workItemId: string;
      sourceEventIds: readonly string[];
    }>,
  ): Promise<WorkItem>;
}>;

export type StartWorkInput = Readonly<{
  conversationId: string;
  projectId: string | null;
  objective: string;
}>;

/**
 * Why nothing was created. Each of these is a state somebody can be in and leave,
 * never a dead end, and none of them writes.
 */
export type StartWorkRefusal = Readonly<{
  started: false;
  reason:
    | "NOT_A_WORK_CONVERSATION"
    | "ALREADY_LINKED"
    | "EMPTY_OBJECTIVE"
    | "NOTHING_IMPORTED_YET";
}>;

/**
 * What was created.
 *
 * `active` is false when the item exists but the second write did not go through.
 * That is a legitimate state — a proposed Work Item — and it is reported rather than
 * hidden behind a generic failure, because the screen has to be able to say the
 * truth: the work is there, and it is not marked as in progress.
 */
export type StartWorkResult = Readonly<{
  started: true;
  active: boolean;
}>;

const refusal = (reason: StartWorkRefusal["reason"]): StartWorkRefusal =>
  Object.freeze({ started: false as const, reason });

export async function startWorkFromConversation(
  sources: WorkFromConversationSources,
  writes: WorkFromConversationWrites,
  input: StartWorkInput,
): Promise<StartWorkResult | StartWorkRefusal | null> {
  if (input.projectId === null) return refusal("NOT_A_WORK_CONVERSATION");
  const projectId = input.projectId;
  const objective = input.objective.trim();
  if (objective.length === 0) return refusal("EMPTY_OBJECTIVE");
  const sessions = await sources.sessions.list(projectId);
  const session = sessions.find(
    (candidate) => candidate.id === input.conversationId,
  );
  if (session === undefined) return null;
  /**
   * One conversation resumes into one objective, which is the rule the summary
   * already reads by. A second Work Item over the same session would make that rule
   * pick between them, so the refusal happens here instead.
   */
  if (workForSession(await sources.workItems.list(projectId), session.id))
    return refusal("ALREADY_LINKED");
  const recent = momentsShown(inOrder(session.events));
  if (recent.length === 0) return refusal("NOTHING_IMPORTED_YET");
  const sourceEventIds = recent.map((event) => event.id);
  const created = await writes.create({
    projectId,
    objective,
    sourceEventIds,
  });
  /**
   * The same evidence for both writes: the person made one statement, so nothing new
   * is asked for the second half of it. A failure here leaves a proposed item, which
   * the caller is told about — it is not an error to swallow, and not one to dress up
   * as success either.
   */
  try {
    await writes.activate({
      projectId,
      workItemId: created.id,
      sourceEventIds,
    });
    return Object.freeze({ started: true as const, active: true });
  } catch {
    return Object.freeze({ started: true as const, active: false });
  }
}
