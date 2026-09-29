import {
  locateExecutable,
  qualifyExecutable,
  type ExecutableQualification,
  type QualifiedExecutable,
} from "@ai-workspace/agent-process";

/**
 * Reviewed installations only (ADR-0050). It is empty on purpose. The current
 * CLI reference, read on 2026-09-28, documents most frozen flags but did not
 * show `--safe-mode`, `--setting-sources` or `--strict-mcp-config` in the part
 * that loaded, and names the retry event `system/api_retry`. Each flag must be
 * confirmed on the installed release before its digest is added here.
 */
export const QUALIFIED_CLAUDE_CODE_EXECUTABLES: readonly QualifiedExecutable[] =
  Object.freeze([]);

/** `claude --version` prints one line such as `2.1.283 (Claude Code)`. */
export function parseClaudeCodeVersion(output: string): string | null {
  const match = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?) \(Claude Code\)\n?$/u.exec(
    output,
  );
  return match?.[1] ?? null;
}

/** Starts nothing and reads no login; see `qualifyCodexExecutable`. */
export async function qualifyClaudeCodeExecutable(
  searchPath: readonly string[],
  versionOutput: string | null,
  qualified: readonly QualifiedExecutable[] = QUALIFIED_CLAUDE_CODE_EXECUTABLES,
): Promise<ExecutableQualification> {
  return qualifyExecutable(
    await locateExecutable("claude", searchPath),
    versionOutput,
    parseClaudeCodeVersion,
    qualified,
  );
}
