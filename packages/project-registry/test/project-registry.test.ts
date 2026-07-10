import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ProjectNotFoundError,
  ProjectRegistry,
  type ProjectRegistryStore,
  type RegisteredProject,
  type RepositoryInspection,
  type RepositoryInspector,
} from "../src/index.ts";

const initialInspection: RepositoryInspection = {
  canonicalPath: "/workspace/alpha",
  name: "alpha",
  branch: "main",
  headCommit: "abc123",
  remoteUrl: "https://github.com/example/alpha.git",
  isDirty: false,
};

describe("ProjectRegistry", () => {
  it("registers a project and remains idempotent by canonical path", async () => {
    const store = new MemoryStore();
    let generatedIds = 0;
    const registry = new ProjectRegistry({
      inspector: new StubInspector(initialInspection),
      store,
      generateId: () => `project-${++generatedIds}`,
      clock: sequenceClock(
        "2026-07-10T10:00:00.000Z",
        "2026-07-10T11:00:00.000Z",
      ),
    });

    const registered = await registry.register("/workspace/alpha");
    const registeredAgain = await registry.register("/workspace/alpha/.");

    assert.equal(registered.id, "project-1");
    assert.equal(registeredAgain.id, registered.id);
    assert.equal(registeredAgain.registeredAt, registered.registeredAt);
    assert.equal(registeredAgain.lastInspectedAt, "2026-07-10T11:00:00.000Z");
    assert.equal(generatedIds, 1);
    assert.equal(store.projects.length, 1);
  });

  it("refreshes mutable inspection state without changing identity", async () => {
    const store = new MemoryStore();
    const inspector = new StubInspector(initialInspection);
    const registry = new ProjectRegistry({
      inspector,
      store,
      generateId: () => "project-1",
      clock: sequenceClock(
        "2026-07-10T10:00:00.000Z",
        "2026-07-10T12:00:00.000Z",
      ),
    });

    const registered = await registry.register("/workspace/alpha");
    inspector.inspection = {
      ...initialInspection,
      branch: "feature/registry",
      headCommit: "def456",
      isDirty: true,
    };

    const refreshed = await registry.inspect(registered.id);

    assert.equal(refreshed.id, registered.id);
    assert.equal(refreshed.registeredAt, registered.registeredAt);
    assert.equal(refreshed.branch, "feature/registry");
    assert.equal(refreshed.headCommit, "def456");
    assert.equal(refreshed.isDirty, true);
  });

  it("fails when inspecting an unknown project", async () => {
    const registry = new ProjectRegistry({
      inspector: new StubInspector(initialInspection),
      store: new MemoryStore(),
      generateId: () => "project-1",
    });

    await assert.rejects(registry.inspect("missing"), ProjectNotFoundError);
  });
});

class StubInspector implements RepositoryInspector {
  public inspection: RepositoryInspection;

  public constructor(inspection: RepositoryInspection) {
    this.inspection = inspection;
  }

  public async inspect(): Promise<RepositoryInspection> {
    return this.inspection;
  }
}

class MemoryStore implements ProjectRegistryStore {
  public projects: readonly RegisteredProject[] = [];

  public async load(): Promise<readonly RegisteredProject[]> {
    return this.projects;
  }

  public async save(projects: readonly RegisteredProject[]): Promise<void> {
    this.projects = structuredClone(projects);
  }
}

function sequenceClock(...timestamps: readonly string[]): () => Date {
  let index = 0;

  return () => {
    const timestamp = timestamps[index] ?? timestamps.at(-1);
    index += 1;

    if (timestamp === undefined) {
      throw new Error("The test clock has no timestamps");
    }

    return new Date(timestamp);
  };
}
