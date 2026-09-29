import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type { MemoryItem } from "@ai-workspace/active-memory";
import type {
  GeneralConversation,
  GeneralEvent,
} from "@ai-workspace/general-conversation";
import type { GeneralProjectLink } from "@ai-workspace/general-project-link";
import type {
  ImportedSession,
  SessionEvent,
} from "@ai-workspace/session-ingestion";
import {
  REDUCED_TURN_EVIDENCE_LIMITS,
  ReducedTurnEvidenceError,
  collectReducedTurnEvidence,
  type ReducedTurnEvidenceDependencies,
} from "../src/reduced-turn-evidence.ts";

const time = "2026-09-22T10:00:00.000Z";
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const hash = "a".repeat(64);

describe("collectReducedTurnEvidence", () => {
  it("keeps General General and admits only verified explicit links with provenance", async () => {
    const event = generalEvent("general-event", "A General decision");
    const page = memory("project-a", "memory-a", "Keep this constraint");
    const result = await collectReducedTurnEvidence(
      fixture({
        conversation: generalConversation(event),
        links: [generalLink(event, "project-a")],
        projects: ["project-a"],
        memory: { "project-a": [page] },
      }),
      generalScope(),
    );

    assert.deepEqual(result.readings[0], {
      type: "USER_MESSAGE",
      text: "A General decision",
      occurredAt: time,
      eventId: "general-event",
      sessionId: null,
      trust: "UNVERIFIED",
      provenance: { kind: "LOCAL_GENERAL_CAPTURE", capturedAt: time },
    });
    assert.deepEqual(result.linkedProjectMemory, [
      {
        id: "memory-a",
        projectId: "project-a",
        type: "CONSTRAINT",
        content: "Keep this constraint",
        provenance: page.sources,
      },
    ]);
    assert.equal(result.sources[0]?.kind, "GENERAL_EVENT");
    assert.equal(result.sources[1]?.kind, "ACTIVE_MEMORY");
    assert.equal(result.accounting.linkedProjects, 1);
  });

  it("accounts for old events and serialized-reading exclusions", async () => {
    const events = Array.from({ length: 129 }, (_, index) =>
      generalEvent(`event-${index}`, index === 0 ? "old" : "x".repeat(15_000)),
    );
    const result = await collectReducedTurnEvidence(
      fixture({ conversation: generalConversation(...events) }),
      generalScope(),
    );

    assert.equal(result.readings.length, 4);
    assert.deepEqual(omission(result, "EVENT_LIMIT"), {
      reason: "EVENT_LIMIT",
      count: 1,
      bytes: null,
      atLeast: false,
    });
    assert.deepEqual(omission(result, "SERIALIZED_READING_LIMIT"), {
      reason: "SERIALIZED_READING_LIMIT",
      count: 124,
      bytes: 1_860_000,
      atLeast: false,
    });
    assert.ok(
      result.accounting.readingBytes <=
        REDUCED_TURN_EVIDENCE_LIMITS.serializedReadingsBytes,
    );
  });

  it("does not call the artifact reader when declared bytes exceed the source limit", async () => {
    let artifactReads = 0;
    const result = await collectReducedTurnEvidence(
      fixture({
        projects: ["project-a"],
        sessions: [
          session("project-a", artifactEvent("session-event", 16 * 1024 + 1)),
        ],
        boundedArtifact: async () => {
          artifactReads += 1;
          return "must not be reached";
        },
      }),
      projectScope(),
    );

    assert.equal(artifactReads, 0);
    assert.deepEqual(omission(result, "SOURCE_TEXT_LIMIT"), {
      reason: "SOURCE_TEXT_LIMIT",
      count: 1,
      bytes: 16 * 1024 + 1,
      atLeast: false,
    });
  });

  it("fails closed for unreadable or cross-scope project material", async () => {
    await assert.rejects(
      () =>
        collectReducedTurnEvidence(
          fixture({
            projects: ["project-a"],
            sessions: [session("project-b", inlineEvent("event", "text"))],
          }),
          projectScope(),
        ),
      ReducedTurnEvidenceError,
    );
    await assert.rejects(
      () =>
        collectReducedTurnEvidence(
          fixture({
            projects: ["project-a"],
            sessions: [session("project-a", artifactEvent("event", 100))],
            boundedArtifact: async () => {
              throw new Error("synthetic unavailable artifact");
            },
          }),
          projectScope(),
        ),
      ReducedTurnEvidenceError,
    );
  });

  it("rejects stale General links and memory returned under another project", async () => {
    const event = generalEvent("general-event", "Synthetic General event");
    await assert.rejects(
      () =>
        collectReducedTurnEvidence(
          fixture({
            conversation: generalConversation(event),
            links: [
              {
                ...generalLink(event, "project-a"),
                generalContentSha256: hash,
              },
            ],
            projects: ["project-a"],
          }),
          generalScope(),
        ),
      ReducedTurnEvidenceError,
    );
    await assert.rejects(
      () =>
        collectReducedTurnEvidence(
          fixture({
            conversation: generalConversation(event),
            links: [generalLink(event, "project-a")],
            projects: ["project-a"],
            memory: {
              "project-a": [memory("project-b", "wrong", "wrong project")],
            },
          }),
          generalScope(),
        ),
      ReducedTurnEvidenceError,
    );
  });

  it("marks the undisclosed remainder of a bounded memory page as unknown bytes", async () => {
    const event = generalEvent("general-event", "Synthetic General event");
    const result = await collectReducedTurnEvidence(
      fixture({
        conversation: generalConversation(event),
        links: [generalLink(event, "project-a")],
        projects: ["project-a"],
        memory: { "project-a": [memory("project-a", "memory-a", "note")] },
        memoryNextCursor: { "project-a": "synthetic-next-page" },
      }),
      generalScope(),
    );

    assert.deepEqual(omission(result, "ACTIVE_MEMORY_PER_PROJECT_LIMIT"), {
      reason: "ACTIVE_MEMORY_PER_PROJECT_LIMIT",
      count: 1,
      bytes: null,
      atLeast: true,
    });
  });

  it("bounds linked projects, total active notes, and per-project metadata reads", async () => {
    const event = generalEvent("general-event", "Synthetic General event");
    const projectIds = Array.from(
      { length: 4 },
      (_, index) => `project-${index}`,
    );
    const calls: unknown[] = [];
    const result = await collectReducedTurnEvidence(
      fixture({
        conversation: generalConversation(event),
        projects: projectIds,
        links: projectIds.map((projectId) => generalLink(event, projectId)),
        memory: Object.fromEntries(
          projectIds.map((projectId) => [
            projectId,
            Array.from({ length: 20 }, (_, index) =>
              memory(
                projectId,
                `${projectId}-memory-${index}`,
                "Synthetic note",
              ),
            ),
          ]),
        ),
        onMemoryList: (query) => calls.push(query),
      }),
      generalScope(),
    );

    assert.equal(result.linkedProjectMemory.length, 64);
    assert.deepEqual(omission(result, "ACTIVE_MEMORY_TOTAL_LIMIT"), {
      reason: "ACTIVE_MEMORY_TOTAL_LIMIT",
      count: 16,
      bytes: 224,
      atLeast: false,
    });
    assert.deepEqual(
      calls,
      projectIds.map((projectId) => ({
        projectId,
        validity: "ACTIVE",
        limit: 20,
      })),
    );
  });
});

function fixture(
  input: Readonly<{
    conversation?: GeneralConversation;
    links?: readonly GeneralProjectLink[];
    projects?: readonly string[];
    sessions?: readonly ImportedSession[];
    memory?: Readonly<Record<string, readonly MemoryItem[]>>;
    memoryNextCursor?: Readonly<Record<string, string | null>>;
    boundedArtifact?: (artifactId: string, maxBytes: number) => Promise<string>;
    onMemoryList?: (query: unknown) => void;
  }>,
): ReducedTurnEvidenceDependencies {
  return {
    conversations: {
      projects: async () =>
        (input.projects ?? []).map((id) => ({ id, name: `Synthetic ${id}` })),
      sessions: { list: async () => input.sessions ?? [] },
    },
    ...(input.boundedArtifact === undefined
      ? {}
      : { boundedArtifact: input.boundedArtifact }),
    general: {
      show: async () => input.conversation ?? generalConversation(),
    },
    generalLinks: { list: async () => input.links ?? [] },
    activeMemory: {
      list: async (query) => {
        input.onMemoryList?.(query);
        return {
          items: input.memory?.[query.projectId] ?? [],
          nextCursor: input.memoryNextCursor?.[query.projectId] ?? null,
        };
      },
    },
  };
}

function generalScope() {
  return {
    conversationId: "general-conversation",
    projectId: null,
    workItemId: null,
    handoffId: null,
  } as const;
}

function projectScope() {
  return {
    conversationId: "session-conversation",
    projectId: "project-a",
    workItemId: null,
    handoffId: null,
  } as const;
}

function generalConversation(
  ...events: readonly GeneralEvent[]
): GeneralConversation {
  return {
    id: "general-conversation",
    scope: "GENERAL",
    title: "Synthetic General",
    createdAt: time,
    events,
  };
}

function generalEvent(id: string, content: string): GeneralEvent {
  return {
    id,
    conversationId: "general-conversation",
    sequence: 0,
    scope: "GENERAL",
    type: "USER_MESSAGE",
    occurredAt: time,
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    content,
    exactBytes: Buffer.byteLength(content, "utf8"),
    contentSha256: digest(content),
    provenance: { kind: "LOCAL_GENERAL_CAPTURE", capturedAt: time },
  };
}

function generalLink(
  event: GeneralEvent,
  targetProjectId: string,
): GeneralProjectLink {
  return {
    id: `link-${targetProjectId}`,
    sourceScope: "GENERAL",
    generalConversationId: "general-conversation",
    generalEventId: event.id,
    generalContentSha256: event.contentSha256,
    targetScope: "PROJECT",
    targetProjectId,
    rationale: "Synthetic explicit link",
    rationaleExactBytes: 23,
    rationaleSha256: digest("Synthetic explicit link"),
    createdAt: time,
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    effect: "LINK_ONLY",
  };
}

function session(
  projectId: string,
  ...events: readonly SessionEvent[]
): ImportedSession {
  return {
    id: "session-conversation",
    projectId,
    sourceType: "SYNTHETIC",
    sourceSessionId: "synthetic-source-session",
    agent: "synthetic",
    model: null,
    startedAt: time,
    createdAt: time,
    lastImportedAt: time,
    latestSourceArtifact: { id: "session-artifact", byteLength: 100 },
    events,
  };
}

function inlineEvent(id: string, text: string): SessionEvent {
  return {
    id,
    sessionId: "session-conversation",
    sequence: 0,
    type: "AGENT_MESSAGE",
    occurredAt: time,
    trust: "UNTRUSTED",
    payload: { kind: "INLINE_TEXT", text },
    source: source(),
  };
}

function artifactEvent(id: string, byteLength: number): SessionEvent {
  return {
    id,
    sessionId: "session-conversation",
    sequence: 0,
    type: "AGENT_MESSAGE",
    occurredAt: time,
    trust: "UNTRUSTED",
    payload: {
      kind: "ARTIFACT",
      artifact: { id: "event-artifact", byteLength },
      mediaType: "text/plain",
    },
    source: source(),
  };
}

function source() {
  return {
    artifactId: "source-artifact",
    sourceType: "MODEL_CONVERSATION_SYNTHETIC",
    sourceSessionId: "synthetic-source-session",
    position: 0,
    recordHash: hash,
  } as const;
}

function memory(projectId: string, id: string, content: string): MemoryItem {
  return {
    id,
    projectId,
    type: "CONSTRAINT",
    content,
    curation: "USER_CURATED",
    validity: "ACTIVE",
    verification: "UNVERIFIED",
    confidence: "UNASSESSED",
    version: 1,
    sources: [
      {
        eventId: "source-event",
        sessionId: "source-session",
        eventType: "AGENT_MESSAGE",
        trust: "UNTRUSTED",
        sourceArtifactId: "source-artifact",
        sourcePosition: 0,
        sourceRecordHash: hash,
      },
    ],
    creationOperationId: "create-memory",
    createdBy: "LOCAL_USER",
    createdAt: time,
    updatedAt: time,
    supersedes: null,
    supersession: null,
    verifications: [],
    invalidation: null,
  };
}

function omission(
  result: Awaited<ReturnType<typeof collectReducedTurnEvidence>>,
  reason: string,
) {
  return result.omissions.find((candidate) => candidate.reason === reason);
}
