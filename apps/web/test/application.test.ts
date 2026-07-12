import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { GuiApplication } from "../src/index.ts";

const execFileAsync = promisify(execFile);
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

describe("GUI application facade", () => {
  it("reuses existing use cases without exposing project paths", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      assert.equal("canonicalPath" in project, false);
      assert.equal((await app.listProjects())[0]?.id, project.id);
      assert.equal((await app.inspectProject(project.id)).name, project.name);
    }));

  it("imports idempotently and navigates project-scoped evidence", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      const first = await app.importSample(project.id);
      const second = await app.importSample(project.id);
      assert.ok(first.addedEvents > 0);
      assert.equal(second.addedEvents, 0);
      assert.equal(second.existingEvents, first.totalEvents);
      const search = await app.search({ projectId: project.id, text: "test" });
      assert.ok(search.results.length > 0);
      assert.equal(search.results[0]?.trust, "UNTRUSTED");
      const event = await app.showEvent(project.id, search.results[0]!.eventId);
      assert.match(event.injectionWarning, /inert data/u);
      const artifact = await app.openEventSource(project.id, event.eventId);
      assert.equal(artifact.trust, "UNTRUSTED");
      assert.ok(artifact.byteLength > 0);
    }));

  it("curates source-linked memory through its additive lifecycle", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      await app.importSample(project.id);
      const eventId = (
        await app.search({ projectId: project.id, text: "test" })
      ).results[0]!.eventId;
      const created = await app.addMemory({
        projectId: project.id,
        type: "DECISION",
        content: "Use the fictional tested greeting.",
        sourceEventIds: [eventId],
      });
      assert.equal(created.curation, "USER_CURATED");
      assert.equal(created.sources[0]!.trust, "UNTRUSTED");
      const verified = await app.verifyMemory({
        projectId: project.id,
        memoryId: created.id,
        note: "Reviewed against the synthetic test result.",
        sourceEventIds: [eventId],
      });
      assert.equal(verified.verification, "VERIFIED");
      const superseded = await app.supersedeMemory({
        projectId: project.id,
        memoryId: verified.id,
        content: "Use the revised fictional tested greeting.",
        sourceEventIds: [eventId],
      });
      assert.equal(superseded.previous.validity, "SUPERSEDED");
      assert.equal(superseded.replacement.verification, "UNVERIFIED");
      assert.equal(superseded.replacement.confidence, "UNASSESSED");
      const invalidated = await app.invalidateMemory({
        projectId: project.id,
        memoryId: superseded.replacement.id,
        reason: "The fictional requirement was withdrawn.",
        sourceEventIds: [eventId],
      });
      assert.equal(invalidated.validity, "INVALIDATED");
      assert.deepEqual(
        (await app.listMemory({ projectId: project.id })).items,
        [],
      );
    }));
});

async function withFixture(
  run: (value: { app: GuiApplication; repository: string }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-gui-app-"));
  const home = join(root, "home");
  const repository = join(root, "repository");
  try {
    await mkdir(repository);
    await execFileAsync("git", [
      "-C",
      repository,
      "init",
      "--initial-branch=main",
    ]);
    await writeFile(join(repository, "README.md"), "# Synthetic GUI project\n");
    await execFileAsync("git", ["-C", repository, "add", "README.md"]);
    await execFileAsync("git", [
      "-C",
      repository,
      "-c",
      "user.name=Synthetic GUI Fixture",
      "-c",
      "user.email=gui-fixture@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    await run({
      app: new GuiApplication({ workspaceHome: home, sampleSessionPath }),
      repository,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
