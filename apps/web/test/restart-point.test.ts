import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemoryItem } from "@ai-workspace/active-memory";
import type { WorkItem, WorkItemId } from "@ai-workspace/core";
import type {
  CreateHandoffInput,
  Handoff,
  SectionMetadata,
} from "@ai-workspace/handoff";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import {
  LOOKED_AT_LIMIT,
  NOTE_LIMIT,
  restartPointOf,
  workForSession,
} from "../src/restart-point.ts";
import { readRestartPoint } from "../src/restart-points.ts";

const METADATA: SectionMetadata = Object.freeze({
  origin: "WORK_ITEM",
  trust: "USER_CURATED",
  curation: "USER_CURATED",
  verification: "UNVERIFIED",
  observation: "DERIVED",
  sources: Object.freeze([]),
});

const section = <T>(value: T) => Object.freeze({ metadata: METADATA, value });

const note = (
  id: string,
  type: MemoryItem["type"],
  content: string,
  verification: MemoryItem["verification"] = "UNVERIFIED",
) =>
  Object.freeze({
    id,
    type,
    content,
    verification,
    confidence: "UNASSESSED" as const,
  });

const handoff = (overrides: Partial<Handoff["sections"]> = {}): Handoff =>
  Object.freeze({
    schemaVersion: 1,
    id: "handoff-01",
    projectId: "project-01",
    workItemId: "work-01",
    predecessorId: null,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-27T09:00:00.000Z",
    sections: Object.freeze({
      objective: section("Finish the restart point"),
      repository: section(
        Object.freeze({
          branch: "main",
          head: "0123456789abcdef0123456789abcdef01234567",
          dirty: true,
          changedPaths: Object.freeze(["apps/web/src/restart-point.ts"]),
        }),
      ),
      selectedMemory: section(
        Object.freeze([
          note(
            "memory-decision",
            "DECISION",
            "Composing is not fixing",
            "VERIFIED",
          ),
          note(
            "memory-constraint",
            "CONSTRAINT",
            "Nothing leaves the computer",
          ),
          note("memory-failure", "FAILURE", "The byte-range form was unusable"),
        ]),
      ),
      knownFailures: section(
        Object.freeze([
          note("memory-failure", "FAILURE", "The byte-range form was unusable"),
        ]),
      ),
      testState: section(Object.freeze([])),
      relevantFiles: section(Object.freeze([])),
      nextAction: section("Finish the restart point"),
      sourceReferences: section(Object.freeze([])),
      ...overrides,
    }),
  }) as Handoff;

const work = (overrides: Partial<WorkItem> = {}): WorkItem =>
  Object.freeze({
    id: "work-01" as WorkItemId,
    objective: "Show what it would take to pick this up again",
    projectId: "project-01",
    status: "ACTIVE",
    version: 2,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
    sources: Object.freeze([
      Object.freeze({
        eventId: "event-01",
        sessionId: "session-01",
        eventType: "USER_MESSAGE",
        trust: "UNTRUSTED",
        sourceArtifactId: "artifact-01",
        sourcePosition: 1,
        sourceRecordHash: "a".repeat(64),
      }),
    ]),
    transitions: Object.freeze([]),
    ...overrides,
  });

const event = (
  sequence: number,
  type: ImportedSession["events"][number]["type"],
  text: string,
): ImportedSession["events"][number] =>
  Object.freeze({
    id: `event-${sequence}`,
    sessionId: "session-01",
    sequence,
    type,
    occurredAt: `2026-08-26T09:0${sequence}:00.000Z`,
    trust: "UNTRUSTED",
    payload: Object.freeze({ kind: "INLINE_TEXT" as const, text }),
    source: Object.freeze({
      artifactId: "artifact-01",
      sourceType: "SYNTHETIC",
      sourceSessionId: "source-session-01",
      position: sequence,
      recordHash: "b".repeat(64),
    }),
  });

const session = (
  events: readonly ImportedSession["events"][number][],
): ImportedSession =>
  Object.freeze({
    id: "session-01",
    projectId: "project-01",
    sourceType: "SYNTHETIC",
    sourceSessionId: "source-session-01",
    agent: "synthetic",
    model: "synthetic-model",
    startedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    lastImportedAt: "2026-08-26T09:10:00.000Z",
    latestSourceArtifact: Object.freeze({
      id: "artifact-01",
      byteLength: 128,
    }),
    events: Object.freeze(events),
  });

const storedNote = (index: number): MemoryItem =>
  Object.freeze({
    id: `memory-${String(index).padStart(2, "0")}`,
    projectId: "project-01",
    type: "DECISION",
    content: `Decision ${index}`,
    curation: "USER_CURATED",
    validity: "ACTIVE",
    verification: "UNVERIFIED",
    confidence: "UNASSESSED",
    version: 1,
    sources: Object.freeze([]),
    creationOperationId: `operation-${index}`,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
    supersedes: null,
    supersession: null,
    verifications: Object.freeze([]),
    invalidation: null,
  });

/**
 * The composing path, as the area receives it. It records what it was asked to
 * build and hands back a packet: a double that cannot persist is the strongest
 * available statement that composing writes nothing.
 */
const composer = () => {
  const asked: CreateHandoffInput[] = [];
  return {
    asked,
    compose: async (input: CreateHandoffInput) => {
      asked.push(input);
      return handoff();
    },
  };
};

const sources = (
  overrides: Partial<Parameters<typeof readRestartPoint>[0]> = {},
) => ({
  sessions: {
    list: async () => [session([event(1, "USER_MESSAGE", "Where was I?")])],
  },
  workItems: { list: async () => [work()] },
  notes: async () => [storedNote(1)],
  compose: async () => handoff(),
  ...overrides,
});

describe("the Work Item an open conversation declares", () => {
  it("reads the stored link rather than guessing at one", () => {
    const linked = work();
    const unrelated = work({
      id: "work-02" as WorkItemId,
      updatedAt: "2026-08-27T09:00:00.000Z",
      sources: Object.freeze([
        Object.freeze({
          ...linked.sources[0]!,
          sessionId: "session-99",
        }),
      ]),
    });
    assert.equal(
      workForSession([unrelated, linked], "session-01")?.id,
      "work-01",
    );
    assert.equal(workForSession([unrelated], "session-01"), null);
    assert.equal(workForSession([], "session-01"), null);
  });

  it("prefers the most recently updated item when several point at one session", () => {
    const older = work();
    const newer = work({
      id: "work-03" as WorkItemId,
      updatedAt: "2026-08-27T10:00:00.000Z",
    });
    assert.equal(workForSession([older, newer], "session-01")?.id, "work-03");
    assert.equal(workForSession([newer, older], "session-01")?.id, "work-03");
  });
});

describe("what the restart point shows", () => {
  const point = restartPointOf({
    handoff: handoff(),
    conversationId: "session-01",
    workState: "ACTIVE",
    lookedAt: [
      Object.freeze({
        type: "USER_MESSAGE",
        occurredAt: "2026-08-26T09:01:00.000Z",
      }),
    ],
    omissions: [
      Object.freeze({ kind: "NOTES" as const, count: 3 }),
      Object.freeze({ kind: "MOMENTS" as const, count: 0 }),
    ],
  });

  it("separates what was decided, what has to hold, and what already failed", () => {
    assert.deepEqual(
      point.decisions.map((entry) => entry.content),
      ["Composing is not fixing"],
    );
    assert.deepEqual(
      point.constraints.map((entry) => entry.content),
      ["Nothing leaves the computer"],
    );
    assert.deepEqual(
      point.failures.map((entry) => entry.content),
      ["The byte-range form was unusable"],
    );
    assert.equal(point.decisions[0]?.verification, "VERIFIED");
  });

  it("speaks of branches and changed files, never of a commit", () => {
    assert.deepEqual(point.repository, {
      branch: "main",
      hasUnsavedChanges: true,
      changedFiles: 1,
    });
  });

  /**
   * The ordinary view carries no fingerprint, no packet identity, and no byte
   * count. The conversation's own id stays, because the caller asked with it and
   * uses it to tell a late answer from a current one; it is never shown.
   */
  it("carries no identifier, digest, or byte count a reader would have to decode", () => {
    const serialized = JSON.stringify(point);
    for (const forbidden of [
      "handoff-01",
      "memory-decision",
      "artifact-01",
      "0123456789abcdef",
      "a".repeat(64),
      "exactBytes",
      "schemaVersion",
      "metadata",
      "head",
    ])
      assert.equal(
        serialized.includes(forbidden),
        false,
        `${forbidden} reached the ordinary view`,
      );
    assert.equal(point.conversationId, "session-01");
  });

  it("states what was left out and stays silent about what was not", () => {
    assert.deepEqual(point.omissions, [{ kind: "NOTES", count: 3 }]);
    assert.equal(point.effect, "COMPOSED_LOCALLY_NOT_SAVED_AND_NOT_SENT");
  });
});

describe("composing the restart point of a conversation", () => {
  it("has nothing to compose for a note, and says so instead of choosing work", async () => {
    assert.deepEqual(
      await readRestartPoint(sources(), {
        conversationId: "note-01",
        projectId: null,
      }),
      { available: false, reason: "NOT_A_WORK_CONVERSATION" },
    );
  });

  it("answers null for a conversation that is not there", async () => {
    assert.equal(
      await readRestartPoint(sources(), {
        conversationId: "session-99",
        projectId: "project-01",
      }),
      null,
    );
  });

  it("refuses to pick a Work Item for an unlinked conversation", async () => {
    assert.deepEqual(
      await readRestartPoint(sources({ workItems: { list: async () => [] } }), {
        conversationId: "session-01",
        projectId: "project-01",
      }),
      { available: false, reason: "NO_LINKED_WORK" },
    );
  });

  it("composes nothing from a session whose moments have not arrived", async () => {
    assert.deepEqual(
      await readRestartPoint(
        sources({ sessions: { list: async () => [session([])] } }),
        { conversationId: "session-01", projectId: "project-01" },
      ),
      { available: false, reason: "NOTHING_IMPORTED_YET" },
    );
  });

  it("cites the moments it shows, bounded, and counts the ones it does not", async () => {
    const spy = composer();
    const moments = Array.from({ length: LOOKED_AT_LIMIT + 3 }, (_, index) =>
      event(index + 1, "AGENT_MESSAGE", `Moment ${index + 1}`),
    );
    const point = await readRestartPoint(
      sources({
        sessions: { list: async () => [session(moments)] },
        compose: spy.compose,
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.equal(point !== null && point.available, true);
    assert.deepEqual(
      spy.asked[0]?.sourceEventIds,
      moments.slice(-LOOKED_AT_LIMIT).map((moment) => moment.id),
    );
    assert.deepEqual(
      point!.available === true
        ? point!.lookedAt.map((moment) => moment.type)
        : [],
      moments.slice(-LOOKED_AT_LIMIT).map((moment) => moment.type),
    );
    assert.deepEqual(point!.available === true ? point!.omissions : [], [
      { kind: "MOMENTS", count: 3 },
    ]);
  });

  /**
   * The packet cannot be built without a next action, and no model may write one.
   * The draft is the person's own text — the objective, and the last thing they
   * asked — and it is never returned to the screen, because nothing has been
   * proposed for review yet.
   */
  it("assembles the next action out of local text, and shows none of it", async () => {
    const spy = composer();
    const point = await readRestartPoint(
      sources({
        sessions: {
          list: async () => [
            session([
              event(1, "USER_MESSAGE", "Where was I?"),
              event(2, "AGENT_MESSAGE", "Here is what I found"),
              event(3, "USER_MESSAGE", "Compose the restart point"),
            ]),
          ],
        },
        compose: spy.compose,
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const draft = spy.asked[0]?.nextAction ?? "";
    assert.match(draft, /^Show what it would take to pick this up again/u);
    assert.match(draft, /Compose the restart point$/u);
    assert.equal(draft.includes("Here is what I found"), false);
    assert.equal(
      JSON.stringify(point).includes("Compose the restart point"),
      false,
    );
  });

  it("bounds the notes it carries and counts the rest", async () => {
    const spy = composer();
    const stored = Array.from({ length: NOTE_LIMIT + 4 }, (_, index) =>
      storedNote(index + 1),
    );
    const point = await readRestartPoint(
      sources({ notes: async () => stored, compose: spy.compose }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.equal(spy.asked[0]?.memoryIds.length, NOTE_LIMIT);
    assert.deepEqual(
      point!.available === true
        ? point!.omissions.filter((omission) => omission.kind === "NOTES")
        : [],
      [{ kind: "NOTES", count: 4 }],
    );
  });

  it("asks for the packet of the declared Work Item, with no files nobody named", async () => {
    const spy = composer();
    await readRestartPoint(sources({ compose: spy.compose }), {
      conversationId: "session-01",
      projectId: "project-01",
    });
    assert.equal(spy.asked.length, 1);
    assert.equal(spy.asked[0]?.projectId, "project-01");
    assert.equal(spy.asked[0]?.workItemId, "work-01");
    assert.equal(spy.asked[0]?.relevantFiles, undefined);
    assert.equal(spy.asked[0]?.predecessorId, undefined);
  });
});
