import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";

test("a General turn cannot expose content with nonexistent configured policy and instructions", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-reduced-policy-"));
  let exposures = 0;
  const conversation = {
    id: "general-policy-test",
    scope: "GENERAL" as const,
    title: "Synthetic policy check",
    createdAt: "2026-09-22T10:00:00.000Z",
    events: [],
  };
  try {
    const area = conversationTurnArea({
      home,
      conversations: {
        projects: async () => [],
        sessions: { list: async () => [] },
        notes: { list: async () => [conversation] },
        workItems: { list: async () => [] },
      },
      general: {
        show: async () => conversation,
        appendTurn: async () => {
          throw new Error("No response may be stored");
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
          selectedBy: "DEFAULT" as const,
          target: {
            targetId: "configured-target",
            displayName: "Synthetic target",
            executionClass: "MODEL_DELIVERY",
            kind: "OPENAI_RESPONSES",
            modelId: "synthetic-model",
            boundary: "EXTERNAL_SERVICE" as const,
            profileRef: join(home, "missing-profile.json"),
            policyRef: join(home, "missing-policy.json"),
            instructionRefs: [join(home, "missing-instructions.json")],
            maxInputBytes: 65_536,
            maxOutputBytes: 16_384,
            enabled: true,
          },
        }),
      },
      audit: {
        record: async () => {
          throw new Error("No legacy audit");
        },
      },
      writer: {
        storeTurn: async () => {
          throw new Error("No project writer");
        },
      },
      transport: {
        send: async () => {
          exposures += 1;
          return { kind: "UNKNOWN" };
        },
      },
    });
    const result = await area.run({
      conversationId: conversation.id,
      projectId: null,
      targetId: "configured-target",
      userText: "Continue this synthetic work",
      clientRequestId: "missing-configuration",
    });
    assert.equal(exposures, 0);
    assert.equal(result.result.kind, "REFUSED_BEFORE_EXPOSURE");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
