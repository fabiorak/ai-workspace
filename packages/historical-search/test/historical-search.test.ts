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
  /**
   * Both scopes now compete in one ranked list rather than being merged in
   * timestamp order. These two records carry the same query terms and score
   * alike, so the declared tiebreak decides: the more recent record wins.
   */
  assert.equal(all.results[0]?.scope, "PROJECT");
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

  const staleSearch = new HistoricalSearch({
    events: { list: async () => [], find: async () => null },
    artifacts: { read: async () => encoder.encode("unused") },
    projects: { exists: async (id) => id === "project-a" },
    general: { list: async () => [general] },
    links: {
      list: async () => [
        Object.freeze({ ...link, generalContentSha256: "c".repeat(64) }),
      ],
    },
  });
  await assert.rejects(
    () =>
      staleSearch.searchAcrossScopes({
        scope: "GENERAL_ONLY",
        projectIds: [],
        text: "fictional",
      }),
    /without using partial results/u,
  );
});

test("rejects duplicate General event identity across conversations", async () => {
  const first = generalConversation(
    "first synthetic collision",
    "2026-01-15T09:00:00.000Z",
  );
  const second = Object.freeze({
    ...generalConversation(
      "second synthetic collision",
      "2026-01-15T09:00:00.000Z",
    ),
    id: "general-conversation-second",
    events: Object.freeze([
      Object.freeze({
        ...generalConversation(
          "second synthetic collision",
          "2026-01-15T09:00:00.000Z",
        ).events[0]!,
        conversationId: "general-conversation-second",
      }),
    ]),
  });
  const search = new HistoricalSearch({
    events: { list: async () => [], find: async () => null },
    artifacts: { read: async () => encoder.encode("unused") },
    projects: { exists: async () => false },
    general: { list: async () => [first, second] },
  });
  await assert.rejects(
    () =>
      search.searchAcrossScopes({
        scope: "GENERAL_ONLY",
        projectIds: [],
        text: "synthetic",
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

  /**
   * Ranked, not chronological. Both events carry the term and the shorter
   * record wins, because BM25 normalizes by length. The scan this replaced
   * returned events in sequence order, so the reversal is the visible change
   * and it is asserted deliberately rather than left to be discovered.
   */
  const ordered = await search.search({
    projectId: "project-1",
    text: "synthetic",
  });
  assert.deepEqual(
    ordered.results.map((result) => result.sequence),
    [2, 1],
  );
});

test("answers a misspelled query and cuts the snippet around the reason", async () => {
  const search = createSearch([
    historicalEvent(
      `Premessa lunga che occupa spazio sufficiente da rendere il taglio osservabile e che non contiene il termine cercato. ${"Testo di riempimento. ".repeat(4)}Il verdetto riguarda la memoria attiva del progetto.`,
      "USER_MESSAGE",
      1,
    ),
  ]);

  const report = await search.search({
    projectId: "project-1",
    text: "meomria",
  });

  assert.equal(report.results.length, 1);
  const snippet = report.results[0]?.snippet ?? "";
  assert.match(snippet, /memoria/u);
  assert.match(snippet, /^…/u);
  assert.doesNotMatch(snippet, /Premessa lunga/u);
});

test("states why every result matched, on each of the three surfaces", async () => {
  const search = createSearch([
    historicalEvent(
      "Il verdetto sulla memoria attiva del progetto",
      "ERROR",
      1,
    ),
  ]);

  /**
   * Not a formality. Retrieval is tolerant, so a term can be reached through a
   * shared ending, a typing error, or the glossary; at the precision this was
   * measured at, the stated reason is what lets a reader tell a real hit from
   * a plausible one. A result that cannot say why it matched is never returned
   * at all, so an empty list of reasons is a defect, not an edge case.
   */
  const project = await search.search({
    projectId: "project-1",
    text: "meomria",
  });
  const first = project.results[0];
  assert.ok(first !== undefined);
  assert.ok(first.score > 0);
  /**
   * More than one reason is normal: the query carries both the surface form
   * and its reduction, and each can reach the record on its own.
   */
  assert.ok(first.reasons.length > 0);
  assert.ok(first.reasons.every((reason) => reason.kind === "TYPO"));
  assert.ok(
    first.reasons.some(
      (reason) => reason.term === "meomria" && reason.matched === "memoria",
    ),
  );

  const global = await search.searchAcrossProjects({
    projectIds: ["project-1"],
    text: "verdetto",
  });
  assert.ok((global.results[0]?.reasons.length ?? 0) > 0);
  assert.ok((global.results[0]?.score ?? 0) > 0);
});

test("applies the filter before the limit cuts the ranked list", async () => {
  const search = createSearch([
    historicalEvent("synthetic", "ERROR", 1),
    historicalEvent("synthetic", "ERROR", 2),
    historicalEvent(
      "synthetic evidence inside a longer record that ranks below the short ones",
      "TEST_RESULT",
      3,
    ),
  ]);

  /**
   * The two best-ranked records are excluded by the type. Asking the engine for
   * one result and filtering afterwards would answer this with nothing.
   */
  const report = await search.search({
    projectId: "project-1",
    text: "synthetic",
    type: "TEST_RESULT",
    limit: 1,
  });

  assert.equal(report.results.length, 1);
  assert.equal(report.results[0]?.sequence, 3);
  assert.equal(report.searchedEvents, 1);
});

test("builds the index once and rebuilds it only after invalidation", async () => {
  let reads = 0;
  const event = historicalEvent("synthetic invalidation evidence", "ERROR", 1);
  const search = new HistoricalSearch({
    events: {
      async list() {
        reads += 1;
        return [event];
      },
      async find() {
        return event;
      },
    },
    artifacts: {
      async read() {
        return encoder.encode("unused");
      },
    },
    projects: {
      async exists() {
        return true;
      },
    },
  });

  await search.search({ projectId: "project-1", text: "evidence" });
  await search.search({ projectId: "project-1", text: "synthetic" });
  assert.equal(reads, 1);

  search.invalidate();
  await search.search({ projectId: "project-1", text: "evidence" });
  assert.equal(reads, 2);
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
  /**
   * Ranked across projects instead of ordered by timestamp. The two records
   * score alike, so the declared tiebreak decides and the more recent one is
   * the single result the limit keeps.
   */
  assert.equal(report.results[0]?.projectId, "project-b");
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
  /**
   * The bound that refuses is now the index's own, and it counts records
   * rather than events: active memory is indexed beside them, so a selection
   * that a scan once accepted can be refused here. The refusal itself is
   * unchanged — nothing is answered from part of the history.
   */
  await assert.rejects(
    oversized.searchAcrossProjects({
      projectIds: ["project-a"],
      text: "bounded",
    }),
    /at most 10000 records/u,
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
