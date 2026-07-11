import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { WorkItemConflictError, WorkItems } from "@ai-workspace/core";
import { JsonWorkItemStore } from "../src/index.ts";

async function withHome(run: (home: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-work-items-"));
  try {
    await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
function domain(store: JsonWorkItemStore) {
  let id = 0;
  return new WorkItems({
    store,
    projects: { exists: async () => true },
    sourceEvents: {
      find: async (_projectId, eventId) => ({
        id: eventId,
        sessionId: "session",
        type: "USER_MESSAGE",
        trust: "UNTRUSTED",
        source: { artifactId: "artifact", position: 0, recordHash: "hash" },
      }),
    },
    ids: () => `id-${++id}`,
    clock: () => new Date(`2026-07-11T10:00:0${id}.000Z`),
  });
}

describe("JsonWorkItemStore", () => {
  it("persists and reconstructs additive lifecycle state", async () =>
    withHome(async (home) => {
      const work = domain(new JsonWorkItemStore(home));
      const created = await work.create({
        projectId: "project",
        objective: "Synthetic objective",
        sourceEventIds: ["event"],
      });
      await work.activate({
        projectId: "project",
        workItemId: created.id,
        sourceEventIds: ["event"],
      });
      const loaded = await new JsonWorkItemStore(home).find(
        "project",
        created.id,
      );
      assert.equal(loaded?.status, "ACTIVE");
      assert.equal(loaded?.version, 2);
      assert.equal(loaded?.transitions.length, 1);
    }));
  it("rejects stale concurrent transitions", async () =>
    withHome(async (home) => {
      const store = new JsonWorkItemStore(home);
      const work = domain(store);
      const created = await work.create({
        projectId: "project",
        objective: "Synthetic objective",
        sourceEventIds: ["event"],
      });
      const first = await work.activate({
        projectId: "project",
        workItemId: created.id,
        sourceEventIds: ["event"],
      });
      await assert.rejects(
        store.transition({ ...first, version: 2 }, first.transitions[0]!),
        WorkItemConflictError,
      );
    }));
  it("fails closed on corrupt state", async () =>
    withHome(async (home) => {
      const store = new JsonWorkItemStore(home);
      const work = domain(store);
      await work.create({
        projectId: "project",
        objective: "Synthetic objective",
        sourceEventIds: ["event"],
      });
      const directory = join(home, "work-items");
      const [name] = await readdir(directory);
      await writeFile(join(directory, name!), "{}\n");
      await assert.rejects(store.list("project"));
    }));
});
