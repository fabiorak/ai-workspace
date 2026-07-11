import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WorkItemConflictError,
  WorkItemError,
  WorkItems,
  type WorkItem,
  type WorkItemStore,
} from "../src/index.ts";

class Store implements WorkItemStore {
  item: WorkItem | null = null;
  async list() {
    return this.item === null ? [] : [this.item];
  }
  async find(projectId: string, id: string) {
    return this.item?.projectId === projectId && this.item.id === id
      ? this.item
      : null;
  }
  async create(item: WorkItem) {
    this.item = item;
    return item;
  }
  async transition(item: WorkItem) {
    if (this.item?.version !== item.version - 1)
      throw new WorkItemConflictError(item.id);
    this.item = item;
    return item;
  }
}
function fixture() {
  const store = new Store();
  let id = 0;
  const work = new WorkItems({
    store,
    projects: { exists: async (projectId) => projectId === "p1" },
    sourceEvents: {
      find: async (projectId, eventId) =>
        projectId === "p1" && eventId === "e1"
          ? {
              id: "e1",
              sessionId: "s1",
              type: "USER_MESSAGE",
              trust: "UNTRUSTED",
              source: { artifactId: "a1", position: 0, recordHash: "hash" },
            }
          : null,
    },
    ids: () => `id-${++id}`,
    clock: () => new Date(`2026-07-11T10:00:0${id}.000Z`),
  });
  return { work, store };
}

describe("WorkItems", () => {
  it("creates bounded proposed state with same-project provenance", async () => {
    const { work } = fixture();
    const item = await work.create({
      projectId: " p1 ",
      objective: " Objective ",
      sourceEventIds: ["e1"],
    });
    assert.equal(item.status, "PROPOSED");
    assert.equal(item.version, 1);
    assert.equal(item.sources[0]?.eventId, "e1");
    assert.equal(item.createdBy, "LOCAL_USER");
  });
  it("records the complete lifecycle additively", async () => {
    const { work } = fixture();
    const created = await work.create({
      projectId: "p1",
      objective: "Objective",
      sourceEventIds: ["e1"],
    });
    await work.activate({
      projectId: "p1",
      workItemId: created.id,
      sourceEventIds: ["e1"],
    });
    await work.block({
      projectId: "p1",
      workItemId: created.id,
      sourceEventIds: ["e1"],
    });
    await work.complete({
      projectId: "p1",
      workItemId: created.id,
      sourceEventIds: ["e1"],
    });
    const reopened = await work.reopen({
      projectId: "p1",
      workItemId: created.id,
      sourceEventIds: ["e1"],
    });
    assert.equal(reopened.status, "ACTIVE");
    assert.equal(reopened.version, 5);
    assert.deepEqual(
      reopened.transitions.map((x) => x.to),
      ["ACTIVE", "BLOCKED", "COMPLETED", "ACTIVE"],
    );
  });
  it("fails closed for foreign sources and invalid transitions", async () => {
    const { work } = fixture();
    await assert.rejects(
      work.create({
        projectId: "p1",
        objective: "Objective",
        sourceEventIds: ["foreign"],
      }),
      WorkItemError,
    );
    const item = await work.create({
      projectId: "p1",
      objective: "Objective",
      sourceEventIds: ["e1"],
    });
    await assert.rejects(
      work.complete({
        projectId: "p1",
        workItemId: item.id,
        sourceEventIds: ["e1"],
      }),
      WorkItemError,
    );
  });
});
