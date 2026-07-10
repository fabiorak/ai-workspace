import { createHash, randomUUID } from "node:crypto";
import { chmod, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ArtifactResolver } from "@ai-workspace/historical-search";
import {
  SessionImportError,
  type ArtifactReference,
  type ArtifactStore,
} from "@ai-workspace/session-ingestion";

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

const ARTIFACT_ID_PATTERN = /^artifact:\/\/sha256\/([a-f0-9]{64})$/u;

export class FileArtifactStore implements ArtifactStore, ArtifactResolver {
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

  public async read(artifactId: string): Promise<Uint8Array> {
    const match = ARTIFACT_ID_PATTERN.exec(artifactId);

    if (match === null) {
      throw new SessionImportError(
        "Artifact ID is invalid. Expected artifact://sha256/<64 hexadecimal characters>.",
      );
    }

    const digest = match[1];

    if (digest === undefined) {
      throw new SessionImportError("Artifact ID does not contain a digest.");
    }

    const artifactPath = join(this.#rootDirectory, digest.slice(0, 2), digest);
    let content: Buffer;

    try {
      content = await readFile(artifactPath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new SessionImportError(
          `Artifact '${artifactId}' was not found in this AI_WORKSPACE_HOME. Reimport the source session or check that you are using the same local workspace home.`,
          { cause: error },
        );
      }

      throw new SessionImportError(
        `Artifact '${artifactId}' cannot be read. Check local storage permissions and retry.`,
        { cause: error },
      );
    }

    if (content.byteLength > MAX_ARTIFACT_BYTES) {
      throw new SessionImportError(
        `Artifact '${artifactId}' exceeds the ${MAX_ARTIFACT_BYTES} byte integrity-check limit.`,
      );
    }

    if (sha256(content) !== digest) {
      throw new SessionImportError(
        `Artifact '${artifactId}' failed its SHA-256 integrity check. Do not trust or display it; restore it from a trusted source or reimport the session.`,
      );
    }

    return content;
  }
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
