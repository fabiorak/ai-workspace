import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";

import { runCli as executeCli } from "../src/cli.ts";

const execFileAsync = promisify(execFile);

describe("project CLI workflow", () => {
  let temporaryRoot: string;
  let workspaceHome: string;
  let repositoryPath: string;
  let projectId: string;

  before(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), "ai-workspace-cli-test-"));
    workspaceHome = join(temporaryRoot, "workspace-home");
    repositoryPath = join(temporaryRoot, "repository");
    await mkdir(repositoryPath);
    await runGit(repositoryPath, ["init", "--initial-branch=main"]);
    await writeFile(join(repositoryPath, "README.md"), "# CLI test\n", "utf8");
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
  });

  after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("registers a repository", async () => {
    const result = await runCli([
      "project",
      "register",
      repositoryPath,
      "--json",
    ]);
    const project = JSON.parse(result.stdout) as {
      id: string;
      canonicalPath: string;
      branch: string;
    };

    projectId = project.id;
    assert.equal(project.canonicalPath, repositoryPath);
    assert.equal(project.branch, "main");
  });

  it("lists the repository from a later process", async () => {
    const result = await runCli(["project", "list", "--json"]);
    const projects = JSON.parse(result.stdout) as readonly {
      id: string;
    }[];

    assert.equal(projects.length, 1);
    assert.equal(projects[0]?.id, projectId);
  });

  it("refreshes dirty state by project id", async () => {
    await writeFile(join(repositoryPath, "README.md"), "# Dirty\n", "utf8");
    const result = await runCli(["project", "inspect", projectId, "--json"]);
    const project = JSON.parse(result.stdout) as { isDirty: boolean };

    assert.equal(project.isDirty, true);
  });

  async function runCli(args: readonly string[]) {
    let stdout = "";
    let stderr = "";
    const exitCode = await executeCli(args, {
      environment: { AI_WORKSPACE_HOME: workspaceHome },
      stdout: (content) => {
        stdout += content;
      },
      stderr: (content) => {
        stderr += content;
      },
    });

    assert.equal(exitCode, 0, stderr);
    return { stdout, stderr };
  }
});

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
}
