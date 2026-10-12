import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import { GuiApplication, startGuiServer } from "../src/index.ts";

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

describe("persistent model target routes", () => {
  it("exposes safe names to conversations and keeps technical configuration in Settings", async () => {
    const fixture = await startFixture();
    try {
      assert.equal(
        (await fetch(`${fixture.server.origin}/api/model-targets`)).status,
        401,
      );
      assert.equal((await fixture.post("/api/model-targets", {})).status, 400);
      const configured = await configure(
        fixture,
        modelTarget("a", "Model A"),
        0,
      );
      const safe = await fixture.get("/api/model-targets");
      assert.deepEqual(await safe.json(), {
        revision: configured.revision,
        targets: [
          {
            targetId: "a",
            displayName: "Model A",
            enabled: true,
            executionClass: "LOCAL_MODEL",
            // Qualified offline, but the process received no loopback address.
            availability: {
              enabled: true,
              qualifiedOffline: true,
              launch: "UNAVAILABLE",
              reason: "NOT_CONNECTED",
            },
          },
        ],
        defaultTargetId: null,
      });
      const safeText = await (await fixture.get("/api/model-targets")).text();
      assert.doesNotMatch(
        safeText,
        /modelId|profileRef|policyRef|instructionRefs/u,
      );
      const settings = (await (
        await fixture.get("/api/model-targets/configuration")
      ).json()) as { targets: unknown[] };
      assert.equal(settings.targets.length, 1);
    } finally {
      await fixture.server.close();
    }
  });

  it("names the class and a simulated or unconnected launch without probing anything", async () => {
    const fixture = await startFixture();
    try {
      let configuration = await configure(
        fixture,
        {
          ...modelTarget("api", "GPT lookalike"),
          executionClass: "MODEL_DELIVERY",
          kind: "OPENAI_RESPONSES",
          boundary: "EXTERNAL_SERVICE",
        },
        0,
      );
      configuration = await configure(
        fixture,
        {
          ...modelTarget("codex", "Codex"),
          executionClass: "AGENT_EXECUTION",
          kind: "CODEX_CLI",
          boundary: "EXTERNAL_SERVICE",
        },
        configuration.revision,
      );
      const view = (await (await fixture.get("/api/model-targets")).json()) as {
        targets: {
          targetId: string;
          executionClass: string;
          availability: { launch: string; reason: string | null };
        }[];
      };
      assert.deepEqual(
        view.targets.map((target) => [
          target.targetId,
          target.executionClass,
          target.availability.launch,
          target.availability.reason,
        ]),
        [
          ["api", "MODEL_DELIVERY", "SIMULATED", null],
          ["codex", "AGENT_EXECUTION", "UNAVAILABLE", "NOT_CONNECTED"],
        ],
      );
      for (const target of [
        { ...modelTarget("x", "X"), executionClass: "AGENT_EXECUTION" },
        { ...modelTarget("x", "X"), kind: "OLLAMA" },
        {
          ...modelTarget("x", "X"),
          executionClass: null,
          kind: null,
          legacyProviderKind: "LOCAL_ADAPTER",
        },
      ]) {
        const refused = await fixture.post("/api/model-targets", {
          target,
          expectedRevision: configuration.revision,
        });
        assert.equal(refused.status, 400, JSON.stringify(target));
      }
      const settings = (await (
        await fixture.get("/api/model-targets/configuration")
      ).json()) as { revision: number; targets: unknown[] };
      assert.equal(settings.revision, configuration.revision);
      assert.equal(settings.targets.length, 2);
    } finally {
      await fixture.server.close();
    }
  });

  it("persists A to B for one conversation across a server restart", async () => {
    const root = await temporaryRoot();
    let fixture = await startFixture(root);
    let conversationId: string;
    let projectId: string;
    try {
      let configuration = await configure(
        fixture,
        modelTarget("a", "Model A"),
        0,
      );
      configuration = await configure(
        fixture,
        modelTarget("b", "Model B"),
        configuration.revision,
      );
      const defaultResponse = await fixture.post("/api/model-targets/default", {
        targetId: "a",
        expectedRevision: configuration.revision,
      });
      assert.equal(defaultResponse.status, 200);
      const project = await fixture.application.registerProject(process.cwd());
      await fixture.application.importSample(project.id);
      projectId = project.id;
      const page = (await (await fixture.get("/api/conversations")).json()) as {
        rows: { id: string }[];
      };
      conversationId = page.rows[0]!.id;
      const path = `/api/conversations/${encodeURIComponent(conversationId)}/model-target?project=${encodeURIComponent(projectId)}`;
      const inherited = (await (await fixture.get(path)).json()) as {
        revision: number;
        selected: { targetId: string; selectedBy: string };
      };
      assert.deepEqual(inherited.selected, {
        targetId: "a",
        displayName: "Model A",
        selectedBy: "DEFAULT",
      });
      const selected = (await (
        await fixture.post(path, {
          targetId: "b",
          expectedRevision: inherited.revision,
        })
      ).json()) as { selected: { targetId: string } };
      assert.equal(selected.selected.targetId, "b");
    } finally {
      await fixture.server.close();
    }

    fixture = await startFixture(root);
    try {
      const path = `/api/conversations/${encodeURIComponent(conversationId!)}/model-target?project=${encodeURIComponent(projectId!)}`;
      const restored = (await (await fixture.get(path)).json()) as {
        selected: { targetId: string; displayName: string; selectedBy: string };
      };
      assert.deepEqual(restored.selected, {
        targetId: "b",
        displayName: "Model B",
        selectedBy: "CONVERSATION",
      });
    } finally {
      await fixture.server.close();
    }
  });
});

function modelTarget(targetId: string, displayName: string) {
  return {
    targetId,
    displayName,
    executionClass: "LOCAL_MODEL",
    kind: "LLAMA_SERVER_LOOPBACK",
    modelId: `synthetic-${targetId}`,
    boundary: "LOCAL_ONLY",
    profileRef: `profiles/${targetId}.json`,
    policyRef: `policies/${targetId}.json`,
    instructionRefs: [`instructions/${targetId}.json`],
    maxInputBytes: 65_536,
    maxOutputBytes: 16_384,
    enabled: true,
  };
}

async function configure(
  fixture: Awaited<ReturnType<typeof startFixture>>,
  target: ReturnType<typeof modelTarget>,
  expectedRevision: number,
) {
  const response = await fixture.post("/api/model-targets", {
    target,
    expectedRevision,
  });
  assert.equal(response.status, 200);
  return (await response.json()) as { revision: number };
}

async function temporaryRoot() {
  const root = await mkdtemp(
    join(tmpdir(), "ai-workspace-model-target-route-"),
  );
  roots.push(root);
  return root;
}

async function startFixture(existingRoot?: string) {
  const root = existingRoot ?? (await temporaryRoot());
  const application = new GuiApplication({
    workspaceHome: join(root, "home"),
    sampleSessionPath,
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
