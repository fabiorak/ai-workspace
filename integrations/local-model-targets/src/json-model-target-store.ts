import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";

import {
  emptyModelTargetConfiguration,
  LEGACY_MODEL_TARGET_CONFIGURATION_VERSION,
  ModelTargetConflictError,
  ModelTargetError,
  readModelTargetConfiguration,
  validateModelTargetConfiguration,
  type ModelTargetConfiguration,
  type ModelTargetStore,
} from "@ai-workspace/model-targets";

const MAX_DOCUMENT_BYTES = 256 * 1024;

type StoredConfiguration = Readonly<{
  configuration: ModelTargetConfiguration;
  /** The exact bytes of a v1 document, kept until it has been preserved. */
  legacy: Buffer | null;
}>;

export class JsonModelTargetStore implements ModelTargetStore {
  readonly #directory: string;
  readonly #path: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "model-targets");
    this.#path = join(this.#directory, "configuration.json");
  }

  public async load(): Promise<ModelTargetConfiguration> {
    return (await this.#read()).configuration;
  }

  public async replace(
    expectedRevision: number,
    configuration: ModelTargetConfiguration,
  ) {
    const lockPath = `${this.#path}.lock`;
    const temporaryPath = `${this.#path}.${randomUUID()}.tmp`;
    const ownerToken = randomUUID();
    let ownsLock = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      try {
        const lock = await open(lockPath, "wx", 0o600);
        ownsLock = true;
        try {
          await lock.writeFile(`${ownerToken}\n`, "utf8");
          await lock.sync();
        } finally {
          await lock.close();
        }
      } catch (error) {
        if (nodeError(error, "EEXIST")) throw new ModelTargetConflictError();
        throw error;
      }
      const current = await this.#read();
      if (current.configuration.revision !== expectedRevision)
        throw new ModelTargetConflictError();
      const validated = validateModelTargetConfiguration(configuration);
      if (validated.revision !== expectedRevision + 1)
        throw new ModelTargetConflictError();
      const content = `${JSON.stringify(validated, null, 2)}\n`;
      if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
        throw new ModelTargetError();
      if (current.legacy !== null)
        await this.#preserveLegacy(current.legacy, temporaryPath);
      await publish(temporaryPath, this.#path, content);
      return validated;
    } catch (error) {
      if (error instanceof ModelTargetError) throw error;
      throw new ModelTargetError(
        "Cannot write local model target configuration.",
      );
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      if (ownsLock) {
        const observed = await readFile(lockPath, "utf8").catch(() => "");
        if (observed === `${ownerToken}\n`)
          await rm(lockPath, { force: true }).catch(() => undefined);
      }
    }
  }

  async #read(): Promise<StoredConfiguration> {
    try {
      const metadata = await stat(this.#path);
      if ((metadata.mode & 0o077) !== 0)
        throw new ModelTargetError(
          "Model target configuration permissions are unsafe.",
        );
      const content = await readFile(this.#path);
      if (content.byteLength > MAX_DOCUMENT_BYTES) throw new ModelTargetError();
      const parsed: unknown = JSON.parse(content.toString("utf8"));
      return Object.freeze({
        configuration: readModelTargetConfiguration(parsed),
        legacy:
          typeof parsed === "object" &&
          parsed !== null &&
          "schemaVersion" in parsed &&
          parsed.schemaVersion === LEGACY_MODEL_TARGET_CONFIGURATION_VERSION
            ? content
            : null,
      });
    } catch (error) {
      if (nodeError(error, "ENOENT"))
        return Object.freeze({
          configuration: emptyModelTargetConfiguration(),
          legacy: null,
        });
      if (error instanceof ModelTargetError) throw error;
      throw new ModelTargetError(
        "Cannot read local model target configuration.",
      );
    }
  }

  /**
   * Keeps the v1 bytes, verified, before v2 replaces them. The name carries
   * their digest, so an interrupted migration finds its own copy and reuses it;
   * a different file under that name is never overwritten and stops the write.
   */
  async #preserveLegacy(legacy: Buffer, temporaryPath: string) {
    const digest = createHash("sha256").update(legacy).digest("hex");
    const backupPath = join(this.#directory, `configuration.v1-${digest}.json`);
    const existing = await readFile(backupPath).catch((error: unknown) => {
      if (nodeError(error, "ENOENT")) return null;
      throw error;
    });
    if (existing === null) await publish(temporaryPath, backupPath, legacy);
    const preserved = await readFile(backupPath);
    if (!preserved.equals(legacy))
      throw new ModelTargetError(
        "A preserved earlier model target configuration does not match. Nothing was changed.",
      );
  }
}

async function publish(
  temporaryPath: string,
  path: string,
  content: string | Buffer,
) {
  const file = await open(temporaryPath, "wx", 0o600);
  try {
    await file.writeFile(content);
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

function nodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
