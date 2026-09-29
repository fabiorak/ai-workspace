import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeneralConversations } from "@ai-workspace/general-conversation";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import type { ResolvedModelTarget } from "@ai-workspace/model-targets";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";

export async function turnReviewFixture(roots: string[]) {
  const home = await mkdtemp(join(tmpdir(), "aiw-n3-"));
  roots.push(home);
  const refs = await writeReducedTurnConfiguration(home);
  const store = new JsonGeneralConversationStore(home);
  for (const id of ["review-one", "review-two"])
    await store.create({
      id,
      title: "Synthetic review",
      scope: "GENERAL",
      createdAt: "2026-09-24T10:00:00.000Z",
      events: [],
    });
  const general = new GeneralConversations({
    store,
    ids: randomUUID,
    clock: () => new Date("2026-09-24T10:00:00.000Z"),
  });
  const state = {
    now: Date.parse("2026-09-24T10:00:00.000Z"),
    target: {
      selectedBy: "DEFAULT",
      target: {
        targetId: "target-b",
        displayName: "Synthetic B",
        modelId: "model-b",
        executionClass: "MODEL_DELIVERY",
        kind: "OPENAI_RESPONSES",
        boundary: "EXTERNAL_SERVICE",
        ...refs,
        maxInputBytes: 65_536,
        maxOutputBytes: 16_384,
        enabled: true,
      },
    } as ResolvedModelTarget,
    onRead: async () => {},
    sent: [] as string[],
  };
  const dependencies = {
    home,
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: () => general.list() },
      workItems: { list: async () => [] },
    },
    general: {
      show: async (id: string) => {
        await state.onRead();
        return general.show(id);
      },
      appendTurn: general.appendTurn.bind(general),
    },
    generalLinks: { list: async () => [] },
    memory: { list: async () => ({ items: [], nextCursor: null }) },
    handoffs: {
      list: async () => [],
      show: async () => {
        throw new Error("No synthetic handoff");
      },
      validateRepository: async () => {
        throw new Error("No synthetic repository");
      },
    },
    targets: { resolve: async () => structuredClone(state.target) },
    audit: {
      record: async () => {
        throw new Error("No project audit");
      },
    },
    writer: {
      storeTurn: async () => {
        throw new Error("No project writer");
      },
    },
    transport: {
      send: async (input: { text: string }) => {
        state.sent.push(input.text);
        return {
          kind: "COMPLETED" as const,
          text: "Synthetic reviewed answer",
          requestId: randomUUID(),
          responseId: randomUUID(),
          usage: {
            inputTokens: null,
            cachedInputTokens: null,
            outputTokens: null,
          },
        };
      },
    },
    clock: () => new Date(state.now),
  };
  const request = {
    conversationId: "review-one",
    projectId: null,
    targetId: "target-b",
    userText: "Continue the invented conversation",
    clientRequestId: "gesture-one",
  };
  return {
    home,
    refs,
    general,
    state,
    dependencies,
    request,
    area: conversationTurnArea(dependencies),
  };
}
