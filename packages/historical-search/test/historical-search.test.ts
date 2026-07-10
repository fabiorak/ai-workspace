import assert from "node:assert/strict";
import { TextEncoder } from "node:util";
import test from "node:test";

import type { SessionEvent } from "@ai-workspace/session-ingestion";

import { HistoricalSearch, type HistoricalEvent } from "../src/index.ts";

const encoder = new TextEncoder();

test("searches case-insensitively with deterministic filters and provenance", async () => {
  const events = [
    historicalEvent("first synthetic failure", "ERROR", 2),
    historicalEvent("Test Failed in a synthetic expectation", "TEST_RESULT", 1),
  ];
  const search = createSearch(events);

  const report = await search.search({
    projectId: "project-1",
    text: "test failed",
    type: "TEST_RESULT",
    limit: 1,
  });

  assert.equal(report.searchedEvents, 1);
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0]?.sequence, 1);
  assert.equal(report.results[0]?.trust, "UNTRUSTED");
  assert.equal(report.results[0]?.matchedIn, "INLINE_PAYLOAD");
  assert.match(report.results[0]?.source.artifactId ?? "", /^artifact:/u);

  const ordered = await search.search({
    projectId: "project-1",
    text: "synthetic",
  });
  assert.deepEqual(
    ordered.results.map((result) => result.sequence),
    [1, 2],
  );
});

test("searches artifact-backed payloads and opens bounded UTF-8 evidence", async () => {
  const event = historicalEvent("ignored", "COMMAND_RESULT", 1, true);
  const search = createSearch([event], "Large synthetic command failure");

  const report = await search.search({
    projectId: "project-1",
    text: "command failure",
  });
  assert.equal(report.results[0]?.matchedIn, "ARTIFACT_PAYLOAD");

  const opened = await search.openArtifact(event.event.source.artifactId);
  assert.equal(opened.content, "Large synthetic command failure");
});

test("guides invalid project, limit, and event recovery", async () => {
  const search = createSearch([]);

  await assert.rejects(
    search.search({ projectId: "missing", text: "failure" }),
    /project register/u,
  );
  await assert.rejects(
    search.search({ projectId: "project-1", text: "failure", limit: 101 }),
    /1 to 100/u,
  );
  await assert.rejects(
    search.showEvent("project-1", "event_missing"),
    /Run history search/u,
  );
});

test("rejects non-UTF-8 artifact content with recovery context", async () => {
  const event = historicalEvent("ignored", "ERROR", 1, true);
  const search = new HistoricalSearch({
    events: {
      async list() {
        return [event];
      },
      async find() {
        return event;
      },
    },
    artifacts: {
      async read() {
        return Uint8Array.from([0xff, 0xfe]);
      },
    },
    projects: {
      async exists() {
        return true;
      },
    },
  });

  await assert.rejects(
    search.search({ projectId: "project-1", text: "error" }),
    /not valid UTF-8.*cannot be searched or displayed/u,
  );
});

function createSearch(
  events: readonly HistoricalEvent[],
  artifactContent = "Synthetic source evidence",
): HistoricalSearch {
  return new HistoricalSearch({
    events: {
      async list(projectId: string, sessionId?: string) {
        return events.filter(
          (item) =>
            item.projectId === projectId &&
            (sessionId === undefined || item.event.sessionId === sessionId),
        );
      },
      async find(projectId: string, eventId: string) {
        return (
          events.find(
            (item) => item.projectId === projectId && item.event.id === eventId,
          ) ?? null
        );
      },
    },
    artifacts: {
      async read(): Promise<Uint8Array> {
        return encoder.encode(artifactContent);
      },
    },
    projects: {
      async exists(projectId: string): Promise<boolean> {
        return projectId === "project-1";
      },
    },
  });
}

function historicalEvent(
  text: string,
  type: SessionEvent["type"],
  sequence: number,
  artifactPayload = false,
): HistoricalEvent {
  const artifactId = `artifact://sha256/${"a".repeat(64)}`;
  const event: SessionEvent = Object.freeze({
    id: `event_${String(sequence).padStart(64, "b")}`,
    sessionId: `session_${"c".repeat(64)}`,
    sequence,
    type,
    occurredAt: `2026-01-15T09:00:0${sequence}.000Z`,
    trust: "UNTRUSTED",
    payload: artifactPayload
      ? Object.freeze({
          kind: "ARTIFACT" as const,
          artifact: Object.freeze({ id: artifactId, byteLength: 31 }),
          mediaType: "application/json" as const,
        })
      : Object.freeze({ kind: "INLINE_TEXT" as const, text }),
    source: Object.freeze({
      artifactId,
      sourceType: "codex",
      sourceSessionId: "synthetic-session",
      position: sequence,
      recordHash: "d".repeat(64),
    }),
  });
  return Object.freeze({ projectId: "project-1", event });
}
