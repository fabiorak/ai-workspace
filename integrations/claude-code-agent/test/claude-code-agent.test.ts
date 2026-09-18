import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  CLAUDE_CODE_ANSWER_SCHEMA,
  CLAUDE_CODE_DEFAULT_MODEL,
  CLAUDE_CODE_SYSTEM_PROMPT,
  ClaudeCodeAgentAdapter,
  buildClaudeCodeAgentInvocation,
  createClaudeCodeAgentProcessRunner,
  type ClaudeCodeAgentObservation,
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
const answered = (text: string) =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    result: JSON.stringify({ answer: text }),
  });
const said = (text: string) =>
  JSON.stringify({ type: "assistant", content: [{ type: "text", text }] });

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
      "--tools",
      "",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      CLAUDE_CODE_ANSWER_SCHEMA,
      "--system-prompt",
      CLAUDE_CODE_SYSTEM_PROMPT,
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--permission-mode",
      "dontAsk",
      "--max-budget-usd",
      "0.05",
      "--model",
      "sonnet",
    ]);
    assert.equal(CLAUDE_CODE_DEFAULT_MODEL, "sonnet");
    assert.equal(value.args.includes("--bare"), false);
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

  it("accepts one schema-valid answer and returns only bounded evidence", async () => {
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
   * Anything the turn loaded or did besides answering is context this boundary
   * did not review, so it is refused rather than reported as a plain answer.
   */
  it("fails closed for tools, loaded context, retries and malformed evidence", async () => {
    const cases = [
      observation({
        stdout: `${init()}\n${JSON.stringify({
          type: "assistant",
          content: [{ type: "tool_use", name: "synthetic" }],
        })}\n${answered("answer")}\n`,
      }),
      observation({
        stdout: `${init({ mcp_servers: [{ name: "synthetic" }] })}\n${answered("answer")}\n`,
      }),
      observation({
        stdout: `${init({ plugins: [{ name: "synthetic" }] })}\n${answered("answer")}\n`,
      }),
      observation({
        stdout: `${init({ memory: [{ name: "synthetic" }] })}\n${answered("answer")}\n`,
      }),
      observation({
        stdout: `${init()}\n${JSON.stringify({ type: "retry", attempt: 2 })}\n${answered("answer")}\n`,
      }),
      observation({
        stdout: `${init()}\n${answered("one")}\n${answered("two")}\n`,
      }),
      observation({ stdout: `${init()}\n${said("Synthetic output.")}\n` }),
      observation({ stdout: `${answered("answer")}\n` }),
      observation({ stdout: `${init()}\n${init()}\n${answered("answer")}\n` }),
      observation({
        stdout: `${init()}\n${JSON.stringify({ type: "unreviewed.event" })}\n${answered("answer")}\n`,
      }),
      observation({
        stdout: `${init()}\n${JSON.stringify({
          type: "result",
          subtype: "success",
          result: "A sentence instead of the schema-valid object.",
        })}\n`,
      }),
      observation({
        stdout: `${init()}\n${JSON.stringify({
          type: "result",
          subtype: "success",
          result: JSON.stringify({ answer: "answer", note: "extra" }),
        })}\n`,
      }),
      observation({
        stdout: `${init()}\n${JSON.stringify({
          type: "result",
          subtype: "error_during_execution",
          result: JSON.stringify({ answer: "answer" }),
        })}\n`,
      }),
      observation({ stdout: "not-json\n" }),
      observation({ exitCode: 1 }),
      observation({ outputLimitExceeded: true }),
      observation({ streamEncodingInvalid: true }),
    ];
    for (const value of cases)
      assert.deepEqual(
        await new ClaudeCodeAgentAdapter(async () => value).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION" },
        value.stdout,
      );
  });

  it("requires verified process-tree termination on timeout", async () => {
    for (const value of [
      observation({
        stdout: "",
        timedOut: true,
        processTreeTerminated: true,
        exitCode: null,
      }),
      observation({ stdout: "", timedOut: true, exitCode: null }),
    ])
      assert.deepEqual(
        await new ClaudeCodeAgentAdapter(async () => value).execute(input),
        { kind: "UNKNOWN_AFTER_EXECUTION" },
      );
  });

  it("keeps an unknown outcome when the runner itself fails", async () => {
    assert.deepEqual(
      await new ClaudeCodeAgentAdapter(async () => {
        throw new Error("Synthetic spawn failure.");
      }).execute(input),
      { kind: "UNKNOWN_AFTER_EXECUTION" },
    );
  });

  it("runs without a shell and forwards only the managed-login environment", async () => {
    const fixture = await fixtureClaude(`
const input = require("node:fs").readFileSync(0, "utf8");
const text = [Boolean(process.env.ANTHROPIC_API_KEY), Boolean(process.env.PRIVATE_CANARY), input.length].join(":");
process.stdout.write(JSON.stringify({type:"system",subtype:"init",tools:[],mcp_servers:[],plugins:[],hooks:[],skills:[],memory:[]}) + "\\n");
process.stdout.write(JSON.stringify({type:"result",subtype:"success",result:JSON.stringify({answer:text})}) + "\\n");
`);
    try {
      const runner = createClaudeCodeAgentProcessRunner({
        environment: {
          PATH: fixture.directory,
          HOME: fixture.directory,
          ANTHROPIC_API_KEY: "must-not-cross",
          PRIVATE_CANARY: "must-not-cross",
        },
      });
      const request = { ...input, isolatedWorkspace: fixture.directory };
      const observed = await runner({
        ...buildClaudeCodeAgentInvocation(request),
        executable: fixture.executable as "claude",
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
      await rm(fixture.directory, { recursive: true });
    }
  });

  it("terminates the isolated process group on timeout", async () => {
    const fixture = await fixtureClaude("setInterval(() => {}, 1000);\n");
    try {
      const runner = createClaudeCodeAgentProcessRunner({
        environment: { PATH: fixture.directory, HOME: fixture.directory },
        terminationGraceMs: 10,
      });
      const value = await runner({
        ...buildClaudeCodeAgentInvocation({
          ...input,
          isolatedWorkspace: fixture.directory,
          timeoutMs: 20,
        }),
        executable: fixture.executable as "claude",
      });
      assert.equal(value.timedOut, true);
      assert.equal(value.processTreeTerminated, true);
    } finally {
      await rm(fixture.directory, { recursive: true });
    }
  });

  it("bounds streamed output before terminating the process group", async () => {
    const fixture = await fixtureClaude(`
process.stdout.write("x".repeat(2 * 1024 * 1024 + 1));
setInterval(() => {}, 1000);
`);
    try {
      const runner = createClaudeCodeAgentProcessRunner({
        environment: { PATH: fixture.directory, HOME: fixture.directory },
        terminationGraceMs: 10,
      });
      const value = await runner({
        ...buildClaudeCodeAgentInvocation({
          ...input,
          isolatedWorkspace: fixture.directory,
          timeoutMs: 1_000,
        }),
        executable: fixture.executable as "claude",
      });
      assert.equal(value.outputLimitExceeded, true);
      assert.equal(value.processTreeTerminated, true);
      assert.ok(Buffer.byteLength(value.stdout, "utf8") <= 2 * 1024 * 1024);
    } finally {
      await rm(fixture.directory, { recursive: true });
    }
  });
});

async function fixtureClaude(
  body: string,
): Promise<{ directory: string; executable: string }> {
  const directory = await mkdtemp(
    join(tmpdir(), "ai-workspace-claude-code-runner-"),
  );
  const executable = join(directory, "claude");
  await writeFile(executable, `#!${process.execPath}\n${body}`, "utf8");
  await chmod(executable, 0o700);
  return { directory, executable };
}
