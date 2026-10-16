import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  GUIDED_TARGET_CONFIGURATION_DEFAULTS,
  TargetConfigurationError,
} from "@ai-workspace/target-configuration";

import { LocalTargetConfigurationStore } from "../src/index.ts";

// Only the homes this file created, collected from mkdtemp while it runs.
const homes: string[] = [];
afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});
const temporaryHome = async () => {
  const home = await mkdtemp(
    join(tmpdir(), "ai-workspace-target-configuration-"),
  );
  homes.push(home);
  return home;
};
const input = (overrides: Record<string, unknown> = {}) => ({
  scope: { kind: "GENERAL" },
  modelId: "model-b",
  rules: ["Use the supplied synthetic evidence."],
  ...GUIDED_TARGET_CONFIGURATION_DEFAULTS,
  ...overrides,
});

describe("LocalTargetConfigurationStore", () => {
  it("writes one private directory named by the digest", async () => {
    const home = await temporaryHome();
    const saved = await new LocalTargetConfigurationStore(home).save(input());
    const directory = join(home, "target-configurations", saved.digest);
    assert.deepEqual(saved.profileRef, join(directory, "profile.json"));
    assert.deepEqual(saved.policyRef, join(directory, "policy.json"));
    assert.deepEqual(saved.instructionRefs, [
      join(directory, "instructions.json"),
    ]);
    assert.deepEqual((await readdir(directory)).sort(), [
      "instructions.json",
      "policy.json",
      "profile.json",
    ]);
    for (const path of [dirname(directory), directory])
      assert.equal((await stat(path)).mode & 0o777, 0o700);
    for (const name of await readdir(directory))
      assert.equal((await stat(join(directory, name))).mode & 0o777, 0o600);
    const policy = JSON.parse(await readFile(saved.policyRef, "utf8")) as {
      maximumDataClass: string;
    };
    assert.equal(policy.maximumDataClass, "CONFIDENTIAL");
  });

  it("reuses the same directory for the same configuration and a new one otherwise", async () => {
    const home = await temporaryHome();
    const store = new LocalTargetConfigurationStore(home);
    const first = await store.save(input());
    assert.deepEqual(await store.save(input()), first);
    const second = await store.save(input({ modelId: "model-c" }));
    assert.notEqual(second.digest, first.digest);
    assert.deepEqual(
      (await readdir(join(home, "target-configurations"))).sort(),
      [first.digest, second.digest].sort(),
    );
    assert.deepEqual(
      JSON.parse(await readFile(first.profileRef, "utf8")).agent.allowedModels,
      ["model-b"],
    );
  });

  it("never overwrites a saved file changed outside the application", async () => {
    const home = await temporaryHome();
    const store = new LocalTargetConfigurationStore(home);
    const saved = await store.save(input());
    const changed = (await readFile(saved.policyRef, "utf8")).replace(
      "CONFIDENTIAL",
      "INTERNAL",
    );
    await writeFile(saved.policyRef, changed, { mode: 0o600 });
    await assert.rejects(store.save(input()), TargetConfigurationError);
    assert.equal(await readFile(saved.policyRef, "utf8"), changed);
    assert.equal(await store.recognize(saved), null);
  });

  it("completes a directory an interrupted save left partial", async () => {
    const home = await temporaryHome();
    const store = new LocalTargetConfigurationStore(home);
    const saved = await store.save(input());
    const complete = await readFile(saved.instructionRefs[0]!, "utf8");
    await rm(saved.instructionRefs[0]!);
    assert.deepEqual(await store.save(input()), saved);
    assert.equal(await readFile(saved.instructionRefs[0]!, "utf8"), complete);
  });

  it("refuses invalid input without creating anything", async () => {
    const home = await temporaryHome();
    await assert.rejects(
      new LocalTargetConfigurationStore(home).save(input({ rules: [] })),
      TargetConfigurationError,
    );
    assert.deepEqual(await readdir(home), []);
  });

  it("recognizes only the exact files of one managed directory", async () => {
    const home = await temporaryHome();
    const store = new LocalTargetConfigurationStore(home);
    const project = { kind: "PROJECT", projectId: "project-42" };
    const saved = await store.save(input({ scope: project }));
    assert.deepEqual(await store.recognize(saved), {
      scope: project,
      modelId: "model-b",
      rules: ["Use the supplied synthetic evidence."],
      ...GUIDED_TARGET_CONFIGURATION_DEFAULTS,
    });
    const other = await store.save(input());
    for (const refs of [
      { ...saved, policyRef: other.policyRef },
      {
        ...saved,
        instructionRefs: [...saved.instructionRefs, other.instructionRefs[0]!],
      },
      { ...saved, profileRef: join(home, "profile.json") },
      {
        profileRef: "/elsewhere/profile.json",
        policyRef: "/elsewhere/policy.json",
        instructionRefs: ["/elsewhere/instructions.json"],
      },
    ])
      assert.equal(await store.recognize(refs), null);
  });

  it("does not recognize a file other users can read", async () => {
    const home = await temporaryHome();
    const store = new LocalTargetConfigurationStore(home);
    const saved = await store.save(input());
    await chmod(saved.profileRef, 0o644);
    assert.equal(await store.recognize(saved), null);
  });
});
