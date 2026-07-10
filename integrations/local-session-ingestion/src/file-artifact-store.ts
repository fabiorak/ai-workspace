import { createHash, randomUUID } from "node:crypto";
import { chmod, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  SessionImportError,
  type ArtifactReference,
  type ArtifactStore,
} from "@ai-workspace/session-ingestion";

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

export class FileArtifactStore implements ArtifactStore {
  readonly #artifactDirectory: string;
  readonly #rootDirectory: string;

  public constructor(workspaceHome: string) {
    this.#artifactDirectory = join(workspaceHome, "artifacts");
    this.#rootDirectory = join(this.#artifactDirectory, "sha256");
  }

  public async put(content: Uint8Array): Promise<ArtifactReference> {
    if (content.byteLength > MAX_ARTIFACT_BYTES) {
      throw new SessionImportError(
        `Artifact exceeds the ${MAX_ARTIFACT_BYTES} byte limit`,
      );
    }

    const digest = sha256(content);
    const directory = join(this.#rootDirectory, digest.slice(0, 2));
    const artifactPath = join(directory, digest);
    const temporaryPath = join(directory, `.${digest}.${randomUUID()}.tmp`);

    try {
      await mkdir(this.#artifactDirectory, { recursive: true, mode: 0o700 });
      await chmod(this.#artifactDirectory, 0o700);
      await mkdir(this.#rootDirectory, { recursive: true, mode: 0o700 });
      await chmod(this.#rootDirectory, 0o700);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      await writeFile(temporaryPath, content, { flag: "wx", mode: 0o600 });

      try {
        await link(temporaryPath, artifactPath);
        await chmod(artifactPath, 0o600);
      } catch (error) {
        if (!isNodeError(error) || error.code !== "EEXIST") {
          throw error;
        }

        const existing = await readFile(artifactPath);

        if (sha256(existing) !== digest || !existing.equals(content)) {
          throw new SessionImportError(
            `Artifact integrity check failed for sha256:${digest}`,
          );
        }
      }

      return Object.freeze({
        id: `artifact://sha256/${digest}`,
        byteLength: content.byteLength,
      });
    } catch (error) {
      if (error instanceof SessionImportError) {
        throw error;
      }

      throw new SessionImportError("Cannot write the local artifact", {
        cause: error,
      });
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
