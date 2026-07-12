import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContextPack } from "../src/index.ts";

const handoff = {
  schemaVersion: 1 as const,
  id: "handoff-1",
  projectId: "project-1",
  workItemId: "work-1",
  predecessorId: null,
  createdBy: "LOCAL_USER" as const,
  createdAt: "2026-07-12T00:00:00.000Z",
  sections: Object.fromEntries(
    [
      "objective",
      "repository",
      "selectedMemory",
      "knownFailures",
      "testState",
      "relevantFiles",
      "nextAction",
      "sourceReferences",
    ].map((key) => [
      key,
      {
        value: key === "objective" ? "Obiettivo è" : [],
        origin: "USER_INPUT",
        trust: "USER_CURATED",
        sources: [],
      },
    ]),
  ),
} as never;

describe("Context Pack builder", () => {
  it("is deterministic and accounts exact UTF-8 bytes", () => {
    const input = {
      handoff,
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    };
    const first = buildContextPack(input);
    assert.deepEqual(first, buildContextPack(input));
    assert.equal(
      first.included[0]!.exactBytes,
      Buffer.byteLength(first.included[0]!.content),
    );
    assert.equal(
      first.measurement.estimatedTokens,
      Math.ceil(first.measurement.exactIncludedBytes / 4),
    );
  });

  it("omits whole items deterministically when a category budget is exceeded", () => {
    const result = buildContextPack({
      handoff,
      budgets: { CONTINUITY: 1, INSTRUCTIONS: 1 },
    });
    assert.deepEqual(result.included, []);
    assert.equal(result.omitted.length, 8);
    assert.equal(
      result.omitted.every((item) => item.reason === "BUDGET_EXCEEDED"),
      true,
    );
  });

  it("rejects invalid budgets and cross-project instructions", () => {
    assert.throws(() =>
      buildContextPack({
        handoff,
        budgets: { CONTINUITY: 0, INSTRUCTIONS: 1 },
      }),
    );
    assert.throws(() =>
      buildContextPack({
        handoff,
        budgets: { CONTINUITY: 1, INSTRUCTIONS: 1 },
        instructions: { projectId: "foreign" } as never,
      }),
    );
  });
});
