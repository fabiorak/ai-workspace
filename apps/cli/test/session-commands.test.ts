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
const claudeFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/claude-code/test/fixtures/synthetic-session.jsonl",
);
const localClaudeFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/claude-code/test/fixtures/synthetic-local-session.jsonl",
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

  it("imports only the explicit synthetic Claude Code subset", async () => {
    const help = await runSuccessfulCli(["session", "import", "--help"]);
    assert.match(help.stdout, /Reviewed synthetic Claude Code JSONL subset/u);
    assert.match(help.stdout, /claude-code-local {2}Real local Claude Code/u);
    const imported = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "claude-code",
      "--file",
      claudeFixturePath,
      "--json",
    ]);
    const report = JSON.parse(imported.stdout) as {
      session: { sourceType: string };
      addedEvents: number;
    };
    assert.equal(report.session.sourceType, "claude-code");
    assert.equal(report.addedEvents, 5);
  });

  it("discovers and imports a real local Claude Code transcript", async () => {
    const transcriptDirectory = join(temporaryRoot, "transcripts");
    const transcriptPath = join(transcriptDirectory, "local-session.jsonl");
    await mkdir(transcriptDirectory, { recursive: true });
    await copyFile(localClaudeFixturePath, transcriptPath);
    await writeFile(
      join(transcriptDirectory, "notes.txt"),
      "not a transcript\n",
      "utf8",
    );

    const discoverHelp = await runSuccessfulCli([
      "session",
      "discover",
      "--help",
    ]);
    assert.match(discoverHelp.stdout, /filesystem metadata only/u);

    const discovered = await runSuccessfulCli([
      "session",
      "discover",
      transcriptDirectory,
      "--json",
    ]);
    const candidates = JSON.parse(discovered.stdout) as readonly {
      fileName: string;
      byteLength: number;
    }[];
    assert.deepEqual(
      candidates.map((candidate) => candidate.fileName),
      ["local-session.jsonl"],
    );
    assert.ok((candidates[0]?.byteLength ?? 0) > 0);

    const imported = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "claude-code-local",
      "--file",
      transcriptPath,
      "--json",
    ]);
    const report = JSON.parse(imported.stdout) as {
      session: { sourceType: string };
      addedEvents: number;
      skippedRecords: readonly { reason: string; count: number }[];
    };
    assert.equal(report.session.sourceType, "claude-code-local");
    assert.equal(report.addedEvents, 10);
    assert.equal(report.skippedRecords.length, 5);

    const printed = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "claude-code-local",
      "--file",
      transcriptPath,
    ]);
    assert.match(printed.stdout, /Records not converted: 5/u);
    assert.match(printed.stdout, /BLANK_LINE: 1/u);
    assert.match(printed.stdout, /Events added: 0/u);
  });

  it("imports a real transcript partially when one record carries restricted data", async () => {
    const canary = "synthetic_canary_value_54321";
    const transcriptDirectory = join(temporaryRoot, "screened-transcripts");
    const transcriptPath = join(transcriptDirectory, "screened-session.jsonl");
    await mkdir(transcriptDirectory, { recursive: true });
    await writeFile(
      transcriptPath,
      `{"type":"user","sessionId":"synthetic-screened-session","message":{"role":"user","content":"keep this turn"}}\n{"type":"user","sessionId":"synthetic-screened-session","message":{"role":"user","content":"password=${canary}"}}\n{"type":"user","sessionId":"synthetic-screened-session","message":{"role":"user","content":"keep this turn too"}}\n`,
      "utf8",
    );

    const imported = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "claude-code-local",
      "--file",
      transcriptPath,
      "--json",
    ]);
    const report = JSON.parse(imported.stdout) as {
      addedEvents: number;
      skippedRecords: readonly { reason: string; count: number }[];
    };

    assert.equal(report.addedEvents, 2);
    assert.deepEqual(report.skippedRecords, [
      { reason: "RESTRICTED_DATA:assigned-credential", count: 1 },
    ]);
    assert.doesNotMatch(imported.stdout, new RegExp(canary, "u"));

    const printed = await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "claude-code-local",
      "--file",
      transcriptPath,
    ]);
    assert.match(
      printed.stdout,
      /Records excluded by restricted-data screening: 1/u,
    );
    assert.match(printed.stdout, /RESTRICTED_DATA:assigned-credential: 1/u);
    assert.doesNotMatch(printed.stdout, new RegExp(canary, "u"));
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

  it("guides a first-time user from help through search and source evidence", async () => {
    const sessionPath = join(workspaceHome, "sessions", `${sessionId}.json`);
    const sessionBeforeSearch = await readFile(sessionPath, "utf8");
    const help = await runSuccessfulCli(["help"]);
    assert.match(help.stdout, /Start here:/u);
    assert.match(help.stdout, /history search/u);

    const contextualHelp = await runSuccessfulCli([
      "history",
      "search",
      "--help",
    ]);
    assert.match(contextualHelp.stdout, /Search imported historical events/u);
    assert.match(contextualHelp.stdout, /Example:/u);

    const searched = await runSuccessfulCli([
      "history",
      "search",
      "synthetic expectation failed",
      "--project",
      projectId,
      "--type",
      "command_result",
      "--json",
    ]);
    const report = JSON.parse(searched.stdout) as {
      searchedEvents: number;
      results: readonly {
        eventId: string;
        type: string;
        trust: string;
        source: { artifactId: string };
      }[];
    };
    assert.equal(report.searchedEvents, 1);
    assert.equal(report.results.length, 1);
    assert.equal(report.results[0]?.type, "COMMAND_RESULT");
    assert.equal(report.results[0]?.trust, "UNTRUSTED");

    /**
     * A word the reader never typed can reach a result, so the human output
     * has to say which word did. Reading it back from the human form, not from
     * the JSON, is the point: this is the surface a person sees.
     */
    const human = await runSuccessfulCli([
      "history",
      "search",
      "sintetica",
      "--project",
      projectId,
    ]);
    assert.match(human.stdout, /Why: /u);

    const eventId = report.results[0]?.eventId ?? "";
    const artifactId = report.results[0]?.source.artifactId ?? "";
    const artifactDigest = artifactId.slice("artifact://sha256/".length);
    const artifactPath = join(
      workspaceHome,
      "artifacts",
      "sha256",
      artifactDigest.slice(0, 2),
      artifactDigest,
    );
    const artifactBeforeShow = await readFile(artifactPath);
    const shown = await runSuccessfulCli([
      "history",
      "show",
      eventId,
      "--project",
      projectId,
      "--json",
    ]);
    const historicalEvent = JSON.parse(shown.stdout) as {
      projectId: string;
      event: { id: string; trust: string };
    };
    assert.equal(historicalEvent.projectId, projectId);
    assert.equal(historicalEvent.event.id, eventId);
    assert.equal(historicalEvent.event.trust, "UNTRUSTED");

    const artifact = await runSuccessfulCli([
      "artifact",
      "show",
      artifactId,
      "--json",
    ]);
    const opened = JSON.parse(artifact.stdout) as {
      id: string;
      content: string;
    };
    assert.equal(opened.id, artifactId);
    assert.match(opened.content, /synthetic expectation failed/iu);
    assert.equal(await readFile(sessionPath, "utf8"), sessionBeforeSearch);
    assert.deepEqual(await readFile(artifactPath), artifactBeforeShow);

    /**
     * A term with no neighbour in the index. Retrieval is tolerant now, so a
     * phrase of ordinary words is no longer a query without answers: its terms
     * reach records on their own, which is the recall the engine exists for and
     * the precision cost measured alongside it. The empty path is still a real
     * path, and this is what reaching it takes.
     */
    const noMatch = await runSuccessfulCli([
      "history",
      "search",
      "zqxjkvwphlm",
      "--project",
      projectId,
    ]);
    assert.match(noMatch.stdout, /No matches found/u);
    assert.match(noMatch.stdout, /Try a shorter phrase/u);

    const emptyRepository = join(temporaryRoot, "empty-history-repository");
    await mkdir(emptyRepository);
    await runGit(emptyRepository, ["init", "--initial-branch=main"]);
    await writeFile(
      join(emptyRepository, "README.md"),
      "# Empty history\n",
      "utf8",
    );
    await runGit(emptyRepository, ["add", "README.md"]);
    await runGit(emptyRepository, [
      "-c",
      "user.name=Synthetic User",
      "-c",
      "user.email=synthetic@example.invalid",
      "commit",
      "-m",
      "synthetic empty history",
    ]);
    const emptyProjectResult = await runSuccessfulCli([
      "project",
      "register",
      emptyRepository,
      "--json",
    ]);
    const emptyProjectId = (
      JSON.parse(emptyProjectResult.stdout) as { id: string }
    ).id;
    const emptyHistory = await runSuccessfulCli([
      "history",
      "search",
      "anything",
      "--project",
      emptyProjectId,
    ]);
    assert.match(emptyHistory.stdout, /No imported events/u);
    assert.match(emptyHistory.stdout, /Next: import a session/u);
  });

  it("neutralizes terminal controls in historical snippets", async () => {
    const controlSource = join(temporaryRoot, "control-session.jsonl");
    await writeFile(
      controlSource,
      '{"schemaVersion":1,"recordType":"session","sessionId":"synthetic-control-session","agent":"codex","model":null,"timestamp":null}\n{"recordType":"event","eventType":"error","timestamp":null,"payload":"\\u001b[31mCONTROL_MATCH"}\n',
      "utf8",
    );
    await runSuccessfulCli([
      "session",
      "import",
      "--project",
      projectId,
      "--source",
      "codex",
      "--file",
      controlSource,
    ]);
    const result = await runSuccessfulCli([
      "history",
      "search",
      "CONTROL_MATCH",
      "--project",
      projectId,
    ]);
    assert.equal(result.stdout.includes("\u001b"), false);
    assert.match(result.stdout, /�\[31mCONTROL_MATCH/u);
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
