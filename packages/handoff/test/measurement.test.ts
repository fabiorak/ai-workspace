import assert from "node:assert/strict";
import { TextEncoder } from "node:util";
import { describe, it } from "node:test";
import {
  HandoffError,
  measureHandoffBreakEven,
  type Handoff,
  type SessionByteBaseline,
} from "../src/index.ts";
const source = {
  eventId: "event_" + "a".repeat(64),
  sessionId: "session_" + "b".repeat(64),
  eventType: "USER_MESSAGE",
  trust: "UNTRUSTED",
  sourceArtifactId: "artifact://sha256/" + "c".repeat(64),
  sourcePosition: 1,
  sourceRecordHash: "d".repeat(64),
};
const metadata = {
  origin: "CANONICAL_EVENT",
  trust: "UNTRUSTED",
  curation: "NONE",
  verification: "NOT_APPLICABLE",
  observation: "IMPORTED",
  sources: [source],
};
const section = (value: unknown) => ({ metadata, value });
const handoff = {
  schemaVersion: 1,
  id: "handoff-fixed",
  projectId: "project-fixed",
  workItemId: "work-fixed",
  predecessorId: null,
  createdBy: "LOCAL_USER",
  createdAt: "2026-07-11T12:00:00.000Z",
  sections: {
    objective: section("Inspect the synthetic compatibility fixture"),
    repository: section({
      branch: "main",
      head: "a".repeat(40),
      dirty: false,
      changedPaths: [],
    }),
    selectedMemory: section([]),
    knownFailures: section([]),
    testState: section([]),
    relevantFiles: section(["fixtures/compatibility.txt"]),
    nextAction: section("Read the synthetic compatibility fixture"),
    sourceReferences: section([source]),
  },
} as unknown as Handoff;
describe("measureHandoffBreakEven", () => {
  it("finds the first exact-byte break-even across a deterministic two-axis corpus", () => {
    const baselines = corpus();
    const report = measureHandoffBreakEven(handoff, baselines);
    assert.equal(report.decisionMethod, "EXACT_UTF8_BYTES");
    assert.equal(report.measurements.length, 15);
    assert.ok(report.firstBreakEven);
    assert.equal(
      report.measurements.every(
        (value) =>
          value.estimatedHandoffTokens === Math.ceil(value.handoffBytes / 4),
      ),
      true,
    );
    if (process.env.AI_WORKSPACE_DEMO_REPORT === "1")
      process.stdout.write(`SYNTHETIC_BREAK_EVEN ${JSON.stringify(report)}\n`);
  });
  it("rejects duplicate or invalid baseline metadata", () => {
    assert.throws(
      () =>
        measureHandoffBreakEven(handoff, [
          {
            label: "same",
            recordCount: 1,
            payloadBytes: 1,
            fullSessionBytes: 1,
          },
          {
            label: "same",
            recordCount: 2,
            payloadBytes: 1,
            fullSessionBytes: 2,
          },
        ]),
      HandoffError,
    );
  });
});
function corpus(): SessionByteBaseline[] {
  const result: SessionByteBaseline[] = [];
  for (const payloadBytes of [32, 256, 1024])
    for (const recordCount of [4, 8, 16, 32, 64]) {
      const raw = syntheticClaudeSession(recordCount, payloadBytes);
      result.push({
        label: `records-${recordCount}-payload-${payloadBytes}`,
        recordCount,
        payloadBytes,
        fullSessionBytes: new TextEncoder().encode(raw).byteLength,
      });
    }
  return result;
}
function syntheticClaudeSession(recordCount: number, payloadBytes: number) {
  const records: string[] = [];
  records.push(
    JSON.stringify({
      type: "user",
      uuid: "user-0000",
      sessionId: "synthetic-break-even",
      timestamp: "2026-07-11T10:00:00.000Z",
      message: {
        role: "user",
        content: "Begin deterministic synthetic measurement.",
      },
    }),
  );
  for (let index = 1; index < recordCount; index++) {
    records.push(
      JSON.stringify({
        type: "assistant",
        uuid: `assistant-${String(index).padStart(4, "0")}`,
        parentUuid:
          index === 1
            ? "user-0000"
            : `assistant-${String(index - 1).padStart(4, "0")}`,
        sessionId: "synthetic-break-even",
        timestamp: new Date(Date.UTC(2026, 6, 11, 10, 0, index)).toISOString(),
        message: {
          role: "assistant",
          model: "synthetic-model",
          content: [{ type: "text", text: "x".repeat(payloadBytes) }],
        },
      }),
    );
  }
  return `${records.join("\n")}\n`;
}
