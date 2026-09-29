import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import type { ClassifiedModelTarget } from "@ai-workspace/model-targets";
import { GuiApplication, startGuiServer } from "../src/index.ts";
import { continuationFixture } from "./continuation-fixture.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";

const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const roots: string[] = [];
const servers = new Set<Awaited<ReturnType<typeof startGuiServer>>>();

it("deduplicates the same completed or unknown gesture after server recreation", async () => {
  for (const unknown of [false, true]) {
    let exposures = 0;
    const transport: DeliveryTransport = {
      send: async () => {
        exposures += 1;
        return unknown
          ? { kind: "UNKNOWN" }
          : {
              kind: "COMPLETED",
              text: "Durable synthetic answer",
              requestId: "r",
              responseId: "s",
              usage: {
                inputTokens: null,
                cachedInputTokens: null,
                outputTokens: null,
              },
            };
      },
    };
    const first = await startFixture(transport);
    const general =
      await first.application.createGeneralConversation("Recovery");
    await configure(first.application, first.root);
    const path = `/api/conversations/${encodeURIComponent(general.id)}/turn`;
    const body = {
      targetId: "synthetic-a",
      userText: "A synthetic recovery question",
      clientRequestId: "durable-gesture",
    };
    const original = (await (
      await first.post(path, body)
    ).json()) as TurnOutcome;
    assert.equal(
      original.result.kind,
      unknown ? "UNKNOWN_AFTER_EXPOSURE" : "COMPLETED",
    );
    await first.server.close();
    const second = await startFixture(transport, first.root);
    const duplicate = (await (
      await second.post(path, body)
    ).json()) as TurnOutcome;
    assert.equal(exposures, 1);
    assert.equal(duplicate.duplicate, true);
    assert.deepEqual(duplicate.result, original.result);
    const changed = await second.post(path, {
      ...body,
      userText: `${body.userText} `,
    });
    assert.equal(changed.status, 409);
    assert.equal(exposures, 1);
    await second.server.close();
  }
});
afterEach(async () => {
  await Promise.all(
    [...servers].map(async (server) => {
      try {
        await server.close();
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "ERR_SERVER_NOT_RUNNING"
        ))
          throw error;
      }
    }),
  );
  servers.clear();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("primary conversation turn route", () => {
  it("reuses one automatic pseudonym across model changes and restart, then restores the response", async () => {
    const sent: string[] = [];
    const transport: DeliveryTransport = {
      send: async ({ text, maxOutputTokens, timeoutMs }) => {
        sent.push(text);
        assert.equal(maxOutputTokens, 512);
        assert.equal(timeoutMs, 30_000);
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
    const configuration = await configure(first.application, first.root);
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
      const configured = await configure(fixture.application, fixture.root);
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
      const configured = await configure(
        fixture.application,
        fixture.root,
        project.id,
      );
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

  it("refuses agent and local-model selections without falling back to Responses", async () => {
    const sent: string[] = [];
    const fixture = await startFixture(completedTransport(sent));
    try {
      let configured = await configure(fixture.application, fixture.root);
      for (const [targetId, executionClass, kind, boundary] of [
        ["synthetic-codex", "AGENT_EXECUTION", "CODEX_CLI", "EXTERNAL_SERVICE"],
        [
          "synthetic-claude",
          "AGENT_EXECUTION",
          "CLAUDE_CODE",
          "EXTERNAL_SERVICE",
        ],
        [
          "synthetic-local",
          "LOCAL_MODEL",
          "LLAMA_SERVER_LOOPBACK",
          "LOCAL_ONLY",
        ],
      ] as const)
        configured = await fixture.application.modelTargets.configure(
          {
            ...modelTarget(targetId, targetId),
            ...(await writeReducedTurnConfiguration(
              join(fixture.root, `configuration-${targetId}`),
              `${targetId}-model`,
              null,
            )),
            executionClass,
            kind,
            boundary,
          } as ClassifiedModelTarget,
          configured.revision,
        );
      for (const targetId of [
        "synthetic-codex",
        "synthetic-claude",
        "synthetic-local",
      ]) {
        const general = await fixture.application.createGeneralConversation(
          `Synthetic ${targetId} turn`,
        );
        configured = await fixture.application.modelTargets.selectConversation(
          general.id,
          null,
          targetId,
          configured.revision,
        );
        const path = `/api/conversations/${encodeURIComponent(general.id)}`;
        const preview = (await (
          await fixture.post(`${path}/turn-preview`, {
            targetId,
            userText: "Continua con il contesto sintetico",
          })
        ).json()) as { kind: string; reason?: string };
        assert.deepEqual(
          [preview.kind, preview.reason],
          ["BLOCKED", "TARGET_UNAVAILABLE"],
          targetId,
        );
        const outcome = (await (
          await fixture.post(`${path}/turn`, {
            targetId,
            userText: "Continua con il contesto sintetico",
            clientRequestId: `no-fallback-${targetId}`,
          })
        ).json()) as TurnOutcome;
        assert.equal(outcome.result.kind, "REFUSED_BEFORE_EXPOSURE", targetId);
        assert.equal(outcome.result.reason, "TARGET_UNAVAILABLE", targetId);
      }
      assert.deepEqual(sent, []);
    } finally {
      await fixture.server.close();
    }
  });

  it("uses reduced context for General and for a project conversation without a handoff", async () => {
    const sent: string[] = [];
    const fixture = await startFixture(completedTransport(sent));
    try {
      let configured = await configure(fixture.application, fixture.root);
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
      configured = await configure(
        fixture.application,
        fixture.root,
        project.id,
      );
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
        executionClass: "MODEL_DELIVERY",
        kind: "OPENAI_RESPONSES",
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
    const preview = await fixture.app.conversationTurns.previewTurnPayload({
      conversationId: fixture.query.conversationId,
      targetId: "handoff-target",
      userText: "Continue from the reviewed handoff",
      bindReview: true,
    });
    assert.equal(preview.kind, "READY");
    if (preview.kind !== "READY" || !preview.review)
      throw new Error("Review unavailable");
    const outcome = await fixture.app.conversationTurns.run({
      ...fixture.query,
      targetId: "handoff-target",
      userText: "Continue from the reviewed handoff",
      clientRequestId: "handoff-request",
      reviewId: preview.review.id,
    });
    assert.equal(outcome.result.kind, "COMPLETED");
    assert.equal(sent.length, 1);
    assert.equal(sent[0], preview.protectedText);
    assert.match(sent[0]!, /Continuation context/u);
    assert.match(sent[0]!, /Inspect the rare failure before retrying/u);
    assert.match(sent[0]!, /Continue from the reviewed handoff/u);
    const restarted = new GuiApplication({
      workspaceHome: fixture.home,
      sampleSessionPath,
      continuationTransport: completedTransport(sent),
    });
    const replay = await restarted.conversationTurns.run({
      ...fixture.query,
      targetId: "handoff-target",
      userText: "Continue from the reviewed handoff",
      clientRequestId: "handoff-request",
      reviewId: preview.review.id,
    });
    assert.equal(replay.duplicate, true);
    assert.deepEqual(replay.result, outcome.result);
    assert.equal(sent.length, 1);
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

async function configure(
  application: GuiApplication,
  root: string,
  projectId: string | null = null,
) {
  const current = await application.modelTargets.inspect();
  let configured = await application.modelTargets.configure(
    {
      ...modelTarget("synthetic-a", "Synthetic A"),
      ...(await writeReducedTurnConfiguration(
        join(root, "configuration-a"),
        "synthetic-a-model",
        projectId,
      )),
    },
    current.revision,
  );
  configured = await application.modelTargets.configure(
    {
      ...modelTarget("synthetic-b", "Synthetic B"),
      ...(await writeReducedTurnConfiguration(
        join(root, "configuration-b"),
        "synthetic-b-model",
        projectId,
      )),
    },
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
    executionClass: "MODEL_DELIVERY" as const,
    kind: "OPENAI_RESPONSES" as const,
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
  servers.add(server);
  const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
  const cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
  return {
    root,
    application,
    server: {
      ...server,
      close: async () => {
        servers.delete(server);
        await server.close();
      },
    },
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
