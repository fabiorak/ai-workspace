import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import type {
  GeneralConversation,
  GeneralEvent,
} from "@ai-workspace/general-conversation";
import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import type { ResolvedModelTarget } from "@ai-workspace/model-targets";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";
import { GuiApplication, startGuiServer } from "../src/index.ts";
import { projectTurnPayload } from "../src/turn-payload-preview.ts";

const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

/**
 * The preview that existed before this one showed the draft alone. A person
 * hunting for values to protect was therefore shown the one part of the payload
 * they had just written, and none of the part they had forgotten: the earlier
 * messages and the memory of linked projects that travel with every turn.
 *
 * These cases pin what is now visible, and pin equally that seeing it costs no
 * send, no audit event and no attempt.
 */
const HISTORY_EMAIL = "cliente@example.invalid";
const HISTORY_NAME = "Mario Rossi";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("payload preview before sending", () => {
  it("shows the whole composed payload, not only the draft", async () => {
    const area = await fixture();
    const preview = await area.previewTurnPayload({
      conversationId: "general-conversation",
      targetId: target.target.targetId,
      userText: "Che cosa era rimasto aperto?",
    });
    assert.equal(preview.kind, "READY");
    if (preview.kind !== "READY") return;
    assert.equal(preview.shape, "REDUCED_CONTEXT");
    const keys = preview.sections.map((section) => section.key);
    assert.deepEqual(keys, [
      "REDUCED_ENVELOPE",
      "REDUCED_READINGS",
      "REDUCED_QUESTION",
    ]);

    // The earlier message is in the payload, so it is in the preview: this is
    // the material the draft-only preview could never show.
    const readings = preview.sections.find(
      (section) => section.key === "REDUCED_READINGS",
    )!;
    assert.equal(readings.count, 1);
    assert.match(readings.text, /\[\[EMAIL_1\]\]/u);
    assert.equal(readings.text.includes(HISTORY_EMAIL), false);

    // And the gap is visible rather than implied: the built-in detector finds no
    // person, so a name in the history reaches the model as itself until someone
    // protects it by hand.
    assert.match(readings.text, new RegExp(HISTORY_NAME, "u"));

    const question = preview.sections.find(
      (section) => section.key === "REDUCED_QUESTION",
    )!;
    assert.equal(question.text, "Che cosa era rimasto aperto?");
    assert.equal(preview.replacements, 1);
    assert.ok(preview.totalBytes > 0);
    assert.equal(preview.model, "Target B");
  });

  it("reuses the same placeholder the later turn would use", async () => {
    const area = await fixture();
    const first = await area.previewTurnPayload({
      conversationId: "general-conversation",
      targetId: target.target.targetId,
      userText: `Scrivo a ${HISTORY_EMAIL}`,
    });
    const second = await area.previewTurnPayload({
      conversationId: "general-conversation",
      targetId: target.target.targetId,
      userText: `Di nuovo a ${HISTORY_EMAIL}`,
    });
    for (const preview of [first, second]) {
      assert.equal(preview.kind, "READY");
      if (preview.kind !== "READY") return;
      const question = preview.sections.find(
        (section) => section.key === "REDUCED_QUESTION",
      )!;
      assert.match(question.text, /\[\[EMAIL_1\]\]/u);
    }
  });

  it("refuses to compose against a target the send would not accept", async () => {
    const area = await fixture();
    for (const targetId of ["another-target", "target-b "])
      assert.deepEqual(
        await area.previewTurnPayload({
          conversationId: "general-conversation",
          targetId,
          userText: "Bozza",
        }),
        {
          kind: "BLOCKED",
          reason: "TARGET_UNAVAILABLE",
          effect: "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT",
        },
      );
  });

  it("refuses an unusable draft before composing anything", async () => {
    const area = await fixture();
    for (const userText of ["", "   ", "x".repeat(64 * 1024 + 1)])
      await assert.rejects(
        area.previewTurnPayload({
          conversationId: "general-conversation",
          targetId: target.target.targetId,
          userText,
        }),
        /TURN_PREVIEW_INVALID/u,
      );
  });
});

/**
 * The handoff path serializes headings the model reads, so those words are part
 * of the payload and are shown as they travel rather than translated.
 */
describe("payload grouping", () => {
  it("keeps the payload's own headings in the handoff shape", () => {
    const projection = projectTurnPayload(
      [
        "Continuation context",
        "The kept handoff is a dated photograph.",
        "## Objective",
        "Close the open work.",
        "## Your question",
        "Che cosa manca?",
      ].join("\n\n"),
    );
    assert.equal(projection.shape, "HANDOFF_CONTEXT");
    assert.deepEqual(
      projection.sections.map((section) => section.title),
      [null, "Objective", "Your question"],
    );
    assert.deepEqual(
      projection.sections.map((section) => section.key),
      ["PAYLOAD_PREAMBLE", "PAYLOAD_SECTION", "PAYLOAD_SECTION"],
    );
    assert.equal(projection.sections[2]!.text, "Che cosa manca?");
  });

  it("never drops payload content it cannot recognise", () => {
    const projection = projectTurnPayload("Un payload senza sezioni.");
    assert.equal(projection.sections.length, 1);
    assert.equal(projection.sections[0]!.text, "Un payload senza sezioni.");
  });
});

/**
 * The route is a guarded POST although it sends nothing, because composing the
 * preview may extend the local stable map. What it must never do is send, and
 * what it must never answer with is one sentence for every different obstacle.
 */
describe("payload preview route", () => {
  it("previews over HTTP without reaching the transport", async () => {
    let sends = 0;
    const served = await startServed(async () => {
      sends += 1;
      throw new Error("A preview must not send.");
    });
    try {
      const general =
        await served.application.createGeneralConversation("Anteprima invio");
      const configured = await served.application.modelTargets.configure(
        {
          targetId: "synthetic-a",
          displayName: "Synthetic A",
          providerKind: "OPENAI_RESPONSES",
          modelId: "synthetic-a-model",
          boundary: "EXTERNAL_SERVICE",
          profileRef: "synthetic-profile.json",
          policyRef: "synthetic-policy.json",
          instructionRefs: ["synthetic-instructions.json"],
          maxInputBytes: 65_536,
          maxOutputBytes: 16_384,
          enabled: true,
        },
        0,
      );
      await served.application.modelTargets.selectDefault(
        "synthetic-a",
        configured.revision,
      );
      const path = `/api/conversations/${encodeURIComponent(general.id)}/turn-preview`;
      const response = await served.post(path, {
        targetId: "synthetic-a",
        userText: `Scrivo a ${HISTORY_EMAIL}`,
      });
      assert.equal(response.status, 200);
      const preview = (await response.json()) as Readonly<{
        kind: string;
        sections: readonly Readonly<{ key: string; text: string }>[];
        effect: string;
      }>;
      assert.equal(preview.kind, "READY");
      assert.equal(
        preview.effect,
        "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT",
      );
      assert.match(
        preview.sections.find((section) => section.key === "REDUCED_QUESTION")!
          .text,
        /\[\[EMAIL_1\]\]/u,
      );
      assert.equal(sends, 0);
      assert.equal((await served.get(path)).status, 404);
    } finally {
      await served.server.close();
    }
  });

  it("names the obstacle instead of one sentence for every refusal", async () => {
    const served = await startServed(async () => {
      throw new Error("A preview must not send.");
    });
    try {
      const general =
        await served.application.createGeneralConversation("Rifiuti");
      const path = `/api/conversations/${encodeURIComponent(general.id)}/turn-preview`;
      const invalid = await served.post(path, {
        targetId: "synthetic-a",
        userText: "",
      });
      assert.equal(invalid.status, 400);
      assert.equal(
        ((await invalid.json()) as Readonly<{ reason: string }>).reason,
        "REQUEST_INVALID",
      );

      const unknown = await served.post(
        "/api/conversations/conversation-that-is-not-here/turn-preview",
        { targetId: "synthetic-a", userText: "Bozza" },
      );
      assert.equal(unknown.status, 409);
      const refusal = (await unknown.json()) as Readonly<{
        reason: string;
        message: string;
        recovery: string;
      }>;
      assert.equal(refusal.reason, "SCOPE_UNAVAILABLE");
      for (const sentence of [refusal.message, refusal.recovery])
        assert.doesNotMatch(sentence, /[/\\]|GENERAL/u, sentence);

      const unguarded = await fetch(`${served.server.origin}${path}`, {
        method: "POST",
        headers: { cookie: served.cookie, "content-type": "application/json" },
        body: JSON.stringify({ targetId: "synthetic-a", userText: "Bozza" }),
      });
      assert.equal(unguarded.status, 403);
      assert.equal(
        ((await unguarded.json()) as Readonly<{ reason: string }>).reason,
        "LOCAL_GUARD",
      );
    } finally {
      await served.server.close();
    }
  });
});

async function startServed(send: DeliveryTransport["send"]) {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-turn-preview-http-"));
  roots.push(root);
  const application = new GuiApplication({
    workspaceHome: join(root, "home"),
    sampleSessionPath,
    continuationTransport: { send },
  });
  const server = await startGuiServer(application, {
    bootstrapToken: "b".repeat(64),
    sessionToken: "s".repeat(64),
    csrfToken: "c".repeat(64),
  });
  const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
  const cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
  return {
    application,
    server,
    cookie,
    get: (path: string) =>
      fetch(`${server.origin}${path}`, { headers: { cookie } }),
    post: (path: string, body: unknown) =>
      fetch(`${server.origin}${path}`, {
        method: "POST",
        headers: {
          cookie,
          origin: server.origin,
          "content-type": "application/json",
          "x-ai-workspace-csrf": "c".repeat(64),
        },
        body: JSON.stringify(body),
      }),
  };
}

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-turn-preview-"));
  roots.push(home);
  let id = 0;
  return conversationTurnArea({
    home,
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: async () => [conversation()] },
      workItems: { list: async () => [] },
    },
    general: {
      show: async () => conversation(),
      appendTurn: async () => {
        throw new Error("A preview must not append a turn.");
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
    targets: { resolve: async () => target },
    audit: {
      record: async () => {
        throw new Error("A preview must not record a privacy audit event.");
      },
    },
    writer: {
      storeTurn: async () => {
        throw new Error("A preview must not store anything.");
      },
    },
    transport: {
      send: async () => {
        throw new Error("A preview must not reach the transport.");
      },
    },
    ids: () => `synthetic-id-${++id}`,
    clock: () => new Date("2026-09-18T10:00:00.000Z"),
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

function conversation(): GeneralConversation {
  return {
    id: "general-conversation",
    scope: "GENERAL",
    title: "Synthetic conversation",
    createdAt: "2026-09-18T09:00:00.000Z",
    events: [event(`${HISTORY_NAME} scrive da ${HISTORY_EMAIL}`)],
  };
}

function event(content: string): GeneralEvent {
  return {
    id: "event-history",
    conversationId: "general-conversation",
    sequence: 0,
    scope: "GENERAL",
    type: "USER_MESSAGE",
    occurredAt: "2026-09-18T09:00:00.000Z",
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    content,
    exactBytes: Buffer.byteLength(content),
    contentSha256: "a".repeat(64),
    provenance: {
      kind: "LOCAL_GENERAL_CAPTURE",
      capturedAt: "2026-09-18T09:00:00.000Z",
    },
  };
}
