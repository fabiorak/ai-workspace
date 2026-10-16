import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import {
  AgentConfinementError,
  privateDirectory,
  within,
  type ConfinedWorkspace,
} from "./workspace.ts";

export type AgentConfigVariable = "CODEX_HOME" | "CLAUDE_CONFIG_DIR";

/**
 * Fixed variables one product gets beyond the shared set. Claude Code's
 * documented switch turns off auto-update, telemetry, error reporting and
 * feature-flag fetches in every run AI Workspace starts (ADR-0050).
 */
const PRODUCT_VARIABLES: Readonly<
  Record<AgentConfigVariable, Readonly<Record<string, string>>>
> = Object.freeze({
  CODEX_HOME: Object.freeze({}),
  CLAUDE_CONFIG_DIR: Object.freeze({
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  }),
});

/**
 * The complete environment of an agent process. Nothing is inherited: no
 * provider key, proxy, certificate override or unrelated secret can cross,
 * because only the variables built here exist.
 */
export type AgentProcessEnvironment = Readonly<{
  workspace: ConfinedWorkspace;
  variables: Readonly<Record<string, string>>;
}>;

export type AgentEnvironmentInput = Readonly<{
  workspace: ConfinedWorkspace;
  configVariable: AgentConfigVariable;
  /**
   * A directory dedicated to this product's managed login, into which the
   * person logged in themselves. AI Workspace checks its metadata only and
   * never lists or reads what is inside.
   */
  configDirectory: string;
  /** Absolute directories searched for the executable and its interpreter. */
  searchPath: readonly string[];
}>;

export async function agentEnvironment(
  input: AgentEnvironmentInput,
): Promise<AgentProcessEnvironment> {
  const searchPath = input.searchPath.map((entry) => {
    if (
      !isAbsolute(entry) ||
      entry.includes(":") ||
      entry.includes("\0") ||
      /[\r\n]/u.test(entry)
    )
      throw new AgentConfinementError(
        "Every agent search path entry must be an absolute directory.",
      );
    return entry;
  });
  if (searchPath.length === 0 || searchPath.length > 16)
    throw new AgentConfinementError(
      "The agent search path needs one to sixteen directories.",
    );
  await verifyConfigDirectory(input.configDirectory, input.workspace);
  const home = input.workspace.home;
  return Object.freeze({
    workspace: input.workspace,
    variables: Object.freeze({
      PATH: searchPath.join(":"),
      HOME: home,
      [input.configVariable]: input.configDirectory,
      TMPDIR: input.workspace.tmp,
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      XDG_CONFIG_HOME: join(home, ".config"),
      XDG_CACHE_HOME: join(home, ".cache"),
      XDG_DATA_HOME: join(home, ".local", "share"),
      XDG_STATE_HOME: join(home, ".local", "state"),
      ...PRODUCT_VARIABLES[input.configVariable],
    }),
  });
}

/**
 * The dedicated login directory must be private and separate: not the
 * person's home, not the product's default directory in that home and not
 * inside the run. Only metadata is read.
 */
export async function verifyConfigDirectory(
  path: string,
  workspace: ConfinedWorkspace,
  personalHome: string = homedir(),
): Promise<void> {
  await privateDirectory(path, "The dedicated agent login directory");
  const defaults = [
    personalHome,
    join(personalHome, ".codex"),
    join(personalHome, ".claude"),
  ];
  if (defaults.includes(path) || within(workspace.run, path))
    throw new AgentConfinementError(
      "The agent login directory must be dedicated to AI Workspace, not the personal home or the product default.",
    );
}
