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

/** Bounds the walk over what a run left behind; beyond it, count as written. */
const MAX_WALK_ENTRIES = 4096;
const MAX_WALK_DEPTH = 32;

/**
 * What the run left where it had no reason to write. Read-only. Only entries
 * that are not directories count: a product may create empty working
 * directories in `TMPDIR`, which hold no content (ADR-0050). Links are counted,
 * never followed.
 */
export async function inspectConfinedWorkspace(
  workspace: ConfinedWorkspace,
): Promise<Readonly<{ workFiles: number; tmpFiles: number }>> {
  const [workFiles, tmpFiles] = await Promise.all([
    countFiles(workspace.work),
    countFiles(workspace.tmp),
  ]);
  return Object.freeze({ workFiles, tmpFiles });
}

/**
 * Removes the run only where it is empty, one directory at a time and never
 * recursively. Empty directories the product created are removed from the
 * deepest up; a file is never removed, so anything left behind stays for
 * inspection.
 */
export async function releaseConfinedWorkspace(
  workspace: ConfinedWorkspace,
): Promise<boolean> {
  for (const path of [workspace.work, workspace.tmp, workspace.home])
    await removeEmptyDirectories(path, 0).catch(() => undefined);
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

async function countFiles(directory: string): Promise<number> {
  let files = 0;
  let seen = 0;
  const pending: Array<readonly [string, number]> = [[directory, 0]];
  while (pending.length > 0) {
    const [path, depth] = pending.pop()!;
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (++seen > MAX_WALK_ENTRIES) return files + 1;
      if (!entry.isDirectory()) files += 1;
      else if (depth >= MAX_WALK_DEPTH) return files + 1;
      else pending.push([join(path, entry.name), depth + 1]);
    }
  }
  return files;
}

/** Empties `directory` of empty subdirectories; never unlinks a file. */
async function removeEmptyDirectories(
  directory: string,
  depth: number,
): Promise<void> {
  if (depth > MAX_WALK_DEPTH) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    await removeEmptyDirectories(path, depth + 1);
    await rmdir(path).catch(() => undefined);
  }
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
