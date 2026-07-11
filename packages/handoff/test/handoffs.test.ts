import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MemoryItem } from "@ai-workspace/active-memory";
import type { Handoff, HandoffStore } from "../src/index.ts";
import {
  encodeHandoff,
  HandoffError,
  Handoffs,
  renderHandoff,
} from "../src/index.ts";

class Store implements HandoffStore {
  item: Handoff | null = null;
  async create(value: Handoff) {
    this.item = value;
    return value;
  }
  async find(projectId: string, workItemId: string, id: string) {
    return this.item?.projectId === projectId &&
      this.item.workItemId === workItemId &&
      this.item.id === id
      ? this.item
      : null;
  }
}
const source = {
  eventId: "event",
  sessionId: "session",
  eventType: "USER_MESSAGE",
  trust: "UNTRUSTED",
  sourceArtifactId: "artifact",
  sourcePosition: 0,
  sourceRecordHash: "hash",
} as const;
function fixture(validity: MemoryItem["validity"] = "ACTIVE") {
  const store = new Store();
  const memory = {
    id: "memory",
    projectId: "project",
    type: "FAILURE",
    content: "Synthetic failure",
    curation: "USER_CURATED",
    validity,
    verification: "UNVERIFIED",
    confidence: "UNASSESSED",
    version: 1,
    sources: [source],
    creationOperationId: "operation",
    createdBy: "LOCAL_USER",
    createdAt: "2026-07-11T10:00:00.000Z",
    updatedAt: "2026-07-11T10:00:00.000Z",
    supersedes: null,
    supersession: null,
    verifications: [],
    invalidation: null,
  } as const;
  const handoffs = new Handoffs({
    store,
    workItems: {
      find: async () => ({
        id: "work" as never,
        projectId: "project",
        objective: "Synthetic objective",
        status: "ACTIVE",
        version: 2,
        createdBy: "LOCAL_USER",
        createdAt: "2026-07-11T09:00:00.000Z",
        updatedAt: "2026-07-11T09:30:00.000Z",
        sources: [source],
        transitions: [],
      }),
    },
    memory: { find: async () => memory },
    sourceEvents: {
      find: async (_project, eventId) =>
        eventId === "event"
          ? {
              id: "event",
              sessionId: "session",
              type: "USER_MESSAGE",
              trust: "UNTRUSTED",
              source: {
                artifactId: "artifact",
                position: 0,
                recordHash: "hash",
              },
            }
          : null,
    },
    ids: () => "handoff",
    clock: () => new Date("2026-07-11T11:00:00.000Z"),
  });
  return { handoffs, store };
}
const input = {
  projectId: "project",
  workItemId: "work",
  memoryIds: ["memory"],
  nextAction: "Inspect synthetic fixture",
  sourceEventIds: ["event"],
  repository: {
    branch: "main",
    head: "012345",
    dirty: false,
    changedPaths: [],
  },
  relevantFiles: ["fixtures/example.txt"],
  testState: [
    {
      command: "npm test",
      outcome: "PASS" as const,
      observedAt: "2026-07-11T10:30:00.000Z",
    },
  ],
};
describe("Handoffs", () => {
  it("creates an immutable source-linked packet with section-level trust", async () => {
    const { handoffs } = fixture();
    const value = await handoffs.create(input);
    assert.equal(value.schemaVersion, 1);
    assert.equal(value.sections.objective.metadata.trust, "USER_CURATED");
    assert.equal(value.sections.sourceReferences.metadata.trust, "UNTRUSTED");
    assert.equal(value.sections.knownFailures.value[0]?.id, "memory");
    assert.ok(Object.isFrozen(value));
    assert.equal(JSON.parse(encodeHandoff(value)).id, "handoff");
    assert.match(renderHandoff(value), /Inspect sources:/u);
  });
  it("rejects non-active selected memory", async () => {
    const { handoffs } = fixture("INVALIDATED");
    await assert.rejects(handoffs.create(input), HandoffError);
  });
  it("requires explicit same-project canonical sources", async () => {
    const { handoffs } = fixture();
    await assert.rejects(
      handoffs.create({ ...input, sourceEventIds: ["foreign"] }),
      HandoffError,
    );
  });

  it("rejects a predecessor outside the explicit handoff history", async () => {
    const { handoffs } = fixture();
    await assert.rejects(
      handoffs.create({ ...input, predecessorId: "missing" }),
      HandoffError,
    );
  });
  it("sanitizes terminal controls in human output", async () => {
    const { handoffs } = fixture();
    const value = await handoffs.create({
      ...input,
      nextAction: "Inspect\u001b[31m fixture",
    });
    assert.equal(renderHandoff(value).includes("\u001b"), false);
  });
});
