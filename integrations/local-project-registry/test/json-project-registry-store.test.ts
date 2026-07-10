import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  JsonProjectRegistryStore,
  ProjectRegistryStorageError,
} from "../src/index.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("JsonProjectRegistryStore", () => {
  it("persists a versioned registry atomically with restrictive permissions", async () => {
    const directory = await createTemporaryDirectory();
    const registryPath = join(directory, "state", "projects.json");
    const store = new JsonProjectRegistryStore(registryPath);
    const projects = [sampleProject()];

    await store.save(projects);
    const loaded = await store.load();
    const registryStat = await stat(registryPath);
    const document = JSON.parse(await readFile(registryPath, "utf8")) as {
      schemaVersion: number;
    };

    assert.deepEqual(loaded, projects);
    assert.equal(document.schemaVersion, 1);
    assert.equal(registryStat.mode & 0o777, 0o600);
  });

  it("returns an empty registry when the file does not exist", async () => {
    const directory = await createTemporaryDirectory();
    const store = new JsonProjectRegistryStore(
      join(directory, "missing", "projects.json"),
    );

    assert.deepEqual(await store.load(), []);
  });

  it("fails closed for an unsupported schema", async () => {
    const directory = await createTemporaryDirectory();
    const registryPath = join(directory, "projects.json");
    await writeFile(
      registryPath,
      JSON.stringify({ schemaVersion: 999, projects: [] }),
      "utf8",
    );
    const store = new JsonProjectRegistryStore(registryPath);

    await assert.rejects(store.load(), ProjectRegistryStorageError);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), "ai-workspace-registry-test-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function sampleProject() {
  return {
    id: "project-1",
    canonicalPath: "/workspace/sample",
    name: "sample",
    repositoryType: "SOFTWARE" as const,
    branch: "main",
    headCommit: "abc123",
    remoteUrl: "https://github.com/example/sample.git",
    isDirty: false,
    registeredAt: "2026-07-10T10:00:00.000Z",
    lastInspectedAt: "2026-07-10T10:00:00.000Z",
  };
}
