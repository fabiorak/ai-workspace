import assert from "node:assert/strict";
import test from "node:test";

import type { SessionEvent } from "@ai-workspace/session-ingestion";

import {
  ActiveMemory,
  ActiveMemoryConflictError,
  type ActiveMemoryStore,
  type MemoryInvalidationRecord,
  type MemoryItem,
  type MemorySupersessionRecord,
  type MemoryVerificationRecord,
  type SupersededMemory,
} from "../src/index.ts";

test("adds safe-default memory with immutable same-project provenance", async () => {
  const { memory } = createMemory();
  const item = await memory.add({
    projectId: "project-1",
    type: "CONSTRAINT",
    content: "  Use the synthetic supported runtime.  ",
    sourceEventIds: ["event-1"],
  });

  assert.equal(item.content, "Use the synthetic supported runtime.");
  assert.equal(item.validity, "ACTIVE");
  assert.equal(item.verification, "UNVERIFIED");
  assert.equal(item.confidence, "UNASSESSED");
  assert.equal(item.curation, "USER_CURATED");
  assert.equal(item.createdBy, "LOCAL_USER");
  assert.deepEqual(item.sources[0], {
    eventId: "event-1",
    sessionId: "session-1",
    eventType: "AGENT_MESSAGE",
    trust: "UNTRUSTED",
    sourceArtifactId: `artifact://sha256/${"a".repeat(64)}`,
    sourcePosition: 1,
    sourceRecordHash: "b".repeat(64),
  });
});

test("lists active items by default with deterministic filters", async () => {
  const { memory } = createMemory();
  await memory.add({
    projectId: "project-1",
    type: "FAILURE",
    content: "Synthetic failure",
    sourceEventIds: ["event-1"],
  });
  const decision = await memory.add({
    projectId: "project-1",
    type: "DECISION",
    content: "Synthetic decision",
    sourceEventIds: ["event-2"],
  });
  await memory.invalidate({
    projectId: "project-1",
    memoryId: decision.id,
    sourceEventIds: ["event-2"],
    reason: "Synthetic decision no longer applies",
  });

  const active = await memory.list({ projectId: "project-1" });
  assert.deepEqual(
    active.items.map((item) => item.type),
    ["FAILURE"],
  );
  assert.equal(active.nextCursor, null);

  const invalidated = await memory.list({
    projectId: "project-1",
    validity: "INVALIDATED",
    type: "DECISION",
  });
  assert.deepEqual(
    invalidated.items.map((item) => item.id),
    [decision.id],
  );
});

test("paginates newest-first with a stable ID tie-break", async () => {
  const { memory } = createMemory({
    timestamps: [
      "2026-07-10T10:00:00.000Z",
      "2026-07-10T12:00:00.000Z",
      "2026-07-10T12:00:00.000Z",
    ],
  });

  for (const content of ["First", "Second", "Third"]) {
    await memory.add({
      projectId: "project-1",
      type: "DECISION",
      content: `Synthetic ${content.toLowerCase()} decision`,
      sourceEventIds: ["event-1"],
    });
  }

  const firstPage = await memory.list({ projectId: "project-1", limit: 2 });
  assert.deepEqual(
    firstPage.items.map((item) => item.content),
    ["Synthetic second decision", "Synthetic third decision"],
  );
  assert.ok(firstPage.nextCursor !== null);
  const cursor = firstPage.nextCursor;

  const secondPage = await memory.list({
    projectId: "project-1",
    limit: 2,
    cursor,
  });
  assert.deepEqual(
    secondPage.items.map((item) => item.content),
    ["Synthetic first decision"],
  );
  assert.equal(secondPage.nextCursor, null);

  await assert.rejects(
    memory.list({
      projectId: "project-1",
      type: "FAILURE",
      cursor,
    }),
    /cursor is invalid or does not match.*without a cursor/u,
  );
  await assert.rejects(
    memory.list({ projectId: "project-1", cursor: "not-a-cursor" }),
    /cursor is invalid or does not match.*without a cursor/u,
  );
});

test("records one explicit verification only while active", async () => {
  const { memory } = createMemory();
  const item = await memory.add({
    projectId: "project-1",
    type: "DECISION",
    content: "Use the synthetic implementation",
    sourceEventIds: ["event-1"],
  });
  const verified = await memory.verify({
    projectId: "project-1",
    memoryId: item.id,
    sourceEventIds: ["event-2"],
    note: "Checked against the synthetic test result",
  });

  assert.equal(verified.verification, "VERIFIED");
  assert.equal(verified.version, 2);
  assert.equal(verified.verifications.length, 1);
  assert.equal(verified.verifications[0]?.actor, "LOCAL_USER");
  assert.equal(verified.sources[0]?.eventId, "event-1");
  assert.equal(verified.verifications[0]?.sources[0]?.eventId, "event-2");

  await assert.rejects(
    memory.verify({
      projectId: "project-1",
      memoryId: item.id,
      sourceEventIds: ["event-2"],
      note: "Duplicate synthetic check",
    }),
    /already VERIFIED/u,
  );
});

test("supersedes additively and resets replacement assessment", async () => {
  const { memory } = createMemory();
  const original = await memory.add({
    projectId: "project-1",
    type: "CONSTRAINT",
    content: "Original synthetic constraint",
    sourceEventIds: ["event-1"],
  });
  await memory.verify({
    projectId: "project-1",
    memoryId: original.id,
    sourceEventIds: ["event-1"],
    note: "Original synthetic verification",
  });
  const result = await memory.supersede({
    projectId: "project-1",
    memoryId: original.id,
    content: "Replacement synthetic constraint",
    sourceEventIds: ["event-2"],
  });

  assert.equal(result.previous.content, original.content);
  assert.equal(result.previous.validity, "SUPERSEDED");
  assert.equal(
    result.previous.supersession?.replacementId,
    result.replacement.id,
  );
  assert.equal(result.replacement.supersedes, original.id);
  assert.equal(result.replacement.validity, "ACTIVE");
  assert.equal(result.replacement.verification, "UNVERIFIED");
  assert.equal(result.replacement.confidence, "UNASSESSED");

  await assert.rejects(
    memory.invalidate({
      projectId: "project-1",
      memoryId: original.id,
      sourceEventIds: ["event-2"],
      reason: "Invalid terminal transition",
    }),
    /SUPERSEDED.*cannot transition again/u,
  );
});

test("rejects missing or foreign sources without exposing foreign data", async () => {
  const { memory } = createMemory();

  await assert.rejects(
    memory.add({
      projectId: "project-1",
      type: "FAILURE",
      content: "Synthetic failure",
      sourceEventIds: ["foreign-event"],
    }),
    /was not found in project 'project-1'.*history search/u,
  );
  await assert.rejects(
    memory.add({
      projectId: "project-1",
      type: "FAILURE",
      content: "Synthetic failure",
      sourceEventIds: [],
    }),
    /1 to 20 source event IDs/u,
  );
});

function createMemory(options?: { readonly timestamps: readonly string[] }): {
  memory: ActiveMemory;
  store: InMemoryStore;
} {
  const store = new InMemoryStore();
  const events = new Map([
    ["event-1", sourceEvent("event-1", "session-1", 1)],
    ["event-2", sourceEvent("event-2", "session-1", 2)],
    ["foreign-event", sourceEvent("foreign-event", "foreign-session", 1)],
  ]);
  let nextId = 0;
  let nextTimestamp = 0;
  const memory = new ActiveMemory({
    store,
    sourceEvents: {
      async find(projectId, eventId) {
        if (projectId !== "project-1" || eventId === "foreign-event") {
          return null;
        }

        return events.get(eventId) ?? null;
      },
    },
    projects: {
      async exists(projectId) {
        return projectId === "project-1";
      },
    },
    ids() {
      nextId += 1;
      return `id-${String(nextId).padStart(4, "0")}`;
    },
    clock() {
      const timestamp =
        options?.timestamps[nextTimestamp] ?? "2026-07-10T12:00:00.000Z";
      nextTimestamp += 1;
      return new Date(timestamp);
    },
  });
  return { memory, store };
}

class InMemoryStore implements ActiveMemoryStore {
  readonly #items = new Map<string, MemoryItem>();

  public async list(projectId: string): Promise<readonly MemoryItem[]> {
    return [...this.#items.values()].filter(
      (item) => item.projectId === projectId,
    );
  }

  public async find(
    projectId: string,
    memoryId: string,
  ): Promise<MemoryItem | null> {
    const item = this.#items.get(memoryId);
    return item?.projectId === projectId ? item : null;
  }

  public async create(item: MemoryItem): Promise<MemoryItem> {
    this.#items.set(item.id, item);
    return item;
  }

  public async verify(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    record: MemoryVerificationRecord,
  ): Promise<MemoryItem> {
    const current = this.#current(projectId, memoryId, expectedVersion);
    const updated = Object.freeze({
      ...current,
      verification: "VERIFIED" as const,
      version: current.version + 1,
      updatedAt: record.occurredAt,
      verifications: Object.freeze([...current.verifications, record]),
    });
    this.#items.set(memoryId, updated);
    return updated;
  }

  public async supersede(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    replacement: MemoryItem,
    record: MemorySupersessionRecord,
  ): Promise<SupersededMemory> {
    const current = this.#current(projectId, memoryId, expectedVersion);
    const previous = Object.freeze({
      ...current,
      validity: "SUPERSEDED" as const,
      version: current.version + 1,
      updatedAt: record.occurredAt,
      supersession: record,
    });
    this.#items.set(previous.id, previous);
    this.#items.set(replacement.id, replacement);
    return Object.freeze({ previous, replacement });
  }

  public async invalidate(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    record: MemoryInvalidationRecord,
  ): Promise<MemoryItem> {
    const current = this.#current(projectId, memoryId, expectedVersion);
    const updated = Object.freeze({
      ...current,
      validity: "INVALIDATED" as const,
      version: current.version + 1,
      updatedAt: record.occurredAt,
      invalidation: record,
    });
    this.#items.set(memoryId, updated);
    return updated;
  }

  #current(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
  ): MemoryItem {
    const current = this.#items.get(memoryId);

    if (current === undefined || current.projectId !== projectId) {
      throw new Error("Test store item missing");
    }

    if (current.version !== expectedVersion) {
      throw new ActiveMemoryConflictError(memoryId);
    }

    return current;
  }
}

function sourceEvent(
  id: string,
  sessionId: string,
  position: number,
): SessionEvent {
  return Object.freeze({
    id,
    sessionId,
    sequence: position,
    type: "AGENT_MESSAGE",
    occurredAt: "2026-07-10T11:00:00.000Z",
    trust: "UNTRUSTED",
    payload: Object.freeze({
      kind: "INLINE_TEXT" as const,
      text: "Synthetic evidence",
    }),
    source: Object.freeze({
      artifactId: `artifact://sha256/${"a".repeat(64)}`,
      sourceType: "codex",
      sourceSessionId: sessionId,
      position,
      recordHash: "b".repeat(64),
    }),
  });
}
