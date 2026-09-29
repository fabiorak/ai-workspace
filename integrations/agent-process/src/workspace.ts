import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rmdir,
} from "node:fs/promises";
import { isAbsolute, join, sep } from "node:path";

export class AgentConfinementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AgentConfinementError";
  }
}

/**
 * A fresh, private directory tree for one agent run (ADR-0050). The process
 * gets `work` as its working directory, `home` as HOME and `tmp` as TMPDIR.
 * Nothing in it is a link, and nothing is shared with another run.
 */
export type ConfinedWorkspace = Readonly<{
  run: string;
  home: string;
  work: string;
  tmp: string;
}>;

/**
 * `root` must already exist, be a real private directory of this account and
 * contain no link on its path. Each run gets a new directory under it.
 */
export async function createConfinedWorkspace(
  root: string,
): Promise<ConfinedWorkspace> {
  await privateDirectory(root, "The agent workspace root");
  const run = await mkdtemp(join(root, "run-"));
  await privateDirectory(run, "The agent run directory");
  const tree = {
    run,
    home: join(run, "home"),
    work: join(run, "work"),
    tmp: join(run, "tmp"),
  };
  for (const path of [tree.home, tree.work, tree.tmp]) {
    await mkdir(path, { mode: 0o700 });
    await privateDirectory(path, "An agent workspace directory");
  }
  return Object.freeze(tree);
}

/** What the run left where it had no reason to write. Read-only. */
export async function inspectConfinedWorkspace(
  workspace: ConfinedWorkspace,
): Promise<Readonly<{ workEntries: number; tmpEntries: number }>> {
  const [work, tmp] = await Promise.all([
    readdir(workspace.work),
    readdir(workspace.tmp),
  ]);
  return Object.freeze({ workEntries: work.length, tmpEntries: tmp.length });
}

/**
 * Removes the run only where it is empty, one directory at a time and never
 * recursively. Anything the product left behind stays for inspection.
 */
export async function releaseConfinedWorkspace(
  workspace: ConfinedWorkspace,
): Promise<boolean> {
  let released = true;
  for (const path of [
    workspace.work,
    workspace.tmp,
    workspace.home,
    workspace.run,
  ])
    try {
      await rmdir(path);
    } catch {
      released = false;
    }
  return released;
}

/** Private, owned, not a link, and its canonical path is the path given. */
export async function privateDirectory(path: string, label: string) {
  if (!isAbsolute(path) || path.includes("\0") || path.endsWith(sep))
    throw new AgentConfinementError(`${label} must be an absolute path.`);
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    throw new AgentConfinementError(`${label} does not exist.`);
  }
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== process.getuid?.() ||
    (metadata.mode & 0o077) !== 0
  )
    throw new AgentConfinementError(
      `${label} must be a private directory owned by this account.`,
    );
  if ((await realpath(path)) !== path)
    throw new AgentConfinementError(`${label} must not pass through a link.`);
}

/** True when `path` is `parent` or lies inside it. */
export function within(parent: string, path: string): boolean {
  return path === parent || path.startsWith(`${parent}${sep}`);
}
