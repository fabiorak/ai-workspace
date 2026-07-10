import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";

import type {
  RepositoryInspection,
  RepositoryInspector,
} from "@ai-workspace/project-registry";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = 1024 * 1024;

export class RepositoryInspectionError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RepositoryInspectionError";
  }
}

export class GitRepositoryInspector implements RepositoryInspector {
  public async inspect(inputPath: string): Promise<RepositoryInspection> {
    const requestedPath = await canonicalDirectory(inputPath);
    const isBare = await runGit(requestedPath, [
      "rev-parse",
      "--is-bare-repository",
    ]);

    if (isBare === "true") {
      throw new RepositoryInspectionError(
        `Bare Git repositories are not supported: ${requestedPath}`,
      );
    }

    const rootOutput = await runGit(requestedPath, [
      "rev-parse",
      "--show-toplevel",
    ]);
    const canonicalPath = await canonicalDirectory(rootOutput);
    const [branch, headCommit, remoteUrl, statusOutput] = await Promise.all([
      runOptionalGit(
        canonicalPath,
        ["symbolic-ref", "--quiet", "--short", "HEAD"],
        [1],
      ),
      runOptionalGit(canonicalPath, ["rev-parse", "--verify", "HEAD"], [128]),
      runOptionalGit(
        canonicalPath,
        ["config", "--get", "remote.origin.url"],
        [1],
      ),
      runGit(canonicalPath, [
        "status",
        "--porcelain=v1",
        "--untracked-files=normal",
      ]),
    ]);

    return Object.freeze({
      canonicalPath,
      name: basename(canonicalPath),
      branch,
      headCommit,
      remoteUrl: sanitizeRemoteUrl(remoteUrl),
      isDirty: statusOutput.length > 0,
    });
  }
}

async function canonicalDirectory(inputPath: string): Promise<string> {
  if (inputPath.trim().length === 0) {
    throw new RepositoryInspectionError("Repository path must not be empty");
  }

  try {
    const canonicalPath = await realpath(inputPath);
    const details = await stat(canonicalPath);

    if (!details.isDirectory()) {
      throw new RepositoryInspectionError(
        `Repository path is not a directory: ${canonicalPath}`,
      );
    }

    return canonicalPath;
  } catch (error) {
    if (error instanceof RepositoryInspectionError) {
      throw error;
    }

    throw new RepositoryInspectionError(
      `Cannot access repository path: ${inputPath}`,
      { cause: error },
    );
  }
}

async function runGit(cwd: string, args: readonly string[]): Promise<string> {
  const result = await executeGit(cwd, args);

  if (result.exitCode !== 0) {
    throw new RepositoryInspectionError(
      `Git could not inspect '${cwd}': ${safeGitError(result.stderr)}`,
    );
  }

  return stripSingleLineEnding(result.stdout);
}

async function runOptionalGit(
  cwd: string,
  args: readonly string[],
  absentExitCodes: readonly number[],
): Promise<string | null> {
  const result = await executeGit(cwd, args);

  if (result.exitCode === 0) {
    const value = stripSingleLineEnding(result.stdout);
    return value.length === 0 ? null : value;
  }

  if (absentExitCodes.includes(result.exitCode)) {
    return null;
  }

  throw new RepositoryInspectionError(
    `Git could not inspect '${cwd}': ${safeGitError(result.stderr)}`,
  );
}

type GitExecutionResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

async function executeGit(
  cwd: string,
  args: readonly string[],
): Promise<GitExecutionResult> {
  try {
    const result = await execFileAsync(
      "git",
      ["-C", cwd, "-c", "core.fsmonitor=false", ...args],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_PAGER: "cat",
          GIT_TERMINAL_PROMPT: "0",
          LC_ALL: "C",
        },
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: 10_000,
        windowsHide: true,
      },
    );

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    if (typeof processError.code === "number") {
      return {
        exitCode: processError.code,
        stdout: processError.stdout ?? "",
        stderr: processError.stderr ?? "",
      };
    }

    throw new RepositoryInspectionError(
      "The Git executable is unavailable or could not be started",
      { cause: error },
    );
  }
}

function sanitizeRemoteUrl(remoteUrl: string | null): string | null {
  if (remoteUrl === null) {
    return null;
  }

  try {
    const parsed = new URL(remoteUrl);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      parsed.username = "";
      parsed.password = "";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }
  } catch {
    // SCP-style and local Git URLs are returned unchanged.
  }

  return remoteUrl;
}

function safeGitError(stderr: string): string {
  const firstLine = stderr.trim().split("\n", 1)[0];
  return firstLine === undefined || firstLine.length === 0
    ? "unknown Git error"
    : firstLine;
}

function stripSingleLineEnding(value: string): string {
  if (value.endsWith("\r\n")) {
    return value.slice(0, -2);
  }

  return value.endsWith("\n") ? value.slice(0, -1) : value;
}
