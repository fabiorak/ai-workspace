import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";
import test from "node:test";

import {
  SessionImportError,
  SessionIngestion,
  type ArtifactReference,
  type ArtifactStore,
  type ImportedSession,
  type RestrictedDataScreen,
  type SessionSource,
  type SessionStore,
} from "../src/index.ts";

const encoder = new TextEncoder();

class MemorySessionStore implements SessionStore {
  public session: ImportedSession | null = null;
  public appendCalls = 0;

  public async load(): Promise<ImportedSession | null> {
    return this.session;
  }

  public async append(
    session: ImportedSession,
    expectedEventCount: number,
  ): Promise<void> {
    assert.equal(this.session?.events.length ?? 0, expectedEventCount);
    this.session = session;
    this.appendCalls += 1;
  }
}

class MemoryArtifactStore implements ArtifactStore {
  public readonly contents: Uint8Array[] = [];

  public async put(content: Uint8Array): Promise<ArtifactReference> {
    this.contents.push(content);
    return Object.freeze({
      id: `artifact://sha256/${hash(content)}`,
      byteLength: content.byteLength,
    });
  }
}

test("imports, reimports, and extends one source without duplicate events", async () => {
  const store = new MemorySessionStore();
  const artifacts = new MemoryArtifactStore();
  let source = makeSource(["first", "second"]);
  const ingestion = createIngestion(store, artifacts, () => source);

  const first = await ingestion.import("project-1", "fixture.jsonl");
  const firstIds = first.session.events.map((event) => event.id);
  assert.equal(first.addedEvents, 2);
  assert.equal(first.existingEvents, 0);

  const second = await ingestion.import("project-1", "fixture.jsonl");
  assert.equal(second.addedEvents, 0);
  assert.equal(second.existingEvents, 2);
  assert.deepEqual(
    second.session.events.map((event) => event.id),
    firstIds,
  );

  source = makeSource(["first", "second", "third"]);
  const extended = await ingestion.import("project-1", "fixture.jsonl");
  assert.equal(extended.addedEvents, 1);
  assert.equal(extended.existingEvents, 2);
  assert.equal(extended.totalEvents, 3);
  assert.deepEqual(
    extended.session.events.slice(0, 2).map((event) => event.id),
    firstIds,
  );
  assert.equal(extended.session.events[2]?.sequence, 3);
});

test("rejects a changed or truncated imported prefix", async () => {
  const store = new MemorySessionStore();
  const artifacts = new MemoryArtifactStore();
  let source = makeSource(["first", "second"]);
  const ingestion = createIngestion(store, artifacts, () => source);

  await ingestion.import("project-1", "fixture.jsonl");
  source = makeSource(["changed", "second"]);
  await assert.rejects(
    ingestion.import("project-1", "fixture.jsonl"),
    /changed at record 1/u,
  );

  source = makeSource(["first"]);
  await assert.rejects(
    ingestion.import("project-1", "fixture.jsonl"),
    /was truncated/u,
  );
  assert.equal(store.session?.events.length, 2);
});

test("screens raw and extracted content before storing artifacts", async () => {
  const store = new MemorySessionStore();
  const artifacts = new MemoryArtifactStore();
  const ingestion = new SessionIngestion({
    sourceAdapter: {
      sourceType: "codex",
      async read(): Promise<SessionSource> {
        return makeSource(["blocked"]);
      },
    },
    screen: {
      assertAllowed(): void {
        throw new SessionImportError(
          "Restricted data detected; import blocked",
        );
      },
    },
    artifactStore: artifacts,
    sessionStore: store,
    projects: {
      async exists(): Promise<boolean> {
        return true;
      },
    },
  });

  await assert.rejects(
    ingestion.import("project-1", "fixture.jsonl"),
    /Restricted data detected/u,
  );
  assert.equal(artifacts.contents.length, 0);
  assert.equal(store.appendCalls, 0);
});

test("stores large canonical payloads as artifacts", async () => {
  const store = new MemorySessionStore();
  const artifacts = new MemoryArtifactStore();
  const ingestion = createIngestion(store, artifacts, () =>
    makeSource(["x".repeat(4_097)]),
  );

  const report = await ingestion.import("project-1", "fixture.jsonl");
  assert.equal(report.session.events[0]?.payload.kind, "ARTIFACT");
  assert.equal(artifacts.contents.length, 2);
});

test("does not allow one provider session identity to cross projects", async () => {
  const store = new MemorySessionStore();
  const artifacts = new MemoryArtifactStore();
  const source = makeSource(["first"]);
  const ingestion = new SessionIngestion({
    sourceAdapter: {
      sourceType: "codex",
      async read() {
        return source;
      },
    },
    screen: { assertAllowed(): void {} },
    artifactStore: artifacts,
    sessionStore: store,
    projects: {
      async exists(): Promise<boolean> {
        return true;
      },
    },
    clock: () => new Date("2026-01-15T10:00:00.000Z"),
  });

  await ingestion.import("project-1", "fixture.jsonl");
  await assert.rejects(
    ingestion.import("project-2", "fixture.jsonl"),
    /identity conflicts/u,
  );
  assert.equal(store.session?.projectId, "project-1");
});

function createIngestion(
  sessionStore: SessionStore,
  artifactStore: ArtifactStore,
  source: () => SessionSource,
): SessionIngestion {
  const allowAll: RestrictedDataScreen = {
    assertAllowed(): void {},
  };

  return new SessionIngestion({
    sourceAdapter: {
      sourceType: "codex",
      async read(): Promise<SessionSource> {
        return source();
      },
    },
    screen: allowAll,
    artifactStore,
    sessionStore,
    projects: {
      async exists(projectId: string): Promise<boolean> {
        return projectId === "project-1";
      },
    },
    clock: () => new Date("2026-01-15T10:00:00.000Z"),
  });
}

function makeSource(payloads: readonly string[]): SessionSource {
  const records = payloads.map((payload) =>
    encoder.encode(
      JSON.stringify({
        recordType: "event",
        eventType: "user_message",
        payload,
      }),
    ),
  );

  return Object.freeze({
    sourceType: "codex",
    sourceSessionId: "synthetic-session",
    agent: "codex",
    model: null,
    startedAt: null,
    rawContent: encoder.encode(payloads.join("\n")),
    events: Object.freeze(
      records.map((rawRecord, index) =>
        Object.freeze({
          position: index + 1,
          type: "USER_MESSAGE" as const,
          occurredAt: null,
          payload: payloads[index] ?? "",
          rawRecord,
        }),
      ),
    ),
  });
}

function hash(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
