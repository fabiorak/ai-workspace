import { createHash } from "node:crypto";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const MAX_EXECUTABLE_BYTES = 512 * 1024 * 1024;

/** One reviewed executable: its reported version and the digest of its file. */
export type QualifiedExecutable = Readonly<{
  version: string;
  sha256: string;
}>;

export type ExecutableIdentity = Readonly<{
  /** The canonical file that will be started, never a name for PATH lookup. */
  path: string;
  sha256: string;
}>;

export type ExecutableQualification =
  | Readonly<{
      kind: "QUALIFIED";
      identity: ExecutableIdentity;
      version: string;
    }>
  | Readonly<{
      kind: "NOT_QUALIFIED";
      reason:
        | "NOT_FOUND"
        | "UNSAFE_FILE"
        | "VERSION_UNREADABLE"
        | "VERSION_NOT_QUALIFIED"
        | "DIGEST_NOT_QUALIFIED";
    }>;

/**
 * Finds the first `name` on the given directories and fixes it to one
 * canonical file. It reads the file only to hash it and starts nothing.
 */
export async function locateExecutable(
  name: string,
  searchPath: readonly string[],
): Promise<ExecutableIdentity | "NOT_FOUND" | "UNSAFE_FILE"> {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(name)) return "UNSAFE_FILE";
  for (const directory of searchPath) {
    const candidate = join(directory, name);
    try {
      await lstat(candidate);
    } catch {
      continue;
    }
    try {
      const path = await realpath(candidate);
      const [file, parent] = await Promise.all([
        stat(path),
        stat(dirname(path)),
      ]);
      const uid = process.getuid?.();
      if (
        !file.isFile() ||
        (file.mode & 0o100) === 0 ||
        (file.mode & 0o022) !== 0 ||
        (parent.mode & 0o002) !== 0 ||
        (file.uid !== uid && file.uid !== 0) ||
        file.size > MAX_EXECUTABLE_BYTES
      )
        return "UNSAFE_FILE";
      return Object.freeze({ path, sha256: await fileDigest(path) });
    } catch {
      return "UNSAFE_FILE";
    }
  }
  return "NOT_FOUND";
}

/**
 * Pure. The version must parse and both the version and the file digest must
 * be on the reviewed list; a new release is unavailable until it is reviewed.
 */
export function qualifyExecutable(
  located: ExecutableIdentity | "NOT_FOUND" | "UNSAFE_FILE",
  versionOutput: string | null,
  parseVersion: (output: string) => string | null,
  qualified: readonly QualifiedExecutable[],
): ExecutableQualification {
  if (located === "NOT_FOUND" || located === "UNSAFE_FILE")
    return Object.freeze({ kind: "NOT_QUALIFIED", reason: located });
  const version =
    versionOutput === null || !versionOutput.isWellFormed()
      ? null
      : parseVersion(versionOutput);
  if (version === null)
    return Object.freeze({
      kind: "NOT_QUALIFIED",
      reason: "VERSION_UNREADABLE",
    });
  const reviewed = qualified.filter((entry) => entry.version === version);
  if (reviewed.length === 0)
    return Object.freeze({
      kind: "NOT_QUALIFIED",
      reason: "VERSION_NOT_QUALIFIED",
    });
  if (!reviewed.some((entry) => entry.sha256 === located.sha256))
    return Object.freeze({
      kind: "NOT_QUALIFIED",
      reason: "DIGEST_NOT_QUALIFIED",
    });
  return Object.freeze({ kind: "QUALIFIED", identity: located, version });
}

export async function fileDigest(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const hash = createHash("sha256");
    for await (const chunk of handle.createReadStream())
      hash.update(chunk as Buffer);
    return hash.digest("hex");
  } finally {
    await handle.close().catch(() => undefined);
  }
}
