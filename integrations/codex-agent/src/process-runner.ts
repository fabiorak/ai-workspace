import { spawn } from "node:child_process";

import type {
  CodexAgentInvocation,
  CodexAgentObservation,
  CodexAgentRunner,
} from "./index.ts";

const MAX_STREAM_BYTES = 2 * 1024 * 1024;
const DEFAULT_TERMINATION_GRACE_MS = 100;
const ENVIRONMENT_ALLOWLIST = Object.freeze([
  "CODEX_HOME",
  "HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "PATH",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "TMPDIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
] as const);

export type CodexAgentProcessRunnerOptions = Readonly<{
  environment?: NodeJS.ProcessEnv;
  terminationGraceMs?: number;
}>;

/**
 * Creates the real process boundary without executing it. The returned runner
 * uses argv directly, sends the request on stdin, bounds both output streams,
 * and never forwards API keys. Authentication remains owned by the installed
 * Codex CLI and its managed-login storage.
 */
export function createCodexAgentProcessRunner(
  options: CodexAgentProcessRunnerOptions = {},
): CodexAgentRunner {
  const environment = allowedEnvironment(options.environment ?? process.env);
  const terminationGraceMs =
    options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
  if (
    !Number.isInteger(terminationGraceMs) ||
    terminationGraceMs < 1 ||
    terminationGraceMs > 5_000
  )
    throw new Error("The Codex process termination grace period is invalid.");
  if (process.platform === "win32")
    throw new Error(
      "The Codex process runner requires POSIX process-group termination.",
    );
  return (invocation) =>
    runCodexProcess(invocation, environment, terminationGraceMs);
}

function allowedEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const name of ENVIRONMENT_ALLOWLIST) {
    const value = source[name];
    if (value !== undefined && !value.includes("\0")) result[name] = value;
  }
  return result;
}

async function runCodexProcess(
  invocation: CodexAgentInvocation,
  environment: NodeJS.ProcessEnv,
  terminationGraceMs: number,
): Promise<CodexAgentObservation> {
  const child = spawn(invocation.executable, invocation.args, {
    cwd: invocation.cwd,
    detached: true,
    env: environment,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout = new BoundedBytes();
  const stderr = new BoundedBytes();
  let timedOut = false;
  let termination: Promise<boolean> | undefined;
  const terminate = () => {
    termination ??= terminateProcessGroup(child.pid, terminationGraceMs);
  };
  child.stdout.on("data", (chunk: Buffer) => {
    if (!stdout.append(chunk)) terminate();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (!stderr.append(chunk)) terminate();
  });
  const timer = setTimeout(() => {
    timedOut = true;
    terminate();
  }, invocation.timeoutMs);
  timer.unref();
  child.stdin.on("error", () => undefined);
  child.stdin.end(invocation.stdin, "utf8");

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code));
  }).finally(() => clearTimeout(timer));
  const processTreeTerminated =
    termination === undefined ? false : await termination;
  const stdoutText = stdout.decode();
  const stderrText = stderr.decode();
  return Object.freeze({
    stdout: stdoutText.text,
    stderr: stderrText.text,
    exitCode,
    timedOut,
    processTreeTerminated,
    outputLimitExceeded: stdout.exceeded || stderr.exceeded,
    streamEncodingInvalid: !stdoutText.valid || !stderrText.valid,
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

async function terminateProcessGroup(
  pid: number | undefined,
  graceMs: number,
): Promise<boolean> {
  if (pid === undefined) return false;
  signalGroup(pid, "SIGTERM");
  await delay(graceMs);
  signalGroup(pid, "SIGKILL");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!groupExists(pid)) return true;
    await delay(10);
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

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const isNoSuchProcess = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ESRCH";
