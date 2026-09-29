import {
  runAgentProcess,
  type AgentProcessEnvironment,
  type ExecutableIdentity,
} from "@ai-workspace/agent-process";

import type { ClaudeCodeAgentRunner } from "./index.ts";

export type ClaudeCodeAgentProcessRunnerOptions = Readonly<{
  /** Produced by qualifying the installed file; never a name looked up later. */
  executable: ExecutableIdentity;
  /** Built for one confined run, with CLAUDE_CONFIG_DIR at the dedicated login. */
  environment: AgentProcessEnvironment;
  terminationGraceMs?: number;
  closeGraceMs?: number;
}>;

/**
 * Creates the real process boundary without executing it (ADR-0050). The
 * runner starts the qualified file with argv and stdin only, in the confined
 * workspace, with the explicit environment. Authentication stays with the
 * installed Claude Code CLI inside the dedicated login directory.
 */
export function createClaudeCodeAgentProcessRunner(
  options: ClaudeCodeAgentProcessRunnerOptions,
): ClaudeCodeAgentRunner {
  if (!("CLAUDE_CONFIG_DIR" in options.environment.variables))
    throw new Error(
      "The Claude Code environment needs its dedicated CLAUDE_CONFIG_DIR.",
    );
  return (invocation) => {
    if (invocation.executable !== "claude")
      return Promise.reject(
        new Error("Only the Claude Code invocation can run."),
      );
    return runAgentProcess({
      executable: options.executable,
      args: invocation.args,
      cwd: invocation.cwd,
      stdin: invocation.stdin,
      timeoutMs: invocation.timeoutMs,
      environment: options.environment,
      ...(options.terminationGraceMs === undefined
        ? {}
        : { terminationGraceMs: options.terminationGraceMs }),
      ...(options.closeGraceMs === undefined
        ? {}
        : { closeGraceMs: options.closeGraceMs }),
    });
  };
}
