import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GeneralConversation } from "@ai-workspace/general-conversation";
import type {
  ImportedSession,
  SessionEvent,
} from "@ai-workspace/session-ingestion";

import {
  MOMENT_LIMIT,
  noteDetail,
  sessionDetail,
} from "../src/conversation-detail.ts";

/** The shape ingestion actually stores: the words are inside the envelope, not in front of it. */
const stored = (text: string, position: number) =>
  JSON.stringify({
    recordUuid: `1111${position}`,
    recordType: "user",
    isSidechain: false,
    isMeta: false,
    blockIndex: null,
    blockType: "text",
    text,
  });

const event = (
  value: Partial<SessionEvent> & Pick<SessionEvent, "id" | "sequence">,
): SessionEvent =>
  ({
    sessionId: "s1",
    type: "USER_MESSAGE",
    occurredAt: "2026-08-17T09:00:00.000Z",
    trust: "UNTRUSTED",
    payload: { kind: "INLINE_TEXT", text: stored("una domanda", 1) },
    source: {
      artifactId: "artifact-1",
      sourceType: "synthetic",
      sourceSessionId: "source-1",
      position: value.sequence,
      recordHash: `hash-${value.sequence}`,
    },
    ...value,
  }) as SessionEvent;

const session = (events: readonly SessionEvent[]): ImportedSession =>
  ({
    id: "s1",
    projectId: "project-1",
    sourceType: "synthetic",
    sourceSessionId: "source-1",
    agent: "Claude Code",
    model: "claude-fictional-1",
    startedAt: null,
    createdAt: "2026-08-17T09:00:00.000Z",
    lastImportedAt: "2026-08-17T09:00:00.000Z",
    latestSourceArtifact: { id: "artifact-1", byteLength: 10 },
    events,
  }) as ImportedSession;

describe("an opened work session", () => {
  it("shows what a person wrote, in the order it happened", () => {
    const detail = sessionDetail({
      projectName: "Demo",
      session: session([
        event({
          id: "e2",
          sequence: 2,
          type: "AGENT_MESSAGE",
          payload: { kind: "INLINE_TEXT", text: stored("la risposta", 2) },
        }),
        event({
          id: "e1",
          sequence: 1,
          payload: { kind: "INLINE_TEXT", text: stored("la domanda", 1) },
        }),
      ]),
    });
    assert.deepEqual(
      detail.moments.map((moment) => [moment.id, moment.type, moment.text]),
      [
        ["e1", "USER_MESSAGE", "la domanda"],
        ["e2", "AGENT_MESSAGE", "la risposta"],
      ],
    );
    assert.equal(detail.title, "la domanda");
    assert.equal(detail.model, "claude-fictional-1");
  });

  it("carries the record and the fingerprint each moment came from", () => {
    const detail = sessionDetail({
      projectName: "Demo",
      session: session([event({ id: "e1", sequence: 7 })]),
    });
    assert.equal(detail.moments[0]?.sourcePosition, 7);
    assert.equal(detail.moments[0]?.contentHash, "hash-7");
    assert.equal(detail.moments[0]?.fromCanonicalPayload, true);
  });

  /**
   * Reading an artifact is a separate, explicit act. Quoting a file this composition
   * never opened would be a claim about bytes nobody checked, so the moment arrives
   * with no text and the interface says where it is instead of inventing it.
   */
  it("does not quote a payload kept as a separate file", () => {
    const detail = sessionDetail({
      projectName: "Demo",
      session: session([
        event({
          id: "e1",
          sequence: 1,
          payload: {
            kind: "ARTIFACT",
            artifact: { id: "artifact-9", byteLength: 4096 },
            mediaType: "application/json",
          },
        }),
      ]),
    });
    assert.equal(detail.moments[0]?.text, "");
    assert.equal(detail.moments[0]?.fromCanonicalPayload, false);
  });

  it("keeps a payload that is not the canonical envelope exactly as stored", () => {
    const detail = sessionDetail({
      projectName: "Demo",
      session: session([
        event({
          id: "e1",
          sequence: 1,
          payload: {
            kind: "INLINE_TEXT",
            text: "testo di un altro adattatore",
          },
        }),
      ]),
    });
    assert.equal(detail.moments[0]?.text, "testo di un altro adattatore");
    assert.equal(detail.moments[0]?.fromCanonicalPayload, false);
  });

  it("bounds what it shows and says how much it left out", () => {
    const detail = sessionDetail({
      projectName: "Demo",
      limit: 2,
      session: session([
        event({ id: "e1", sequence: 1 }),
        event({ id: "e2", sequence: 2 }),
        event({ id: "e3", sequence: 3 }),
      ]),
    });
    assert.equal(detail.moments.length, 2);
    assert.equal(detail.total, 3);
    assert.equal(detail.limit, 2);
    assert.equal(MOMENT_LIMIT > 0, true);
  });
});

describe("an opened note", () => {
  it("stands on its own content hash, having no imported source", () => {
    const conversation = {
      id: "g1",
      scope: "GENERAL",
      title: "Un appunto",
      createdAt: "2026-08-17T08:00:00.000Z",
      events: [
        {
          id: "ge1",
          conversationId: "g1",
          sequence: 1,
          scope: "GENERAL",
          type: "USER_MESSAGE",
          occurredAt: "2026-08-17T08:00:00.000Z",
          actor: "LOCAL_USER",
          origin: "USER_AUTHORED",
          verification: "UNVERIFIED",
          dataClass: "CONFIDENTIAL",
          content: "quello che ho scritto io",
          exactBytes: 24,
          contentSha256: "abc123",
          provenance: {
            kind: "LOCAL_GENERAL_CAPTURE",
            capturedAt: "2026-08-17T08:00:00.000Z",
          },
        },
      ],
    } as unknown as GeneralConversation;
    const detail = noteDetail({ conversation });
    assert.equal(detail.kind, "NOTES");
    assert.equal(detail.titleSource, "GIVEN_TITLE");
    assert.equal(detail.moments[0]?.text, "quello che ho scritto io");
    assert.equal(detail.moments[0]?.sourcePosition, null);
    assert.equal(detail.moments[0]?.contentHash, "abc123");
    // No model was involved, and naming one would be a lie of omission.
    assert.equal(detail.model, null);
    assert.equal(detail.agent, null);
  });
});
