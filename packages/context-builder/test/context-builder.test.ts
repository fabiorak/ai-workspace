import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import {
  buildContextPack,
  buildContextPackV1,
  ContextBuilderError,
  expandContextPack,
  type ContextPackPreview,
} from "../src/index.ts";

const source: SectionMetadata["sources"][number] = Object.freeze({
  eventId: "event-1",
  sessionId: "session-1",
  eventType: "USER_MESSAGE",
  trust: "UNTRUSTED",
  sourceArtifactId: "artifact-1",
  sourcePosition: 0,
  sourceRecordHash: "a".repeat(64),
});
type MutablePacket = {
  schemaVersion: number;
  included: Array<{ content: string; exactBytes: number }>;
  sourceTable: {
    projectId: string;
    exactBytes: number;
    entries: Array<Record<string, unknown>>;
  };
  usedBytes: { CONTINUITY: number; INSTRUCTIONS: number };
  measurement: { exactIncludedBytes: number; estimatedTokens: number };
};

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
        metadata: {
          origin: key === "sourceReferences" ? "CANONICAL_EVENT" : "USER_INPUT",
          trust: key === "sourceReferences" ? "UNTRUSTED" : "USER_CURATED",
          curation: key === "sourceReferences" ? "NONE" : "USER_CURATED",
          verification: "UNVERIFIED",
          observation: "DERIVED",
          sources: [source],
        },
        value: key === "objective" ? "Obiettivo è" : [],
      },
    ]),
  ),
} as unknown as Handoff;

describe("Context Pack builder", () => {
  it("is deterministic and accounts exact UTF-8 bytes", () => {
    const input = {
      handoff,
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    };
    const first = buildContextPack(input);
    assert.deepEqual(first, buildContextPack(input));
    assert.equal(first.schemaVersion, 2);
    assert.equal(first.sourceTable?.entries.length, 1);
    assert.equal(
      first.included[0]!.exactBytes,
      Buffer.byteLength(first.included[0]!.content),
    );
    assert.equal(
      first.usedBytes.CONTINUITY,
      first.included
        .filter((item) => item.category === "CONTINUITY")
        .reduce((total, item) => total + item.exactBytes, 0) +
        first.sourceTable!.exactBytes,
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
    assert.equal(result.sourceTable, null);
    assert.equal(
      result.omitted.every((item) => item.reason === "BUDGET_EXCEEDED"),
      true,
    );
  });

  it("retains byte-identical v1 candidates and expands v2 losslessly", () => {
    const input = {
      handoff,
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    };
    const legacy = buildContextPackV1(input);
    const expandedLegacy = expandContextPack(legacy);
    const expanded = expandContextPack(buildContextPack(input));
    assert.equal(legacy.schemaVersion, 1);
    assert.equal(expandedLegacy.schemaVersion, 1);
    assert.deepEqual(expandedLegacy.included, legacy.included);
    assert.equal(expanded.schemaVersion, 2);
    assert.deepEqual(
      expanded.included.map((item) => item.content),
      legacy.included.map((item) => item.content),
    );
    assert.equal(expanded.sourceTableSummary?.entryCount, 1);
  });

  it("charges canonical shared bytes once at deterministic marginal boundaries", () => {
    const full = buildContextPack({
      handoff,
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    });
    const firstCost =
      full.included[0]!.exactBytes + full.sourceTable!.exactBytes;
    const boundary = buildContextPack({
      handoff,
      budgets: { CONTINUITY: firstCost, INSTRUCTIONS: 1 },
    });
    assert.equal(boundary.included.length, 1);
    assert.equal(boundary.omitted.length, 7);
    assert.equal(boundary.usedBytes.CONTINUITY, firstCost);
    assert.equal(
      boundary.omitted[0]!.byteMethod,
      "MARGINAL_CONTENT_AND_NEW_SHARED_SOURCES",
    );
  });

  it("is canonical under source permutations and rejects noncanonical or unreferenced table rows", () => {
    const secondSource = Object.freeze({
      ...source,
      eventId: "event-2",
      sessionId: "session-2",
      sourcePosition: 1,
      sourceRecordHash: "b".repeat(64),
    });
    const withSources = (sources: readonly (typeof source)[]) =>
      ({
        ...handoff,
        sections: Object.fromEntries(
          Object.entries(handoff.sections).map(([name, section]) => [
            name,
            {
              ...section,
              metadata: { ...section.metadata, sources },
            },
          ]),
        ),
      }) as unknown as typeof handoff;
    const forward = buildContextPack({
      handoff: withSources([source, secondSource]),
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    });
    const reversed = buildContextPack({
      handoff: withSources([secondSource, source]),
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    });
    assert.deepEqual(forward, reversed);

    const noncanonical = structuredClone(forward) as unknown as MutablePacket;
    noncanonical.sourceTable.entries.reverse();
    assert.throws(
      () => expandContextPack(noncanonical as unknown as ContextPackPreview),
      ContextBuilderError,
    );

    const unreferenced = structuredClone(forward) as unknown as MutablePacket;
    const unusedId = String(unreferenced.sourceTable.entries[1]!.id);
    let removedBytes = 0;
    for (const item of unreferenced.included) {
      const parsed = JSON.parse(item.content);
      const previous = item.exactBytes;
      parsed.metadata.sourceIds = parsed.metadata.sourceIds.filter(
        (id: string) => id !== unusedId,
      );
      item.content = JSON.stringify(parsed);
      item.exactBytes = Buffer.byteLength(item.content);
      removedBytes += previous - item.exactBytes;
    }
    unreferenced.usedBytes.CONTINUITY -= removedBytes;
    unreferenced.measurement.exactIncludedBytes -= removedBytes;
    unreferenced.measurement.estimatedTokens = Math.ceil(
      unreferenced.measurement.exactIncludedBytes / 4,
    );
    assert.throws(
      () => expandContextPack(unreferenced as unknown as ContextPackPreview),
      ContextBuilderError,
    );
  });

  it("rejects unsupported, dangling, duplicate, unreferenced, cross-scope, and inconsistent v2 packets without echo", () => {
    const packet = buildContextPack({
      handoff,
      budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
    });
    const rejects = (mutate: (value: MutablePacket) => void) => {
      const value = structuredClone(packet) as unknown as MutablePacket;
      mutate(value);
      assert.throws(
        () => expandContextPack(value as unknown as ContextPackPreview),
        (error: unknown) =>
          error instanceof ContextBuilderError &&
          !error.message.includes("PRIVATE-CANARY"),
      );
    };
    rejects((value) => {
      value.schemaVersion = 99;
    });
    rejects((value) => {
      const item = value.included[0]!;
      const section = JSON.parse(item.content);
      section.metadata.sourceIds[0] = `source:sha256:${"0".repeat(64)}`;
      item.content = JSON.stringify(section);
      item.exactBytes = Buffer.byteLength(item.content);
    });
    rejects((value) => {
      const item = value.included[0]!;
      const section = JSON.parse(item.content);
      section.metadata.sourceIds.push(section.metadata.sourceIds[0]);
      item.content = JSON.stringify(section);
      item.exactBytes = Buffer.byteLength(item.content);
    });
    rejects((value) => {
      value.sourceTable.entries.push(value.sourceTable.entries[0]!);
    });
    rejects((value) => {
      value.sourceTable.projectId = "foreign-project";
    });
    rejects((value) => {
      value.sourceTable.exactBytes += 1;
    });
    rejects((value) => {
      const item = value.included[0]!;
      item.content = JSON.stringify({
        metadata: { sourceIds: [] },
        value: `PRIVATE-CANARY${"x".repeat(1_000_001)}`,
      });
      item.exactBytes = Buffer.byteLength(item.content);
    });
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
