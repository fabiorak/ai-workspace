import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { WorkItemSource } from "@ai-workspace/core";
import {
  decodePersistedHandoff,
  encodePersistedHandoff,
  HandoffError,
  renderHandoff,
  type Handoff,
  type SectionMetadata,
} from "../src/index.ts";

const sourceA: WorkItemSource = {
  eventId: "event-a",
  sessionId: "session",
  eventType: "USER_MESSAGE",
  trust: "UNTRUSTED",
  sourceArtifactId: "artifact",
  sourcePosition: 0,
  sourceRecordHash: "hash-a",
};
const sourceB: WorkItemSource = {
  ...sourceA,
  eventId: "event-b",
  sourcePosition: 1,
  sourceRecordHash: "hash-b",
};
const metadata = (
  sources: readonly WorkItemSource[],
  trust: SectionMetadata["trust"] = "UNTRUSTED",
): SectionMetadata => ({
  origin: "CANONICAL_EVENT",
  trust,
  curation: "NONE",
  verification: "NOT_APPLICABLE",
  observation: "IMPORTED",
  sources,
});
function packet(
  sources: readonly WorkItemSource[] = [sourceA, sourceB],
): Handoff {
  const observed = metadata(sources, "OBSERVED");
  const untrusted = metadata(sources);
  return {
    schemaVersion: 1,
    id: "handoff-v2",
    projectId: "project",
    workItemId: "work",
    predecessorId: "handoff-v1",
    createdBy: "LOCAL_USER",
    createdAt: "2026-07-11T12:00:00.000Z",
    sections: {
      objective: { metadata: untrusted, value: "objective" },
      repository: {
        metadata: observed,
        value: { branch: "main", head: "abc", dirty: false, changedPaths: [] },
      },
      selectedMemory: { metadata: untrusted, value: [] },
      knownFailures: { metadata: untrusted, value: [] },
      testState: { metadata: observed, value: [] },
      relevantFiles: { metadata: observed, value: ["README.md"] },
      nextAction: { metadata: untrusted, value: "continue" },
      sourceReferences: { metadata: untrusted, value: sources },
    },
  };
}

describe("persisted handoff codec", () => {
  it("reads the immutable schema-v1 fixture without changing its bytes", async () => {
    const path = new URL("./fixtures/handoff-v1.json", import.meta.url);
    const before = await readFile(path, "utf8");
    const decoded = decodePersistedHandoff(JSON.parse(before));
    assert.equal(decoded.id, "synthetic-handoff-v1");
    assert.equal(await readFile(path, "utf8"), before);
  });

  it("encodes schema v2 deterministically and expands it losslessly", () => {
    const logical = packet();
    const encoded = encodePersistedHandoff(logical);
    assert.equal(JSON.parse(encoded).schemaVersion, 2);
    assert.deepEqual(decodePersistedHandoff(JSON.parse(encoded)), logical);
    assert.equal(
      encodePersistedHandoff(decodePersistedHandoff(JSON.parse(encoded))),
      encoded,
    );
  });

  it("normalizes permuted source occurrence input to identical bytes", () => {
    const reversed = packet([sourceB, sourceA]);
    assert.equal(
      encodePersistedHandoff(reversed),
      encodePersistedHandoff(packet()),
    );
  });

  it("preserves section trust and source-navigation commands", () => {
    const logical = packet();
    const decoded = decodePersistedHandoff(
      JSON.parse(encodePersistedHandoff(logical)),
    );
    assert.equal(decoded.sections.objective.metadata.trust, "UNTRUSTED");
    assert.equal(decoded.sections.repository.metadata.trust, "OBSERVED");
    assert.equal(renderHandoff(decoded), renderHandoff(logical));
  });

  it("accepts a v2 successor that names a v1 predecessor", () => {
    const decoded = decodePersistedHandoff(
      JSON.parse(encodePersistedHandoff(packet())),
    );
    assert.equal(decoded.predecessorId, "handoff-v1");
    assert.equal(decoded.projectId, "project");
    assert.equal(decoded.workItemId, "work");
  });

  it("rejects dangling, duplicate, malformed, and unreferenced source entries", () => {
    type MutablePersisted = {
      sections: Record<string, { metadata: { sourceIds: string[] } }>;
      sourceTable: Array<{
        id: string;
        source: Record<string, unknown>;
      }>;
    };
    const original = JSON.parse(
      encodePersistedHandoff(packet()),
    ) as MutablePersisted;
    for (const mutate of [
      (value: MutablePersisted) =>
        value.sections.objective!.metadata.sourceIds.push("source-9999"),
      (value: MutablePersisted) =>
        value.sections.objective!.metadata.sourceIds.push("source-0001"),
      (value: MutablePersisted) =>
        (value.sourceTable[0]!.source.sourcePosition = -1),
      (value: MutablePersisted) =>
        value.sourceTable.push({
          id: "source-0003",
          source: { ...sourceA, eventId: "unused" },
        }),
    ]) {
      const value = structuredClone(original);
      mutate(value);
      assert.throws(() => decodePersistedHandoff(value), HandoffError);
    }
  });

  it("rejects oversized tables and reference arrays", () => {
    const value = JSON.parse(encodePersistedHandoff(packet()));
    value.sourceTable = Array.from({ length: 101 }, (_, index) => ({
      id: `source-${String(index + 1).padStart(4, "0")}`,
      source: { ...sourceA, eventId: `event-${index}` },
    }));
    assert.throws(() => decodePersistedHandoff(value), HandoffError);
    const references = packet(
      Array.from({ length: 101 }, (_, index) => ({
        ...sourceA,
        eventId: `event-${index}`,
      })),
    );
    assert.throws(() => encodePersistedHandoff(references), HandoffError);
  });
});
