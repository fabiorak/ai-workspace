import assert from "node:assert/strict";
import { TextEncoder } from "node:util";
import test from "node:test";

import type { SessionEvent } from "@ai-workspace/session-ingestion";
import type { GeneralConversation } from "@ai-workspace/general-conversation";
import type { GeneralProjectLink } from "@ai-workspace/general-project-link";

import { HistoricalSearch, type HistoricalEvent } from "../src/index.ts";

const encoder = new TextEncoder();

test("searches General without projects and merges all scopes before the global limit", async () => {
  const general = generalConversation(
    "shared evidence general",
    "2026-01-15T09:00:00.000Z",
  );
  const project = historicalEventFor(
    "project-a",
    "shared evidence project",
    "USER_MESSAGE",
    1,
  );
  const search = new HistoricalSearch({
    events: { list: async () => [project], find: async () => project },
    artifacts: { read: async () => encoder.encode("unused") },
    projects: { exists: async (id) => id === "project-a" },
    general: { list: async () => [general] },
  });
  const only = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: "SHARED EVIDENCE",
  });
  assert.equal(only.searchedProjects, 0);
  assert.equal(only.results[0]?.scope, "GENERAL");
  const filtered = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: "shared evidence",
    type: "ERROR",
  });
  assert.equal(filtered.query.type, "ERROR");
  assert.equal(filtered.results.length, 0);
  const all = await search.searchAcrossScopes({
    scope: "ALL_SCOPES",
    projectIds: ["project-a"],
    text: "shared evidence",
    limit: 1,
  });
  assert.equal(all.searchedEvents, 2);
  assert.equal(all.results.length, 1);
  assert.equal(all.results[0]?.scope, "GENERAL");
});

test("annotates and explicitly filters General results by validated project links", async () => {
  const general = generalConversation(
    "linked fictional evidence",
    "2026-01-15T09:00:00.000Z",
  );
  const link: GeneralProjectLink = Object.freeze({
    id: "link-fictional",
    sourceScope: "GENERAL",
    generalConversationId: general.id,
    generalEventId: general.events[0]!.id,
    generalContentSha256: general.events[0]!.contentSha256,
    targetScope: "PROJECT",
    targetProjectId: "project-a",
    rationale: "Relevant to the fictional parser",
    rationaleExactBytes: 33,
    rationaleSha256: "b".repeat(64),
    createdAt: "2026-01-15T10:00:00.000Z",
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    effect: "LINK_ONLY",
  });
  let projectPresent = true;
  const search = new HistoricalSearch({
    events: { list: async () => [], find: async () => null },
    artifacts: { read: async () => encoder.encode("unused") },
    projects: { exists: async (id) => id === "project-a" && projectPresent },
    general: { list: async () => [general] },
    links: { list: async () => [link] },
  });
  const report = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: "fictional",
    associatedProjectId: "project-a",
  });
  const result = report.results[0];
  assert.equal(report.query.associatedProjectId, "project-a");
  assert.equal(result?.scope, "GENERAL");
  if (result?.scope === "GENERAL") {
    assert.equal(result.links[0]?.targetProjectId, "project-a");
    assert.equal(result.links[0]?.effect, "LINK_ONLY");
  }
  projectPresent = false;
  await assert.rejects(
    () =>
      search.searchAcrossScopes({
        scope: "GENERAL_ONLY",
        projectIds: [],
        text: "fictional",
      }),
    /without using partial results/u,
  );
});

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

test("searches all explicit projects before applying one deterministic limit", async () => {
  const events = [
    historicalEventFor("project-b", "shared evidence later", "ERROR", 2),
    historicalEventFor("project-a", "shared evidence first", "TEST_RESULT", 1),
  ];
  const search = createMultiProjectSearch(events);

  const report = await search.searchAcrossProjects({
    projectIds: ["project-b", "project-a"],
    text: "shared evidence",
    limit: 1,
  });

  assert.deepEqual(report.query.projectIds, ["project-a", "project-b"]);
  assert.equal(report.searchedProjects, 2);
  assert.equal(report.searchedEvents, 2);
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0]?.projectId, "project-a");
  assert.deepEqual(
    report,
    await search.searchAcrossProjects({
      projectIds: ["project-a", "project-b"],
      text: "shared evidence",
      limit: 1,
    }),
  );
});

test("keeps global filters, artifact matches, provenance, and project scope", async () => {
  const event = historicalEventFor(
    "project-b",
    "ignored",
    "COMMAND_RESULT",
    1,
    true,
  );
  const search = createMultiProjectSearch(
    [event],
    "Global synthetic artifact evidence",
  );
  const report = await search.searchAcrossProjects({
    projectIds: ["project-a", "project-b"],
    text: "artifact evidence",
    type: "COMMAND_RESULT",
  });
  assert.equal(report.results[0]?.projectId, "project-b");
  assert.equal(report.results[0]?.matchedIn, "ARTIFACT_PAYLOAD");
  assert.equal(report.results[0]?.trust, "UNTRUSTED");
  assert.match(report.results[0]?.source.recordHash ?? "", /^d{64}$/u);
});

test("rejects invalid global scope and excessive event volume", async () => {
  const search = createMultiProjectSearch([]);
  await assert.rejects(
    search.searchAcrossProjects({ projectIds: [], text: "evidence" }),
    /from 1 to 100/u,
  );
  await assert.rejects(
    search.searchAcrossProjects({
      projectIds: ["project-a", "project-a"],
      text: "evidence",
    }),
    /must be unique/u,
  );
  await assert.rejects(
    search.searchAcrossProjects({
      projectIds: Array.from({ length: 101 }, (_, index) => `project-${index}`),
      text: "evidence",
    }),
    /from 1 to 100/u,
  );

  const event = historicalEventFor("project-a", "bounded", "ERROR", 1);
  const oversized = new HistoricalSearch({
    events: {
      async list() {
        return Array.from({ length: 10_001 }, () => event);
      },
      async find() {
        return null;
      },
    },
    artifacts: {
      async read() {
        return encoder.encode("");
      },
    },
    projects: {
      async exists() {
        return true;
      },
    },
  });
  await assert.rejects(
    oversized.searchAcrossProjects({
      projectIds: ["project-a"],
      text: "bounded",
    }),
    /exceeds 10000 canonical events/u,
  );
});

test("fails global search without partial results or rejected-content echo", async () => {
  const canary = "PRIVATE-SYNTHETIC-GLOBAL-SEARCH-CANARY";
  const search = new HistoricalSearch({
    events: {
      async list(projectId) {
        if (projectId === "project-b") throw new Error(canary);
        return [
          historicalEventFor("project-a", "matching evidence", "ERROR", 1),
        ];
      },
      async find() {
        return null;
      },
    },
    artifacts: {
      async read() {
        return encoder.encode("");
      },
    },
    projects: {
      async exists() {
        return true;
      },
    },
  });
  await assert.rejects(
    search.searchAcrossProjects({
      projectIds: ["project-a", "project-b"],
      text: "matching",
    }),
    (error: unknown) =>
      error instanceof Error &&
      /without using partial results/u.test(error.message) &&
      !error.message.includes(canary),
  );

  const inconsistent = new HistoricalSearch({
    events: {
      async list() {
        return [historicalEventFor("foreign-project", "matching", "ERROR", 1)];
      },
      async find() {
        return null;
      },
    },
    artifacts: {
      async read() {
        return encoder.encode("");
      },
    },
    projects: {
      async exists() {
        return true;
      },
    },
  });
  await assert.rejects(
    inconsistent.searchAcrossProjects({
      projectIds: ["project-a"],
      text: "matching",
    }),
    /inconsistent project scope/u,
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

function createMultiProjectSearch(
  events: readonly HistoricalEvent[],
  artifactContent = "Synthetic source evidence",
) {
  return new HistoricalSearch({
    events: {
      async list(projectId: string) {
        return events.filter((event) => event.projectId === projectId);
      },
      async find(projectId: string, eventId: string) {
        return (
          events.find(
            (event) =>
              event.projectId === projectId && event.event.id === eventId,
          ) ?? null
        );
      },
    },
    artifacts: {
      async read() {
        return encoder.encode(artifactContent);
      },
    },
    projects: {
      async exists(projectId: string) {
        return projectId === "project-a" || projectId === "project-b";
      },
    },
  });
}

function historicalEventFor(
  projectId: string,
  text: string,
  type: SessionEvent["type"],
  sequence: number,
  artifactPayload = false,
): HistoricalEvent {
  return Object.freeze({
    ...historicalEvent(text, type, sequence, artifactPayload),
    projectId,
  });
}

function generalConversation(
  content: string,
  occurredAt: string,
): GeneralConversation {
  return Object.freeze({
    id: "general-conversation-fictional",
    scope: "GENERAL",
    title: "Fictional question",
    createdAt: occurredAt,
    events: Object.freeze([
      Object.freeze({
        id: "general-event-fictional",
        conversationId: "general-conversation-fictional",
        sequence: 0,
        scope: "GENERAL",
        type: "USER_MESSAGE",
        occurredAt,
        actor: "LOCAL_USER",
        origin: "USER_AUTHORED",
        verification: "UNVERIFIED",
        dataClass: "CONFIDENTIAL",
        content,
        exactBytes: Buffer.byteLength(content, "utf8"),
        contentSha256: "a".repeat(64),
        provenance: Object.freeze({
          kind: "LOCAL_GENERAL_CAPTURE",
          capturedAt: occurredAt,
        }),
      }),
    ]),
  });
}
