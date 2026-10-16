import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  buildGuidedTargetConfiguration,
  guidedTargetConfigurationDigest,
  recognizeGuidedTargetConfiguration,
  TargetConfigurationError,
  type GuidedTargetConfigurationFiles,
  type GuidedTargetConfigurationInput,
} from "@ai-workspace/target-configuration";

export type TargetConfigurationRefs = Readonly<{
  profileRef: string;
  policyRef: string;
  instructionRefs: readonly string[];
}>;

const FILE_NAMES = Object.freeze({
  profile: "profile.json",
  policy: "policy.json",
  instructions: "instructions.json",
});
const DIGEST = /^[a-f0-9]{64}$/u;
const MAX_FILE_BYTES = 256 * 1_024;

/**
 * Guided configurations as immutable files (ADR-0052): one directory per
 * digest, never overwritten, so a target moves to new files only when its own
 * save succeeds and a reference always names the same content.
 */
export class LocalTargetConfigurationStore {
  readonly #root: string;

  public constructor(workspaceHome: string) {
    this.#root = join(resolve(workspaceHome), "target-configurations");
  }

  public async save(
    value: unknown,
  ): Promise<TargetConfigurationRefs & Readonly<{ digest: string }>> {
    const built = buildGuidedTargetConfiguration(value);
    const directory = join(this.#root, built.digest);
    try {
      for (const path of [this.#root, directory]) {
        await mkdir(path, { recursive: true, mode: 0o700 });
        if (!(await lstat(path)).isDirectory()) throw new Error();
        await chmod(path, 0o700);
      }
      for (const name of Object.keys(FILE_NAMES) as (keyof typeof FILE_NAMES)[])
        await keep(directory, name, built.files[name]);
    } catch (error) {
      if (error instanceof TargetConfigurationError) throw error;
      throw new TargetConfigurationError(
        "Cannot write the guided configuration. Check local workspace permissions, then retry.",
        { cause: error },
      );
    }
    return Object.freeze({ digest: built.digest, ...refs(directory) });
  }

  /** The guided fields of a target, or null when its files are not guided. */
  public async recognize(
    target: TargetConfigurationRefs,
  ): Promise<GuidedTargetConfigurationInput | null> {
    const digest = basename(dirname(target.profileRef));
    if (!DIGEST.test(digest)) return null;
    const expected = refs(join(this.#root, digest));
    if (
      target.profileRef !== expected.profileRef ||
      target.policyRef !== expected.policyRef ||
      target.instructionRefs.length !== 1 ||
      target.instructionRefs[0] !== expected.instructionRefs[0]
    )
      return null;
    try {
      const files: GuidedTargetConfigurationFiles = Object.freeze({
        profile: await readOwned(expected.profileRef),
        policy: await readOwned(expected.policyRef),
        instructions: await readOwned(expected.instructionRefs[0]!),
      });
      if (guidedTargetConfigurationDigest(files) !== digest) return null;
      return recognizeGuidedTargetConfiguration(files);
    } catch {
      return null;
    }
  }
}

function refs(directory: string): TargetConfigurationRefs {
  return Object.freeze({
    profileRef: join(directory, FILE_NAMES.profile),
    policyRef: join(directory, FILE_NAMES.policy),
    instructionRefs: Object.freeze([join(directory, FILE_NAMES.instructions)]),
  });
}

/** Keeps an identical file, refuses a different one, writes a missing one. */
async function keep(
  directory: string,
  name: keyof typeof FILE_NAMES,
  content: string,
) {
  const path = join(directory, FILE_NAMES[name]);
  const existing = await readOwned(path).catch((error: unknown) => {
    if (nodeError(error, "ENOENT")) return null;
    throw error;
  });
  if (existing === null) await publish(directory, name, content);
  if ((await readOwned(path)) !== content)
    throw new TargetConfigurationError(
      "A saved guided configuration file was changed outside AI Workspace. Nothing was overwritten; save the configuration with different values or restore the file.",
    );
}

async function publish(
  directory: string,
  name: keyof typeof FILE_NAMES,
  content: string,
) {
  // Unique and created exclusively by this call, so it is the only file the
  // failure path below may remove.
  const temporaryPath = join(
    directory,
    `.${FILE_NAMES[name]}.${randomUUID()}.tmp`,
  );
  const file = await open(temporaryPath, "wx", 0o600);
  try {
    try {
      await file.writeFile(content, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporaryPath, join(directory, FILE_NAMES[name]));
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

/** A regular file, readable by its owner only, within the read limit. */
async function readOwned(path: string): Promise<string> {
  const metadata = await lstat(path);
  if (
    !metadata.isFile() ||
    (metadata.mode & 0o077) !== 0 ||
    metadata.size < 1 ||
    metadata.size > MAX_FILE_BYTES
  )
    throw new TargetConfigurationError(
      "A guided configuration file is not a private regular file. Nothing was changed.",
    );
  return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path));
}

function nodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
