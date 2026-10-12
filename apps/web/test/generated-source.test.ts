import assert from "node:assert/strict";
import test from "node:test";

import type { ImportedSession } from "@ai-workspace/session-ingestion";

import { modelConversationWriter } from "../src/model-conversation.ts";
import {
  generatedSource,
  generatedSourceType,
} from "../src/generated-source.ts";

test("labels each execution class and reads the label back", () => {
  assert.equal(
    generatedSourceType("MODEL_DELIVERY", "Model One"),
    "MODEL_CONVERSATION:Model One",
  );
  assert.equal(
    generatedSourceType("AGENT_EXECUTION", "Codex"),
    "AGENT_EXECUTION:Codex",
  );
  assert.equal(
    generatedSourceType("LOCAL_MODEL", "Local"),
    "LOCAL_MODEL:Local",
  );
  assert.deepEqual(generatedSource("LOCAL_MODEL:Local"), {
    executionClass: "LOCAL_MODEL",
    speaker: "Local",
  });
  assert.deepEqual(generatedSource("AGENT_EXECUTION:Codex"), {
    executionClass: "AGENT_EXECUTION",
    speaker: "Codex",
  });
});

test("keeps the historical labels and rejects unknown ones", () => {
  assert.deepEqual(generatedSource("MODEL_CONVERSATION"), {
    executionClass: "MODEL_DELIVERY",
    speaker: null,
  });
  assert.deepEqual(generatedSource("MODEL_CONVERSATION:Model One"), {
    executionClass: "MODEL_DELIVERY",
    speaker: "Model One",
  });
  for (const unknown of [
    "LOCAL_MODEL_X:Local",
    "LOCAL_MODEL",
    "CONVERSATION_TURN",
  ])
    assert.equal(generatedSource(unknown), null, unknown);
});

const artifact = { id: "artifact-1", sha256: "0".repeat(64), byteLength: 1 };

async function storedSourceTypes(
  turns: readonly ("MODEL_DELIVERY" | "LOCAL_MODEL" | undefined)[],
) {
  let session = {
    id: "conversation-1",
    projectId: "project-1",
    sourceType: "GENERAL",
    sourceSessionId: "conversation-1",
    agent: "general",
    model: null,
    startedAt: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    lastImportedAt: "2026-10-12T10:00:00.000Z",
    latestSourceArtifact: artifact,
    events: [],
  } as unknown as ImportedSession;
  const writer = modelConversationWriter({
    sessions: {
      load: async () => session,
      append: async (next) => {
        session = next;
      },
    },
    artifacts: { put: async () => artifact } as never,
    clock: () => new Date("2026-10-12T10:00:00.000Z"),
  });
  let index = 0;
  for (const executionClass of turns)
    await writer.storeTurn({
      projectId: "project-1",
      conversationId: "conversation-1",
      attemptId: `attempt-${++index}`,
      model: "m",
      text: "answer",
      occurredAt: "2026-10-12T10:00:00.000Z",
      userText: "question",
      targetId: "t",
      displayName: "Name",
      ...(executionClass === undefined ? {} : { executionClass }),
    });
  return session.events
    .filter((event) => event.type === "AGENT_MESSAGE")
    .map((event) => event.source.sourceType);
}

test("writes the class into the source for LOCAL_MODEL only", async () => {
  assert.deepEqual(
    await storedSourceTypes([undefined, "MODEL_DELIVERY", "LOCAL_MODEL"]),
    ["MODEL_CONVERSATION:Name", "MODEL_CONVERSATION:Name", "LOCAL_MODEL:Name"],
  );
});
