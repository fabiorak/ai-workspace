import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
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
    assert.equal(JSON.parse(await readFile(path, "utf8")).schemaVersion, 1);
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

function sampleTarget() {
  return {
    targetId: "synthetic-model",
    displayName: "Synthetic model",
    providerKind: "LOCAL_ADAPTER",
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
