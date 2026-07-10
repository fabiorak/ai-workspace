import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";

import {
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
