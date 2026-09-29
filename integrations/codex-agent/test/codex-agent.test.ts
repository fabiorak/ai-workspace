import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import {
  agentEnvironment,
  createConfinedWorkspace,
  locateExecutable,
} from "@ai-workspace/agent-process";

import {
  CodexAgentAdapter,
  buildCodexAgentInvocation,
  createCodexAgentProcessRunner,
  type CodexAgentObservation,
  parseCodexVersion,
  qualifyCodexExecutable,
  QUALIFIED_CODEX_EXECUTABLES,
} from "../src/index.ts";

const input = {
  model: "gpt-test",
  text: "Synthetic protected context",
  isolatedWorkspace: "/tmp/ai-workspace-codex-agent-test",
  timeoutMs: 30_000,
};

const observation = (
  override: Partial<CodexAgentObservation> = {},
): CodexAgentObservation => ({
  stdout:
    '{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n',
  stderr: "",
  exitCode: 0,
  timedOut: false,
  processTreeTerminated: false,
  outputLimitExceeded: false,
  streamEncodingInvalid: false,
  lingeringProcesses: false,
  workspaceWritten: false,
  ...override,
});

describe("subscription-backed Codex agent adapter", () => {
  it("builds one fixed read-only ephemeral stdin invocation", () => {
    const value = buildCodexAgentInvocation(input);
    assert.equal(value.executable, "codex");
    assert.equal(value.stdin, input.text);
    assert.equal(value.cwd, input.isolatedWorkspace);
    assert.deepEqual(value.args, [
      "--ask-for-approval",
      "never",
      "exec",
      "--ephemeral",
      "--json",
      "--sandbox",
      "read-only",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--model",
      "gpt-test",
      "--cd",
      input.isolatedWorkspace,
      "-",
    ]);
  });

  it("accepts one final message and returns only bounded evidence", async () => {
    const result = await new CodexAgentAdapter(async () =>
      observation({
        stdout:
          '{"type":"thread.started","thread_id":"synthetic"}\n{"type":"turn.started"}\n{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n',
      }),
    ).execute(input);
    assert.equal(result.kind, "COMPLETED");
    if (result.kind === "COMPLETED") {
      assert.equal(result.text, "answer");
      assert.equal(result.eventCount, 4);
      assert.equal(result.inputDigest.length, 64);
      assert.equal(JSON.stringify(result).includes(input.text), false);
    }
  });

  it("fails closed for tools, duplicates, malformed output and nonzero exit", async () => {
    const cases = [
      observation({
        stdout:
          '{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"turn.completed"}\n',
      }),
      observation({
        stdout:
          '{"type":"item.completed","item":{"type":"agent_message","text":"one"}}\n{"type":"item.completed","item":{"type":"agent_message","text":"two"}}\n{"type":"turn.completed"}\n',
      }),
      observation({ stdout: "not-json\n" }),
      observation({
        stdout:
          '{"type":"unreviewed.event"}\n{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n',
      }),
      observation({
        stdout:
          '{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n{"type":"turn.started"}\n',
      }),
      observation({ exitCode: 1 }),
      observation({ outputLimitExceeded: true }),
    ];
    for (const value of cases)
      assert.deepEqual(
        await new CodexAgentAdapter(async () => value).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION" },
      );
  });

  it("reads only the exact version line and ships no reviewed release", async () => {
    assert.equal(parseCodexVersion("codex-cli 0.63.0\n"), "0.63.0");
    for (const value of [
      "0.63.0",
      "codex-cli 0.63",
      "codex-cli 0.63.0\nextra",
      " codex-cli 0.63.0",
    ])
      assert.equal(parseCodexVersion(value), null, value);
    assert.deepEqual(QUALIFIED_CODEX_EXECUTABLES, []);
    assert.deepEqual(
      await qualifyCodexExecutable(
        [dirname(process.execPath)],
        "codex-cli 0.63.0\n",
      ),
      {
        kind: "NOT_QUALIFIED",
        reason: "NOT_FOUND",
      },
    );
  });

  it("voids an answer when a descendant lingered or the workspace was written", async () => {
    for (const override of [
      { lingeringProcesses: true },
      { workspaceWritten: true },
    ])
      assert.deepEqual(
        await new CodexAgentAdapter(async () => observation(override)).execute(
          input,
        ),
        { kind: "UNKNOWN_AFTER_EXECUTION" },
        JSON.stringify(override),
      );
  });

  it("requires verified process-tree termination on timeout", async () => {
    assert.deepEqual(
      await new CodexAgentAdapter(async () =>
        observation({
          stdout: "",
          timedOut: true,
          processTreeTerminated: true,
          exitCode: null,
        }),
      ).execute(input),
      { kind: "UNKNOWN_AFTER_EXECUTION" },
    );
    assert.deepEqual(
      await new CodexAgentAdapter(async () =>
        observation({ stdout: "", timedOut: true, exitCode: null }),
      ).execute(input),
      { kind: "UNKNOWN_AFTER_EXECUTION" },
    );
  });

  it("runs without a shell and forwards only the managed-login environment", async () => {
    const fixture = await fixtureCodex(`
const input = require("node:fs").readFileSync(0, "utf8");
const text = [Boolean(process.env.OPENAI_API_KEY), Boolean(process.env.PRIVATE_CANARY), input.length].join(":");
process.stdout.write(JSON.stringify({type:"item.completed",item:{type:"agent_message",text}}) + "\\n");
process.stdout.write(JSON.stringify({type:"turn.completed"}) + "\\n");
`);
    try {
      process.env.OPENAI_API_KEY = "must-not-cross";
      process.env.PRIVATE_CANARY = "must-not-cross";
      const runner = createCodexAgentProcessRunner(await confined(fixture));
      const request = {
        ...input,
        isolatedWorkspace: fixture.work,
      };
      const observed = await runner({
        ...buildCodexAgentInvocation(request),
      });
      assert.equal(observed.exitCode, 0);
      assert.equal(observed.outputLimitExceeded, false);
      assert.equal(observed.streamEncodingInvalid, false);
      assert.equal(observed.stderr, "");
      assert.equal(
        observed.stdout,
        `{"type":"item.completed","item":{"type":"agent_message","text":"false:false:${input.text.length}"}}\n{"type":"turn.completed"}\n`,
      );
      const result = await new CodexAgentAdapter(async () => observed).execute(
        request,
      );
      assert.equal(result.kind, "COMPLETED");
      if (result.kind === "COMPLETED")
        assert.equal(result.text, `false:false:${input.text.length}`);
    } finally {
      await release(fixture);
    }
  });

  it("terminates the isolated process group on timeout", async () => {
    const fixture = await fixtureCodex("setInterval(() => {}, 1000);\n");
    try {
      const runner = createCodexAgentProcessRunner({
        ...(await confined(fixture)),
        terminationGraceMs: 10,
      });
      const value = await runner({
        ...buildCodexAgentInvocation({
          ...input,
          isolatedWorkspace: fixture.work,
          timeoutMs: 20,
        }),
      });
      assert.equal(value.timedOut, true);
      assert.equal(value.processTreeTerminated, true);
    } finally {
      await release(fixture);
    }
  });

  it("bounds streamed output before terminating the process group", async () => {
    const fixture = await fixtureCodex(`
process.stdout.write("x".repeat(2 * 1024 * 1024 + 1));
setInterval(() => {}, 1000);
`);
    try {
      const runner = createCodexAgentProcessRunner({
        ...(await confined(fixture)),
        terminationGraceMs: 10,
      });
      const value = await runner({
        ...buildCodexAgentInvocation({
          ...input,
          isolatedWorkspace: fixture.work,
          timeoutMs: 1_000,
        }),
      });
      assert.equal(value.outputLimitExceeded, true);
      assert.equal(value.processTreeTerminated, true);
      assert.ok(Buffer.byteLength(value.stdout, "utf8") <= 2 * 1024 * 1024);
    } finally {
      await release(fixture);
    }
  });
});

/**
 * A synthetic executable and a confined run under one mkdtemp root. Only that
 * root, created by this call, is ever removed.
 */
async function fixtureCodex(body: string) {
  const directory = await mkdtemp(join(tmpdir(), "ai-workspace-codex-runner-"));
  const bin = join(directory, "bin");
  const login = join(directory, "login");
  const runs = join(directory, "runs");
  for (const path of [bin, login, runs]) await mkdir(path, { mode: 0o700 });
  const executable = join(bin, "codex");
  await writeFile(executable, `#!${process.execPath}\n${body}`, "utf8");
  await chmod(executable, 0o700);
  const workspace = await createConfinedWorkspace(runs);
  return { directory, bin, login, workspace, work: workspace.work };
}

async function confined(fixture: Awaited<ReturnType<typeof fixtureCodex>>) {
  const located = await locateExecutable("codex", [fixture.bin]);
  if (typeof located === "string") throw new Error(located);
  return {
    executable: located,
    environment: await agentEnvironment({
      workspace: fixture.workspace,
      configVariable: "CODEX_HOME",
      configDirectory: fixture.login,
      searchPath: [fixture.bin, dirname(process.execPath)],
    }),
  };
}

async function release(fixture: Awaited<ReturnType<typeof fixtureCodex>>) {
  delete process.env.OPENAI_API_KEY;
  delete process.env.PRIVATE_CANARY;
  await rm(fixture.directory, { recursive: true });
}
