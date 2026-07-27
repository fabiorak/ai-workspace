import assert from "node:assert/strict";
import { TextEncoder } from "node:util";
import test from "node:test";

import type { MemoryItem, MemoryValidity } from "@ai-workspace/active-memory";
import type { SessionEvent } from "@ai-workspace/session-ingestion";

import {
  HistoricalSearchError,
  TolerantHistoricalIndex,
  type HistoricalEvent,
  type HistoricalSearchDependencies,
} from "../src/index.ts";

const encoder = new TextEncoder();

/**
 * The two rules of the single searchable surface are checked against every
 * probe a caller could plausibly type, not against one query that happens to
 * work. An inadmissible item that surfaces only for an unusual spelling is the
 * same defect as one that surfaces for the obvious one.
 */
const PROBES: readonly string[] = Object.freeze([
  "il totale del carrello va arrotondato per difetto",
  "totale carrello",
  "arrotondato",
  "arrotondamento",
  "arrotondat",
  "arotondato",
  "carrelo",
  "TOTALE CARRELLO",
  "carrello totale difetto",
  "difetto",
]);

test("never returns a memory item that is not active, whatever is typed", async () => {
  const dependencies = depsOf({
    events: [event("un messaggio senza relazione", 1)],
    memory: [
      memoryItem(
        "memory-superseded",
        "il totale del carrello va arrotondato per difetto",
        "SUPERSEDED",
      ),
      memoryItem(
        "memory-invalidated",
        "il totale del carrello va arrotondato per difetto",
        "INVALIDATED",
      ),
      memoryItem(
        "memory-active",
        "il totale del carrello va arrotondato per eccesso",
        "ACTIVE",
      ),
    ],
  });
  const index = await TolerantHistoricalIndex.build(dependencies, [
    "project-a",
  ]);
  assert.equal(index.indexedMemoryItems, 3);
  let reached = 0;
  for (const probe of PROBES) {
    for (const result of index.search(probe).results) {
      assert.equal(
        result.store === "ACTIVE_MEMORY" ? result.validity : "ACTIVE",
        "ACTIVE",
      );
      if (result.store === "ACTIVE_MEMORY") {
        assert.notEqual(result.memoryId, "memory-superseded");
        assert.notEqual(result.memoryId, "memory-invalidated");
        reached += 1;
      }
    }
  }
  assert.ok(reached > 0, "the admissible item must still be reachable");
});

test("returns one answer when a memory item and its event share provenance", async () => {
  const extracted = event("la decisione sul totale del carrello", 7);
  const dependencies = depsOf({
    events: [extracted],
    memory: [
      memoryItem(
        "memory-from-event",
        "la decisione sul totale del carrello",
        "ACTIVE",
        [linkTo(extracted.event)],
      ),
    ],
  });
  const index = await TolerantHistoricalIndex.build(dependencies, [
    "project-a",
  ]);
  const results = index.search("decisione totale carrello").results;
  assert.equal(results.length, 1);

  /** Without the shared source the same two texts are two peers. */
  const unrelated = depsOf({
    events: [extracted],
    memory: [
      memoryItem(
        "memory-standalone",
        "la decisione sul totale del carrello",
        "ACTIVE",
      ),
    ],
  });
  const peers = await TolerantHistoricalIndex.build(unrelated, ["project-a"]);
  assert.equal(peers.search("decisione totale carrello").results.length, 2);
});

test("reads no store while answering, because answering cannot await", async () => {
  const dependencies = countedDeps({
    events: [
      event("il totale del carrello", 1),
      event("un altro messaggio", 2),
    ],
    memory: [memoryItem("memory-active", "vincolo sul carrello", "ACTIVE")],
  });
  const index = await TolerantHistoricalIndex.build(dependencies.ports, [
    "project-a",
  ]);
  const afterBuild = { ...dependencies.calls };
  assert.ok(afterBuild.events > 0 && afterBuild.memory > 0);

  const report = index.search("carrello");
  assert.ok(
    !(report instanceof Promise),
    "search must be synchronous, so it cannot reach a port",
  );
  for (const probe of PROBES) index.search(probe);
  assert.deepEqual({ ...dependencies.calls }, afterBuild);

  /** Rebuilding is the only thing that reads again, and it says so by awaiting. */
  await index.rebuild();
  assert.ok(dependencies.calls.events > afterBuild.events);
});

test("ranks both stores into one list in which every entry declares its store", async () => {
  const dependencies = depsOf({
    events: [event("il totale del carrello resta invariato", 1)],
    memory: [
      memoryItem("memory-active", "vincolo sul totale del carrello", "ACTIVE"),
    ],
  });
  const index = await TolerantHistoricalIndex.build(dependencies, [
    "project-a",
  ]);
  const report = index.search("totale carrello");
  assert.equal(report.indexedEvents, 1);
  assert.equal(report.indexedMemoryItems, 1);
  assert.equal(report.results.length, 2);
  assert.deepEqual(
    new Set(report.results.map((result) => result.store)),
    new Set(["SESSION_EVENTS", "ACTIVE_MEMORY"]),
  );
  for (const result of report.results) {
    assert.equal(result.projectId, "project-a");
    assert.ok(result.score > 0);
    assert.ok(
      result.reasons.length > 0 &&
        result.reasons.every((reason) => reason.term.length > 0),
      "every entry must state why it was returned",
    );
  }
});

test("indexes what a person saw, not the provenance around it", async () => {
  const payload = JSON.stringify({
    recordUuid: "f".repeat(36),
    recordType: "assistant",
    isSidechain: false,
    blockIndex: 0,
    blockType: "text",
    text: "il totale del carrello va arrotondato per difetto",
  });
  const dependencies = depsOf({ events: [event(payload, 1)], memory: [] });
  const index = await TolerantHistoricalIndex.build(dependencies, [
    "project-a",
  ]);
  assert.equal(index.search("arrotondato difetto").results.length, 1);
  /** The unique provenance field must not have become a searchable term. */
  assert.equal(index.search("f".repeat(36)).results.length, 0);
});

test("refuses to answer once invalidated, and answers again once rebuilt", async () => {
  const dependencies = depsOf({
    events: [event("il totale del carrello", 1)],
    memory: [],
  });
  const index = await TolerantHistoricalIndex.build(dependencies, [
    "project-a",
  ]);
  assert.equal(index.search("carrello").results.length, 1);
  index.invalidate();
  assert.equal(index.isStale, true);
  assert.throws(() => index.search("carrello"));
  await index.rebuild();
  assert.equal(index.isStale, false);
  assert.equal(index.search("carrello").results.length, 1);
});

test("refuses a selection larger than the bound it was measured at", async () => {
  const events = Array.from({ length: 10_001 }, (_, position) =>
    event(`messaggio numero ${position}`, position),
  );
  const dependencies = depsOf({ events, memory: [] });
  await assert.rejects(
    () => TolerantHistoricalIndex.build(dependencies, ["project-a"]),
    HistoricalSearchError,
  );
});

test("refuses an unregistered project and a repeated one", async () => {
  const dependencies = depsOf({ events: [], memory: [] });
  await assert.rejects(
    () => TolerantHistoricalIndex.build(dependencies, ["project-b"]),
    HistoricalSearchError,
  );
  await assert.rejects(
    () =>
      TolerantHistoricalIndex.build(dependencies, ["project-a", "project-a"]),
    HistoricalSearchError,
  );
  await assert.rejects(
    () => TolerantHistoricalIndex.build(dependencies, []),
    HistoricalSearchError,
  );
});

test("covers events alone where a deployment has no active memory", async () => {
  const dependencies = depsOf({
    events: [event("il totale del carrello", 1)],
    memory: null,
  });
  const index = await TolerantHistoricalIndex.build(dependencies, [
    "project-a",
  ]);
  assert.equal(index.indexedMemoryItems, 0);
  assert.equal(index.search("carrello").results.length, 1);
});

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function event(text: string, sequence: number): HistoricalEvent {
  const artifactId = `artifact://sha256/${"a".repeat(64)}`;
  const sessionEvent: SessionEvent = Object.freeze({
    id: `event_${String(sequence).padStart(64, "b")}`,
    sessionId: `session_${"c".repeat(64)}`,
    sequence,
    type: "USER_MESSAGE",
    occurredAt: `2026-01-15T09:00:00.${String(sequence).padStart(3, "0")}Z`,
    trust: "UNTRUSTED",
    payload: Object.freeze({ kind: "INLINE_TEXT" as const, text }),
    source: Object.freeze({
      artifactId,
      sourceType: "codex",
      sourceSessionId: "synthetic-session",
      position: sequence,
      recordHash: "d".repeat(64),
    }),
  });
  return Object.freeze({ projectId: "project-a", event: sessionEvent });
}

function linkTo(source: SessionEvent): MemoryItem["sources"][number] {
  return Object.freeze({
    eventId: source.id,
    sessionId: source.sessionId,
    eventType: source.type,
    trust: "UNTRUSTED" as const,
    sourceArtifactId: source.source.artifactId,
    sourcePosition: source.source.position,
    sourceRecordHash: source.source.recordHash,
  });
}

function memoryItem(
  id: string,
  content: string,
  validity: MemoryValidity,
  sources: MemoryItem["sources"] = [],
): MemoryItem {
  return Object.freeze({
    id,
    projectId: "project-a",
    type: "DECISION" as const,
    content,
    curation: "USER_CURATED" as const,
    validity,
    verification: "UNVERIFIED" as const,
    confidence: "UNASSESSED" as const,
    version: 1,
    sources: Object.freeze(sources),
    creationOperationId: `operation-${id}`,
    createdBy: "LOCAL_USER" as const,
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: "2026-01-15T09:00:00.000Z",
    supersedes: null,
    supersession: null,
    verifications: Object.freeze([]),
    invalidation: null,
  });
}

function depsOf(
  fixture: Readonly<{
    events: readonly HistoricalEvent[];
    memory: readonly MemoryItem[] | null;
  }>,
): HistoricalSearchDependencies {
  return Object.freeze({
    events: {
      list: async () => fixture.events,
      find: async () => fixture.events[0] ?? null,
    },
    artifacts: { read: async () => encoder.encode("unused") },
    projects: { exists: async (id: string) => id === "project-a" },
    ...(fixture.memory === null
      ? {}
      : { memory: { list: async () => fixture.memory ?? [] } }),
  });
}

function countedDeps(
  fixture: Readonly<{
    events: readonly HistoricalEvent[];
    memory: readonly MemoryItem[];
  }>,
): Readonly<{
  ports: HistoricalSearchDependencies;
  calls: { events: number; memory: number; artifacts: number };
}> {
  const calls = { events: 0, memory: 0, artifacts: 0 };
  return Object.freeze({
    calls,
    ports: Object.freeze({
      events: {
        list: async () => {
          calls.events += 1;
          return fixture.events;
        },
        find: async () => fixture.events[0] ?? null,
      },
      artifacts: {
        read: async () => {
          calls.artifacts += 1;
          return encoder.encode("unused");
        },
      },
      projects: { exists: async (id: string) => id === "project-a" },
      memory: {
        list: async () => {
          calls.memory += 1;
          return fixture.memory;
        },
      },
    }),
  });
}
