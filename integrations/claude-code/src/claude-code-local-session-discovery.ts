import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  SessionImportError,
  type DiscoveredSessionFile,
  type SessionFileDiscovery,
} from "@ai-workspace/session-ingestion";

/**
 * Lists the Claude Code transcripts inside one directory that the user named
 * explicitly.
 *
 * Discovery is deliberately dumb: it is not recursive, it has no default
 * location, it never guesses which project a transcript belongs to, and it never
 * opens a candidate. Every returned value comes from filesystem metadata, so
 * listing a directory cannot read a conversation. Reading happens only when the
 * user then imports one named file.
 */

const MAX_CANDIDATES = 500;
const TRANSCRIPT_SUFFIX = ".jsonl";

export class ClaudeCodeLocalSessionDiscovery implements SessionFileDiscovery {
  public readonly sourceType = "claude-code-local";

  public async discover(
    directoryPath: string,
  ): Promise<readonly DiscoveredSessionFile[]> {
    const entries = await listDirectory(directoryPath);
    const candidates: DiscoveredSessionFile[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(TRANSCRIPT_SUFFIX)) {
        continue;
      }

      const filePath = join(directoryPath, entry);
      const details = await stat(filePath).catch(() => null);

      if (details === null || !details.isFile()) {
        continue;
      }

      candidates.push(
        Object.freeze({
          filePath,
          fileName: entry,
          byteLength: details.size,
          modifiedAt: new Date(details.mtimeMs).toISOString(),
        }),
      );

      if (candidates.length >= MAX_CANDIDATES) {
        break;
      }
    }

    return Object.freeze(
      candidates.sort((left, right) =>
        left.modifiedAt === right.modifiedAt
          ? left.fileName < right.fileName
            ? -1
            : 1
          : left.modifiedAt < right.modifiedAt
            ? 1
            : -1,
      ),
    );
  }
}

async function listDirectory(
  directoryPath: string,
): Promise<readonly string[]> {
  if (directoryPath.trim().length === 0) {
    throw new SessionImportError(
      "Name the directory that holds the transcripts. Nothing is discovered automatically.",
    );
  }

  try {
    const details = await stat(directoryPath);

    if (!details.isDirectory()) {
      throw new SessionImportError(
        "The transcript location must be a directory that you name explicitly.",
      );
    }

    return await readdir(directoryPath);
  } catch (error) {
    if (error instanceof SessionImportError) {
      throw error;
    }

    if (isNodeError(error) && error.code === "ENOENT") {
      throw new SessionImportError(
        "That transcript directory does not exist. Check the path; no other location is searched.",
        { cause: error },
      );
    }

    throw new SessionImportError(
      "Cannot list that transcript directory. Check the path and its permissions.",
      { cause: error },
    );
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
