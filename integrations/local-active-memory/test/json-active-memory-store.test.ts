import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ActiveMemoryConflictError,
  type MemoryItem,
} from "@ai-workspace/active-memory";

import { JsonActiveMemoryStore } from "../src/index.ts";

const PROJECT_ID = "synthetic-project";
const ITEM_1 = uuid(1);
const ITEM_2 = uuid(2);

test("persists and reloads the complete active-memory lifecycle", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-active-memory-"));

  try {
    const store = new JsonActiveMemoryStore(home);
    const created = await store.create(item(ITEM_1, uuid(11)));
    assert.equal(created.validity, "ACTIVE");

    const verified = await store.verify(PROJECT_ID, ITEM_1, 1, {
      id: uuid(12),
      actor: "LOCAL_USER",
      occurredAt: "2026-07-10T11:00:00.000Z",
      note: "Synthetic verification method",
      sources: [source(2)],
    });
    assert.equal(verified.verification, "VERIFIED");

    const superseded = await store.supersede(
      PROJECT_ID,
      ITEM_1,
      2,
      item(ITEM_2, uuid(14), ITEM_1, "Synthetic replacement constraint"),
      {
        id: uuid(13),
        actor: "LOCAL_USER",
        occurredAt: "2026-07-10T12:00:00.000Z",
        replacementId: ITEM_2,
        sources: [source(3)],
      },
    );
    assert.equal(superseded.previous.validity, "SUPERSEDED");
    assert.equal(superseded.replacement.confidence, "UNASSESSED");

    const invalidated = await store.invalidate(PROJECT_ID, ITEM_2, 1, {
      id: uuid(15),
      actor: "LOCAL_USER",
      occurredAt: "2026-07-10T13:00:00.000Z",
      reason: "Synthetic replacement expired",
      sources: [source(4)],
    });
    assert.equal(invalidated.validity, "INVALIDATED");

    const reloaded = new JsonActiveMemoryStore(home);
    assert.equal((await reloaded.list(PROJECT_ID)).length, 2);
    assert.equal((await reloaded.find(PROJECT_ID, ITEM_1))?.version, 3);
    assert.equal((await reloaded.find(PROJECT_ID, ITEM_2))?.version, 2);
    assert.equal(await reloaded.find("another-project", ITEM_1), null);

    const directory = join(home, "memory");
    const document = documentPath(home, PROJECT_ID);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(document)).mode & 0o777, 0o600);
    assert.deepEqual(
      (await readdir(directory)).filter((entry) => entry.endsWith(".tmp")),
      [],
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("serializes concurrent transitions and reports the stale caller", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-active-memory-"));

  try {
    const store = new JsonActiveMemoryStore(home);
    await store.create(item(ITEM_1, uuid(11)));
    const outcomes = await Promise.allSettled([
      store.verify(PROJECT_ID, ITEM_1, 1, {
        id: uuid(12),
        actor: "LOCAL_USER",
        occurredAt: "2026-07-10T11:00:00.000Z",
        note: "Synthetic verification one",
        sources: [source(2)],
      }),
      store.verify(PROJECT_ID, ITEM_1, 1, {
        id: uuid(13),
        actor: "LOCAL_USER",
        occurredAt: "2026-07-10T11:00:01.000Z",
        note: "Synthetic verification two",
        sources: [source(3)],
      }),
    ]);

    assert.equal(
      outcomes.filter((outcome) => outcome.status === "fulfilled").length,
      1,
    );
    const rejection = outcomes.find((outcome) => outcome.status === "rejected");
    assert.ok(rejection?.status === "rejected");
    assert.ok(
      rejection.reason instanceof ActiveMemoryConflictError ||
        /holds the active-memory lock/u.test(String(rejection.reason)),
    );
    assert.equal((await store.find(PROJECT_ID, ITEM_1))?.version, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("diagnoses an existing lock without removing it", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-active-memory-"));
  const memoryDirectory = join(home, "memory");
  const lockPath = `${documentPath(home, PROJECT_ID)}.lock`;
  const ownerToken = uuid(90);

  try {
    await mkdir(memoryDirectory, { recursive: true, mode: 0o700 });
    await writeFile(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 1,
        ownerToken,
        pid: 4242,
        createdAt: "2026-07-10T09:00:00.000Z",
      })}\n`,
      { mode: 0o600 },
    );

    await assert.rejects(
      new JsonActiveMemoryStore(home).create(item(ITEM_1, uuid(11))),
      /PID 4242.*2026-07-10T09:00:00.000Z.*owner.*remove the lock only after confirming/u,
    );
    assert.match(await readFile(lockPath, "utf8"), new RegExp(ownerToken, "u"));
    assert.deepEqual(await readdir(memoryDirectory), [
      lockPath.slice(memoryDirectory.length + 1),
    ]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("fails closed on corruption and leaves no partial replacement", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-active-memory-"));
  const document = documentPath(home, PROJECT_ID);

  try {
    const store = new JsonActiveMemoryStore(home);
    await store.create(item(ITEM_1, uuid(11)));
    const original = await readFile(document, "utf8");
    await writeFile(document, "synthetic corrupt JSON", "utf8");

    await assert.rejects(
      store.verify(PROJECT_ID, ITEM_1, 1, {
        id: uuid(12),
        actor: "LOCAL_USER",
        occurredAt: "2026-07-10T11:00:00.000Z",
        note: "Synthetic verification method",
        sources: [source(2)],
      }),
      /active-memory log is invalid.*not valid JSON.*rebuild memory/u,
    );
    assert.equal(await readFile(document, "utf8"), "synthetic corrupt JSON");
    assert.deepEqual(
      (await readdir(join(home, "memory"))).filter(
        (entry) => entry.endsWith(".tmp") || entry.endsWith(".lock"),
      ),
      [],
    );

    await writeFile(document, original, "utf8");
    assert.equal((await store.find(PROJECT_ID, ITEM_1))?.version, 1);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

function item(
  id: string,
  creationOperationId: string,
  supersedes: string | null = null,
  content = "Synthetic runtime constraint",
): MemoryItem {
  return Object.freeze({
    id,
    projectId: PROJECT_ID,
    type: "CONSTRAINT",
    content,
    curation: "USER_CURATED",
    validity: "ACTIVE",
    verification: "UNVERIFIED",
    confidence: "UNASSESSED",
    version: 1,
    sources: Object.freeze([source(supersedes === null ? 1 : 3)]),
    creationOperationId,
    createdBy: "LOCAL_USER",
    createdAt:
      supersedes === null
        ? "2026-07-10T10:00:00.000Z"
        : "2026-07-10T12:00:00.000Z",
    updatedAt:
      supersedes === null
        ? "2026-07-10T10:00:00.000Z"
        : "2026-07-10T12:00:00.000Z",
    supersedes,
    supersession: null,
    verifications: Object.freeze([]),
    invalidation: null,
  });
}

function source(position: number) {
  return Object.freeze({
    eventId: `event_${String(position).padStart(64, "a")}`,
    sessionId: `session_${"b".repeat(64)}`,
    eventType: "AGENT_MESSAGE" as const,
    trust: "UNTRUSTED" as const,
    sourceArtifactId: `artifact://sha256/${"c".repeat(64)}`,
    sourcePosition: position,
    sourceRecordHash: "d".repeat(64),
  });
}

function documentPath(home: string, projectId: string): string {
  const digest = createHash("sha256").update(projectId, "utf8").digest("hex");
  return join(home, "memory", `project_${digest}.json`);
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}
