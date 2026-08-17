import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TITLE_BUDGET,
  groupConversations,
  noteRows,
  orderConversations,
  sessionRows,
  titleFrom,
} from "../src/conversation-list.ts";
import type { SessionEvent } from "@ai-workspace/session-ingestion";
import type { GeneralConversation } from "@ai-workspace/general-conversation";

const event = (
  value: Partial<SessionEvent> & Pick<SessionEvent, "id" | "sessionId">,
): SessionEvent =>
  ({
    sequence: 1,
    type: "USER_MESSAGE",
    occurredAt: "2026-08-17T09:00:00.000Z",
    trust: "UNTRUSTED",
    payload: { kind: "INLINE_TEXT", text: "a question" },
    source: {
      artifactId: "artifact-1",
      sourceType: "synthetic",
      position: 1,
      recordHash: "hash-1",
    },
    ...value,
  }) as SessionEvent;

const conversation = (
  value: Partial<GeneralConversation> & Pick<GeneralConversation, "id">,
): GeneralConversation =>
  ({
    scope: "GENERAL",
    title: "A note",
    createdAt: "2026-08-10T08:00:00.000Z",
    events: [],
    ...value,
  }) as GeneralConversation;

describe("conversation titles", () => {
  it("quotes the first question and never gains a word", () => {
    const long = `${"parola ".repeat(30)}fine`;
    const title = titleFrom(long);
    assert.ok(title !== null);
    assert.ok(title.length <= TITLE_BUDGET + 1);
    assert.ok(title.endsWith("…"));
    assert.ok(long.startsWith(title.slice(0, -1).trimEnd()));
  });

  it("collapses the newlines a transcript question carries", () => {
    assert.equal(titleFrom("  perché\n\tnon\n passa  "), "perché non passa");
  });

  it("reports no title instead of an empty one", () => {
    assert.equal(titleFrom("   \n  "), null);
  });

  it("keeps a short question whole, without an ellipsis", () => {
    assert.equal(titleFrom("dove eravamo?"), "dove eravamo?");
  });
});

describe("work session rows", () => {
  it("groups moments per session and titles each from its first question", () => {
    const rows = sessionRows({
      projectId: "project-1",
      projectName: "Demo",
      events: [
        event({
          id: "e3",
          sessionId: "s2",
          sequence: 1,
          payload: { kind: "INLINE_TEXT", text: "seconda sessione" },
          occurredAt: "2026-08-16T10:00:00.000Z",
        }),
        event({
          id: "e2",
          sessionId: "s1",
          sequence: 2,
          type: "AGENT_MESSAGE",
          payload: { kind: "INLINE_TEXT", text: "una risposta" },
          occurredAt: "2026-08-17T11:00:00.000Z",
        }),
        event({
          id: "e1",
          sessionId: "s1",
          sequence: 1,
          payload: { kind: "INLINE_TEXT", text: "prima domanda" },
        }),
      ],
    });
    assert.deepEqual(
      rows.map((row) => [row.id, row.title, row.momentCount, row.lastMomentAt]),
      [
        ["s2", "seconda sessione", 1, "2026-08-16T10:00:00.000Z"],
        ["s1", "prima domanda", 2, "2026-08-17T11:00:00.000Z"],
      ],
    );
    assert.equal(
      rows.every((row) => row.titleSource === "FIRST_QUESTION"),
      true,
    );
  });

  it("takes the title from a question, not from an assistant message", () => {
    const rows = sessionRows({
      projectId: "project-1",
      projectName: "Demo",
      events: [
        event({
          id: "e1",
          sessionId: "s1",
          sequence: 1,
          type: "AGENT_MESSAGE",
          payload: { kind: "INLINE_TEXT", text: "parlo io per primo" },
        }),
        event({
          id: "e2",
          sessionId: "s1",
          sequence: 2,
          payload: { kind: "INLINE_TEXT", text: "la mia domanda" },
        }),
      ],
    });
    assert.equal(rows[0]?.title, "la mia domanda");
  });

  it("leaves a session untitled when its question lives in an artifact", () => {
    const rows = sessionRows({
      projectId: "project-1",
      projectName: "Demo",
      events: [
        event({
          id: "e1",
          sessionId: "s1",
          payload: {
            kind: "ARTIFACT",
            artifact: { id: "artifact-9", byteLength: 10 },
            mediaType: "text/plain",
          },
        }),
      ],
    });
    assert.equal(rows[0]?.title, null);
    assert.equal(rows[0]?.titleSource, "UNTITLED");
  });

  it("reports no time rather than inventing one when no moment carries a time", () => {
    const rows = sessionRows({
      projectId: "project-1",
      projectName: "Demo",
      events: [event({ id: "e1", sessionId: "s1", occurredAt: null })],
    });
    assert.equal(rows[0]?.lastMomentAt, null);
  });

  it("shows a linked Work Item state as an attribute of the row", () => {
    const rows = sessionRows({
      projectId: "project-1",
      projectName: "Demo",
      events: [event({ id: "e1", sessionId: "s1" })],
      workStateBySession: { s1: "BLOCKED" },
    });
    assert.equal(rows[0]?.workState, "BLOCKED");
  });
});

describe("note rows", () => {
  it("uses the title its author wrote and keeps an empty note in the list", () => {
    const rows = noteRows([
      conversation({ id: "c1", title: "Appunti sparsi" }),
    ]);
    assert.deepEqual(
      rows.map((row) => [
        row.title,
        row.titleSource,
        row.momentCount,
        row.projectId,
      ]),
      [["Appunti sparsi", "GIVEN_TITLE", 0, null]],
    );
  });

  it("prefers the newest question over the creation time", () => {
    const rows = noteRows([
      conversation({
        id: "c1",
        events: [
          {
            id: "g1",
            conversationId: "c1",
            sequence: 1,
            scope: "GENERAL",
            type: "USER_MESSAGE",
            occurredAt: "2026-08-15T07:00:00.000Z",
            actor: "LOCAL_USER",
            origin: "USER_AUTHORED",
            verification: "UNVERIFIED",
            dataClass: "CONFIDENTIAL",
            content: "una domanda",
            exactBytes: 11,
            contentSha256: "a".repeat(64),
            provenance: {
              kind: "LOCAL_GENERAL_CAPTURE",
              capturedAt: "2026-08-15T07:00:00.000Z",
            },
          },
        ] as GeneralConversation["events"],
      }),
    ]);
    assert.equal(rows[0]?.lastMomentAt, "2026-08-15T07:00:00.000Z");
  });
});

describe("ordering and grouping", () => {
  const row = (id: string, lastMomentAt: string | null) =>
    Object.freeze({
      id,
      kind: "WORK_SESSION" as const,
      projectId: "p",
      projectName: "P",
      title: id,
      titleSource: "FIRST_QUESTION" as const,
      lastMomentAt,
      momentCount: 1,
      workState: null,
    });

  it("puts the newest first and everything undated last", () => {
    assert.deepEqual(
      orderConversations([
        row("old", "2026-08-01T10:00:00.000Z"),
        row("undated", null),
        row("new", "2026-08-17T10:00:00.000Z"),
      ]).map((entry) => entry.id),
      ["new", "old", "undated"],
    );
  });

  it("reads the same way twice when times tie", () => {
    const tied = [
      row("b", "2026-08-17T10:00:00.000Z"),
      row("a", "2026-08-17T10:00:00.000Z"),
    ];
    assert.deepEqual(
      orderConversations(tied).map((entry) => entry.id),
      orderConversations([...tied].reverse()).map((entry) => entry.id),
    );
  });

  /**
   * Grouping is by the reader's calendar day, so these instants are built in
   * local time and then serialised. An instant written as UTC would land on a
   * different day depending on where the test runs, which is how the first
   * version of this test failed.
   */
  const localMoment = (year: number, month: number, day: number) =>
    new Date(year, month - 1, day, 12, 0, 0).toISOString();

  it("groups by the reader's calendar day and drops empty groups", () => {
    const now = new Date(2026, 7, 17, 9, 0, 0);
    const groups = groupConversations(
      [
        row("today", localMoment(2026, 8, 17)),
        row("yesterday", localMoment(2026, 8, 16)),
        row("earlier", localMoment(2026, 7, 1)),
        row("undated", null),
      ],
      now,
    );
    assert.deepEqual(
      groups.map((group) => [group.key, group.rows.map((entry) => entry.id)]),
      [
        ["TODAY", ["today"]],
        ["YESTERDAY", ["yesterday"]],
        ["EARLIER", ["earlier"]],
        ["UNDATED", ["undated"]],
      ],
    );
    assert.deepEqual(
      groupConversations([row("today", localMoment(2026, 8, 17))], now).map(
        (group) => group.key,
      ),
      ["TODAY"],
    );
  });

  it("treats an unreadable time as undated instead of throwing", () => {
    const groups = groupConversations(
      [row("broken", "not-a-date")],
      new Date(2026, 7, 17, 9, 0, 0),
    );
    assert.deepEqual(
      groups.map((group) => group.key),
      ["UNDATED"],
    );
  });
});
