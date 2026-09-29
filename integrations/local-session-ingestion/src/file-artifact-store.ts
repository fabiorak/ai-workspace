import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  link,
  mkdir,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import type { ArtifactResolver } from "@ai-workspace/historical-search";
import {
  SessionImportError,
  type ArtifactReference,
  type ArtifactStore,
} from "@ai-workspace/session-ingestion";

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

const ARTIFACT_ID_PATTERN = /^artifact:\/\/sha256\/([a-f0-9]{64})$/u;
const READ_FLAGS = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;

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
    return this.readBounded(artifactId, MAX_ARTIFACT_BYTES);
  }

  /**
   * Opens only a regular artifact file without following a final symlink and
   * reads at most `maxBytes + 1` bytes. The extra byte detects a post-stat
   * growth race before a complete oversized artifact enters memory.
   */
  public async readBounded(
    artifactId: string,
    maxBytes: number,
  ): Promise<Uint8Array> {
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 0 ||
      maxBytes > MAX_ARTIFACT_BYTES
    )
      throw new SessionImportError(
        `Artifact read bound must be an integer from 0 to ${MAX_ARTIFACT_BYTES}.`,
      );
    const digest = artifactDigest(artifactId);
    const artifactPath = join(this.#rootDirectory, digest.slice(0, 2), digest);
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(artifactPath, READ_FLAGS);
    } catch (error) {
      throw artifactReadError(artifactId, error);
    }
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile())
        throw new SessionImportError(
          `Artifact '${artifactId}' is not a regular file and cannot be trusted.`,
        );
      if (metadata.size > maxBytes)
        throw new SessionImportError(
          `Artifact '${artifactId}' exceeds the ${maxBytes} byte read bound.`,
        );
      const buffer = Buffer.alloc(maxBytes + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const read = await handle.read(
          buffer,
          bytesRead,
          buffer.length - bytesRead,
          bytesRead,
        );
        if (read.bytesRead === 0) break;
        bytesRead += read.bytesRead;
      }
      if (bytesRead > maxBytes)
        throw new SessionImportError(
          `Artifact '${artifactId}' exceeds the ${maxBytes} byte read bound.`,
        );
      const content = buffer.subarray(0, bytesRead);
      if (sha256(content) !== digest)
        throw new SessionImportError(
          `Artifact '${artifactId}' failed its SHA-256 integrity check. Do not trust or display it; restore it from a trusted source or reimport the session.`,
        );
      return content;
    } catch (error) {
      if (error instanceof SessionImportError) throw error;
      throw artifactReadError(artifactId, error);
    } finally {
      await handle.close().catch(() => undefined);
    }
  }
}

function artifactDigest(artifactId: string): string {
  const match = ARTIFACT_ID_PATTERN.exec(artifactId);
  if (match === null)
    throw new SessionImportError(
      "Artifact ID is invalid. Expected artifact://sha256/<64 hexadecimal characters>.",
    );
  const digest = match[1];
  if (digest === undefined)
    throw new SessionImportError("Artifact ID does not contain a digest.");
  return digest;
}

function artifactReadError(
  artifactId: string,
  cause: unknown,
): SessionImportError {
  if (isNodeError(cause) && cause.code === "ENOENT")
    return new SessionImportError(
      `Artifact '${artifactId}' was not found in this AI_WORKSPACE_HOME. Reimport the source session or check that you are using the same local workspace home.`,
      { cause },
    );
  return new SessionImportError(
    `Artifact '${artifactId}' cannot be read. Check local storage permissions and retry.`,
    { cause },
  );
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
