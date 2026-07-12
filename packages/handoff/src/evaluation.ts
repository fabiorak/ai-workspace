import { TextEncoder } from "node:util";
import type {
  ImportedSession,
  SessionEvent,
} from "@ai-workspace/session-ingestion";
import { HandoffError, type HandoffStore } from "./handoffs.ts";
import { encodeHandoff } from "./render.ts";

export type HandoffEvaluation = Readonly<{
  schemaVersion: 1;
  id: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  resumeSessionId: string;
  expectedEventId: string;
  evaluatedAt: string;
  firstAction: Readonly<{
    matched: boolean;
    actualEventId: string | null;
    actualEventType: string | null;
    method: "FIRST_CANONICAL_ACTION_EVENT";
  }>;
  context: Readonly<{
    fullSessionBytes: number;
    handoffBytes: number;
    byteReduction: number;
    reductionPercent: number;
    estimatedFullSessionTokens: number;
    estimatedHandoffTokens: number;
    tokenEstimateMethod: "CEIL_UTF8_BYTES_DIVIDED_BY_4";
  }>;
  elapsed: Readonly<{
    milliseconds: number | null;
    method: "SESSION_STARTED_AT_TO_EXPECTED_EVENT_TIMESTAMP";
    limitation: string;
  }>;
}>;
export type HandoffEvaluationStore = Readonly<{
  create(evaluation: HandoffEvaluation): Promise<HandoffEvaluation>;
}>;
export type HandoffEvaluationDependencies = Readonly<{
  handoffs: Pick<HandoffStore, "find" | "create">;
  sessions: Readonly<{ load(id: string): Promise<ImportedSession | null> }>;
  store: HandoffEvaluationStore;
  ids: () => string;
  clock: () => Date;
}>;
const ACTION_TYPES = new Set([
  "TOOL_CALL",
  "COMMAND_RESULT",
  "FILE_CHANGE",
  "TEST_RESULT",
]);
export class HandoffEvaluator {
  readonly #deps: HandoffEvaluationDependencies;
  public constructor(dependencies: HandoffEvaluationDependencies) {
    this.#deps = dependencies;
  }
  public async evaluate(
    input: Readonly<{
      projectId: string;
      workItemId: string;
      handoffId: string;
      resumeSessionId: string;
      expectedEventId: string;
    }>,
  ): Promise<HandoffEvaluation> {
    const projectId = required(input.projectId, "Project ID"),
      workItemId = required(input.workItemId, "Work Item ID"),
      handoffId = required(input.handoffId, "Handoff ID"),
      sessionId = required(input.resumeSessionId, "Resume session ID"),
      expectedId = required(input.expectedEventId, "Expected event ID");
    const handoff = await this.#deps.handoffs.find(
      projectId,
      workItemId,
      handoffId,
    );
    if (handoff === null)
      throw new HandoffError(
        `Handoff '${handoffId}' was not found for the explicit project and Work Item.`,
      );
    const session = await this.#deps.sessions.load(sessionId);
    if (session === null || session.projectId !== projectId)
      throw new HandoffError(
        `Resume session '${sessionId}' was not found in project '${projectId}'.`,
      );
    const expected = session.events.find((event) => event.id === expectedId);
    if (expected === undefined)
      throw new HandoffError(
        `Expected event '${expectedId}' was not found in the explicit resume session.`,
      );
    const actual =
      session.events.find((event) => ACTION_TYPES.has(event.type)) ?? null;
    const fullBytes = session.latestSourceArtifact.byteLength,
      handoffBytes = new TextEncoder().encode(
        encodeHandoff(handoff),
      ).byteLength;
    const elapsed = elapsedMilliseconds(session.startedAt, expected);
    const evaluatedAt = this.#deps.clock();
    if (Number.isNaN(evaluatedAt.getTime()))
      throw new HandoffError("Evaluation clock returned an invalid date.");
    const evaluation: HandoffEvaluation = Object.freeze({
      schemaVersion: 1,
      id: required(this.#deps.ids(), "Evaluation ID"),
      projectId,
      workItemId,
      handoffId,
      resumeSessionId: sessionId,
      expectedEventId: expectedId,
      evaluatedAt: evaluatedAt.toISOString(),
      firstAction: Object.freeze({
        matched: actual?.id === expectedId,
        actualEventId: actual?.id ?? null,
        actualEventType: actual?.type ?? null,
        method: "FIRST_CANONICAL_ACTION_EVENT",
      }),
      context: Object.freeze({
        fullSessionBytes: fullBytes,
        handoffBytes,
        byteReduction: fullBytes - handoffBytes,
        reductionPercent:
          fullBytes === 0
            ? 0
            : Number(
                (((fullBytes - handoffBytes) / fullBytes) * 100).toFixed(2),
              ),
        estimatedFullSessionTokens: Math.ceil(fullBytes / 4),
        estimatedHandoffTokens: Math.ceil(handoffBytes / 4),
        tokenEstimateMethod: "CEIL_UTF8_BYTES_DIVIDED_BY_4",
      }),
      elapsed: Object.freeze({
        milliseconds: elapsed,
        method: "SESSION_STARTED_AT_TO_EXPECTED_EVENT_TIMESTAMP",
        limitation:
          "Synthetic source timestamps measure fixture interval, not general productivity or wall-clock agent startup.",
      }),
    });
    return this.#deps.store.create(evaluation);
  }
}
function elapsedMilliseconds(
  start: string | null,
  event: SessionEvent,
): number | null {
  if (start === null || event.occurredAt === null) return null;
  const value = Date.parse(event.occurredAt) - Date.parse(start);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new HandoffError(`${label} cannot be empty.`);
  return normalized;
}
