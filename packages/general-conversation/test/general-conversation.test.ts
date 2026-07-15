import assert from "node:assert/strict";
import test from "node:test";

import {
  GeneralConversationConflictError,
  GeneralConversationError,
  GeneralConversations,
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
  };
}
