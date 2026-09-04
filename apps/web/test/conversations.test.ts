import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  ImportedSession,
  SessionEvent,
} from "@ai-workspace/session-ingestion";
import type { WorkItem } from "@ai-workspace/core";

import {
  readConversation,
  readConversationMoment,
  readConversations,
  RESTART_PRESSURE_BYTES,
  type ConversationSources,
} from "../src/conversations.ts";

const stored = (text: string) =>
  JSON.stringify({
    recordUuid: "record-1",
    recordType: "assistant",
    isSidechain: false,
    isMeta: false,
    blockIndex: 0,
    blockType: "text",
    text,
  });

const artifactEvent: SessionEvent = {
  id: "event-long",
  sessionId: "session-1",
  sequence: 0,
  type: "AGENT_MESSAGE",
  occurredAt: "2026-08-29T10:00:00.000Z",
  trust: "UNTRUSTED",
  payload: {
    kind: "ARTIFACT",
    artifact: { id: "artifact://sha256/long", byteLength: 8_000 },
    mediaType: "application/json",
  },
  source: {
    artifactId: "artifact://sha256/source",
    sourceType: "synthetic",
    sourceSessionId: "source-1",
    position: 1,
    recordHash: "record-hash",
  },
};

const session: ImportedSession = {
  id: "session-1",
  projectId: "project-1",
  sourceType: "synthetic",
  sourceSessionId: "source-1",
  agent: "synthetic-agent",
  model: null,
  startedAt: null,
  createdAt: "2026-08-29T10:00:00.000Z",
  lastImportedAt: "2026-08-29T10:00:00.000Z",
  latestSourceArtifact: {
    id: "artifact://sha256/source",
    byteLength: 10_000,
  },
  events: [artifactEvent],
};

function sources(
  artifact: (id: string) => Promise<string>,
): ConversationSources {
  return {
    projects: async () => [{ id: "project-1", name: "Demo" }],
    sessions: { list: async () => [session] },
    notes: { list: async () => [] },
    workItems: { list: async () => [] },
    artifact,
  };
}

describe("a separately stored conversation moment", () => {
  it("is not read with the conversation and opens only through its event", async () => {
    const opened: string[] = [];
    const source = sources(async (id) => {
      opened.push(id);
      return stored("la risposta lunga");
    });

    const conversation = await readConversation(source, {
      id: session.id,
      projectId: session.projectId,
    });
    assert.equal(conversation?.moments[0]?.text, "");
    assert.equal(conversation?.moments[0]?.textStoredSeparately, true);
    assert.deepEqual(opened, []);

    const reading = await readConversationMoment(source, {
      id: session.id,
      projectId: session.projectId,
      eventId: artifactEvent.id,
    });
    assert.deepEqual(opened, ["artifact://sha256/long"]);
    assert.equal(reading?.available, true);
    assert.equal(reading?.text, "la risposta lunga");
    assert.equal(reading?.fromCanonicalPayload, true);
  });

  it("cannot use another event or a project-free conversation as an artifact browser", async () => {
    let reads = 0;
    const source = sources(async () => {
      reads += 1;
      return stored("non va letto");
    });
    assert.equal(
      await readConversationMoment(source, {
        id: session.id,
        projectId: session.projectId,
        eventId: "event-from-somewhere-else",
      }),
      null,
    );
    assert.equal(
      await readConversationMoment(source, {
        id: session.id,
        projectId: null,
        eventId: artifactEvent.id,
      }),
      null,
    );
    assert.equal(reads, 0);
  });

  it("shows no bytes when the artifact cannot be read and verified", async () => {
    const reading = await readConversationMoment(
      sources(async () => {
        throw new Error("integrity check failed");
      }),
      {
        id: session.id,
        projectId: session.projectId,
        eventId: artifactEvent.id,
      },
    );
    assert.equal(reading?.available, false);
    assert.equal(reading?.text, "");
  });
});

describe("proactive restart signals", () => {
  const work = {
    id: "work-1",
    projectId: "project-1",
    objective: "Riprendere il lavoro",
    status: "ACTIVE",
    version: 1,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    sources: [{ sessionId: session.id, eventId: artifactEvent.id }],
    transitions: [],
  } as unknown as WorkItem;

  const signalSources = (
    byteLength: number,
    fixedAt: string | null,
  ): ConversationSources => ({
    projects: async () => [{ id: "project-1", name: "Demo" }],
    sessions: {
      list: async () => [
        {
          ...session,
          latestSourceArtifact: {
            id: "artifact://sha256/source",
            byteLength,
          },
        },
      ],
    },
    notes: { list: async () => [] },
    workItems: { list: async () => [work] },
    handoffs: {
      list: async () =>
        fixedAt === null
          ? []
          : [{ createdAt: "2026-08-01T09:00:00.000Z" }, { createdAt: fixedAt }],
    },
  });

  it("uses the measured pilot and material after the latest kept point", async () => {
    const cases = [
      {
        bytes: RESTART_PRESSURE_BYTES,
        fixedAt: "2026-08-29T11:00:00.000Z",
        expected: "CONTEXT_PRESSURE",
      },
      {
        bytes: RESTART_PRESSURE_BYTES - 1,
        fixedAt: "2026-08-29T09:00:00.000Z",
        expected: "NEW_MATERIAL",
      },
      {
        bytes: RESTART_PRESSURE_BYTES,
        fixedAt: "2026-08-29T09:00:00.000Z",
        expected: "CONTEXT_PRESSURE_AND_NEW_MATERIAL",
      },
      {
        bytes: RESTART_PRESSURE_BYTES - 1,
        fixedAt: null,
        expected: null,
      },
    ] as const;
    for (const entry of cases) {
      const page = await readConversations(
        signalSources(entry.bytes, entry.fixedAt),
      );
      assert.equal(page.rows[0]?.restartSignal, entry.expected);
    }
  });
});
