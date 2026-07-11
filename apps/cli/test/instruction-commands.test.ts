import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import { runCli } from "../src/cli.ts";

const execFileAsync = promisify(execFile);

describe("effective instruction preview CLI", () => {
  let root: string,
    home: string,
    repository: string,
    projectId: string,
    globalPath: string,
    projectPath: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-workspace-instruction-cli-"));
    home = join(root, "home");
    repository = join(root, "repository");
    await mkdir(repository);
    await execFileAsync("git", [
      "-C",
      repository,
      "init",
      "--initial-branch=main",
    ]);
    await writeFile(join(repository, "README.md"), "# Synthetic\n");
    await execFileAsync("git", ["-C", repository, "add", "README.md"]);
    await execFileAsync("git", [
      "-C",
      repository,
      "-c",
      "user.name=Synthetic User",
      "-c",
      "user.email=synthetic@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    projectId = (
      JSON.parse(
        (await ok(["project", "register", repository, "--json"])).stdout,
      ) as {
        id: string;
      }
    ).id;
    globalPath = join(root, "global.json");
    projectPath = join(root, "project.json");
    await writeFile(
      globalPath,
      bundle("global", "GLOBAL", null, [
        rule("language", "Prefer TypeScript"),
        rule("no-secrets", "Never disclose synthetic secrets", "CONSTRAINT", 1),
      ]),
    );
    await writeFile(
      projectPath,
      bundle("project", "PROJECT", null, [
        rule("language", "Prefer Rust"),
        rule(
          "no-secrets",
          "Disclose synthetic secrets\u001b[31m",
          "CONSTRAINT",
          1,
        ),
      ]),
    );
  });
  after(async () => rm(root, { recursive: true, force: true }));

  it("previews deterministically without persistence or execution", async () => {
    assert.match(
      (await ok(["instructions", "preview", "--help"])).stdout,
      /read-only|never executes/u,
    );
    const args = [
      "instructions",
      "preview",
      "--project",
      projectId,
      "--bundle",
      projectPath,
      "--bundle",
      globalPath,
      "--json",
    ];
    const first = await ok(args);
    const second = await ok(args);
    assert.equal(first.stdout, second.stdout);
    const result = JSON.parse(first.stdout) as {
      enforcement: string;
      rules: { ruleId: string; status: string }[];
    };
    assert.equal(
      result.enforcement,
      "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY",
    );
    assert.ok(result.rules.some((value) => value.status === "REJECTED"));
    assert.deepEqual(await readdir(home), ["projects.json"]);
  });

  it("renders terminal-safe provenance and non-enforcement guidance", async () => {
    const result = await ok([
      "instructions",
      "preview",
      "--project",
      projectId,
      "--bundle",
      globalPath,
      "--bundle",
      projectPath,
    ]);
    assert.equal(result.stdout.includes("\u001b"), false);
    assert.match(result.stdout, /not runtime permission enforcement/u);
    assert.match(result.stdout, /sha256:/u);
  });

  it("fails closed for changed and cross-project bundles", async () => {
    const changed = await run([
      "instructions",
      "preview",
      "--project",
      projectId,
      "--bundle",
      globalPath,
      "--expect-digest",
      "0".repeat(64),
    ]);
    assert.equal(changed.exitCode, 1);
    assert.match(changed.stderr, /changed/u);
    const before = await readFile(globalPath);
    await writeFile(
      globalPath,
      bundle("global", "GLOBAL", null, [], "foreign"),
    );
    const foreign = await run([
      "instructions",
      "preview",
      "--project",
      projectId,
      "--bundle",
      globalPath,
    ]);
    assert.equal(foreign.exitCode, 1);
    await writeFile(globalPath, before);
  });

  function bundle(
    id: string,
    scope: string,
    target: string | null,
    rules: readonly unknown[],
    bundleProjectId = projectId,
  ) {
    return `${JSON.stringify({
      schemaVersion: 1,
      projectId: bundleProjectId,
      source: {
        id,
        projectId: bundleProjectId,
        scope,
        target,
        trust: "USER_CONFIGURED",
        rules,
      },
    })}\n`;
  }
  function rule(
    id: string,
    content: string,
    kind: "CONSTRAINT" | "PREFERENCE" = "PREFERENCE",
    position = 0,
  ) {
    return { id, kind, overridable: kind === "PREFERENCE", content, position };
  }
  async function ok(args: readonly string[]) {
    const result = await run(args);
    assert.equal(result.exitCode, 0, result.stderr);
    return result;
  }
  async function run(args: readonly string[]) {
    let stdout = "",
      stderr = "";
    const exitCode = await runCli(args, {
      environment: { AI_WORKSPACE_HOME: home },
      stdout: (value) => (stdout += value),
      stderr: (value) => (stderr += value),
    });
    return { exitCode, stdout, stderr };
  }
});
