import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  HistoricalSearchError,
  type HistoricalEvent,
  type HistoricalEventReader,
} from "@ai-workspace/historical-search";

import { JsonSessionStore } from "./json-session-store.ts";

const SESSION_FILE_PATTERN = /^(session_[a-f0-9]{64})\.json$/u;
const MAX_SESSION_DOCUMENTS = 1_000;

export class LocalHistoricalEventReader implements HistoricalEventReader {
  readonly #directory: string;
  readonly #sessions: JsonSessionStore;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "sessions");
    this.#sessions = new JsonSessionStore(workspaceHome);
  }

  public async list(
    projectId: string,
    sessionId?: string,
  ): Promise<readonly HistoricalEvent[]> {
    if (sessionId !== undefined) {
      const session = await this.#sessions.load(sessionId);

      if (session === null || session.projectId !== projectId) {
        return [];
      }

      return Object.freeze(
        session.events.map((event) => Object.freeze({ projectId, event })),
      );
    }

    let entries: readonly string[];

    try {
      entries = await readdir(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }

      throw new HistoricalSearchError(
        "Cannot read local session history. Check AI_WORKSPACE_HOME permissions and retry.",
        { cause: error },
      );
    }

    const sessionIds = entries
      .map((entry) => SESSION_FILE_PATTERN.exec(entry)?.[1])
      .filter((value): value is string => value !== undefined)
      .sort();

    if (sessionIds.length > MAX_SESSION_DOCUMENTS) {
      throw new HistoricalSearchError(
        `Local history contains more than ${MAX_SESSION_DOCUMENTS} sessions. Narrow the query with --session or migrate to an indexed search adapter.`,
      );
    }

    const results: HistoricalEvent[] = [];

    for (const id of sessionIds) {
      const session = await this.#sessions.load(id);

      if (session?.projectId !== projectId) {
        continue;
      }

      results.push(
        ...session.events.map((event) => Object.freeze({ projectId, event })),
      );
    }

    return Object.freeze(results);
  }

  public async find(
    projectId: string,
    eventId: string,
  ): Promise<HistoricalEvent | null> {
    const events = await this.list(projectId);
    return events.find(({ event }) => event.id === eventId) ?? null;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
