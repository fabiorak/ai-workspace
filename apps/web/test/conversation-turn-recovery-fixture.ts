import { randomUUID } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mock } from "node:test";
import { GeneralConversations } from "@ai-workspace/general-conversation";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { JsonConversationTurnRegistry } from "@ai-workspace/local-conversation-turns";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";
import { reducedTurnConfigurationRefs } from "./reduced-turn-fixture.ts";

export const recoveryRequest = {
  conversationId: "n2-general",
  projectId: null,
  targetId: "target-b",
  userText: "A synthetic crash recovery question",
  clientRequestId: "n2-gesture",
} as const;
export function recoveryGeneral(home: string) {
  return new GeneralConversations({
    store: new JsonGeneralConversationStore(home),
    ids: randomUUID,
    clock: () => new Date(),
  });
}
export function recoveryArea(home: string, stage = "normal") {
  const general = recoveryGeneral(home);
  return conversationTurnArea({
    home,
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: () => general.list() },
      workItems: { list: async () => [] },
    },
    general: {
      show: (id) => general.show(id),
      appendTurn: async (input) => {
        if (stage === "before-append") process.exit(73);
        const result = await general.appendTurn(input);
        if (stage === "after-append") process.exit(73);
        return result;
      },
    },
    generalLinks: { list: async () => [] },
    memory: { list: async () => ({ items: [], nextCursor: null }) },
    handoffs: {
      list: async () => [],
      show: async () => {
        throw new Error("No handoff");
      },
      validateRepository: async () => {
        throw new Error("No repository");
      },
    },
    targets: {
      resolve: async () => ({
        selectedBy: "DEFAULT",
        target: {
          targetId: "target-b",
          displayName: "Target B",
          modelId: "model-b",
          executionClass: "MODEL_DELIVERY",
          kind: "OPENAI_RESPONSES",
          boundary: "EXTERNAL_SERVICE",
          ...reducedTurnConfigurationRefs(home),
          maxInputBytes: 65_536,
          maxOutputBytes: 16_384,
          enabled: true,
        },
      }),
    },
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
      send: async () => {
        await appendFile(join(home, "synthetic-exposures.log"), "exposure\n");
        if (stage === "after-exposure") process.exit(73);
        return {
          kind: "COMPLETED",
          text: "Synthetic durable answer",
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
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const home = process.argv[2]!;
  const stage = process.argv[3]!;
  // Fault injection is confined to this synthetic child. Each hook exits only
  // after the preceding real store operation has finished its durable writes.
  const execute = JsonConversationTurnRegistry.prototype.execute;
  if (stage === "after-turn-claim")
    mock.method(
      JsonConversationTurnRegistry.prototype,
      "execute",
      function (
        this: JsonConversationTurnRegistry,
        claim: Parameters<typeof execute>[0],
      ) {
        return execute.call(this, claim, async () => process.exit(73));
      },
    );
  const prepare = JsonModelAttemptStore.prototype.prepare;
  if (stage === "after-link" || stage === "after-prepare")
    mock.method(
      JsonModelAttemptStore.prototype,
      "prepare",
      async function (
        this: JsonModelAttemptStore,
        input: Parameters<typeof prepare>[0],
      ) {
        if (stage === "after-link") process.exit(73);
        await prepare.call(this, input);
        process.exit(73);
      },
    );
  const transition = JsonModelAttemptStore.prototype.transition;
  if (stage === "after-executor-claim")
    mock.method(
      JsonModelAttemptStore.prototype,
      "transition",
      async function (
        this: JsonModelAttemptStore,
        ...args: Parameters<typeof transition>
      ) {
        const result = await transition.apply(this, args);
        if (result.state === "EXPOSURE_STARTED") process.exit(73);
        return result;
      },
    );
  const result = await recoveryArea(home, stage).run(recoveryRequest);
  process.stdout.write(JSON.stringify(result));
}
