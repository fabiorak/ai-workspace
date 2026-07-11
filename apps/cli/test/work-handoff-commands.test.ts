import assert from "node:assert/strict";
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
const claudeFixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/claude-code/test/fixtures/synthetic-session.jsonl",
);
describe("Work Item and handoff CLI workflow", () => {
  let root: string,
    home: string,
    repository: string,
    projectId: string,
    eventId: string,
    sourceSessionId: string,
    memoryId: string,
    workId: string,
    handoffId: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-workspace-work-handoff-cli-"));
    home = join(root, "home");
    repository = join(root, "repository");
    const source = join(root, "session.jsonl");
    await mkdir(repository);
    await runGit(repository, ["init", "--initial-branch=main"]);
    await writeFile(join(repository, "README.md"), "# Synthetic\n");
    await runGit(repository, ["add", "README.md"]);
    await runGit(repository, [
      "-c",
      "user.name=Synthetic User",
      "-c",
      "user.email=synthetic@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    await copyFile(fixturePath, source);
    projectId = (
      JSON.parse(
        (await ok(["project", "register", repository, "--json"])).stdout,
      ) as { id: string }
    ).id;
    const imported = JSON.parse(
      (
        await ok([
          "session",
          "import",
          "--project",
          projectId,
          "--source",
          "codex",
          "--file",
          source,
          "--json",
        ])
      ).stdout,
    ) as { session: { id: string; events: { id: string }[] } };
    eventId = imported.session.events[0]!.id;
    sourceSessionId = imported.session.id;
    memoryId = (
      JSON.parse(
        (
          await ok([
            "memory",
            "add",
            "--project",
            projectId,
            "--type",
            "failure",
            "--content",
            "Synthetic known failure",
            "--source-event",
            eventId,
            "--json",
          ])
        ).stdout,
      ) as { id: string }
    ).id;
  });
  it("previews exact persisted bytes without creating a handoff", async () => {
    const previewWorkId = (
      JSON.parse(
        (
          await ok(
            [
              "work",
              "create",
              "--project",
              projectId,
              "--objective-stdin",
              "--source-event",
              eventId,
              "--json",
            ],
            "Synthetic preview objective\n",
          )
        ).stdout,
      ) as { id: string }
    ).id;
    const withoutBaseline = JSON.parse(
      (
        await ok(
          [
            "handoff",
            "preview",
            "--project",
            projectId,
            "--work-item",
            previewWorkId,
            "--memory",
            memoryId,
            "--next-action-stdin",
            "--source-event",
            eventId,
            "--json",
          ],
          "Inspect the synthetic fixture\n",
        )
      ).stdout,
    ) as { exactHandoffBytes: number; baseline: unknown };
    assert.ok(withoutBaseline.exactHandoffBytes > 0);
    assert.equal(withoutBaseline.baseline, null);
    const named = JSON.parse(
      (
        await ok(
          [
            "handoff",
            "preview",
            "--project",
            projectId,
            "--work-item",
            previewWorkId,
            "--memory",
            memoryId,
            "--next-action-stdin",
            "--source-event",
            eventId,
            "--baseline-session",
            sourceSessionId,
            "--json",
          ],
          "Inspect the synthetic fixture\n",
        )
      ).stdout,
    ) as {
      baseline: {
        sessionId: string;
        byteDifference: number;
        interpretation: string;
      };
      tokenEstimate: { method: string };
    };
    assert.equal(named.baseline.sessionId, sourceSessionId);
    assert.equal(typeof named.baseline.byteDifference, "number");
    assert.match(named.baseline.interpretation, /SAVINGS|EQUAL_SIZE/u);
    assert.equal(named.tokenEstimate.method, "CEIL_UTF8_BYTES_DIVIDED_BY_4");
  });
  after(async () => rm(root, { recursive: true, force: true }));
  it("guides explicit Work Item lifecycle with stdin", async () => {
    assert.match(
      (await ok(["work", "create", "--help"])).stdout,
      /No current Work Item is inferred/u,
    );
    const created = await ok(
      [
        "work",
        "create",
        "--project",
        projectId,
        "--objective-stdin",
        "--source-event",
        eventId,
        "--json",
      ],
      "Synthetic objective\n",
    );
    const item = JSON.parse(created.stdout) as { id: string; status: string };
    workId = item.id;
    assert.equal(item.status, "PROPOSED");
    assert.equal(
      (
        JSON.parse(
          (
            await ok([
              "work",
              "activate",
              workId,
              "--project",
              projectId,
              "--source-event",
              eventId,
              "--json",
            ])
          ).stdout,
        ) as { status: string }
      ).status,
      "ACTIVE",
    );
    assert.match(
      (await ok(["work", "show", workId, "--project", projectId])).stdout,
      /Lifecycle transitions: 1/u,
    );
  });
  it("creates, shows, and validates an immutable bounded handoff", async () => {
    const created = await ok(
      [
        "handoff",
        "create",
        "--project",
        projectId,
        "--work-item",
        workId,
        "--memory",
        memoryId,
        "--next-action-stdin",
        "--source-event",
        eventId,
        "--relevant-file",
        "README.md",
        "--test-command",
        "npm test",
        "--test-outcome",
        "PASS",
        "--json",
      ],
      "Inspect the synthetic fixture\n",
    );
    const handoff = JSON.parse(created.stdout) as {
      id: string;
      sections: {
        knownFailures: { value: unknown[] };
        repository: { value: { dirty: boolean } };
      };
    };
    handoffId = handoff.id;
    assert.equal(handoff.sections.knownFailures.value.length, 1);
    assert.equal(handoff.sections.repository.value.dirty, false);
    const shown = await ok([
      "handoff",
      "show",
      handoffId,
      "--project",
      projectId,
      "--work-item",
      workId,
    ]);
    assert.match(shown.stdout, /Trust|UNTRUSTED|Inspect sources/u);
    assert.equal(
      (
        await ok([
          "handoff",
          "validate",
          handoffId,
          "--project",
          projectId,
          "--work-item",
          workId,
        ])
      ).exitCode,
      0,
    );
    await writeFile(join(repository, "README.md"), "# Changed\n");
    const drift = await run([
      "handoff",
      "validate",
      handoffId,
      "--project",
      projectId,
      "--work-item",
      workId,
    ]);
    assert.equal(drift.exitCode, 1);
    assert.match(drift.stdout, /immutable handoff snapshot/u);
  });
  it("keeps project scope explicit and errors actionable", async () => {
    const foreign = await run(["work", "show", workId, "--project", "foreign"]);
    assert.equal(foreign.exitCode, 1);
    assert.match(foreign.stderr, /not registered/u);
    const missing = await run([
      "handoff",
      "show",
      "missing",
      "--project",
      projectId,
      "--work-item",
      workId,
    ]);
    assert.equal(missing.exitCode, 1);
    assert.match(missing.stderr, /not found/u);
  });
  it("evaluates the predeclared first action with exact-byte baselines", async () => {
    const imported = JSON.parse(
      (
        await ok([
          "session",
          "import",
          "--project",
          projectId,
          "--source",
          "claude-code",
          "--file",
          claudeFixturePath,
          "--json",
        ])
      ).stdout,
    ) as { session: { id: string; events: { id: string; type: string }[] } };
    const expected = imported.session.events.find(
      (event) => event.type === "TOOL_CALL",
    );
    assert.ok(expected);
    const evaluated = JSON.parse(
      (
        await ok([
          "handoff",
          "evaluate",
          handoffId,
          "--project",
          projectId,
          "--work-item",
          workId,
          "--resume-session",
          imported.session.id,
          "--expected-event",
          expected.id,
          "--json",
        ])
      ).stdout,
    ) as {
      firstAction: { matched: boolean };
      context: {
        fullSessionBytes: number;
        handoffBytes: number;
        tokenEstimateMethod: string;
      };
      elapsed: { milliseconds: number };
    };
    if (process.env.AI_WORKSPACE_DEMO_REPORT === "1") {
      process.stdout.write(
        `SYNTHETIC_HANDOFF_EVALUATION ${JSON.stringify(evaluated)}\n`,
      );
    }
    assert.equal(evaluated.firstAction.matched, true);
    assert.ok(evaluated.context.fullSessionBytes > 0);
    assert.ok(evaluated.context.handoffBytes > 0);
    assert.equal(
      evaluated.context.tokenEstimateMethod,
      "CEIL_UTF8_BYTES_DIVIDED_BY_4",
    );
    assert.equal(evaluated.elapsed.milliseconds, 1000);
  });
  async function ok(args: readonly string[], stdin?: string) {
    const result = await run(args, stdin);
    assert.equal(result.exitCode, 0, result.stderr);
    return result;
  }
  async function run(args: readonly string[], stdin?: string) {
    let stdout = "",
      stderr = "";
    const exitCode = await executeCli(args, {
      environment: { AI_WORKSPACE_HOME: home },
      stdout: (value) => {
        stdout += value;
      },
      stderr: (value) => {
        stderr += value;
      },
      ...(stdin === undefined ? {} : { stdin: async () => stdin }),
    });
    return { exitCode, stdout, stderr };
  }
});
async function runGit(cwd: string, args: readonly string[]) {
  await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
}
