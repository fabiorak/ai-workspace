import {
  locateExecutable,
  qualifyExecutable,
  type ExecutableQualification,
  type QualifiedExecutable,
} from "@ai-workspace/agent-process";

/**
 * Reviewed installations only (ADR-0050). It is empty on purpose: the flags in
 * `buildCodexAgentInvocation` are frozen from 2026-07-22 evidence and no
 * installed release has been checked against them, so every real installation
 * is unavailable until one is reviewed and added with its file digest.
 */
export const QUALIFIED_CODEX_EXECUTABLES: readonly QualifiedExecutable[] =
  Object.freeze([]);

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
