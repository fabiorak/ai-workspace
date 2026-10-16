import {
  locateExecutable,
  qualifyExecutable,
  type ExecutableQualification,
  type QualifiedExecutable,
} from "@ai-workspace/agent-process";

/**
 * Reviewed installations only (ADR-0050). Each entry was checked without
 * running a task: `--version` and `--help` in an empty environment with a
 * temporary `HOME` and `CLAUDE_CONFIG_DIR`, then the complete
 * `buildClaudeCodeAgentInvocation` argv followed by `--help`, which validates
 * every flag and choice before printing help. Any other release or file,
 * including an automatic update, stays unavailable until it is reviewed the
 * same way and added with its file digest.
 */
export const QUALIFIED_CLAUDE_CODE_EXECUTABLES: readonly QualifiedExecutable[] =
  Object.freeze([
    // Native release 2.1.294, linux x64, dynamically linked ELF.
    Object.freeze({
      version: "2.1.294",
      sha256:
        "27122ca7b624f537546fbef35b80c66370d974ff258f3d9b10ac50bb8771f262",
    }),
  ]);

/**
 * Built-in plugins a reviewed release loads even in safe mode, by name, as its
 * initialization event lists them with nonessential traffic off, with and
 * without a signed-in account. No flag turns them off; the release digest
 * covers them, and any other plugin still voids the answer (ADR-0050).
 */
export const CLAUDE_CODE_BUILT_IN_PLUGINS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  "2.1.294": Object.freeze([
    "cc-plugin-agents-md",
    "cc-plugin-plugin-authoring",
    "cc-plugin-sec-default",
  ]),
});

/** The reviewed built-in plugins of one release; none for any other. */
export function claudeCodeBuiltInPlugins(version: string): readonly string[] {
  return Object.hasOwn(CLAUDE_CODE_BUILT_IN_PLUGINS, version)
    ? CLAUDE_CODE_BUILT_IN_PLUGINS[version]!
    : Object.freeze([]);
}

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
