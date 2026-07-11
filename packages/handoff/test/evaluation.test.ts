import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HandoffEvaluator,
  HandoffError,
  type Handoff,
  type HandoffEvaluation,
} from "../src/index.ts";
const handoff = {
  id: "handoff",
  projectId: "project",
  workItemId: "work",
} as Handoff;
const session = {
  id: "session",
  projectId: "project",
  startedAt: "2026-07-11T10:00:00.000Z",
  latestSourceArtifact: { id: "artifact", byteLength: 1000 },
  events: [
    {
      id: "message",
      type: "AGENT_MESSAGE",
      occurredAt: "2026-07-11T10:00:01.000Z",
    },
    { id: "action", type: "TOOL_CALL", occurredAt: "2026-07-11T10:00:02.000Z" },
  ],
} as never;
describe("HandoffEvaluator", () => {
  it("matches the first canonical action and labels measurements", async () => {
    let stored: HandoffEvaluation | null = null;
    const evaluator = new HandoffEvaluator({
      handoffs: { find: async () => handoff, create: async (value) => value },
      sessions: { load: async () => session },
      store: { create: async (value) => (stored = value) },
      ids: () => "evaluation",
      clock: () => new Date("2026-07-11T11:00:00.000Z"),
    });
    const value = await evaluator.evaluate({
      projectId: "project",
      workItemId: "work",
      handoffId: "handoff",
      resumeSessionId: "session",
      expectedEventId: "action",
    });
    assert.equal(value.firstAction.matched, true);
    assert.equal(value.elapsed.milliseconds, 2000);
    assert.equal(value.context.fullSessionBytes, 1000);
    assert.equal(stored, value);
  });
  it("rejects an expected event outside the resume session", async () => {
    const evaluator = new HandoffEvaluator({
      handoffs: { find: async () => handoff, create: async (value) => value },
      sessions: { load: async () => session },
      store: { create: async (value) => value },
      ids: () => "evaluation",
      clock: () => new Date(),
    });
    await assert.rejects(
      evaluator.evaluate({
        projectId: "project",
        workItemId: "work",
        handoffId: "handoff",
        resumeSessionId: "session",
        expectedEventId: "missing",
      }),
      HandoffError,
    );
  });
});
