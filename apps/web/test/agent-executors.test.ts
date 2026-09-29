import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { fileDigest } from "@ai-workspace/agent-process";

import { agentExecutorsFromEnvironment } from "../src/agent-executors.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** A synthetic `codex` that writes a marker for every start and answers. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-n7-executors-"));
  roots.push(root);
  const bin = join(root, "bin");
  const runs = join(root, "runs");
  const login = join(root, "codex-login");
  const marks = join(root, "marks");
  for (const path of [bin, runs, login, marks])
    await mkdir(path, { mode: 0o700 });
  const executable = join(bin, "codex");
  await writeFile(
    executable,
    `#!${process.execPath}
const fs = require("node:fs");
fs.writeFileSync(${JSON.stringify(marks)} + "/" + process.pid, process.argv.slice(2).join(" "));
if (process.argv.includes("--version")) { process.stdout.write("codex-cli 0.63.0\\n"); process.exit(0); }
const input = fs.readFileSync(0, "utf8");
const text = "Synthetic real-runner answer (" + input.length + ", " + process.cwd().endsWith("/work") + ", " + String(process.env.OPENAI_API_KEY) + ")";
process.stdout.write(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\\n");
`,
  );
  await chmod(executable, 0o700);
  return {
    root,
    runs,
    marks,
    executable,
    environment: {
      AI_WORKSPACE_AGENT_EXECUTION: "CODEX_CLI",
      AI_WORKSPACE_AGENT_RUN_ROOT: runs,
      AI_WORKSPACE_AGENT_PATH: `${bin}:${dirname(process.execPath)}`,
      AI_WORKSPACE_CODEX_LOGIN_DIR: login,
    },
  };
}

describe("agent execution opt-in", () => {
  it("reads and locates nothing without the exact opt-in", async () => {
    assert.deepEqual(await agentExecutorsFromEnvironment({}), {
      executors: [],
      report: [],
    });
    await assert.rejects(
      agentExecutorsFromEnvironment({ AI_WORKSPACE_AGENT_EXECUTION: "OPENAI" }),
      /must list CODEX_CLI/u,
    );
    await assert.rejects(
      agentExecutorsFromEnvironment({
        AI_WORKSPACE_AGENT_EXECUTION: "CODEX_CLI",
      }),
      /AI_WORKSPACE_AGENT_RUN_ROOT/u,
    );
  });

  it("never starts an unreviewed file, not even for its version", async () => {
    const { environment, marks } = await fixture();
    const shipped = await agentExecutorsFromEnvironment(environment);
    assert.deepEqual(shipped, {
      executors: [],
      report: [
        {
          kind: "CODEX_CLI",
          outcome: "NOT_QUALIFIED",
          reason: "DIGEST_NOT_QUALIFIED",
        },
      ],
    });
    assert.deepEqual(await readdir(marks), []);
    const claude = await agentExecutorsFromEnvironment({
      ...environment,
      AI_WORKSPACE_AGENT_EXECUTION: "CLAUDE_CODE",
    });
    assert.equal(claude.report[0]?.reason, "NOT_FOUND");
  });

  it("offers a reviewed file only when its version matches, then runs it confined", async () => {
    const { environment, marks, executable, runs } = await fixture();
    const sha256 = await fileDigest(executable);
    const other = await agentExecutorsFromEnvironment(environment, {
      CODEX_CLI: [{ version: "0.64.0", sha256 }],
    });
    assert.equal(other.report[0]?.reason, "VERSION_NOT_QUALIFIED");
    assert.equal((await readdir(marks)).length, 1, "only --version ran");

    process.env.OPENAI_API_KEY = "must-not-cross";
    try {
      const offered = await agentExecutorsFromEnvironment(environment, {
        CODEX_CLI: [{ version: "0.63.0", sha256 }],
      });
      assert.deepEqual(offered.report, [
        { kind: "CODEX_CLI", outcome: "OFFERED", reason: null },
      ]);
      const [executor] = offered.executors;
      assert.equal(executor?.launch, "AVAILABLE");
      const request = {
        model: "synthetic-model",
        text: "Synthetic protected input",
        timeoutMs: 10_000,
      };
      assert.deepEqual(executor!.plan(request), executor!.plan(request));
      const result = await executor!.execute(request);
      assert.deepEqual(result, {
        kind: "COMPLETED",
        text: `Synthetic real-runner answer (${request.text.length}, true, undefined)`,
        reportedModel: null,
      });
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
    const starts = await Promise.all(
      (await readdir(marks)).map((name) => readFile(join(marks, name), "utf8")),
    );
    assert.equal(starts.filter((args) => args === "--version").length, 2);
    assert.equal(
      starts.filter((args) => args.startsWith("--ask-for-approval")).length,
      1,
    );
    assert.deepEqual(await readdir(runs), [], "every run tree was released");
    await writeFile(executable, "#!/bin/sh\nexit 0\n");
    const changed = await agentExecutorsFromEnvironment(environment, {
      CODEX_CLI: [{ version: "0.63.0", sha256 }],
    });
    assert.equal(changed.report[0]?.reason, "DIGEST_NOT_QUALIFIED");
    assert.equal((await stat(executable)).isFile(), true);
  });
});
