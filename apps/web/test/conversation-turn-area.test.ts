import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type {
  GeneralConversation,
  GeneralEvent,
} from "@ai-workspace/general-conversation";
import type { ResolvedModelTarget } from "@ai-workspace/model-targets";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("conversation turn coordination", () => {
  it("recomposes changed source context before exposure", async () => {
    let reads = 0;
    let exposures = 0;
    const area = await fixture(
      () => conversation(reads++ === 0 ? "Before" : "After"),
      async () => {
        exposures += 1;
        return completed();
      },
    );
    const outcome = await area.run(request("changed-source"));
    assert.equal(outcome.result.kind, "REFUSED_BEFORE_EXPOSURE");
    assert.equal(
      outcome.result.kind === "REFUSED_BEFORE_EXPOSURE"
        ? outcome.result.reason
        : null,
      "CONTEXT_UNAVAILABLE",
    );
    assert.equal(exposures, 0);
  });

  it("caches an unknown post-exposure outcome and never retries it", async () => {
    let exposures = 0;
    const area = await fixture(
      () => conversation("Stable"),
      async () => {
        exposures += 1;
        return { kind: "UNKNOWN" as const };
      },
    );
    const first = await area.run(request("unknown-once"));
    const duplicate = await area.run(request("unknown-once"));
    assert.equal(first.result.kind, "UNKNOWN_AFTER_EXPOSURE");
    assert.equal(duplicate.result.kind, "UNKNOWN_AFTER_EXPOSURE");
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(exposures, 1);
  });
});

async function fixture(
  current: () => GeneralConversation,
  send: () => Promise<
    ReturnType<typeof completed> | Readonly<{ kind: "UNKNOWN" }>
  >,
) {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-turn-area-"));
  roots.push(home);
  const refs = await writeReducedTurnConfiguration(home);
  let id = 0;
  return conversationTurnArea({
    home,
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: async () => [conversation("Scope")] },
      workItems: { list: async () => [] },
    },
    general: {
      show: async () => current(),
      appendTurn: async () => {
        throw new Error("A refused or unknown response must not be stored.");
      },
    },
    generalLinks: { list: async () => [] },
    memory: {
      list: async () => ({ items: [], nextCursor: null }),
    },
    handoffs: {
      list: async () => [],
      show: async () => {
        throw new Error("No handoff is available in General.");
      },
      validateRepository: async () => {
        throw new Error("No repository is available in General.");
      },
    },
    targets: {
      resolve: async () => ({
        ...target,
        target: { ...target.target, ...refs },
      }),
    },
    audit: {
      record: async () => {
        throw new Error("Reduced context has no project privacy audit.");
      },
    },
    writer: {
      storeTurn: async () => {
        throw new Error("General does not use the project writer.");
      },
    },
    transport: { send },
    ids: () => `synthetic-id-${++id}`,
    clock: () => new Date("2026-09-14T10:00:00.000Z"),
  });
}

const target: ResolvedModelTarget = {
  selectedBy: "DEFAULT",
  target: {
    targetId: "target-b",
    displayName: "Target B",
    executionClass: "MODEL_DELIVERY",
    kind: "OPENAI_RESPONSES",
    modelId: "model-b",
    boundary: "EXTERNAL_SERVICE",
    profileRef: "unused-profile.json",
    policyRef: "unused-policy.json",
    instructionRefs: ["unused-instructions.json"],
    maxInputBytes: 65_536,
    maxOutputBytes: 16_384,
    enabled: true,
  },
};

function request(clientRequestId: string) {
  return {
    conversationId: "general-conversation",
    projectId: null,
    targetId: target.target.targetId,
    userText: "Continue the synthetic conversation",
    clientRequestId,
  };
}

function conversation(content: string): GeneralConversation {
  return {
    id: "general-conversation",
    scope: "GENERAL",
    title: "Synthetic conversation",
    createdAt: "2026-09-14T09:00:00.000Z",
    events: [event(content)],
  };
}

function event(content: string): GeneralEvent {
  return {
    id: `event-${content.toLowerCase()}`,
    conversationId: "general-conversation",
    sequence: 0,
    scope: "GENERAL",
    type: "USER_MESSAGE",
    occurredAt: "2026-09-14T09:00:00.000Z",
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    content,
    exactBytes: Buffer.byteLength(content),
    contentSha256: createHash("sha256").update(content).digest("hex"),
    provenance: {
      kind: "LOCAL_GENERAL_CAPTURE",
      capturedAt: "2026-09-14T09:00:00.000Z",
    },
  };
}

function completed() {
  return {
    kind: "COMPLETED" as const,
    text: "Synthetic answer",
    requestId: "request-id",
    responseId: "response-id",
    usage: {
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
    },
  };
}
