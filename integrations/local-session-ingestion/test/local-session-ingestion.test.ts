import assert from "node:assert/strict";
import { access, chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ImportedSession } from "@ai-workspace/session-ingestion";

import {
  FileArtifactStore,
  HighConfidenceRestrictedDataScreen,
  JsonSessionStore,
  LocalHistoricalEventReader,
} from "../src/index.ts";

test("stores identical artifacts once and detects content corruption", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-artifact-"));
  const store = new FileArtifactStore(home);
  const content = Buffer.from("synthetic artifact", "utf8");

  try {
    const first = await store.put(content);
    const second = await store.put(content);
    assert.deepEqual(second, first);
    assert.deepEqual(await store.read(first.id), content);

    const digest = first.id.slice("artifact://sha256/".length);
    const artifactPath = join(
      home,
      "artifacts",
      "sha256",
      digest.slice(0, 2),
      digest,
    );
    assert.equal((await stat(artifactPath)).mode & 0o777, 0o600);
    await chmod(artifactPath, 0o600);
    await writeFile(artifactPath, "corrupted", "utf8");
    await assert.rejects(store.put(content), /integrity check failed/u);
    await assert.rejects(store.read(first.id), /failed its SHA-256/u);
    await assert.rejects(
      store.read(`artifact://sha256/${"f".repeat(64)}`),
      /was not found.*Reimport/u,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("persists an append-only session and rejects event replacement and locks", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-session-store-"));
  const store = new JsonSessionStore(home);
  const first = makeSession(["first"]);

  try {
    await store.append(first, 0);
    assert.deepEqual(await store.load(first.id), first);
    const sessionDirectory = join(home, "sessions");
    const sessionPath = join(sessionDirectory, `${first.id}.json`);
    assert.equal((await stat(sessionDirectory)).mode & 0o777, 0o700);
    assert.equal((await stat(sessionPath)).mode & 0o777, 0o600);

    const extended = makeSession(["first", "second"]);
    await store.append(extended, 1);
    assert.equal((await store.load(first.id))?.events.length, 2);
    const reader = new LocalHistoricalEventReader(home);
    assert.equal((await reader.list("project-1")).length, 2);
    assert.equal((await reader.list("another-project")).length, 0);
    assert.equal(
      (await reader.find("project-1", extended.events[1]?.id ?? ""))?.event
        .sequence,
      2,
    );

    const replaced = makeSession(["changed", "second"]);
    await assert.rejects(store.append(replaced, 2), /cannot be changed/u);

    const lockPath = join(home, "sessions", `${first.id}.json.lock`);
    await writeFile(lockPath, "synthetic lock", { mode: 0o600 });
    await assert.rejects(store.append(extended, 2), /holds the session lock/u);
    await access(lockPath);
    assert.equal((await store.load(first.id))?.events.length, 2);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("blocks a fictional restricted-data canary without echoing it", () => {
  const screen = new HighConfidenceRestrictedDataScreen();
  const canary = "synthetic_canary_value_12345";
  const content = Buffer.from(`password=${canary}`, "utf8");

  assert.throws(
    () => screen.assertAllowed(content, "source record 4"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /source record 4.*assigned-credential/u);
      assert.doesNotMatch(error.message, new RegExp(canary, "u"));
      return true;
    },
  );
});

function makeSession(payloads: readonly string[]): ImportedSession {
  const sessionId = `session_${"a".repeat(64)}`;
  const artifactId = `artifact://sha256/${"c".repeat(64)}`;

  return Object.freeze({
    id: sessionId,
    projectId: "project-1",
    sourceType: "codex",
    sourceSessionId: "synthetic-session",
    agent: "codex",
    model: null,
    startedAt: null,
    createdAt: "2026-01-15T10:00:00.000Z",
    lastImportedAt: "2026-01-15T10:00:00.000Z",
    latestSourceArtifact: Object.freeze({
      id: artifactId,
      byteLength: 100,
    }),
    events: Object.freeze(
      payloads.map((payload, index) =>
        Object.freeze({
          id: `event_${String(index + 1).padStart(64, "b")}`,
          sessionId,
          sequence: index + 1,
          type: "USER_MESSAGE" as const,
          occurredAt: null,
          trust: "UNTRUSTED" as const,
          payload: Object.freeze({
            kind: "INLINE_TEXT" as const,
            text: payload,
          }),
          source: Object.freeze({
            artifactId,
            sourceType: "codex",
            sourceSessionId: "synthetic-session",
            position: index + 1,
            recordHash: String(index + 1).padStart(64, "d"),
          }),
        }),
      ),
    ),
  });
}
