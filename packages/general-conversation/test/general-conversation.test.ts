import assert from "node:assert/strict";
import test from "node:test";

import {
  GeneralConversationConflictError,
  GeneralConversationError,
  GeneralConversations,
  generalMessageContent,
  type GeneralConversation,
  type GeneralConversationStore,
} from "../src/index.ts";

test("creates project-free General evidence with exact Unicode bytes and deterministic hash", async () => {
  const values = new Map<string, GeneralConversation>();
  const store = memoryStore(values);
  const ids = ["conversation-fictional", "event-fictional"];
  const service = new GeneralConversations({
    store,
    ids: () => ids.shift()!,
    clock: () => new Date("2026-07-15T10:00:00.000Z"),
  });
  const created = await service.create("Unrelated question");
  const updated = await service.append({
    conversationId: created.id,
    expectedEventCount: 0,
    content: "Perché caffè ☕?",
  });
  assert.equal(updated.scope, "GENERAL");
  assert.equal(updated.events[0]?.exactBytes, 19);
  assert.equal(
    updated.events[0]?.contentSha256,
    "0141c7d436ea2587ac7a7e8ddc9357bcc33adb8ab6f938dcd477b17c9551bbbe",
  );
  assert.deepEqual(
    {
      actor: updated.events[0]?.actor,
      origin: updated.events[0]?.origin,
      verification: updated.events[0]?.verification,
      dataClass: updated.events[0]?.dataClass,
    },
    {
      actor: "LOCAL_USER",
      origin: "USER_AUTHORED",
      verification: "UNVERIFIED",
      dataClass: "CONFIDENTIAL",
    },
  );
});

test("blocks restricted content without persisting or echoing its value", async () => {
  const values = new Map<string, GeneralConversation>();
  const service = new GeneralConversations({
    store: memoryStore(values),
    ids: () => "fictional-id",
    clock: () => new Date("2026-07-15T10:00:00.000Z"),
  });
  const conversation = await service.create("Security question");
  const secret = "sk-abcdefghijklmnopqrstuvwxyz123456";
  await assert.rejects(
    () =>
      service.append({
        conversationId: conversation.id,
        expectedEventCount: 0,
        content: secret,
      }),
    (error: unknown) =>
      error instanceof GeneralConversationError &&
      !error.message.includes(secret) &&
      /provider-api-key/u.test(error.message),
  );
  assert.equal((await service.show(conversation.id)).events.length, 0);
});

test("appends one user and model turn atomically with explicit provenance", async () => {
  const values = new Map<string, GeneralConversation>();
  const ids = ["conversation-turn", "event-user", "event-model"];
  const service = new GeneralConversations({
    store: memoryStore(values),
    ids: () => ids.shift()!,
    clock: () => new Date("2026-09-14T10:00:00.000Z"),
  });
  const conversation = await service.create("Synthetic turn");
  const updated = await service.appendTurn({
    conversationId: conversation.id,
    expectedEventCount: 0,
    userText: "A synthetic question",
    assistantText: "A synthetic answer",
    attemptId: "attempt-1",
    model: "model-1",
    displayName: "Model One",
    targetId: "target-1",
  });
  assert.equal(updated.events.length, 2);
  assert.deepEqual(
    updated.events.map((event) => [event.sequence, event.type, event.actor]),
    [
      [0, "USER_MESSAGE", "LOCAL_USER"],
      [1, "AGENT_MESSAGE", "MODEL"],
    ],
  );
  const response = updated.events[1]!;
  assert.equal(response.provenance.kind, "MODEL_CONVERSATION");
  if (response.provenance.kind === "MODEL_CONVERSATION")
    assert.equal(response.provenance.displayName, "Model One");
});

test("records the execution class and a reported model only when given", async () => {
  const values = new Map<string, GeneralConversation>();
  let count = 0;
  const service = new GeneralConversations({
    store: memoryStore(values),
    ids: () => `id-${++count}`,
    clock: () => new Date("2026-09-28T10:00:00.000Z"),
  });
  const conversation = await service.create("Synthetic agent turn");
  const turn = {
    conversationId: conversation.id,
    userText: "A synthetic question",
    assistantText: "A synthetic answer",
    attemptId: "attempt-1",
    model: "sonnet",
    displayName: "Claude Code",
    targetId: "claude",
  };
  let updated = await service.appendTurn({
    ...turn,
    expectedEventCount: 0,
    executionClass: "AGENT_EXECUTION",
    reportedModel: null,
  });
  assert.deepEqual(updated.events[1]!.provenance, {
    kind: "MODEL_CONVERSATION",
    attemptId: "attempt-1",
    displayName: "Claude Code",
    model: "sonnet",
    targetId: "claude",
    executionClass: "AGENT_EXECUTION",
  });
  updated = await service.appendTurn({
    ...turn,
    attemptId: "attempt-2",
    expectedEventCount: 2,
    executionClass: "AGENT_EXECUTION",
    reportedModel: "claude-sonnet-reported",
  });
  assert.equal(
    updated.events[3]!.provenance.kind === "MODEL_CONVERSATION" &&
      updated.events[3]!.provenance.reportedModel,
    "claude-sonnet-reported",
  );
  await assert.rejects(
    service.appendTurn({
      ...turn,
      attemptId: "attempt-3",
      expectedEventCount: 4,
      executionClass: "LOCAL_MODEL_X" as never,
    }),
    GeneralConversationError,
  );
});

/**
 * Messages and answers often span lines. A line feed is kept, a carriage
 * return before it is dropped, and every other control character is still
 * refused; titles and identifiers stay on one line.
 */
test("keeps line breaks in message content and nothing else", async () => {
  const values = new Map<string, GeneralConversation>();
  let count = 0;
  const service = new GeneralConversations({
    store: memoryStore(values),
    ids: () => `id-${++count}`,
    clock: () => new Date("2026-10-16T10:00:00.000Z"),
  });
  const conversation = await service.create("Synthetic lines");
  const turn = {
    conversationId: conversation.id,
    attemptId: "attempt-1",
    model: "sonnet",
    displayName: "Claude Code",
    targetId: "claude",
  };
  const updated = await service.appendTurn({
    ...turn,
    expectedEventCount: 0,
    userText: "Prima riga sintetica\r\nseconda riga",
    assistantText: "Una risposta\nsu due righe.",
  });
  assert.deepEqual(
    updated.events.map((event) => [event.content, event.exactBytes]),
    [
      ["Prima riga sintetica\nseconda riga", 33],
      ["Una risposta\nsu due righe.", 26],
    ],
  );
  const captured = await service.append({
    conversationId: conversation.id,
    expectedEventCount: 2,
    content: "Una domanda\nsu due righe",
  });
  assert.equal(captured.events[2]!.content, "Una domanda\nsu due righe");
  for (const text of [
    "Colonna\tvalore",
    "Ritorno\rcarrello",
    "Nulla\u0000qui",
  ]) {
    assert.throws(
      () => generalMessageContent(text, "Question"),
      GeneralConversationError,
      JSON.stringify(text),
    );
    await assert.rejects(
      service.appendTurn({
        ...turn,
        attemptId: `attempt-${text.length}`,
        expectedEventCount: 3,
        userText: "Domanda sintetica",
        assistantText: text,
      }),
      GeneralConversationError,
      JSON.stringify(text),
    );
  }
  await assert.rejects(
    service.create("Titolo\nsu due righe"),
    GeneralConversationError,
  );
});

function memoryStore(
  values: Map<string, GeneralConversation>,
): GeneralConversationStore {
  return {
    list: async () => Object.freeze([...values.values()]),
    find: async (id) => values.get(id) ?? null,
    create: async (conversation) => {
      if (values.has(conversation.id))
        throw new GeneralConversationConflictError();
      values.set(conversation.id, conversation);
      return conversation;
    },
    append: async (id, expected, event) => {
      const current = values.get(id);
      if (!current || current.events.length !== expected)
        throw new GeneralConversationConflictError();
      const updated = Object.freeze({
        ...current,
        events: Object.freeze([...current.events, event]),
      });
      values.set(id, updated);
      return updated;
    },
    appendMany: async (id, expected, events) => {
      const current = values.get(id);
      if (!current || current.events.length !== expected)
        throw new GeneralConversationConflictError();
      const updated = Object.freeze({
        ...current,
        events: Object.freeze([...current.events, ...events]),
      });
      values.set(id, updated);
      return updated;
    },
  };
}

test("records LOCAL_MODEL additively and keeps older values meaning what they meant", async () => {
  const values = new Map<string, GeneralConversation>();
  let count = 0;
  const service = new GeneralConversations({
    store: memoryStore(values),
    ids: () => `id-${++count}`,
    clock: () => new Date("2026-09-28T10:00:00.000Z"),
  });
  const conversation = await service.create("Synthetic local turn");
  const turn = {
    conversationId: conversation.id,
    userText: "A synthetic question",
    assistantText: "A synthetic answer",
    attemptId: "attempt-1",
    model: "local-model",
    displayName: "Local model",
    targetId: "local",
  };
  let updated = await service.appendTurn({
    ...turn,
    expectedEventCount: 0,
    executionClass: "LOCAL_MODEL",
  });
  assert.deepEqual(updated.events[1]!.provenance, {
    kind: "MODEL_CONVERSATION",
    attemptId: "attempt-1",
    displayName: "Local model",
    model: "local-model",
    targetId: "local",
    executionClass: "LOCAL_MODEL",
  });
  updated = await service.appendTurn({
    ...turn,
    attemptId: "attempt-2",
    expectedEventCount: 2,
  });
  assert.equal("executionClass" in updated.events[3]!.provenance, false);
  updated = await service.appendTurn({
    ...turn,
    attemptId: "attempt-3",
    expectedEventCount: 4,
    executionClass: "MODEL_DELIVERY",
  });
  assert.equal(
    updated.events[5]!.provenance.kind === "MODEL_CONVERSATION" &&
      updated.events[5]!.provenance.executionClass,
    "MODEL_DELIVERY",
  );
});
