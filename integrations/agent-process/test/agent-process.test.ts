import assert from "node:assert/strict";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  AgentConfinementError,
  AgentProcessError,
  agentEnvironment,
  createConfinedWorkspace,
  fileDigest,
  inspectConfinedWorkspace,
  locateExecutable,
  qualifyExecutable,
  releaseConfinedWorkspace,
  runAgentProcess,
  verifyConfigDirectory,
} from "../src/index.ts";

/**
 * Every process here is a synthetic Node script written into a mkdtemp root.
 * Only those roots are removed, and an escaped process is stopped by the PID
 * it wrote down, never by name.
 */
const roots: string[] = [];
const escaped: number[] = [];
afterEach(async () => {
  for (const pid of escaped.splice(0))
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function root() {
  const path = await mkdtemp(join(tmpdir(), "ai-workspace-agent-process-"));
  roots.push(path);
  return path;
}

async function fixture(body: string, name = "agent") {
  const base = await root();
  const bin = join(base, "bin");
  const login = join(base, "login");
  const runs = join(base, "runs");
  for (const path of [bin, login, runs]) await mkdir(path, { mode: 0o700 });
  const file = join(bin, name);
  await writeFile(file, `#!${process.execPath}\n${body}`, "utf8");
  await chmod(file, 0o700);
  const workspace = await createConfinedWorkspace(runs);
  const located = await locateExecutable(name, [bin]);
  if (typeof located === "string") throw new Error(located);
  const environment = await agentEnvironment({
    workspace,
    configVariable: "CODEX_HOME",
    configDirectory: login,
    searchPath: [bin, dirname(process.execPath)],
  });
  const run = (override: Partial<Parameters<typeof runAgentProcess>[0]> = {}) =>
    runAgentProcess({
      executable: located,
      args: ["--synthetic"],
      cwd: workspace.work,
      stdin: "Synthetic protected input",
      timeoutMs: 2_000,
      environment,
      terminationGraceMs: 20,
      closeGraceMs: 100,
      ...override,
    });
  return { base, bin, login, runs, file, workspace, located, run };
}

describe("confined agent workspace", () => {
  it("creates a private run tree and releases only what is empty", async () => {
    const base = await root();
    const runs = join(base, "runs");
    await mkdir(runs, { mode: 0o700 });
    const first = await createConfinedWorkspace(runs);
    const second = await createConfinedWorkspace(runs);
    assert.notEqual(first.run, second.run);
    for (const path of [first.run, first.home, first.work, first.tmp])
      assert.equal((await stat(path)).mode & 0o777, 0o700);
    assert.deepEqual(await inspectConfinedWorkspace(first), {
      workFiles: 0,
      tmpFiles: 0,
    });
    assert.equal(await releaseConfinedWorkspace(first), true);
    await assert.rejects(stat(first.run), { code: "ENOENT" });
    await writeFile(join(second.work, "left-behind.txt"), "kept\n");
    assert.equal(await releaseConfinedWorkspace(second), false);
    assert.equal(
      await readFile(join(second.work, "left-behind.txt"), "utf8"),
      "kept\n",
    );
  });

  /**
   * A product may create an empty working directory in `TMPDIR` on every run.
   * It holds no content, so it neither voids the answer nor keeps the run; a
   * file anywhere below it still does, and is never removed.
   */
  it("counts only files, at any depth, and releases empty directories", async () => {
    const base = await root();
    const runs = join(base, "runs");
    await mkdir(runs, { mode: 0o700 });
    const empty = await createConfinedWorkspace(runs);
    await mkdir(join(empty.tmp, "claude-1000", "nested"), { recursive: true });
    await mkdir(join(empty.home, ".cache"), { recursive: true });
    assert.deepEqual(await inspectConfinedWorkspace(empty), {
      workFiles: 0,
      tmpFiles: 0,
    });
    assert.equal(await releaseConfinedWorkspace(empty), true);
    await assert.rejects(stat(empty.run), { code: "ENOENT" });

    const written = await createConfinedWorkspace(runs);
    const deep = join(written.tmp, "claude-1000", "nested");
    await mkdir(deep, { recursive: true });
    await mkdir(join(written.tmp, "empty"));
    await writeFile(join(deep, "left-behind.txt"), "kept\n");
    await symlink(base, join(written.work, "link"));
    assert.deepEqual(await inspectConfinedWorkspace(written), {
      workFiles: 1,
      tmpFiles: 1,
    });
    assert.equal(await releaseConfinedWorkspace(written), false);
    assert.equal(
      await readFile(join(deep, "left-behind.txt"), "utf8"),
      "kept\n",
    );
    // The link is kept and was never followed; the empty sibling is gone.
    assert.equal(
      (await lstat(join(written.work, "link"))).isSymbolicLink(),
      true,
    );
    await assert.rejects(stat(join(written.tmp, "empty")), { code: "ENOENT" });
  });

  it("refuses a root that is shared, missing, relative or reached through a link", async () => {
    const base = await root();
    const open = join(base, "open");
    await mkdir(open, { mode: 0o755 });
    await chmod(open, 0o755);
    const real = join(base, "real");
    await mkdir(real, { mode: 0o700 });
    const link = join(base, "link");
    await symlink(real, link);
    for (const path of [open, link, join(base, "missing"), "relative/runs"])
      await assert.rejects(
        createConfinedWorkspace(path),
        AgentConfinementError,
        path,
      );
  });
});

describe("explicit agent environment", () => {
  it("carries only the variables it builds, whatever the parent holds", async () => {
    process.env.OPENAI_API_KEY = "must-not-cross";
    process.env.HTTPS_PROXY = "http://must-not-cross.invalid";
    try {
      const { run, workspace, login } = await fixture(`
const lines = [process.cwd(), ...Object.keys(process.env).sort().map((key) => key + "=" + process.env[key])];
process.stdout.write(lines.join("\\n") + "\\n");
`);
      const observed = await run();
      assert.equal(observed.exitCode, 0);
      const [cwd, ...variables] = observed.stdout.trim().split("\n");
      assert.equal(cwd, workspace.work);
      const names = variables.map((line) => line.split("=")[0]);
      assert.deepEqual(names, [
        "CODEX_HOME",
        "HOME",
        "LANG",
        "LC_ALL",
        "PATH",
        "TMPDIR",
        "XDG_CACHE_HOME",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "XDG_STATE_HOME",
      ]);
      assert.ok(variables.includes(`HOME=${workspace.home}`));
      assert.ok(variables.includes(`CODEX_HOME=${login}`));
      assert.ok(variables.includes(`TMPDIR=${workspace.tmp}`));
      assert.doesNotMatch(observed.stdout, /must-not-cross/u);
      assert.doesNotMatch(
        observed.stdout,
        new RegExp(`=${homedir()}(?:\\n|/)`, "u"),
      );
    } finally {
      delete process.env.OPENAI_API_KEY;
      delete process.env.HTTPS_PROXY;
    }
  });

  it("adds only Claude Code's fixed switch for nonessential traffic", async () => {
    const { workspace, login, bin } = await fixture("");
    const build = (configVariable: "CODEX_HOME" | "CLAUDE_CONFIG_DIR") =>
      agentEnvironment({
        workspace,
        configVariable,
        configDirectory: login,
        searchPath: [bin],
      });
    const claude = (await build("CLAUDE_CONFIG_DIR")).variables;
    const codex = (await build("CODEX_HOME")).variables;
    assert.equal(claude.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, "1");
    assert.equal(claude.CLAUDE_CONFIG_DIR, login);
    assert.equal("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC" in codex, false);
    assert.deepEqual(
      Object.keys(claude)
        .filter((name) => !(name in codex))
        .sort(),
      ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "CLAUDE_CONFIG_DIR"],
    );
  });

  it("refuses a login directory that is personal, shared or inside the run", async () => {
    const { workspace, login } = await fixture("");
    const personal = await root();
    await chmod(personal, 0o700);
    for (const name of [".codex", ".claude"])
      await mkdir(join(personal, name), { mode: 0o700 });
    for (const path of [
      personal,
      join(personal, ".codex"),
      join(personal, ".claude"),
    ])
      await assert.rejects(
        verifyConfigDirectory(path, workspace, personal),
        /dedicated to AI Workspace/u,
        path,
      );
    await assert.rejects(
      verifyConfigDirectory(workspace.home, workspace, personal),
      /dedicated to AI Workspace/u,
    );
    await chmod(login, 0o750);
    await assert.rejects(
      verifyConfigDirectory(login, workspace, personal),
      /private directory/u,
    );
    await chmod(login, 0o700);
    await verifyConfigDirectory(login, workspace, personal);
    assert.deepEqual(await readdir(login), []);
    await assert.rejects(
      agentEnvironment({
        workspace,
        configVariable: "CODEX_HOME",
        configDirectory: login,
        searchPath: ["relative/bin"],
      }),
      /absolute directory/u,
    );
  });
});

describe("executable qualification", () => {
  it("fixes one canonical file and qualifies only a reviewed version and digest", async () => {
    const { bin, file, located } = await fixture("", "codex");
    const alias = join(await root(), "alias");
    await mkdir(alias, { mode: 0o700 });
    await symlink(file, join(alias, "codex"));
    const viaLink = await locateExecutable("codex", [alias]);
    assert.deepEqual(viaLink, located);
    const digest = await fileDigest(file);
    const reviewed = [{ version: "0.63.0", sha256: digest }];
    const parse = (output: string) =>
      /^codex-cli (\d+\.\d+\.\d+)\n$/u.exec(output)?.[1] ?? null;
    const qualifyCodexExecutable = async (
      searchPath: readonly string[],
      output: string | null,
      list: readonly { version: string; sha256: string }[],
    ) =>
      qualifyExecutable(
        await locateExecutable("codex", searchPath),
        output,
        parse,
        list,
      );
    assert.deepEqual(
      await qualifyCodexExecutable([bin], "codex-cli 0.63.0\n", reviewed),
      { kind: "QUALIFIED", identity: located, version: "0.63.0" },
    );
    const refused = async (
      searchPath: readonly string[],
      output: string | null,
      list = reviewed,
    ) => {
      const result = await qualifyCodexExecutable(searchPath, output, list);
      return result.kind === "NOT_QUALIFIED" ? result.reason : result.kind;
    };
    assert.equal(
      await refused([bin], "codex-cli 0.64.0\n"),
      "VERSION_NOT_QUALIFIED",
    );
    assert.equal(await refused([bin], "garbage"), "VERSION_UNREADABLE");
    assert.equal(await refused([bin], null), "VERSION_UNREADABLE");
    assert.equal(
      await refused([bin], "codex-cli 0.63.0\n", [
        { version: "0.63.0", sha256: "0".repeat(64) },
      ]),
      "DIGEST_NOT_QUALIFIED",
    );
    assert.equal(
      await refused([join(bin, "missing")], "codex-cli 0.63.0\n"),
      "NOT_FOUND",
    );
    assert.equal(
      await refused([bin], "codex-cli 0.63.0\n", []),
      "VERSION_NOT_QUALIFIED",
    );
    await chmod(file, 0o722);
    assert.equal(await refused([bin], "codex-cli 0.63.0\n"), "UNSAFE_FILE");
  });

  it("never qualifies an unsafe or missing file", () => {
    assert.deepEqual(
      qualifyExecutable("UNSAFE_FILE", "x", () => "x", []),
      {
        kind: "NOT_QUALIFIED",
        reason: "UNSAFE_FILE",
      },
    );
    assert.deepEqual(
      qualifyExecutable("NOT_FOUND", "x", () => "x", []),
      {
        kind: "NOT_QUALIFIED",
        reason: "NOT_FOUND",
      },
    );
  });
});

describe("process-group runner", () => {
  it("starts nothing when the file changed after qualification or the directory is wrong", async () => {
    const { run, file, workspace } = await fixture("");
    const mark = join(dirname(workspace.run), "marker");
    await writeFile(
      file,
      `#!${process.execPath}\nrequire("node:fs").writeFileSync(${JSON.stringify(mark)}, "ran");\n`,
    );
    await assert.rejects(run(), /changed after it was qualified/u);
    await assert.rejects(stat(mark), { code: "ENOENT" });
    await assert.rejects(run({ cwd: workspace.home }), AgentProcessError);
  });

  it("kills a leader that ignores SIGTERM and proves the group is gone", async () => {
    const { run } = await fixture(`
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
`);
    const observed = await run({ timeoutMs: 50 });
    assert.equal(observed.timedOut, true);
    assert.equal(observed.processTreeTerminated, true);
    assert.equal(observed.lingeringProcesses, false);
    assert.equal(observed.exitCode, null);
  });

  it("marks and kills a descendant that outlives the leader holding its streams", async () => {
    const { run } = await fixture(`
const { spawn } = require("node:child_process");
spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"] }).unref();
process.stdout.write("leader done\\n");
`);
    const observed = await run();
    assert.equal(observed.exitCode, 0);
    assert.equal(observed.timedOut, false);
    assert.equal(observed.lingeringProcesses, true);
    assert.equal(observed.processTreeTerminated, true);
    assert.equal(observed.workspaceWritten, false);
  });

  it("marks a descendant that closed its streams but kept running", async () => {
    const { run } = await fixture(`
const { spawn } = require("node:child_process");
spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }).unref();
process.stdout.write("leader done\\n");
`);
    const observed = await run();
    assert.equal(observed.exitCode, 0);
    assert.equal(observed.lingeringProcesses, true);
    assert.equal(observed.processTreeTerminated, true);
  });

  it("cannot prove termination of a process that left the group, and says so", async () => {
    const base = await root();
    const pidFile = join(base, "escaped.pid");
    const { run } = await fixture(`
const { spawn } = require("node:child_process");
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: ["ignore", "inherit", "inherit"] });
require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
child.unref();
`);
    const observed = await run();
    const pid = Number(await readFile(pidFile, "utf8"));
    escaped.push(pid);
    assert.equal(observed.lingeringProcesses, true);
    assert.equal(observed.processTreeTerminated, false);
  });

  it("reports files written in the workspace, which an answer-only run must not leave", async () => {
    const { run, workspace } = await fixture(`
require("node:fs").writeFileSync("note.txt", "written");
process.stdout.write("done\\n");
`);
    const observed = await run();
    assert.equal(observed.exitCode, 0);
    assert.equal(observed.workspaceWritten, true);
    assert.equal(
      await readFile(join(workspace.work, "note.txt"), "utf8"),
      "written",
    );
  });

  it("does not count an empty working directory the product creates in TMPDIR", async () => {
    const { run } = await fixture(`
const { join } = require("node:path");
require("node:fs").mkdirSync(join(process.env.TMPDIR, "claude-1000", "nested"), { recursive: true });
process.stdout.write("done\\n");
`);
    const observed = await run();
    assert.equal(observed.exitCode, 0);
    assert.equal(observed.workspaceWritten, false);
  });

  it("delivers stdin, returns bounded clean streams and leaves nothing running", async () => {
    const { run } = await fixture(`
const input = require("node:fs").readFileSync(0, "utf8");
process.stdout.write(JSON.stringify({ length: input.length, args: process.argv.slice(2) }) + "\\n");
`);
    const observed = await run();
    assert.deepEqual(JSON.parse(observed.stdout), {
      length: "Synthetic protected input".length,
      args: ["--synthetic"],
    });
    assert.equal(observed.stderr, "");
    assert.equal(observed.lingeringProcesses, false);
    assert.equal(observed.workspaceWritten, false);
    assert.equal(observed.processTreeTerminated, false);
    assert.equal(observed.outputLimitExceeded, false);
  });
});
