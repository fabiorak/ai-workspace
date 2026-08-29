import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkItem, WorkItemId } from "@ai-workspace/core";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import { LOOKED_AT_LIMIT } from "../src/restart-point.ts";
import {
  startWorkFromConversation,
  type WorkFromConversationWrites,
} from "../src/work-from-conversation.ts";

const event = (sequence: number): ImportedSession["events"][number] =>
  Object.freeze({
    id: `event-${sequence}`,
    sessionId: "session-01",
    sequence,
    type: "USER_MESSAGE",
    occurredAt: `2026-08-26T09:0${sequence}:00.000Z`,
    trust: "UNTRUSTED",
    payload: Object.freeze({
      kind: "INLINE_TEXT" as const,
      text: `Moment ${sequence}`,
    }),
    source: Object.freeze({
      artifactId: "artifact-01",
      sourceType: "SYNTHETIC",
      sourceSessionId: "source-session-01",
      position: sequence,
      recordHash: "b".repeat(64),
    }),
  }) as ImportedSession["events"][number];

const session = (count: number): ImportedSession =>
  Object.freeze({
    id: "session-01",
    projectId: "project-01",
    sourceType: "SYNTHETIC",
    sourceSessionId: "source-session-01",
    agent: "synthetic",
    model: null,
    startedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    lastImportedAt: "2026-08-26T09:10:00.000Z",
    latestSourceArtifact: Object.freeze({ id: "artifact-01", byteLength: 128 }),
    /** Deliberately out of order, so what is cited cannot be the stored order. */
    events: Object.freeze(
      Array.from({ length: count }, (_, index) => event(count - index)),
    ),
  }) as ImportedSession;

const linked = (sessionId: string): WorkItem =>
  Object.freeze({
    id: "work-01" as WorkItemId,
    objective: "Something already declared",
    projectId: "project-01",
    status: "ACTIVE",
    version: 2,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
    sources: Object.freeze([
      Object.freeze({
        eventId: "event-1",
        sessionId,
        eventType: "USER_MESSAGE",
        trust: "UNTRUSTED",
        sourceArtifactId: "artifact-01",
        sourcePosition: 1,
        sourceRecordHash: "a".repeat(64),
      }),
    ]),
    transitions: Object.freeze([]),
  }) as WorkItem;

/** Records what it was asked to write, and can be told to fail on the second write. */
const writer = (failActivation = false) => {
  const created: Parameters<WorkFromConversationWrites["create"]>[0][] = [];
  const activated: Parameters<WorkFromConversationWrites["activate"]>[0][] = [];
  return {
    created,
    activated,
    writes: Object.freeze({
      create: async (
        input: Parameters<WorkFromConversationWrites["create"]>[0],
      ) => {
        created.push(input);
        return linked("session-99");
      },
      activate: async (
        input: Parameters<WorkFromConversationWrites["activate"]>[0],
      ) => {
        activated.push(input);
        if (failActivation)
          throw new Error("the second write did not go through");
        return linked("session-99");
      },
    }) as WorkFromConversationWrites,
  };
};

const sources = (
  overrides: Partial<Parameters<typeof startWorkFromConversation>[0]> = {},
) => ({
  sessions: { list: async () => [session(9)] },
  workItems: { list: async () => [] as readonly WorkItem[] },
  ...overrides,
});

describe("declaring that a conversation is a piece of work", () => {
  const input = {
    conversationId: "session-01",
    projectId: "project-01",
    objective: "Bring the fictional station back online",
  };

  it("cites the same recent moments the summary shows, in the order they happened", async () => {
    const spy = writer();
    const result = await startWorkFromConversation(
      sources(),
      spy.writes,
      input,
    );
    assert.deepEqual(result, { started: true, active: true });
    assert.equal(spy.created.length, 1);
    assert.deepEqual(spy.created[0]?.sourceEventIds, [
      "event-5",
      "event-6",
      "event-7",
      "event-8",
      "event-9",
    ]);
    assert.equal(spy.created[0]?.sourceEventIds.length, LOOKED_AT_LIMIT);
    assert.equal(spy.created[0]?.objective, input.objective);
  });

  /** One statement, so the second write asks for nothing the first did not have. */
  it("marks it as in progress with the very same evidence", async () => {
    const spy = writer();
    await startWorkFromConversation(sources(), spy.writes, input);
    assert.deepEqual(
      spy.activated[0]?.sourceEventIds,
      spy.created[0]?.sourceEventIds,
    );
  });

  it("cites everything there is when the conversation is shorter than the bound", async () => {
    const spy = writer();
    await startWorkFromConversation(
      sources({ sessions: { list: async () => [session(2)] } }),
      spy.writes,
      input,
    );
    assert.deepEqual(spy.created[0]?.sourceEventIds, ["event-1", "event-2"]);
  });

  /**
   * A proposed Work Item is a legitimate state, so a failed activation is reported
   * as what it is. Saying it succeeded would put "in progress" on screen over a work
   * that is not, and failing outright would hide a Work Item that now exists.
   */
  it("says the work exists and is not in progress when the second write fails", async () => {
    const spy = writer(true);
    const result = await startWorkFromConversation(
      sources(),
      spy.writes,
      input,
    );
    assert.deepEqual(result, { started: true, active: false });
    assert.equal(spy.created.length, 1);
  });

  it("refuses without writing, and says which state it is in", async () => {
    for (const [expected, given, overrides] of [
      ["NOT_A_WORK_CONVERSATION", { ...input, projectId: null }, {}],
      ["EMPTY_OBJECTIVE", { ...input, objective: "   " }, {}],
      [
        "ALREADY_LINKED",
        input,
        { workItems: { list: async () => [linked("session-01")] } },
      ],
      [
        "NOTHING_IMPORTED_YET",
        input,
        { sessions: { list: async () => [session(0)] } },
      ],
    ] as const) {
      const spy = writer();
      assert.deepEqual(
        await startWorkFromConversation(sources(overrides), spy.writes, given),
        { started: false, reason: expected },
      );
      assert.deepEqual([spy.created.length, spy.activated.length], [0, 0]);
    }
  });

  /** A conversation that is not there is not a refusal: there is nothing to refuse. */
  it("answers null for a conversation that is gone", async () => {
    const spy = writer();
    assert.equal(
      await startWorkFromConversation(sources(), spy.writes, {
        ...input,
        conversationId: "session-missing",
      }),
      null,
    );
    assert.equal(spy.created.length, 0);
  });

  /** Nothing is decided on somebody's behalf: an unrelated item does not link. */
  it("does not treat another conversation's work as this one's", async () => {
    const spy = writer();
    const result = await startWorkFromConversation(
      sources({ workItems: { list: async () => [linked("session-99")] } }),
      spy.writes,
      input,
    );
    assert.deepEqual(result, { started: true, active: true });
  });
});
