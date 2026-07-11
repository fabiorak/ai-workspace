import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";

import {
  GitHandoffRepositoryReader,
  GitRepositoryInspector,
  RepositoryInspectionError,
} from "../src/index.ts";

const execFileAsync = promisify(execFile);

describe("GitRepositoryInspector", () => {
  let temporaryRoot: string;
  let repositoryPath: string;
  let linkedWorktreePath: string;
  let nestedPath: string;

  before(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), "ai-workspace-git-test-"));
    repositoryPath = join(temporaryRoot, "sample-repository");
    linkedWorktreePath = join(temporaryRoot, "linked-worktree");
    nestedPath = join(repositoryPath, "src", "nested");
    await mkdir(nestedPath, { recursive: true });
    await runGit(repositoryPath, ["init", "--initial-branch=main"]);
    await writeFile(join(repositoryPath, "README.md"), "# Sample\n", "utf8");
    await runGit(repositoryPath, ["add", "README.md"]);
    await runGit(repositoryPath, [
      "-c",
      "user.name=Test User",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "initial commit",
    ]);
    await runGit(repositoryPath, [
      "remote",
      "add",
      "origin",
      "https://secret-token@github.com/example/sample-repository.git",
    ]);
    await runGit(repositoryPath, [
      "worktree",
      "add",
      "-b",
      "linked-worktree",
      linkedWorktreePath,
    ]);
  });

  it("treats a linked worktree as its own canonical repository root", async () => {
    const inspector = new GitRepositoryInspector();

    const inspection = await inspector.inspect(linkedWorktreePath);

    assert.equal(inspection.canonicalPath, linkedWorktreePath);
    assert.equal(inspection.name, "linked-worktree");
    assert.equal(inspection.branch, "linked-worktree");
    assert.equal(inspection.isDirty, false);
  });

  after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("resolves a nested path and sanitizes Git metadata", async () => {
    const inspector = new GitRepositoryInspector();

    const inspection = await inspector.inspect(nestedPath);

    assert.equal(inspection.canonicalPath, repositoryPath);
    assert.equal(inspection.name, "sample-repository");
    assert.equal(inspection.branch, "main");
    assert.match(inspection.headCommit ?? "", /^[0-9a-f]{40}$/u);
    assert.equal(
      inspection.remoteUrl,
      "https://github.com/example/sample-repository.git",
    );
    assert.equal(inspection.isDirty, false);
  });

  it("captures only bounded repository resume metadata", async () => {
    const inspector = new GitRepositoryInspector();
    await writeFile(
      join(repositoryPath, "synthetic untracked.txt"),
      "secret-like content must not be captured\n",
      "utf8",
    );
    const snapshot = await inspector.captureHandoffState(repositoryPath);
    assert.equal(snapshot.branch, "main");
    assert.match(snapshot.head ?? "", /^[0-9a-f]{40}$/u);
    assert.equal(snapshot.dirty, true);
    assert.deepEqual(snapshot.changedPaths, ["synthetic untracked.txt"]);
    assert.equal(
      JSON.stringify(snapshot).includes("secret-like content"),
      false,
    );
    await rm(join(repositoryPath, "synthetic untracked.txt"));
  });

  it("scopes handoff capture to a registered project", async () => {
    const reader = new GitHandoffRepositoryReader({
      find: async (id) =>
        id === "project"
          ? {
              id,
              canonicalPath: repositoryPath,
              name: "sample-repository",
              branch: "main",
              headCommit: null,
              remoteUrl: null,
              isDirty: false,
              repositoryType: "SOFTWARE",
              registeredAt: "2026-07-11T00:00:00.000Z",
              lastInspectedAt: "2026-07-11T00:00:00.000Z",
            }
          : null,
    });
    assert.equal((await reader.capture("project")).branch, "main");
    await assert.rejects(reader.capture("foreign"), RepositoryInspectionError);
  });

  it("detects dirty state and detached HEAD", async () => {
    const inspector = new GitRepositoryInspector();
    await writeFile(join(repositoryPath, "README.md"), "# Changed\n", "utf8");

    const dirtyInspection = await inspector.inspect(repositoryPath);
    assert.equal(dirtyInspection.isDirty, true);

    await runGit(repositoryPath, ["checkout", "--detach"]);
    const detachedInspection = await inspector.inspect(repositoryPath);
    assert.equal(detachedInspection.branch, null);
  });

  it("rejects a directory that is not a Git repository", async () => {
    const inspector = new GitRepositoryInspector();

    await assert.rejects(
      inspector.inspect(temporaryRoot),
      RepositoryInspectionError,
    );
  });
});

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
}
