import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type { ClassifiedModelTarget } from "@ai-workspace/model-targets";

import { startGuiServer } from "../src/index.ts";
import {
  configureAndSelect,
  localModelApplication,
  syntheticLocalModelLog,
} from "./local-model-turn-fixture.ts";

// Only the roots this file created, collected from mkdtemp while it runs.
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const RULE = "Rispondi solo con i dati sintetici forniti.";
const guided = (overrides: Record<string, unknown> = {}) => ({
  scope: { kind: "GENERAL" },
  modelId: "synthetic-local-model",
  rules: [RULE],
  continuityBudgetBytes: 65_536,
  instructionBudgetBytes: 16_384,
  ...overrides,
});
type Refs = Pick<
  ClassifiedModelTarget,
  "profileRef" | "policyRef" | "instructionRefs"
>;
const localTarget = (refs: Refs): ClassifiedModelTarget => ({
  targetId: "local",
  displayName: "Modello locale",
  executionClass: "LOCAL_MODEL",
  kind: "LLAMA_SERVER_LOOPBACK",
  modelId: "synthetic-local-model",
  boundary: "LOCAL_ONLY",
  ...refs,
  maxInputBytes: 256 * 1024,
  maxOutputBytes: 16_384,
  enabled: true,
});

describe("guided target configuration route", () => {
  it("saves immutable files, and the target saved with them is recognized", async () => {
    const fixture = await startFixture();
    try {
      assert.equal(
        (
          await fetch(
            `${fixture.server.origin}/api/target-configurations/local`,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch(`${fixture.server.origin}/api/target-configurations`, {
            method: "POST",
            headers: {
              cookie: fixture.cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify(guided()),
          })
        ).status,
        403,
      );
      const saved = await fixture.post("/api/target-configurations", guided());
      assert.equal(saved.status, 200);
      const refs = (await saved.json()) as Refs;
      assert.ok(
        refs.profileRef.startsWith(
          join(fixture.home, "target-configurations") + "/",
        ),
      );
      assert.deepEqual(Object.keys(refs).sort(), [
        "instructionRefs",
        "policyRef",
        "profileRef",
      ]);
      const configured = await fixture.post("/api/model-targets", {
        target: localTarget(refs),
        expectedRevision: 0,
      });
      assert.equal(configured.status, 200);
      const read = await fixture.get("/api/target-configurations/local");
      assert.deepEqual(await read.json(), { configuration: guided() });
      assert.equal(
        (await fixture.get("/api/target-configurations/missing")).status,
        404,
      );
    } finally {
      await fixture.server.close();
    }
  });

  it("reports files of one's own as not guided", async () => {
    const fixture = await startFixture();
    try {
      await fixture.post("/api/model-targets", {
        target: localTarget({
          profileRef: join(fixture.home, "own", "profile.json"),
          policyRef: join(fixture.home, "own", "policy.json"),
          instructionRefs: [join(fixture.home, "own", "instructions.json")],
        }),
        expectedRevision: 0,
      });
      const read = await fixture.get("/api/target-configurations/local");
      assert.deepEqual(await read.json(), { configuration: null });
    } finally {
      await fixture.server.close();
    }
  });

  it("accepts a registered project only, and explains a refused input", async () => {
    const fixture = await startFixture();
    try {
      const unknown = await fixture.post(
        "/api/target-configurations",
        guided({ scope: { kind: "PROJECT", projectId: "not-registered" } }),
      );
      assert.equal(unknown.status, 400);
      assert.match(
        ((await unknown.json()) as { message: string }).message,
        /registered project/u,
      );
      const project = await fixture.application.registerProject(process.cwd());
      const saved = await fixture.post(
        "/api/target-configurations",
        guided({ scope: { kind: "PROJECT", projectId: project.id } }),
      );
      assert.equal(saved.status, 200);
      const policy = JSON.parse(
        await readFile(((await saved.json()) as Refs).policyRef, "utf8"),
      ) as { scope: unknown };
      assert.deepEqual(policy.scope, {
        kind: "PROJECT",
        projectId: project.id,
      });
      const refused = await fixture.post(
        "/api/target-configurations",
        guided({ rules: [] }),
      );
      assert.equal(refused.status, 400);
      const body = (await refused.json()) as {
        message: string;
        recovery: string;
      };
      assert.match(body.message, /instruction rules/u);
      assert.ok(body.recovery.length > 0);
    } finally {
      await fixture.server.close();
    }
  });

  it("runs a General turn on a guided configuration and sends its rule", async () => {
    const root = await temporaryRoot();
    const log = syntheticLocalModelLog();
    const application = localModelApplication(root, { log });
    const { digest, ...refs } =
      await application.modelTargets.configurations.save(guided());
    assert.match(digest, /^[a-f0-9]{64}$/u);
    const general = await application.createGeneralConversation(
      "Conversazione guidata sintetica",
    );
    await configureAndSelect(
      application,
      [localTarget(refs)],
      general.id,
      null,
      "local",
    );
    const outcome = (await application.conversationTurns.run({
      conversationId: general.id,
      projectId: null,
      targetId: "local",
      userText: "Qual è lo stato del lavoro sintetico?",
      clientRequestId: "guided-1",
    })) as { result: { kind: string } };
    assert.equal(outcome.result.kind, "COMPLETED", JSON.stringify(outcome));
    assert.equal(log.bodies.length, 1);
    assert.ok(
      log.bodies[0]!.includes(RULE),
      "the guided rule reaches the model",
    );
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(
    join(tmpdir(), "ai-workspace-target-configuration-route-"),
  );
  roots.push(root);
  return root;
}

async function startFixture() {
  const root = await temporaryRoot();
  const application = localModelApplication(root);
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
    home: join(root, "home"),
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
