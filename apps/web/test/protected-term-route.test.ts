import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import { GuiApplication, startGuiServer } from "../src/index.ts";

/**
 * The browser names a value and nothing else. Scope, key, map and paths stay on
 * the server, and the term only matters if the next message is protected by it.
 */
const COMPANY = "Acme Dynamics";
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("protected term route", () => {
  it("previews and names terms for a first General draft without creating or sending a conversation", async () => {
    let sends = 0;
    const fixture = await startFixture({
      send: async () => {
        sends += 1;
        throw new Error("A first-draft preview must not send.");
      },
    });
    try {
      const added = await fixture.post("/api/protected-terms", {
        term: COMPANY,
        type: "ORGANIZATION",
      });
      assert.deepEqual(await added.json(), {
        pseudonym: "[[AZIENDA_1]]",
        added: true,
        terms: 1,
      });
      const preview = await fixture.post("/api/protection-preview", {
        text: `Che cosa è successo con ${COMPANY}?`,
      });
      assert.deepEqual(await preview.json(), {
        text: "Che cosa è successo con [[AZIENDA_1]]?",
        replacements: 1,
        effect: "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT",
      });
      assert.equal(sends, 0);
      assert.equal((await fixture.get("/api/protection-preview")).status, 404);
      assert.equal(
        (
          await fixture.post("/api/protection-preview", {
            text: "bozza",
            scopeId: "GENERAL",
          })
        ).status,
        400,
      );
    } finally {
      await fixture.server.close();
    }
  });

  it("previews automatic replacements locally without reaching the transport", async () => {
    let sends = 0;
    const fixture = await startFixture({
      send: async () => {
        sends += 1;
        throw new Error("A preview must not send.");
      },
    });
    try {
      const general =
        await fixture.application.createGeneralConversation("Anteprima locale");
      const path = `/api/conversations/${encodeURIComponent(general.id)}/protection-preview`;
      const preview = await fixture.post(path, {
        text: "Scrivi a prova@example.invalid prima di inviare.",
      });
      assert.equal(preview.status, 200);
      assert.deepEqual(await preview.json(), {
        text: "Scrivi a [[EMAIL_1]] prima di inviare.",
        replacements: 1,
        effect: "LOCAL_PREVIEW_NOT_AUDITED_AUTHORIZED_OR_SENT",
      });
      assert.equal(sends, 0);
      assert.equal((await fixture.get(path)).status, 404);
      assert.equal((await fixture.post(path, { text: "" })).status, 400);
      assert.equal(
        (await fixture.post(path, { text: "bozza", scopeId: "GENERAL" }))
          .status,
        400,
      );
      const unguarded = await fetch(`${fixture.server.origin}${path}`, {
        method: "POST",
        headers: {
          cookie: fixture.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ text: "prova@example.invalid" }),
      });
      assert.equal(unguarded.status, 403);
    } finally {
      await fixture.server.close();
    }
  });

  it("protects the named value in the next message and restores the answer", async () => {
    const sent: string[] = [];
    const fixture = await startFixture({
      send: async ({ text }) => {
        sent.push(text);
        return {
          kind: "COMPLETED",
          text: "Confermato per [[AZIENDA_1]].",
          requestId: `request-${sent.length}`,
          responseId: `response-${sent.length}`,
          usage: {
            inputTokens: null,
            cachedInputTokens: null,
            outputTokens: null,
          },
        };
      },
    });
    try {
      const general =
        await fixture.application.createGeneralConversation("Termine rivisto");
      const configured = await configure(fixture.application);
      await fixture.application.modelTargets.selectConversation(
        general.id,
        null,
        "synthetic-a",
        configured.revision,
      );
      const added = await fixture.post(
        `/api/conversations/${encodeURIComponent(general.id)}/protected-terms`,
        { term: COMPANY, type: "ORGANIZATION" },
      );
      assert.equal(added.status, 200);
      assert.deepEqual(await added.json(), {
        pseudonym: "[[AZIENDA_1]]",
        added: true,
        terms: 1,
      });

      const turn = await fixture.post(
        `/api/conversations/${encodeURIComponent(general.id)}/turn`,
        {
          targetId: "synthetic-a",
          userText: `Che cosa è successo con ${COMPANY}?`,
          clientRequestId: "after-term",
        },
      );
      const outcome = (await turn.json()) as Readonly<{
        result: Readonly<{ kind: string; text?: string }>;
      }>;
      assert.equal(outcome.result.kind, "COMPLETED", JSON.stringify(outcome));
      assert.equal(sent.length, 1);
      assert.equal(
        sent[0]!.includes(COMPANY),
        false,
        "The transport must never receive the original value.",
      );
      assert.match(sent[0]!, /\[\[AZIENDA_1\]\]/u);
      assert.equal(outcome.result.text, `Confermato per ${COMPANY}.`);
    } finally {
      await fixture.server.close();
    }
  });

  it("refuses an unusable term, an unknown kind and a second kind for one value", async () => {
    const fixture = await startFixture(silentTransport());
    try {
      const general =
        await fixture.application.createGeneralConversation("Rifiuti");
      const path = `/api/conversations/${encodeURIComponent(general.id)}/protected-terms`;
      for (const body of [
        { term: "A", type: "ORGANIZATION" },
        { term: COMPANY, type: "NOT_A_KIND" },
        { term: COMPANY, type: "ORGANIZATION", scopeId: "PROJECT:other" },
        { term: COMPANY },
      ])
        assert.equal(
          (await fixture.post(path, body)).status,
          400,
          JSON.stringify(body),
        );

      assert.equal(
        (await fixture.post(path, { term: COMPANY, type: "ORGANIZATION" }))
          .status,
        200,
      );
      const conflict = await fixture.post(path, {
        term: COMPANY,
        type: "PERSON",
      });
      assert.equal(conflict.status, 409);
      const repeated = await fixture.post(path, {
        term: COMPANY,
        type: "ORGANIZATION",
      });
      assert.deepEqual(await repeated.json(), {
        pseudonym: "[[AZIENDA_1]]",
        added: false,
        terms: 1,
      });
    } finally {
      await fixture.server.close();
    }
  });

  it("answers no term route to a read, and refuses a write without the local guard", async () => {
    const fixture = await startFixture(silentTransport());
    try {
      const general =
        await fixture.application.createGeneralConversation("Guardie");
      const path = `/api/conversations/${encodeURIComponent(general.id)}/protected-terms`;
      assert.equal((await fixture.get(path)).status, 404);
      const unguarded = await fetch(`${fixture.server.origin}${path}`, {
        method: "POST",
        headers: {
          cookie: fixture.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ term: COMPANY, type: "ORGANIZATION" }),
      });
      assert.equal(unguarded.status, 403);
    } finally {
      await fixture.server.close();
    }
  });
});

function silentTransport(): DeliveryTransport {
  return {
    send: async () => {
      throw new Error("No message is sent while only terms are reviewed.");
    },
  };
}

async function configure(application: GuiApplication) {
  const configured = await application.modelTargets.configure(
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
  return application.modelTargets.selectDefault(
    "synthetic-a",
    configured.revision,
  );
}

async function startFixture(transport: DeliveryTransport) {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-term-route-"));
  roots.push(root);
  const application = new GuiApplication({
    workspaceHome: join(root, "home"),
    sampleSessionPath,
    continuationTransport: transport,
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
