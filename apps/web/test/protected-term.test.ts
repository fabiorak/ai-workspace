import assert from "node:assert/strict";
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

/**
 * The built-in detector has no recall for names, companies or addresses, so a
 * reviewed term is the only way one of those is protected before it leaves.
 * These tests exercise the observable promise: the transport never sees the
 * original, the placeholder is stable across restarts and model changes, and a
 * term that cannot be represented changes nothing.
 */
const COMPANY = "Acme Dynamics";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("reviewed protected terms", () => {
  it("protects a reviewed term in the next turn and restores it in the answer", async () => {
    const home = await temporaryHome();
    const sent: string[] = [];
    const area = fixture(home, sent);
    const added = await area.addProtectedTerm({
      conversationId: "general-conversation",
      term: COMPANY,
      type: "ORGANIZATION",
    });
    assert.equal(added.pseudonym, "[[AZIENDA_1]]");
    assert.equal(added.added, true);
    assert.equal(added.terms, 1);

    const outcome = await area.run(request("first-turn"));
    assert.equal(outcome.result.kind, "COMPLETED");
    assert.equal(sent.length, 1);
    assert.ok(
      !sent[0]!.includes(COMPANY),
      "The transport must never receive the original value.",
    );
    assert.ok(sent[0]!.includes("[[AZIENDA_1]]"));
    assert.equal(
      outcome.result.kind === "COMPLETED" ? outcome.result.text : null,
      `Answer about ${COMPANY} for the synthetic case.`,
    );
  });

  it("reuses the same placeholder after a restart and a model change", async () => {
    const home = await temporaryHome();
    const sent: string[] = [];
    const first = fixture(home, sent);
    const added = await first.addProtectedTerm({
      conversationId: "general-conversation",
      term: COMPANY,
      type: "ORGANIZATION",
    });

    const restarted = fixture(home, sent, "target-c");
    const again = await restarted.addProtectedTerm({
      conversationId: "general-conversation",
      term: COMPANY,
      type: "ORGANIZATION",
    });
    assert.equal(again.pseudonym, added.pseudonym);
    assert.equal(again.added, false, "The same value keeps one placeholder.");
    assert.equal(again.terms, 1);

    const outcome = await restarted.run(request("after-restart", "target-c"));
    assert.equal(outcome.result.kind, "COMPLETED");
    assert.ok(!sent.at(-1)!.includes(COMPANY));
    assert.ok(sent.at(-1)!.includes(added.pseudonym));
  });

  it("refuses a second kind for the same value and leaves the map unchanged", async () => {
    const home = await temporaryHome();
    const area = fixture(home, []);
    await area.addProtectedTerm({
      conversationId: "general-conversation",
      term: COMPANY,
      type: "ORGANIZATION",
    });
    await assert.rejects(
      area.addProtectedTerm({
        conversationId: "general-conversation",
        term: COMPANY,
        type: "PERSON",
      }),
      /PROTECTED_TERM_TYPE_CONFLICT/u,
    );
    const unchanged = await area.addProtectedTerm({
      conversationId: "general-conversation",
      term: COMPANY,
      type: "ORGANIZATION",
    });
    assert.equal(unchanged.terms, 1);
    assert.equal(unchanged.pseudonym, "[[AZIENDA_1]]");
  });

  it("fails closed on a term it cannot represent", async () => {
    const home = await temporaryHome();
    const area = fixture(home, []);
    for (const term of [
      "",
      "   ",
      "A",
      "[[AZIENDA_1]]",
      "Acme\u0000Dynamics",
      "x".repeat(257),
    ])
      await assert.rejects(
        area.addProtectedTerm({
          conversationId: "general-conversation",
          term,
          type: "ORGANIZATION",
        }),
        /PROTECTED_TERM_INVALID/u,
        `"${term.slice(0, 16)}" must not reach the stable map.`,
      );
    const first = await area.addProtectedTerm({
      conversationId: "general-conversation",
      term: COMPANY,
      type: "ORGANIZATION",
    });
    assert.equal(first.terms, 1, "No refused term occupied a placeholder.");
  });

  it("refuses a conversation whose scope the server cannot resolve", async () => {
    const home = await temporaryHome();
    const area = fixture(home, []);
    await assert.rejects(
      area.addProtectedTerm({
        conversationId: "not-a-known-conversation",
        term: COMPANY,
        type: "ORGANIZATION",
      }),
      /CONVERSATION_SCOPE_UNAVAILABLE_OR_AMBIGUOUS/u,
    );
  });
});

async function temporaryHome() {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-protected-term-"));
  roots.push(home);
  return home;
}

function fixture(
  home: string,
  sent: string[],
  targetId = target.target.targetId,
) {
  let id = 0;
  const events: GeneralEvent[] = [event()];
  return conversationTurnArea({
    home,
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: async () => [conversation(events)] },
      workItems: { list: async () => [] },
    },
    general: {
      show: async () => conversation(events),
      appendTurn: async (input) => {
        events.push(event(input.userText), event(input.assistantText));
        return conversation(events);
      },
    },
    generalLinks: { list: async () => [] },
    memory: { list: async () => ({ items: [], nextCursor: null }) },
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
        target: { ...target.target, targetId },
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
    transport: {
      send: async (input) => {
        sent.push(input.text);
        return {
          kind: "COMPLETED" as const,
          /** The model only ever sees and returns the placeholder. */
          text: "Answer about [[AZIENDA_1]] for the synthetic case.",
          requestId: `request-${++id}`,
          responseId: `response-${id}`,
          usage: {
            inputTokens: null,
            cachedInputTokens: null,
            outputTokens: null,
          },
        };
      },
    },
    ids: () => `synthetic-id-${++id}`,
    clock: () => new Date("2026-09-15T10:00:00.000Z"),
  });
}

const target: ResolvedModelTarget = {
  selectedBy: "DEFAULT",
  target: {
    targetId: "target-b",
    displayName: "Target B",
    providerKind: "OPENAI_RESPONSES",
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

function request(clientRequestId: string, targetId = target.target.targetId) {
  return {
    conversationId: "general-conversation",
    projectId: null,
    targetId,
    userText: `What happened with ${COMPANY}?`,
    clientRequestId,
  };
}

function conversation(events: readonly GeneralEvent[]): GeneralConversation {
  return {
    id: "general-conversation",
    scope: "GENERAL",
    title: "Synthetic conversation",
    createdAt: "2026-09-15T09:00:00.000Z",
    events: [...events],
  };
}

function event(
  content = `${COMPANY} opened the synthetic case.`,
): GeneralEvent {
  return {
    id: `event-${content.length}-${content.slice(0, 8)}`,
    conversationId: "general-conversation",
    sequence: 0,
    scope: "GENERAL",
    type: "USER_MESSAGE",
    occurredAt: "2026-09-15T09:00:00.000Z",
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    content,
    exactBytes: Buffer.byteLength(content),
    contentSha256: "a".repeat(64),
    provenance: {
      kind: "LOCAL_GENERAL_CAPTURE",
      capturedAt: "2026-09-15T09:00:00.000Z",
    },
  };
}
