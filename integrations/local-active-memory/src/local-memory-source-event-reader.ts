import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { MemorySourceEventReader } from "@ai-workspace/active-memory";
import { JsonSessionStore } from "@ai-workspace/local-session-ingestion";
import {
  SessionImportError,
  type SessionEvent,
} from "@ai-workspace/session-ingestion";

const SESSION_FILE_PATTERN = /^(session_[a-f0-9]{64})\.json$/u;
const MAX_SESSION_DOCUMENTS = 1_000;

export class LocalMemorySourceEventReader implements MemorySourceEventReader {
  readonly #directory: string;
  readonly #sessions: JsonSessionStore;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "sessions");
    this.#sessions = new JsonSessionStore(workspaceHome);
  }

  public async find(
    projectId: string,
    eventId: string,
  ): Promise<SessionEvent | null> {
    let entries: readonly string[];

    try {
      entries = await readdir(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }

      throw new SessionImportError(
        "Cannot read canonical session events. Check AI_WORKSPACE_HOME permissions and retry.",
        { cause: error },
      );
    }

    const sessionIds = entries
      .map((entry) => SESSION_FILE_PATTERN.exec(entry)?.[1])
      .filter((value): value is string => value !== undefined)
      .sort();

    if (sessionIds.length > MAX_SESSION_DOCUMENTS) {
      throw new SessionImportError(
        `Canonical history contains more than ${MAX_SESSION_DOCUMENTS} sessions. Migrate to an indexed source-event adapter before adding memory.`,
      );
    }

    for (const sessionId of sessionIds) {
      const session = await this.#sessions.load(sessionId);

      if (session?.projectId !== projectId) {
        continue;
      }

      const event = session.events.find(
        (candidate) => candidate.id === eventId,
      );

      if (event !== undefined) {
        return event;
      }
    }

    return null;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
