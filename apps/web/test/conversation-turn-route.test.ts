import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import { GuiApplication, startGuiServer } from "../src/index.ts";
import { continuationFixture } from "./continuation-fixture.ts";

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

describe("primary conversation turn route", () => {
  it("reuses one automatic pseudonym across model changes and restart, then restores the response", async () => {
    const sent: string[] = [];
    const transport: DeliveryTransport = {
      send: async ({ text }) => {
        sent.push(text);
        assert.equal(text.includes("anna.rossi@example.test"), false);
        assert.match(text, /\[\[EMAIL_1\]\]/u);
        return {
          kind: "COMPLETED",
          text: "Confermato per [[EMAIL_1]].",
          requestId: `request-${sent.length}`,
          responseId: `response-${sent.length}`,
          usage: {
            inputTokens: null,
            cachedInputTokens: null,
            outputTokens: null,
          },
        };
      },
    };
    const first = await startFixture(transport);
    const root = first.root;
    const general = await first.application.createGeneralConversation(
      "Protezione automatica sintetica",
    );
    const configuration = await configure(first.application);
    await first.application.modelTargets.selectConversation(
      general.id,
      null,
      "synthetic-a",
      configuration.revision,
    );
    const firstResponse = await first.post(
      `/api/conversations/${encodeURIComponent(general.id)}/turn`,
      {
        targetId: "synthetic-a",
        userText: "Contatta anna.rossi@example.test",
        clientRequestId: "stable-first",
      },
    );
    const firstOutcome = (await firstResponse.json()) as TurnOutcome;
    assert.equal(firstOutcome.result.kind, "COMPLETED");
    assert.equal(
      firstOutcome.result.kind === "COMPLETED"
        ? firstOutcome.result.text
        : null,
      "Confermato per anna.rossi@example.test.",
    );
    await first.server.close();

    const second = await startFixture(transport, root);
    try {
      const current = await second.application.modelTargets.inspect();
      await second.application.modelTargets.selectConversation(
        general.id,
        null,
        "synthetic-b",
        current.revision,
      );
      const secondResponse = await second.post(
        `/api/conversations/${encodeURIComponent(general.id)}/turn`,
        {
          targetId: "synthetic-b",
          userText: "Scrivi ancora ad anna.rossi@example.test",
          clientRequestId: "stable-second",
        },
      );
      const secondOutcome = (await secondResponse.json()) as TurnOutcome;
      assert.equal(secondOutcome.result.kind, "COMPLETED");
      assert.equal(secondOutcome.result.effectiveModel, "Synthetic B");
      assert.equal(sent.length, 2);
      assert.match(sent[1]!, /\[\[EMAIL_1\]\]/u);
    } finally {
      await second.server.close();
    }
  });

  it("withholds a provider response containing an unknown automatic placeholder", async () => {
    const fixture = await startFixture({
      send: async () => ({
        kind: "COMPLETED",
        text: "Unknown [[EMAIL_999]]",
        requestId: "unknown-placeholder-request",
        responseId: "unknown-placeholder-response",
        usage: {
          inputTokens: null,
          cachedInputTokens: null,
          outputTokens: null,
        },
      }),
    });
    try {
      const general = await fixture.application.createGeneralConversation(
        "Placeholder sconosciuto",
      );
      const configured = await configure(fixture.application);
      await fixture.application.modelTargets.selectConversation(
        general.id,
        null,
        "synthetic-a",
        configured.revision,
      );
      const response = await fixture.post(
        `/api/conversations/${encodeURIComponent(general.id)}/turn`,
        {
          targetId: "synthetic-a",
          userText: "Contatta anna@example.test",
          clientRequestId: "unknown-placeholder",
        },
      );
      const outcome = (await response.json()) as TurnOutcome;
      assert.equal(outcome.result.kind, "RESPONSE_WITHHELD");
      assert.equal(outcome.result.reason, "RESTORATION_FAILED");
    } finally {
      await fixture.server.close();
    }
  });

  it("coordinates a duplicate click once and retains the selected target attribution", async () => {
    let exposures = 0;
    const sent: string[] = [];
    const fixture = await startFixture({
      send: async ({ text }) => {
        exposures += 1;
        sent.push(text);
        await Promise.resolve();
        return {
          kind: "COMPLETED",
          text: "Synthetic coordinated answer",
          requestId: "request-once",
          responseId: "response-once",
          usage: {
            inputTokens: null,
            cachedInputTokens: null,
            outputTokens: null,
          },
        };
      },
    });
    try {
      const project = await fixture.application.registerProject(process.cwd());
      await fixture.application.importSample(project.id);
      const page = (await (await fixture.get("/api/conversations")).json()) as {
        rows: { id: string; projectId: string }[];
      };
      const conversation = page.rows[0]!;
      const configured = await configure(fixture.application);
      await fixture.application.modelTargets.selectConversation(
        conversation.id,
        project.id,
        "synthetic-b",
        configured.revision,
      );
      const path = `/api/conversations/${encodeURIComponent(conversation.id)}/turn?project=${encodeURIComponent(project.id)}`;
      const input = {
        targetId: "synthetic-b",
        userText: "Continue with the current evidence",
        clientRequestId: "request-same",
      };
      const [left, right] = await Promise.all([
        fixture.post(path, input),
        fixture.post(path, input),
      ]);
      assert.equal(left.status, 200);
      assert.equal(right.status, 200);
      const outcomes = (await Promise.all([
        left.json(),
        right.json(),
      ])) as TurnOutcome[];
      assert.equal(exposures, 1);
      assert.equal(sent.length, 1);
      assert.match(sent[0]!, /Continue with the current evidence/u);
      assert.deepEqual(outcomes.map((outcome) => outcome.duplicate).sort(), [
        false,
        true,
      ]);
      for (const outcome of outcomes) {
        assert.equal(outcome.result.kind, "COMPLETED", JSON.stringify(outcome));
        assert.equal(outcome.result.effectiveModel, "Synthetic B");
      }
      const opened = (await (
        await fixture.get(
          `/api/conversations/${encodeURIComponent(conversation.id)}?project=${encodeURIComponent(project.id)}`,
        )
      ).json()) as {
        moments: { type: string; text: string; speaker: string | null }[];
      };
      assert.deepEqual(
        opened.moments.slice(-2).map(({ type, text, speaker }) => ({
          type,
          text,
          speaker,
        })),
        [
          { type: "USER_MESSAGE", text: input.userText, speaker: null },
          {
            type: "AGENT_MESSAGE",
            text: "Synthetic coordinated answer",
            speaker: "Synthetic B",
          },
        ],
      );
    } finally {
      await fixture.server.close();
    }
  });

  it("uses reduced context for General and for a project conversation without a handoff", async () => {
    const sent: string[] = [];
    const fixture = await startFixture(completedTransport(sent));
    try {
      let configured = await configure(fixture.application);
      const general = await fixture.application.createGeneralConversation(
        "Synthetic General turn",
      );
      configured = await fixture.application.modelTargets.selectConversation(
        general.id,
        null,
        "synthetic-b",
        configured.revision,
      );
      const generalResponse = await fixture.post(
        `/api/conversations/${encodeURIComponent(general.id)}/turn`,
        {
          targetId: "synthetic-b",
          userText: "Question without a project",
          clientRequestId: "general-request",
        },
      );
      assert.equal(generalResponse.status, 200);
      const generalOutcome = (await generalResponse.json()) as TurnOutcome;
      assert.equal(
        generalOutcome.result.kind,
        "COMPLETED",
        JSON.stringify(generalOutcome),
      );

      const project = await fixture.application.registerProject(process.cwd());
      await fixture.application.importSample(project.id);
      const page = (await (await fixture.get("/api/conversations")).json()) as {
        rows: { id: string; projectId: string | null; kind: string }[];
      };
      const session = page.rows.find((row) => row.kind === "WORK_SESSION")!;
      await fixture.application.modelTargets.selectConversation(
        session.id,
        project.id,
        "synthetic-b",
        configured.revision,
      );
      const projectResponse = await fixture.post(
        `/api/conversations/${encodeURIComponent(session.id)}/turn?project=${encodeURIComponent(project.id)}`,
        {
          targetId: "synthetic-b",
          userText: "Question without a handoff",
          clientRequestId: "project-request",
        },
      );
      assert.equal(projectResponse.status, 200);
      assert.equal(
        ((await projectResponse.json()) as TurnOutcome).result.kind,
        "COMPLETED",
      );
      assert.equal(sent.length, 2);
      assert.match(sent[0]!, /BOUNDED_REDUCED_CONVERSATION_CONTEXT/u);
      assert.match(sent[0]!, /Question without a project/u);
      assert.match(sent[1]!, /Question without a handoff/u);
    } finally {
      await fixture.server.close();
    }
  });

  it("enriches a work conversation with its existing handoff context", async () => {
    const sent: string[] = [];
    const fixture = await continuationFixture(completedTransport(sent));
    roots.push(fixture.root);
    let configuration = await fixture.app.modelTargets.configure(
      {
        targetId: "handoff-target",
        displayName: "Handoff target",
        providerKind: "OPENAI_RESPONSES",
        modelId: fixture.target.model,
        boundary: "EXTERNAL_SERVICE",
        profileRef: fixture.target.profile.path,
        policyRef: fixture.target.policy.path,
        instructionRefs: fixture.target.bundles.map((bundle) => bundle.path),
        maxInputBytes: 256 * 1024,
        maxOutputBytes: 16_384,
        enabled: true,
      },
      0,
    );
    configuration = await fixture.app.modelTargets.selectDefault(
      "handoff-target",
      configuration.revision,
    );
    assert.equal(configuration.defaultTargetId, "handoff-target");
    const outcome = await fixture.app.conversationTurns.run({
      ...fixture.query,
      targetId: "handoff-target",
      userText: "Continue from the reviewed handoff",
      clientRequestId: "handoff-request",
    });
    assert.equal(outcome.result.kind, "COMPLETED");
    assert.equal(sent.length, 1);
    assert.match(sent[0]!, /Continuation context/u);
    assert.match(sent[0]!, /Inspect the rare failure before retrying/u);
    assert.match(sent[0]!, /Continue from the reviewed handoff/u);
  });
});

type TurnOutcome = Readonly<{
  duplicate: boolean;
  result: Readonly<{
    kind: string;
    effectiveModel?: string;
    text?: string;
    reason?: string;
  }>;
}>;

function completedTransport(sent: string[]): DeliveryTransport {
  return {
    send: async ({ text }) => {
      sent.push(text);
      return {
        kind: "COMPLETED",
        text: `Synthetic answer ${sent.length}`,
        requestId: `request-${sent.length}`,
        responseId: `response-${sent.length}`,
        usage: {
          inputTokens: null,
          cachedInputTokens: null,
          outputTokens: null,
        },
      };
    },
  };
}

async function configure(application: GuiApplication) {
  let configured = await application.modelTargets.configure(
    modelTarget("synthetic-a", "Synthetic A"),
    0,
  );
  configured = await application.modelTargets.configure(
    modelTarget("synthetic-b", "Synthetic B"),
    configured.revision,
  );
  return application.modelTargets.selectDefault(
    "synthetic-a",
    configured.revision,
  );
}

function modelTarget(targetId: string, displayName: string) {
  return {
    targetId,
    displayName,
    providerKind: "OPENAI_RESPONSES",
    modelId: `${targetId}-model`,
    boundary: "EXTERNAL_SERVICE" as const,
    profileRef: "synthetic-profile.json",
    policyRef: "synthetic-policy.json",
    instructionRefs: ["synthetic-instructions.json"],
    maxInputBytes: 65_536,
    maxOutputBytes: 16_384,
    enabled: true,
  };
}

async function startFixture(
  transport: DeliveryTransport,
  existingRoot?: string,
) {
  const root =
    existingRoot ?? (await mkdtemp(join(tmpdir(), "ai-workspace-turn-route-")));
  if (existingRoot === undefined) roots.push(root);
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
    root,
    application,
    server,
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
