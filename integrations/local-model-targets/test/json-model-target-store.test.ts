import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  emptyModelTargetConfiguration,
  ModelTargetConflictError,
  ModelTargetError,
  ModelTargets,
} from "@ai-workspace/model-targets";
import { JsonModelTargetStore } from "../src/index.ts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("JsonModelTargetStore", () => {
  it("starts empty and never migrates transient settings or credentials", async () => {
    const home = await temporaryHome();
    await writeFile(
      join(home, "legacy-continuation-target.json"),
      JSON.stringify({ credential: "synthetic-secret-never-read" }),
      "utf8",
    );
    assert.deepEqual(
      await new JsonModelTargetStore(home).load(),
      emptyModelTargetConfiguration(),
    );
  });

  it("persists versioned bounded configuration with restrictive permissions", async () => {
    const home = await temporaryHome();
    const store = new JsonModelTargetStore(home);
    const targets = new ModelTargets(store);
    await targets.configure(sampleTarget(), 0);
    const path = join(home, "model-targets", "configuration.json");
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(path, "utf8")).schemaVersion, 2);
    assert.equal(
      (await store.load()).targets[0]?.displayName,
      "Synthetic model",
    );
  });

  it("rejects stale concurrency and fails closed on corruption and unsafe permissions", async () => {
    const home = await temporaryHome();
    const store = new JsonModelTargetStore(home);
    const targets = new ModelTargets(store);
    const first = await targets.configure(sampleTarget(), 0);
    await assert.rejects(
      () => store.replace(0, first),
      ModelTargetConflictError,
    );
    const path = join(home, "model-targets", "configuration.json");
    await writeFile(path, "{broken", { mode: 0o600 });
    await assert.rejects(() => store.load(), ModelTargetError);
    await writeFile(path, JSON.stringify(first), { mode: 0o644 });
    await chmod(path, 0o644);
    await assert.rejects(() => store.load(), /permissions are unsafe/u);
  });

  it("preserves a lock owned by another local writer", async () => {
    const home = await temporaryHome();
    const directory = join(home, "model-targets");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const lock = join(directory, "configuration.json.lock");
    await writeFile(lock, "other-owner\n", { mode: 0o600 });
    const targets = new ModelTargets(new JsonModelTargetStore(home));
    await assert.rejects(
      () => targets.configure(sampleTarget(), 0),
      ModelTargetConflictError,
    );
    assert.equal(await readFile(lock, "utf8"), "other-owner\n");
  });
});

describe("JsonModelTargetStore v1 migration", () => {
  it("reads a v1 document as v2 without writing anything", async () => {
    const home = await temporaryHome();
    const path = await writeLegacy(home);
    const before = await readFile(path);
    const configuration = await new JsonModelTargetStore(home).load();
    assert.equal(configuration.schemaVersion, 2);
    assert.equal(configuration.revision, 7);
    assert.deepEqual(
      configuration.targets.map((target) => [
        target.targetId,
        target.executionClass,
        target.kind,
      ]),
      [
        ["api-target", "MODEL_DELIVERY", "OPENAI_RESPONSES"],
        ["local-target", null, null],
        ["named-like-codex", null, null],
      ],
    );
    assert.deepEqual(await readFile(path), before);
    assert.deepEqual(await backups(home), []);
  });

  it("preserves the exact v1 bytes before publishing v2 on the first change", async () => {
    const home = await temporaryHome();
    const path = await writeLegacy(home);
    const original = await readFile(path);
    const targets = new ModelTargets(new JsonModelTargetStore(home));
    const next = await targets.selectDefault(null, 7);
    const [backup] = await backups(home);
    assert.equal(
      backup,
      `configuration.v1-${createHash("sha256").update(original).digest("hex")}.json`,
    );
    const backupPath = join(home, "model-targets", backup!);
    assert.deepEqual(await readFile(backupPath), original);
    assert.equal((await stat(backupPath)).mode & 0o777, 0o600);
    const stored = JSON.parse(await readFile(path, "utf8"));
    assert.equal(stored.schemaVersion, 2);
    assert.equal(stored.revision, 8);
    assert.deepEqual(stored, JSON.parse(JSON.stringify(next)));
    assert.deepEqual(stored.targets[1], {
      targetId: "local-target",
      displayName: "Local target",
      executionClass: null,
      kind: null,
      legacyProviderKind: "LOCAL_ADAPTER",
      boundary: "LOCAL_ONLY",
      modelId: "synthetic-local",
      profileRef: "profiles/local-target.json",
      policyRef: "policies/local-target.json",
      instructionRefs: ["instructions/local-target.json"],
      maxInputBytes: 65_536,
      maxOutputBytes: 16_384,
      enabled: true,
    });
    assert.deepEqual(stored.conversationSelections, [
      {
        conversationId: "conversation-one",
        projectId: null,
        targetId: "local-target",
      },
    ]);

    const restarted = new ModelTargets(new JsonModelTargetStore(home));
    assert.deepEqual(await restarted.inspect(), next);
    await restarted.selectDefault("api-target", 8);
    assert.deepEqual(await backups(home), [backup]);
  });

  it("reuses the copy left by an interrupted migration and refuses a different one", async () => {
    const home = await temporaryHome();
    const path = await writeLegacy(home);
    const original = await readFile(path);
    const name = `configuration.v1-${createHash("sha256").update(original).digest("hex")}.json`;
    const backupPath = join(home, "model-targets", name);
    await writeFile(backupPath, "not the preserved configuration\n", {
      mode: 0o600,
    });
    const targets = new ModelTargets(new JsonModelTargetStore(home));
    await assert.rejects(
      () => targets.selectDefault(null, 7),
      /does not match. Nothing was changed/u,
    );
    assert.deepEqual(await readFile(path), original);
    assert.equal(
      await readFile(backupPath, "utf8"),
      "not the preserved configuration\n",
    );

    await writeFile(backupPath, original, { mode: 0o600 });
    await targets.selectDefault(null, 7);
    assert.deepEqual(await readFile(backupPath), original);
    assert.equal(JSON.parse(await readFile(path, "utf8")).schemaVersion, 2);
  });

  it("keeps v1 untouched on a stale revision and rejects unknown schemas", async () => {
    const home = await temporaryHome();
    const path = await writeLegacy(home);
    const original = await readFile(path);
    const targets = new ModelTargets(new JsonModelTargetStore(home));
    await assert.rejects(
      () => targets.selectDefault(null, 6),
      ModelTargetConflictError,
    );
    assert.deepEqual(await readFile(path), original);
    assert.deepEqual(await backups(home), []);

    await writeFile(
      path,
      JSON.stringify({
        ...JSON.parse(original.toString("utf8")),
        schemaVersion: 3,
      }),
      { mode: 0o600 },
    );
    await assert.rejects(() => targets.inspect(), /Unsupported/u);
  });
});

async function writeLegacy(home: string) {
  const directory = join(home, "model-targets");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const legacy = (
    targetId: string,
    providerKind: string,
    boundary: string,
  ) => ({
    targetId,
    displayName:
      targetId === "api-target"
        ? "API target"
        : targetId === "local-target"
          ? "Local target"
          : "Codex lookalike",
    providerKind,
    modelId: `synthetic-${targetId.split("-")[0]}`,
    boundary,
    profileRef: `profiles/${targetId}.json`,
    policyRef: `policies/${targetId}.json`,
    instructionRefs: [`instructions/${targetId}.json`],
    maxInputBytes: 65_536,
    maxOutputBytes: 16_384,
    enabled: true,
  });
  const path = join(directory, "configuration.json");
  await writeFile(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        revision: 7,
        targets: [
          legacy("api-target", "OPENAI_RESPONSES", "EXTERNAL_SERVICE"),
          legacy("local-target", "LOCAL_ADAPTER", "LOCAL_ONLY"),
          legacy("named-like-codex", "CODEX_CLI", "EXTERNAL_SERVICE"),
        ],
        defaultTargetId: "local-target",
        projectSelections: [],
        conversationSelections: [
          {
            conversationId: "conversation-one",
            projectId: null,
            targetId: "local-target",
          },
        ],
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  return path;
}

async function backups(home: string) {
  return (await readdir(join(home, "model-targets")))
    .filter((name) => name.startsWith("configuration.v1-"))
    .sort();
}

function sampleTarget() {
  return {
    targetId: "synthetic-model",
    displayName: "Synthetic model",
    executionClass: "LOCAL_MODEL" as const,
    kind: "LLAMA_SERVER_LOOPBACK" as const,
    modelId: "synthetic-v1",
    boundary: "LOCAL_ONLY" as const,
    profileRef: "profiles/synthetic.json",
    policyRef: "policies/synthetic.json",
    instructionRefs: ["instructions/synthetic.json"],
    maxInputBytes: 65_536,
    maxOutputBytes: 16_384,
    enabled: true,
  };
}

async function temporaryHome() {
  const directory = await mkdtemp(
    join(tmpdir(), "ai-workspace-model-targets-"),
  );
  directories.push(directory);
  return directory;
}
