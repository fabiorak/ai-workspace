import { spawn } from "node:child_process";

import type { AgentProcessEnvironment } from "./environment.ts";
import { fileDigest, type ExecutableIdentity } from "./executable.ts";
import { inspectConfinedWorkspace } from "./workspace.ts";

const MAX_STREAM_BYTES = 2 * 1024 * 1024;
const DEFAULT_TERMINATION_GRACE_MS = 100;
const DEFAULT_CLOSE_GRACE_MS = 500;

export type AgentProcessSpec = Readonly<{
  executable: ExecutableIdentity;
  args: readonly string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  environment: AgentProcessEnvironment;
  terminationGraceMs?: number;
  closeGraceMs?: number;
}>;

/**
 * Evidence about one run. The last two fields are after-the-fact checks: a
 * descendant still alive or holding the streams, and files left where an
 * answer-only run has no reason to write; empty directories are not files.
 * Either one voids the answer.
 */
export type AgentProcessObservation = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  processTreeTerminated: boolean;
  outputLimitExceeded: boolean;
  streamEncodingInvalid: boolean;
  lingeringProcesses: boolean;
  workspaceWritten: boolean;
}>;

export class AgentProcessError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentProcessError";
  }
}

/**
 * Starts the fixed file, never a name, with argv and no shell, inside the run
 * directory and with only the built environment. Throws before starting
 * anything when the file changed since qualification or the request is
 * outside its workspace.
 */
export async function runAgentProcess(
  spec: AgentProcessSpec,
): Promise<AgentProcessObservation> {
  const terminationGraceMs =
    spec.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
  const closeGraceMs = spec.closeGraceMs ?? DEFAULT_CLOSE_GRACE_MS;
  if (process.platform === "win32")
    throw new AgentProcessError(
      "Agent processes require POSIX process-group termination.",
    );
  if (
    !bounded(terminationGraceMs, 5_000) ||
    !bounded(closeGraceMs, 10_000) ||
    !bounded(spec.timeoutMs, 120_000)
  )
    throw new AgentProcessError("The agent process limits are invalid.");
  if (spec.cwd !== spec.environment.workspace.work)
    throw new AgentProcessError(
      "The agent process must run in its confined workspace.",
    );
  if ((await fileDigest(spec.executable.path)) !== spec.executable.sha256)
    throw new AgentProcessError(
      "The agent executable changed after it was qualified.",
    );
  const child = spawn(spec.executable.path, spec.args, {
    cwd: spec.cwd,
    detached: true,
    env: { ...spec.environment.variables },
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pid = child.pid;
  const stdout = new BoundedBytes();
  const stderr = new BoundedBytes();
  let timedOut = false;
  let lingering = false;
  let termination: Promise<boolean> | undefined;
  const terminate = () => {
    termination ??= terminateProcessGroup(pid, terminationGraceMs);
    return termination;
  };
  child.stdout.on("data", (chunk: Buffer) => {
    if (!stdout.append(chunk)) void terminate();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (!stderr.append(chunk)) void terminate();
  });
  child.stdin.on("error", () => undefined);

  let exitCode: number | null = null;
  let exited = false;
  let spawnError: unknown;
  const closed = new Promise<void>((resolve) => child.once("close", resolve));
  const failed = new Promise<void>((resolve) =>
    child.once("error", (error) => {
      spawnError = error;
      resolve();
    }),
  );
  const leaderSettled = new Promise<void>((resolve) =>
    child.once("exit", (code) => {
      exited = true;
      exitCode = code;
      // The leader can exit while a descendant keeps the streams open.
      setTimeout(resolve, closeGraceMs).unref();
    }),
  );
  let signalTimeout!: () => void;
  const timeoutFired = new Promise<void>((resolve) => {
    signalTimeout = resolve;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    void terminate();
    signalTimeout();
  }, spec.timeoutMs);
  timer.unref();
  child.stdin.end(spec.stdin, "utf8");

  await Promise.race([closed, failed, leaderSettled, timeoutFired]);
  if (spawnError !== undefined) {
    clearTimeout(timer);
    throw new AgentProcessError("The agent process could not be started.");
  }
  let streamsHeldOpen = false;
  if (!(await settles(closed, 0))) {
    if (!timedOut) lingering = true;
    await terminate();
    if (!(await settles(closed, closeGraceMs))) {
      // Something outside the process group still holds the streams.
      streamsHeldOpen = true;
      child.stdout.destroy();
      child.stderr.destroy();
      child.stdin.destroy();
    }
  }
  clearTimeout(timer);
  // Stream closure proves nothing about descendants that closed their own.
  if (pid !== undefined && groupExists(pid)) {
    lingering = true;
    await terminate();
  }
  const groupTerminated = termination === undefined ? false : await termination;
  const workspace = await inspectConfinedWorkspace(
    spec.environment.workspace,
  ).catch(() => ({ workFiles: 1, tmpFiles: 1 }));
  const stdoutText = stdout.decode();
  const stderrText = stderr.decode();
  return Object.freeze({
    stdout: stdoutText.text,
    stderr: stderrText.text,
    exitCode: exited ? exitCode : null,
    timedOut,
    processTreeTerminated: groupTerminated && !streamsHeldOpen,
    outputLimitExceeded: stdout.exceeded || stderr.exceeded,
    streamEncodingInvalid: !stdoutText.valid || !stderrText.valid,
    lingeringProcesses: lingering || streamsHeldOpen,
    workspaceWritten: workspace.workFiles + workspace.tmpFiles > 0,
  });
}

class BoundedBytes {
  readonly #chunks: Buffer[] = [];
  #bytes = 0;
  public exceeded = false;

  public append(chunk: Buffer): boolean {
    const remaining = MAX_STREAM_BYTES - this.#bytes;
    if (chunk.byteLength > remaining) {
      if (remaining > 0) this.#chunks.push(chunk.subarray(0, remaining));
      this.#bytes = MAX_STREAM_BYTES;
      this.exceeded = true;
      return false;
    }
    this.#chunks.push(chunk);
    this.#bytes += chunk.byteLength;
    return true;
  }

  public decode(): { text: string; valid: boolean } {
    try {
      return {
        text: new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.concat(this.#chunks, this.#bytes),
        ),
        valid: true,
      };
    } catch {
      return { text: "", valid: false };
    }
  }
}

/** SIGTERM, a grace period, SIGKILL, then proof that the group is gone. */
async function terminateProcessGroup(
  pid: number | undefined,
  graceMs: number,
): Promise<boolean> {
  if (pid === undefined) return false;
  signalGroup(pid, "SIGTERM");
  await wait(graceMs);
  signalGroup(pid, "SIGKILL");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!groupExists(pid)) return true;
    await wait(10);
  }
  return !groupExists(pid);
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (!isNoSuchProcess(error)) throw error;
  }
}

function groupExists(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (isNoSuchProcess(error)) return false;
    throw error;
  }
}

async function settles(promise: Promise<void>, ms: number): Promise<boolean> {
  let done = false;
  await Promise.race([promise.then(() => (done = true)), wait(ms)]);
  return done;
}

const bounded = (value: number, maximum: number) =>
  Number.isInteger(value) && value >= 1 && value <= maximum;
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const isNoSuchProcess = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ESRCH";
