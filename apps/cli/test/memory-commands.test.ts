import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

describe("active-memory CLI workflow", () => {
  let temporaryRoot: string;
  let workspaceHome: string;
  let projectId: string;
  let sourceEvents: readonly string[];
  let originalId: string;
  let replacementId: string;
  let invalidatedId: string;

  before(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), "ai-workspace-memory-cli-"));
    workspaceHome = join(temporaryRoot, "workspace-home");
    const repositoryPath = join(temporaryRoot, "repository");
    const sourcePath = join(temporaryRoot, "session.jsonl");
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

    const registered = await runSuccessfulCli([
      "project",
      "register",
      repositoryPath,
      "--json",
    ]);
    projectId = (JSON.parse(registered.stdout) as { id: string }).id;
    const imported = await runSuccessfulCli([
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
    sourceEvents = (
      JSON.parse(imported.stdout) as {
        session: { events: readonly { id: string }[] };
      }
    ).session.events.map((event) => event.id);
    assert.ok(sourceEvents.length >= 4);
  });

  after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("guides creation from stdin with explicit trust language", async () => {
    const help = await runSuccessfulCli(["memory", "add", "--help"]);
    assert.match(help.stdout, /USER_CURATED/u);
    assert.match(help.stdout, /UNTRUSTED/u);
    assert.match(help.stdout, /--content-stdin/u);

    const created = await runSuccessfulCli(
      [
        "memory",
        "add",
        "--project",
        projectId,
        "--type",
        "constraint",
        "--content-stdin",
        "--source-event",
        event(0),
        "--json",
      ],
      "\u001b[31mSynthetic runtime constraint",
    );
    const item = JSON.parse(created.stdout) as {
      id: string;
      curation: string;
      validity: string;
      verification: string;
      confidence: string;
      sources: readonly { trust: string }[];
    };
    originalId = item.id;
    assert.equal(item.curation, "USER_CURATED");
    assert.equal(item.validity, "ACTIVE");
    assert.equal(item.verification, "UNVERIFIED");
    assert.equal(item.confidence, "UNASSESSED");
    assert.equal(item.sources[0]?.trust, "UNTRUSTED");

    const shown = await runSuccessfulCli([
      "memory",
      "show",
      originalId,
      "--project",
      projectId,
    ]);
    assert.equal(shown.stdout.includes("\u001b"), false);
    assert.match(shown.stdout, /�\[31mSynthetic runtime constraint/u);
    assert.match(shown.stdout, /history show.*--project/u);
    assert.match(shown.stdout, /Curation and source trust are independent/u);
  });

  it("verifies once and supersedes additively across invocations", async () => {
    const verified = await runSuccessfulCli(
      [
        "memory",
        "verify",
        originalId,
        "--project",
        projectId,
        "--note-stdin",
        "--source-event",
        event(1),
        "--json",
      ],
      "Synthetic verification method",
    );
    assert.equal(
      (JSON.parse(verified.stdout) as { verification: string }).verification,
      "VERIFIED",
    );

    const superseded = await runSuccessfulCli([
      "memory",
      "supersede",
      originalId,
      "--project",
      projectId,
      "--content",
      "Synthetic replacement constraint",
      "--source-event",
      event(2),
      "--json",
    ]);
    const result = JSON.parse(superseded.stdout) as {
      previous: { id: string; validity: string; verification: string };
      replacement: {
        id: string;
        validity: string;
        verification: string;
        confidence: string;
      };
    };
    replacementId = result.replacement.id;
    assert.equal(result.previous.id, originalId);
    assert.equal(result.previous.validity, "SUPERSEDED");
    assert.equal(result.previous.verification, "VERIFIED");
    assert.equal(result.replacement.validity, "ACTIVE");
    assert.equal(result.replacement.verification, "UNVERIFIED");
    assert.equal(result.replacement.confidence, "UNASSESSED");

    const repeated = await runCli([
      "memory",
      "verify",
      originalId,
      "--project",
      projectId,
      "--note",
      "Invalid terminal verification",
      "--source-event",
      event(1),
    ]);
    assert.equal(repeated.exitCode, 1);
    assert.match(repeated.stderr, /SUPERSEDED.*cannot transition again/u);
  });

  it("invalidates separately and paginates active-only results", async () => {
    const failure = await runSuccessfulCli([
      "memory",
      "add",
      "--project",
      projectId,
      "--type",
      "failure",
      "--content",
      "Synthetic obsolete failure",
      "--source-event",
      event(0),
      "--json",
    ]);
    invalidatedId = (JSON.parse(failure.stdout) as { id: string }).id;
    await runSuccessfulCli(
      [
        "memory",
        "invalidate",
        invalidatedId,
        "--project",
        projectId,
        "--reason-stdin",
        "--source-event",
        event(3),
        "--json",
      ],
      "Synthetic failure no longer applies",
    );

    await runSuccessfulCli([
      "memory",
      "add",
      "--project",
      projectId,
      "--type",
      "decision",
      "--content",
      "Synthetic active decision",
      "--source-event",
      event(0),
      "--json",
    ]);

    const firstPage = await runSuccessfulCli([
      "memory",
      "list",
      "--project",
      projectId,
      "--limit",
      "1",
      "--json",
    ]);
    const first = JSON.parse(firstPage.stdout) as {
      items: readonly { id: string; validity: string }[];
      nextCursor: string | null;
    };
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0]?.validity, "ACTIVE");
    assert.ok(first.nextCursor !== null);
    const cursor = first.nextCursor;

    const secondPage = await runSuccessfulCli([
      "memory",
      "list",
      "--project",
      projectId,
      "--limit",
      "1",
      "--cursor",
      cursor,
      "--json",
    ]);
    const second = JSON.parse(secondPage.stdout) as {
      items: readonly { id: string; validity: string }[];
      nextCursor: string | null;
    };
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0]?.validity, "ACTIVE");
    assert.notEqual(second.items[0]?.id, first.items[0]?.id);
    assert.equal(second.nextCursor, null);

    const terminal = await runSuccessfulCli([
      "memory",
      "list",
      "--project",
      projectId,
      "--validity",
      "invalidated",
      "--json",
    ]);
    assert.deepEqual(
      (
        JSON.parse(terminal.stdout) as {
          items: readonly { id: string }[];
        }
      ).items.map((item) => item.id),
      [invalidatedId],
    );
  });

  it("rejects ambiguous stdin, cross-project scope, and corrupt storage", async () => {
    const ambiguous = await runCli(
      [
        "memory",
        "add",
        "--project",
        projectId,
        "--type",
        "decision",
        "--content",
        "Inline",
        "--content-stdin",
        "--source-event",
        event(0),
      ],
      "Stdin",
    );
    assert.equal(ambiguous.exitCode, 2);
    assert.match(ambiguous.stderr, /Use exactly one/u);

    const foreign = await runCli([
      "memory",
      "show",
      replacementId,
      "--project",
      "00000000-0000-4000-8000-000000000099",
    ]);
    assert.equal(foreign.exitCode, 1);
    assert.match(foreign.stderr, /not registered/u);

    const memoryPath = documentPath(workspaceHome, projectId);
    await writeFile(memoryPath, "synthetic corrupt JSON", "utf8");
    const corrupt = await runCli(["memory", "list", "--project", projectId]);
    assert.equal(corrupt.exitCode, 1);
    assert.match(corrupt.stderr, /not valid JSON.*rebuild memory/u);
    assert.doesNotMatch(corrupt.stderr, /Synthetic runtime constraint/u);
  });

  function event(index: number): string {
    const value = sourceEvents[index];
    assert.ok(value !== undefined);
    return value;
  }

  async function runSuccessfulCli(
    args: readonly string[],
    stdin?: string,
  ): Promise<Awaited<ReturnType<typeof runCli>>> {
    const result = await runCli(args, stdin);
    assert.equal(result.exitCode, 0, result.stderr);
    return result;
  }

  async function runCli(args: readonly string[], stdin?: string) {
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
      ...(stdin === undefined ? {} : { stdin: async () => stdin }),
    });
    return { exitCode, stdout, stderr };
  }
});

function documentPath(home: string, projectId: string): string {
  const digest = createHash("sha256").update(projectId, "utf8").digest("hex");
  return join(home, "memory", `project_${digest}.json`);
}

async function runGit(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
}
