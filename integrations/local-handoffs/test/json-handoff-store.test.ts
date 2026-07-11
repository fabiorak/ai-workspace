import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { HandoffError, type Handoff } from "@ai-workspace/handoff";
import { JsonHandoffStore } from "../src/index.ts";
const packet = {
  schemaVersion: 1,
  id: "handoff",
  projectId: "project",
  workItemId: "work",
  predecessorId: null,
  createdBy: "LOCAL_USER",
  createdAt: "2026-07-11T12:00:00.000Z",
  sections: {
    objective: { metadata: {}, value: "objective" },
    repository: { metadata: {}, value: {} },
    selectedMemory: { metadata: {}, value: [] },
    knownFailures: { metadata: {}, value: [] },
    testState: { metadata: {}, value: [] },
    relevantFiles: { metadata: {}, value: [] },
    nextAction: { metadata: {}, value: "next" },
    sourceReferences: { metadata: {}, value: [] },
  },
} as unknown as Handoff;
describe("JsonHandoffStore", () => {
  it("persists immutable packets and rejects replacement", async () =>
    withHome(async (home) => {
      const store = new JsonHandoffStore(home);
      await store.create(packet);
      assert.equal(
        (await store.find("project", "work", "handoff"))?.id,
        "handoff",
      );
      await assert.rejects(store.create(packet), HandoffError);
    }));
  it("fails closed for corrupt packets", async () =>
    withHome(async (home) => {
      const store = new JsonHandoffStore(home);
      await store.create(packet);
      const [name] = await readdir(join(home, "handoffs"));
      await writeFile(join(home, "handoffs", name!), "{}\n");
      await assert.rejects(
        store.find("project", "work", "handoff"),
        HandoffError,
      );
    }));
});
async function withHome(run: (home: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-handoff-store-"));
  try {
    await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
