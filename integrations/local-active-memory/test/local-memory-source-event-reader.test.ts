import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { JsonSessionStore } from "@ai-workspace/local-session-ingestion";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import { LocalMemorySourceEventReader } from "../src/index.ts";

test("resolves a canonical event only inside the requested project", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-memory-source-"));
  const store = new JsonSessionStore(home);
  const local = makeSession("a", "project-1", "b");
  const foreign = makeSession("d", "project-2", "e");

  try {
    await store.append(local, 0);
    await store.append(foreign, 0);
    const reader = new LocalMemorySourceEventReader(home);
    const localEvent = local.events[0];
    const foreignEvent = foreign.events[0];
    assert.ok(localEvent !== undefined);
    assert.ok(foreignEvent !== undefined);

    assert.deepEqual(await reader.find("project-1", localEvent.id), localEvent);
    assert.equal(await reader.find("project-1", foreignEvent.id), null);
    assert.equal(
      await reader.find("project-1", `event_${"f".repeat(64)}`),
      null,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("fails closed when canonical session storage is corrupt", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-memory-source-"));
  const session = makeSession("a", "project-1", "b");

  try {
    const store = new JsonSessionStore(home);
    await store.append(session, 0);
    await writeFile(
      join(home, "sessions", `${session.id}.json`),
      "synthetic invalid JSON",
      "utf8",
    );

    const reader = new LocalMemorySourceEventReader(home);
    await assert.rejects(
      reader.find("project-1", session.events[0]?.id ?? ""),
      /local session store is invalid.*not valid JSON/u,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

function makeSession(
  sessionCharacter: string,
  projectId: string,
  eventCharacter: string,
): ImportedSession {
  const sessionId = `session_${sessionCharacter.repeat(64)}`;
  const artifactId = `artifact://sha256/${"c".repeat(64)}`;

  return Object.freeze({
    id: sessionId,
    projectId,
    sourceType: "codex",
    sourceSessionId: `synthetic-${sessionCharacter}`,
    agent: "codex",
    model: null,
    startedAt: null,
    createdAt: "2026-01-15T10:00:00.000Z",
    lastImportedAt: "2026-01-15T10:00:00.000Z",
    latestSourceArtifact: Object.freeze({ id: artifactId, byteLength: 100 }),
    events: Object.freeze([
      Object.freeze({
        id: `event_${eventCharacter.repeat(64)}`,
        sessionId,
        sequence: 1,
        type: "USER_MESSAGE" as const,
        occurredAt: null,
        trust: "UNTRUSTED" as const,
        payload: Object.freeze({
          kind: "INLINE_TEXT" as const,
          text: "Synthetic provenance evidence",
        }),
        source: Object.freeze({
          artifactId,
          sourceType: "codex",
          sourceSessionId: `synthetic-${sessionCharacter}`,
          position: 1,
          recordHash: "d".repeat(64),
        }),
      }),
    ]),
  });
}
