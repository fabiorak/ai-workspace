import {
  runAgentProcess,
  type AgentProcessEnvironment,
  type ExecutableIdentity,
} from "@ai-workspace/agent-process";

import type { CodexAgentRunner } from "./index.ts";

export type CodexAgentProcessRunnerOptions = Readonly<{
  /** Produced by qualifying the installed file; never a name looked up later. */
  executable: ExecutableIdentity;
  /** Built for one confined run, with CODEX_HOME at the dedicated login. */
  environment: AgentProcessEnvironment;
  terminationGraceMs?: number;
  closeGraceMs?: number;
}>;

/**
 * Creates the real process boundary without executing it (ADR-0050). The
 * runner starts the qualified file with argv and stdin only, in the confined
 * workspace, with the explicit environment. Authentication stays with the
 * installed Codex CLI inside the dedicated login directory.
 */
export function createCodexAgentProcessRunner(
  options: CodexAgentProcessRunnerOptions,
): CodexAgentRunner {
  if (!("CODEX_HOME" in options.environment.variables))
    throw new Error("The Codex environment needs its dedicated CODEX_HOME.");
  return (invocation) => {
    if (invocation.executable !== "codex")
      return Promise.reject(new Error("Only the Codex invocation can run."));
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
