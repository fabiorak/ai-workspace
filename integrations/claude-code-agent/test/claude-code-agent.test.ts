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
  CLAUDE_CODE_BUILT_IN_PLUGINS,
  CLAUDE_CODE_DEFAULT_MODEL,
  claudeCodeBuiltInPlugins,
  CLAUDE_CODE_SYSTEM_PROMPT,
  ClaudeCodeAgentAdapter,
  buildClaudeCodeAgentInvocation,
  createClaudeCodeAgentProcessRunner,
  type ClaudeCodeAgentObservation,
  parseClaudeCodeVersion,
  qualifyClaudeCodeExecutable,
  QUALIFIED_CLAUDE_CODE_EXECUTABLES,
} from "../src/index.ts";

/**
 * No real Claude Code is started anywhere in this file. Every process test runs
 * a synthetic executable written into a temporary directory, which is what makes
 * the boundary observable without a login, a subscription or a turn of credit.
 */
const input = {
  text: "Synthetic protected context",
  isolatedWorkspace: "/tmp/ai-workspace-claude-code-agent-test",
  timeoutMs: 30_000,
};

const init = (override: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "system",
    subtype: "init",
    tools: [],
    mcp_servers: [],
    plugins: [],
    hooks: [],
    skills: [],
    memory: [],
    ...override,
  });
const answered = (text: string, override: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: text,
    permission_denials: [],
    ...override,
  });
/** The documented shape: the content sits in `message`, a Messages API reply. */
const assistant = (
  content: readonly unknown[],
  override: Record<string, unknown> = {},
) =>
  JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content },
    parent_tool_use_id: null,
    ...override,
  });
const said = (text: string) => assistant([{ type: "text", text }]);

const DISCARDED_RATE_LIMIT = "rate_limit_event";

const observation = (
  override: Partial<ClaudeCodeAgentObservation> = {},
): ClaudeCodeAgentObservation => ({
  stdout: `${init()}\n${said("Synthetic output.")}\n${answered("answer")}\n`,
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

describe("subscription-backed Claude Code agent adapter", () => {
  /**
   * Managed login is the whole point of this class of target, so `--bare` is
   * never built: it skips the OAuth and keychain reads the subscription login
   * depends on, and would require an API key this boundary must not hold.
   */
  it("builds one managed-login stdin invocation on the stable alias", () => {
    const value = buildClaudeCodeAgentInvocation(input);
    assert.equal(value.executable, "claude");
    assert.equal(value.stdin, input.text);
    assert.equal(value.cwd, input.isolatedWorkspace);
    assert.deepEqual(value.args, [
      "-p",
      "--safe-mode",
      "--restricted",
      "--tools",
      "",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--no-chrome",
      "--output-format",
      "stream-json",
      "--verbose",
      "--system-prompt",
      CLAUDE_CODE_SYSTEM_PROMPT,
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--permission-mode",
      "dontAsk",
      "--permission-prompts",
      "none",
      "--max-budget-usd",
      "0.05",
      "--model",
      "sonnet",
    ]);
    assert.equal(CLAUDE_CODE_DEFAULT_MODEL, "sonnet");
    assert.equal(value.args.includes("--bare"), false);
    // Plain text: no schema retries inside the product, no hidden tool call.
    assert.equal(value.args.includes("--json-schema"), false);
    // The alias stays inspectable and replaceable, and reaches argv verbatim.
    assert.deepEqual(
      buildClaudeCodeAgentInvocation({ ...input, model: "opus" }).args.slice(
        -2,
      ),
      ["--model", "opus"],
    );
  });

  it("refuses an unusable request before any process exists", async () => {
    for (const value of [
      { ...input, model: "" },
      { ...input, text: "   " },
      { ...input, text: "x".repeat(256 * 1024 + 1) },
      { ...input, isolatedWorkspace: "relative/workspace" },
      { ...input, timeoutMs: 120_001 },
      { ...input, timeoutMs: 0 },
    ])
      assert.deepEqual(
        await new ClaudeCodeAgentAdapter(async () => {
          throw new Error("A rejected request must not reach the runner.");
        }).execute(value),
        { kind: "REJECTED_BEFORE_EXECUTION" },
      );
  });

  it("accepts one plain answer and returns only bounded evidence", async () => {
    const result = await new ClaudeCodeAgentAdapter(async () =>
      observation(),
    ).execute(input);
    assert.equal(result.kind, "COMPLETED");
    if (result.kind === "COMPLETED") {
      assert.equal(result.text, "answer");
      assert.equal(result.model, "sonnet");
      assert.equal(result.eventCount, 3);
      assert.equal(result.inputDigest.length, 64);
      assert.equal(JSON.stringify(result).includes(input.text), false);
    }
  });

  /**
   * Reasoning, a quota notice and the product's own API retry carry no answer.
   * They are discarded unread, so none of their text can reach the result.
   */
  it("discards reasoning, quota notices and API retries unread", async () => {
    const stdout = [
      JSON.stringify({ type: DISCARDED_RATE_LIMIT, rate_limit_info: {} }),
      init(),
      JSON.stringify({ type: "system", subtype: "api_retry", attempt: 1 }),
      assistant([
        { type: "thinking", thinking: "Synthetic hidden reasoning." },
        { type: "redacted_thinking", data: "synthetic" },
        { type: "text", text: "Synthetic output." },
      ]),
      JSON.stringify({ type: DISCARDED_RATE_LIMIT, rate_limit_info: {} }),
      answered("answer"),
    ].join("\n");
    const result = await new ClaudeCodeAgentAdapter(async () =>
      observation({ stdout }),
    ).execute(input);
    assert.equal(result.kind, "COMPLETED");
    if (result.kind === "COMPLETED") {
      assert.equal(result.text, "answer");
      assert.equal(result.eventCount, 6);
      assert.equal(JSON.stringify(result).includes("hidden reasoning"), false);
    }
  });

  /**
   * The reviewed release loads two built-in plugins even in safe mode, and no
   * flag turns them off. Exactly those names are accepted for that release;
   * another plugin, any plugin without the reviewed list, or any other loaded
   * context still voids the answer.
   */
  it("accepts only the reviewed release's built-in plugins, by name", async () => {
    const reviewed = claudeCodeBuiltInPlugins("2.1.294");
    const plugins = (...names: string[]) =>
      names.map((name) => ({ name, path: `/synthetic/${name}` }));
    const run = (
      initOverride: Record<string, unknown>,
      builtInPlugins?: readonly string[],
    ) =>
      new ClaudeCodeAgentAdapter(
        async () =>
          observation({
            stdout: [
              JSON.stringify({ type: "system", subtype: "ui_invalidate" }),
              init(initOverride),
              said("Synthetic output."),
              answered("answer"),
            ].join("\n"),
          }),
        builtInPlugins === undefined ? {} : { builtInPlugins },
      ).execute(input);
    const accepted = await run(
      { plugins: plugins("cc-plugin-agents-md", "cc-plugin-plugin-authoring") },
      reviewed,
    );
    assert.equal(accepted.kind, "COMPLETED");
    assert.equal(
      (await run({ plugins: plugins("cc-plugin-agents-md") }, reviewed)).kind,
      "COMPLETED",
    );
    for (const [override, list] of [
      [
        { plugins: plugins("cc-plugin-agents-md", "cc-plugin-telemetry") },
        reviewed,
      ],
      [{ plugins: plugins("cc-plugin-agents-md") }, undefined],
      [{ plugins: ["cc-plugin-agents-md"] }, reviewed],
      [
        { plugins: plugins("cc-plugin-agents-md"), skills: ["synthetic"] },
        reviewed,
      ],
    ] as const)
      assert.deepEqual(
        await run(override, list),
        {
          kind: "UNKNOWN_AFTER_EXECUTION",
          reason: "CONTEXT_LOADED",
          unexpectedEvent: null,
        },
        JSON.stringify(override),
      );
  });

  /**
   * Anything the turn loaded or did besides answering is context this boundary
   * did not review, so it is refused rather than reported as a plain answer.
   */
  it("fails closed for tools, loaded context, retries and malformed evidence", async () => {
    const unknown = (
      reason: string,
      unexpectedEvent: string | null = null,
    ) => ({
      kind: "UNKNOWN_AFTER_EXECUTION",
      reason,
      unexpectedEvent,
    });
    const cases: Array<[ClaudeCodeAgentObservation, object]> = [
      [
        observation({
          stdout: `${init()}\n${assistant([{ type: "tool_use", name: "synthetic" }])}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "assistant/tool_use"),
      ],
      // The undocumented top-level shape is not an answer either.
      [
        observation({
          stdout: `${init()}\n${JSON.stringify({
            type: "assistant",
            content: [{ type: "text", text: "Synthetic output." }],
          })}\n${answered("answer")}\n`,
        }),
        unknown("MALFORMED_EVENT"),
      ],
      [
        observation({
          stdout: `${init()}\n${assistant([{ type: "text", text: "x" }], { parent_tool_use_id: "synthetic" })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "assistant"),
      ],
      [
        observation({
          stdout: `${init()}\n${assistant([{ type: "text", text: "x" }], { error: "unknown" })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "assistant"),
      ],
      [
        observation({
          stdout: `${init()}\n${JSON.stringify({ type: "user", message: { content: [] } })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "user"),
      ],
      [
        observation({
          stdout: `${init()}\n${JSON.stringify({ type: "system", subtype: "permission_denied" })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "system/permission_denied"),
      ],
      [
        observation({
          stdout: `${init()}\n${answered("answer", { permission_denials: [{ tool_name: "Read" }] })}\n`,
        }),
        unknown("ERROR_RESULT"),
      ],
      [
        observation({
          stdout: `${init()}\n${answered("answer", { is_error: true })}\n`,
        }),
        unknown("ERROR_RESULT"),
      ],
      [
        observation({ stdout: `${init()}\n${answered("   ")}\n` }),
        unknown("NO_ANSWER"),
      ],
      [
        observation({
          stdout: `${init()}\n${answered("answer")}\n${JSON.stringify({ type: DISCARDED_RATE_LIMIT })}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "rate_limit_event"),
      ],
      [
        observation({
          stdout: `${init({ mcp_servers: [{ name: "synthetic" }] })}\n${answered("answer")}\n`,
        }),
        unknown("CONTEXT_LOADED"),
      ],
      [
        observation({
          stdout: `${init({ plugins: [{ name: "synthetic" }] })}\n${answered("answer")}\n`,
        }),
        unknown("CONTEXT_LOADED"),
      ],
      [
        observation({
          stdout: `${init({ memory: [{ name: "synthetic" }] })}\n${answered("answer")}\n`,
        }),
        unknown("CONTEXT_LOADED"),
      ],
      [
        observation({
          stdout: `${init()}\n${JSON.stringify({ type: "retry", attempt: 2 })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "retry"),
      ],
      [
        observation({
          stdout: `${init()}\n${answered("one")}\n${answered("two")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "result/success"),
      ],
      [
        observation({ stdout: `${init()}\n${said("Synthetic output.")}\n` }),
        unknown("NO_ANSWER"),
      ],
      [
        observation({ stdout: `${answered("answer")}\n` }),
        unknown("NO_ANSWER"),
      ],
      [
        observation({
          stdout: `${init()}\n${init()}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "system/init"),
      ],
      [
        observation({
          stdout: `${init()}\n${JSON.stringify({ type: "unreviewed.event" })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT", "unreviewed.event"),
      ],
      // A type that is not an identifier is reported without its value.
      [
        observation({
          stdout: `${init()}\n${JSON.stringify({ type: "Synthetic sentence, not a type" })}\n${answered("answer")}\n`,
        }),
        unknown("UNEXPECTED_EVENT"),
      ],
      [
        observation({
          stdout: `${init()}\n${answered("answer", { subtype: "error_during_execution" })}\n`,
        }),
        unknown("ERROR_RESULT"),
      ],
      [
        observation({
          stdout: `${init()}\n${answered("answer", { subtype: "error_max_budget_usd" })}\n`,
        }),
        unknown("ERROR_RESULT"),
      ],
      [observation({ stdout: "not-json\n" }), unknown("MALFORMED_EVENT")],
      [observation({ exitCode: 1 }), unknown("EXIT_CODE")],
      [observation({ outputLimitExceeded: true }), unknown("OUTPUT_LIMIT")],
      [
        observation({ streamEncodingInvalid: true }),
        unknown("STREAM_ENCODING"),
      ],
    ];
    for (const [value, expected] of cases)
      assert.deepEqual(
        await new ClaudeCodeAgentAdapter(async () => value).execute(input),
        expected,
        value.stdout,
      );
  });

  it("reads only the exact version line and ships one reviewed release", async () => {
    assert.equal(parseClaudeCodeVersion("2.1.283 (Claude Code)\n"), "2.1.283");
    for (const value of [
      "2.1.283",
      "Claude Code 2.1.283",
      "2.1.283 (Claude Code) x",
    ])
      assert.equal(parseClaudeCodeVersion(value), null, value);
    assert.deepEqual(QUALIFIED_CLAUDE_CODE_EXECUTABLES, [
      {
        version: "2.1.294",
        sha256:
          "27122ca7b624f537546fbef35b80c66370d974ff258f3d9b10ac50bb8771f262",
      },
    ]);
    assert.ok(Object.isFrozen(QUALIFIED_CLAUDE_CODE_EXECUTABLES));
    assert.ok(QUALIFIED_CLAUDE_CODE_EXECUTABLES.every(Object.isFrozen));
    // Built-in plugins belong to the reviewed release and to no other.
    assert.deepEqual(claudeCodeBuiltInPlugins("2.1.294"), [
      "cc-plugin-agents-md",
      "cc-plugin-plugin-authoring",
      "cc-plugin-sec-default",
    ]);
    for (const version of ["2.1.295", "__proto__", "constructor"])
      assert.deepEqual(claudeCodeBuiltInPlugins(version), [], version);
    assert.ok(Object.isFrozen(CLAUDE_CODE_BUILT_IN_PLUGINS));
    assert.ok(
      QUALIFIED_CLAUDE_CODE_EXECUTABLES.every((entry) =>
        Object.isFrozen(claudeCodeBuiltInPlugins(entry.version)),
      ),
    );
    assert.deepEqual(
      await qualifyClaudeCodeExecutable(
        [dirname(process.execPath)],
        "2.1.283 (Claude Code)\n",
      ),
      {
        kind: "NOT_QUALIFIED",
        reason: "NOT_FOUND",
      },
    );
  });

  it("voids an answer when a descendant lingered or the workspace was written", async () => {
    for (const [override, reason] of [
      [{ lingeringProcesses: true }, "LINGERING_PROCESS"],
      [{ workspaceWritten: true }, "WORKSPACE_WRITTEN"],
    ] as const)
      assert.deepEqual(
        await new ClaudeCodeAgentAdapter(async () =>
          observation(override),
        ).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION", reason, unexpectedEvent: null },
        JSON.stringify(override),
      );
  });

  it("requires verified process-tree termination on timeout", async () => {
    for (const [value, reason] of [
      [
        observation({
          stdout: "",
          timedOut: true,
          processTreeTerminated: true,
          exitCode: null,
        }),
        "TIMED_OUT",
      ],
      [
        observation({ stdout: "", timedOut: true, exitCode: null }),
        "LINGERING_PROCESS",
      ],
    ] as const)
      assert.deepEqual(
        await new ClaudeCodeAgentAdapter(async () => value).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION", reason, unexpectedEvent: null },
      );
  });

  it("keeps an unknown outcome when the runner itself fails", async () => {
    assert.deepEqual(
      await new ClaudeCodeAgentAdapter(async () => {
        throw new Error("Synthetic spawn failure.");
      }).execute(input),
      {
        kind: "UNKNOWN_AFTER_EXECUTION",
        reason: "RUNNER_FAILED",
        unexpectedEvent: null,
      },
    );
  });

  it("runs without a shell and forwards only the managed-login environment", async () => {
    const fixture = await fixtureClaude(`
const input = require("node:fs").readFileSync(0, "utf8");
const text = [Boolean(process.env.ANTHROPIC_API_KEY), Boolean(process.env.PRIVATE_CANARY), input.length].join(":");
process.stdout.write(JSON.stringify({type:"system",subtype:"init",tools:[],mcp_servers:[],plugins:[],hooks:[],skills:[],memory:[]}) + "\\n");
process.stdout.write(JSON.stringify({type:"result",subtype:"success",result:text}) + "\\n");
`);
    try {
      process.env.ANTHROPIC_API_KEY = "must-not-cross";
      process.env.PRIVATE_CANARY = "must-not-cross";
      const runner = createClaudeCodeAgentProcessRunner(
        await confined(fixture),
      );
      const request = { ...input, isolatedWorkspace: fixture.work };
      const observed = await runner({
        ...buildClaudeCodeAgentInvocation(request),
      });
      assert.equal(observed.exitCode, 0);
      assert.equal(observed.outputLimitExceeded, false);
      assert.equal(observed.streamEncodingInvalid, false);
      assert.equal(observed.stderr, "");
      const result = await new ClaudeCodeAgentAdapter(
        async () => observed,
      ).execute(request);
      assert.equal(result.kind, "COMPLETED");
      if (result.kind === "COMPLETED")
        assert.equal(result.text, `false:false:${input.text.length}`);
    } finally {
      await release(fixture);
    }
  });

  it("terminates the isolated process group on timeout", async () => {
    const fixture = await fixtureClaude("setInterval(() => {}, 1000);\n");
    try {
      const runner = createClaudeCodeAgentProcessRunner({
        ...(await confined(fixture)),
        terminationGraceMs: 10,
      });
      const value = await runner({
        ...buildClaudeCodeAgentInvocation({
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
    const fixture = await fixtureClaude(`
process.stdout.write("x".repeat(2 * 1024 * 1024 + 1));
setInterval(() => {}, 1000);
`);
    try {
      const runner = createClaudeCodeAgentProcessRunner({
        ...(await confined(fixture)),
        terminationGraceMs: 10,
      });
      const value = await runner({
        ...buildClaudeCodeAgentInvocation({
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
async function fixtureClaude(body: string) {
  const directory = await mkdtemp(
    join(tmpdir(), "ai-workspace-claude-runner-"),
  );
  const bin = join(directory, "bin");
  const login = join(directory, "login");
  const runs = join(directory, "runs");
  for (const path of [bin, login, runs]) await mkdir(path, { mode: 0o700 });
  const executable = join(bin, "claude");
  await writeFile(executable, `#!${process.execPath}\n${body}`, "utf8");
  await chmod(executable, 0o700);
  const workspace = await createConfinedWorkspace(runs);
  return { directory, bin, login, workspace, work: workspace.work };
}

async function confined(fixture: Awaited<ReturnType<typeof fixtureClaude>>) {
  const located = await locateExecutable("claude", [fixture.bin]);
  if (typeof located === "string") throw new Error(located);
  return {
    executable: located,
    environment: await agentEnvironment({
      workspace: fixture.workspace,
      configVariable: "CLAUDE_CONFIG_DIR",
      configDirectory: fixture.login,
      searchPath: [fixture.bin, dirname(process.execPath)],
    }),
  };
}

async function release(fixture: Awaited<ReturnType<typeof fixtureClaude>>) {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.PRIVATE_CANARY;
  await rm(fixture.directory, { recursive: true });
}
