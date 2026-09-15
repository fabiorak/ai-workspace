import { randomUUID } from "node:crypto";
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
  ModelTargetConflictError,
  ModelTargetError,
  validateModelTargetConfiguration,
  type ModelTargetConfiguration,
  type ModelTargetStore,
} from "@ai-workspace/model-targets";

const MAX_DOCUMENT_BYTES = 256 * 1024;

export class JsonModelTargetStore implements ModelTargetStore {
  readonly #directory: string;
  readonly #path: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "model-targets");
    this.#path = join(this.#directory, "configuration.json");
  }

  public async load(): Promise<ModelTargetConfiguration> {
    try {
      const metadata = await stat(this.#path);
      if ((metadata.mode & 0o077) !== 0)
        throw new ModelTargetError(
          "Model target configuration permissions are unsafe.",
        );
      const content = await readFile(this.#path);
      if (content.byteLength > MAX_DOCUMENT_BYTES) throw new ModelTargetError();
      return validateModelTargetConfiguration(
        JSON.parse(content.toString("utf8")),
      );
    } catch (error) {
      if (nodeError(error, "ENOENT")) return emptyModelTargetConfiguration();
      if (error instanceof ModelTargetError) throw error;
      throw new ModelTargetError(
        "Cannot read local model target configuration.",
      );
    }
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
      const current = await this.load();
      if (current.revision !== expectedRevision)
        throw new ModelTargetConflictError();
      const validated = validateModelTargetConfiguration(configuration);
      if (validated.revision !== expectedRevision + 1)
        throw new ModelTargetConflictError();
      const content = `${JSON.stringify(validated, null, 2)}\n`;
      if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
        throw new ModelTargetError();
      const file = await open(temporaryPath, "wx", 0o600);
      try {
        await file.writeFile(content, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporaryPath, this.#path);
      await chmod(this.#path, 0o600);
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
}

function nodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
