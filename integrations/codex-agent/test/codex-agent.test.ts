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
  CODEX_DISABLED_FEATURES,
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
      "--no-daemon",
      ...[
        "shell_tool",
        "unified_exec_tty",
        "shell_snapshot",
        "view_image",
        "apps",
        "plugins",
        "remote_plugin",
        "hooks",
        "skill_search",
        "skill_mcp_dependency_install",
        "workspace_dependencies",
        "browser_use",
        "browser_use_external",
        "browser_use_full_cdp_access",
        "computer_use",
        "in_app_browser",
        "multi_agent",
        "image_generation",
        "tool_suggest",
        "sleep_tool",
        "goals",
        "daemon_auto_start",
        "unbounded_connection_retries",
      ].flatMap((feature) => ["--disable", feature]),
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
    // Exactly the 23 features observed off; the one that stayed on is not
    // listed as if it were disabled.
    assert.equal(CODEX_DISABLED_FEATURES.length, 23);
    assert.equal(new Set(CODEX_DISABLED_FEATURES).size, 23);
    assert.equal(CODEX_DISABLED_FEATURES.includes("unified_exec"), false);
    assert.ok(Object.isFrozen(CODEX_DISABLED_FEATURES));
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

  it("discards reasoning and answer-only announcements without keeping them", async () => {
    const reasoning = "Synthetic private reasoning canary";
    const result = await new CodexAgentAdapter(async () =>
      observation({
        stdout: [
          { type: "thread.started", thread_id: "synthetic" },
          { type: "turn.started" },
          { type: "item.started", item: { id: "r", type: "reasoning" } },
          {
            type: "item.completed",
            item: { id: "r", type: "reasoning", text: reasoning },
          },
          { type: "item.started", item: { id: "a", type: "agent_message" } },
          {
            type: "item.completed",
            item: { id: "a", type: "agent_message", text: "answer" },
          },
          { type: "turn.completed", usage: { output_tokens: 1 } },
        ]
          .map((event) => JSON.stringify(event) + "\n")
          .join(""),
      }),
    ).execute(input);
    assert.equal(result.kind, "COMPLETED");
    if (result.kind === "COMPLETED") {
      assert.equal(result.text, "answer");
      assert.equal(result.eventCount, 7);
      assert.equal(JSON.stringify(result).includes(reasoning), false);
    }
  });

  it("still fails closed for every other started or completed item", async () => {
    const answer =
      '{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n';
    const cases: Array<[string, string, string | null]> = [
      ...[
        "command_execution",
        "file_change",
        "mcp_tool_call",
        "web_search",
        "todo_list",
        "unreviewed",
      ].flatMap((type): Array<[string, string, string | null]> => [
        [
          `{"type":"item.started","item":{"type":"${type}"}}\n${answer}`,
          "UNEXPECTED_EVENT",
          `item.started/${type}`,
        ],
        [
          `{"type":"item.completed","item":{"type":"${type}"}}\n${answer}`,
          "UNEXPECTED_EVENT",
          `item.completed/${type}`,
        ],
      ]),
      [`{"type":"item.started"}\n${answer}`, "MALFORMED_EVENT", null],
      [
        `{"type":"item.updated","item":{"type":"agent_message","text":"a"}}\n${answer}`,
        "UNEXPECTED_EVENT",
        "item.updated/agent_message",
      ],
      [
        `{"type":"turn.failed","error":{"message":"synthetic"}}\n${answer}`,
        "ERROR_RESULT",
        null,
      ],
      [
        `{"type":"error","message":"synthetic"}\n${answer}`,
        "ERROR_RESULT",
        null,
      ],
      [
        '{"type":"item.completed","item":{"type":"reasoning","text":"only"}}\n{"type":"turn.completed"}\n',
        "NO_ANSWER",
        null,
      ],
    ];
    for (const [stdout, reason, unexpectedEvent] of cases)
      assert.deepEqual(
        await new CodexAgentAdapter(async () =>
          observation({ stdout }),
        ).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION", reason, unexpectedEvent },
        stdout,
      );
  });

  it("fails closed for tools, duplicates, malformed output and nonzero exit", async () => {
    const cases: Array<[CodexAgentObservation, string, string | null]> = [
      [
        observation({
          stdout:
            '{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"turn.completed"}\n',
        }),
        "UNEXPECTED_EVENT",
        "item.completed/command_execution",
      ],
      [
        observation({
          stdout:
            '{"type":"item.completed","item":{"type":"agent_message","text":"one"}}\n{"type":"item.completed","item":{"type":"agent_message","text":"two"}}\n{"type":"turn.completed"}\n',
        }),
        "UNEXPECTED_EVENT",
        "item.completed/agent_message",
      ],
      [observation({ stdout: "not-json\n" }), "MALFORMED_EVENT", null],
      [
        observation({
          stdout:
            '{"type":"unreviewed.event"}\n{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n',
        }),
        "UNEXPECTED_EVENT",
        "unreviewed.event",
      ],
      [
        observation({
          stdout:
            '{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}\n{"type":"turn.completed"}\n{"type":"turn.started"}\n',
        }),
        "UNEXPECTED_EVENT",
        "turn.started",
      ],
      [observation({ exitCode: 1 }), "EXIT_CODE", null],
      [observation({ outputLimitExceeded: true }), "OUTPUT_LIMIT", null],
    ];
    for (const [value, reason, unexpectedEvent] of cases)
      assert.deepEqual(
        await new CodexAgentAdapter(async () => value).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION", reason, unexpectedEvent },
        value.stdout,
      );
  });

  it("reads only the exact version line and ships one reviewed release", async () => {
    assert.equal(parseCodexVersion("codex-cli 0.63.0\n"), "0.63.0");
    assert.equal(parseCodexVersion("codex-cli 0.160.0\n"), "0.160.0");
    for (const value of [
      "0.63.0",
      "codex-cli 0.63",
      "codex-cli 0.63.0\nextra",
      " codex-cli 0.63.0",
    ])
      assert.equal(parseCodexVersion(value), null, value);
    assert.deepEqual(QUALIFIED_CODEX_EXECUTABLES, [
      {
        version: "0.160.0",
        sha256:
          "12eb3e81114588aca3b7998f4f19e8997b056aca08e57a7ca7c8a3ec8c652aad",
      },
    ]);
    assert.ok(Object.isFrozen(QUALIFIED_CODEX_EXECUTABLES));
    assert.ok(QUALIFIED_CODEX_EXECUTABLES.every(Object.isFrozen));
    assert.deepEqual(
      await qualifyCodexExecutable(
        [dirname(process.execPath)],
        "codex-cli 0.160.0\n",
      ),
      {
        kind: "NOT_QUALIFIED",
        reason: "NOT_FOUND",
      },
    );
  });

  it("refuses another file that reports the reviewed version", async () => {
    const fixture = await fixtureCodex("process.exit(0);\n");
    try {
      assert.deepEqual(
        await qualifyCodexExecutable([fixture.bin], "codex-cli 0.160.0\n"),
        { kind: "NOT_QUALIFIED", reason: "DIGEST_NOT_QUALIFIED" },
      );
      assert.deepEqual(
        await qualifyCodexExecutable([fixture.bin], "codex-cli 0.161.0\n"),
        { kind: "NOT_QUALIFIED", reason: "VERSION_NOT_QUALIFIED" },
      );
    } finally {
      await release(fixture);
    }
  });

  it("voids an answer when a descendant lingered or the workspace was written", async () => {
    for (const [override, reason] of [
      [{ lingeringProcesses: true }, "LINGERING_PROCESS"],
      [{ workspaceWritten: true }, "WORKSPACE_WRITTEN"],
    ] as const)
      assert.deepEqual(
        await new CodexAgentAdapter(async () => observation(override)).execute(
          input,
        ),
        { kind: "UNKNOWN_AFTER_EXECUTION", reason, unexpectedEvent: null },
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
      {
        kind: "UNKNOWN_AFTER_EXECUTION",
        reason: "TIMED_OUT",
        unexpectedEvent: null,
      },
    );
    assert.deepEqual(
      await new CodexAgentAdapter(async () =>
        observation({ stdout: "", timedOut: true, exitCode: null }),
      ).execute(input),
      {
        kind: "UNKNOWN_AFTER_EXECUTION",
        reason: "LINGERING_PROCESS",
        unexpectedEvent: null,
      },
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
