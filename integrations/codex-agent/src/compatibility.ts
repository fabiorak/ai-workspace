import {
  locateExecutable,
  qualifyExecutable,
  type ExecutableQualification,
  type QualifiedExecutable,
} from "@ai-workspace/agent-process";

/**
 * Reviewed installations only (ADR-0050). Each entry was checked without
 * running a task: `--version`, `--help` and `exec --help` in an empty
 * environment, then the complete `buildCodexAgentInvocation` argv followed by
 * `--help`, which validates every flag and value before printing help. Any
 * other release or file, including an automatic update, stays unavailable
 * until it is reviewed the same way and added with its file digest.
 */
export const QUALIFIED_CODEX_EXECUTABLES: readonly QualifiedExecutable[] =
  Object.freeze([
    // Standalone release 0.160.0, x86_64-unknown-linux-musl, static binary.
    Object.freeze({
      version: "0.160.0",
      sha256:
        "12eb3e81114588aca3b7998f4f19e8997b056aca08e57a7ca7c8a3ec8c652aad",
    }),
  ]);

/** `codex --version` prints one line such as `codex-cli 0.63.0`. */
export function parseCodexVersion(output: string): string | null {
  const match = /^codex-cli (\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\n?$/u.exec(
    output,
  );
  return match?.[1] ?? null;
}

/**
 * Locates and fixes the executable, then qualifies it against the reviewed
 * list. `versionOutput` comes from a separate, explicitly authorized reading;
 * this function starts nothing and reads no login.
 */
export async function qualifyCodexExecutable(
  searchPath: readonly string[],
  versionOutput: string | null,
  qualified: readonly QualifiedExecutable[] = QUALIFIED_CODEX_EXECUTABLES,
): Promise<ExecutableQualification> {
  return qualifyExecutable(
    await locateExecutable("codex", searchPath),
    versionOutput,
    parseCodexVersion,
    qualified,
  );
}
