import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";

import { runCli as executeCli } from "../src/cli.ts";

const execFileAsync = promisify(execFile);
const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const extensionRecord =
  '{"recordType":"event","eventType":"agent_message","timestamp":"2026-01-15T09:00:09.000Z","payload":{"text":"Synthetic follow-up."}}\n';

describe("session CLI workflow", () => {
  let temporaryRoot: string;
  let workspaceHome: string;
  let sourcePath: string;
  let originalSource: string;
  let projectId: string;
  let sessionId: string;

  before(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), "ai-workspace-session-cli-"));
    workspaceHome = join(temporaryRoot, "workspace-home");
    const repositoryPath = join(temporaryRoot, "repository");
    sourcePath = join(temporaryRoot, "session.jsonl");
    await mkdir(repositoryPath);
    await runGit(repositoryPath, ["init", "--initial-branch=main"]);
    await writeFile(join(repositoryPath, "README.md"), "# Synthetic\n", "utf8");
    await runGit(repositoryPath, ["add", "README.md"]);
    await runGit(repositoryPath, [
      "-c",
      "user.name=Synthetic User",
      "-c",
      "user.email=synthetic@example.invalid",
      "commit",
      "-m",
      "synthetic initial commit",
    ]);
    await copyFile(fixturePath, sourcePath);
    originalSource = await readFile(sourcePath, "utf8");

    const registered = await runSuccessfulCli([
      "project",
      "register",
      repositoryPath,
      "--json",
    ]);
    projectId = (JSON.parse(registered.stdout) as { id: string }).id;
  });

  after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("imports and reimports without duplication", async () => {
    const first = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
      "--file",
      sourcePath,
      "--json",
    ]);
    const firstReport = JSON.parse(first.stdout) as {
      session: { id: string };
      addedEvents: number;
      existingEvents: number;
      totalEvents: number;
    };
    sessionId = firstReport.session.id;
    assert.equal(firstReport.addedEvents, 9);
    assert.equal(firstReport.existingEvents, 0);

    const second = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
      "--file",
      sourcePath,
      "--json",
    ]);
    const secondReport = JSON.parse(second.stdout) as {
      addedEvents: number;
      existingEvents: number;
      totalEvents: number;
    };
    assert.equal(secondReport.addedEvents, 0);
    assert.equal(secondReport.existingEvents, 9);
    assert.equal(secondReport.totalEvents, 9);
  });

  it("adds only an append-only source extension", async () => {
    await writeFile(sourcePath, `${originalSource}${extensionRecord}`, "utf8");
    const result = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
      "--file",
      sourcePath,
      "--json",
    ]);
    const report = JSON.parse(result.stdout) as {
      addedEvents: number;
      existingEvents: number;
      totalEvents: number;
    };
    assert.equal(report.addedEvents, 1);
    assert.equal(report.existingEvents, 9);
    assert.equal(report.totalEvents, 10);
  });

  it("inspects ordered provenance without artifact bodies", async () => {
    const result = await runSuccessfulCli([
      "session",
      "inspect",
      sessionId,
      "--json",
    ]);
    const session = JSON.parse(result.stdout) as {
      events: readonly {
        sequence: number;
        trust: string;
        source: { artifactId: string };
      }[];
    };

    assert.equal(session.events.length, 10);
    assert.deepEqual(
      session.events.map((event) => event.sequence),
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    assert.ok(session.events.every((event) => event.trust === "UNTRUSTED"));
    assert.ok(
      session.events.every((event) =>
        event.source.artifactId.startsWith("artifact://sha256/"),
      ),
    );
    assert.doesNotMatch(result.stdout, /fictional-private-artifact-body/u);
  });

  it("rejects a changed prefix and restricted data without exposing values", async () => {
    const changed = `${originalSource}${extensionRecord}`.replace(
      "Add a fictional greeting and verify it.",
      "Changed historical content.",
    );
    await writeFile(sourcePath, changed, "utf8");
    const changedResult = await runCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
      "--file",
      sourcePath,
    ]);
    assert.equal(changedResult.exitCode, 1);
    assert.match(changedResult.stderr, /changed at record 1/u);

    const canary = "synthetic_canary_value_67890";
    const restrictedPath = join(temporaryRoot, "restricted.jsonl");
    await writeFile(
      restrictedPath,
      `{"schemaVersion":1,"recordType":"session","sessionId":"synthetic-restricted-session","agent":"codex","model":null,"timestamp":null}\n{"recordType":"event","eventType":"user_message","timestamp":null,"payload":"password=${canary}"}\n`,
      "utf8",
    );
    const restrictedResult = await runCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
      "--file",
      restrictedPath,
    ]);
    assert.equal(restrictedResult.exitCode, 1);
    assert.match(restrictedResult.stderr, /Restricted data detected/u);
    assert.doesNotMatch(restrictedResult.stderr, new RegExp(canary, "u"));
  });

  it("returns a usage exit code for incomplete import options", async () => {
    const result = await runCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
    ]);

    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /requires --project, --source, and --file/u);
  });

  async function runSuccessfulCli(args: readonly string[]) {
    const result = await runCli(args);
    assert.equal(result.exitCode, 0, result.stderr);
    return result;
  }

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

    return { exitCode, stdout, stderr };
  }
});

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
}
