import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { SessionImportError } from "@ai-workspace/session-ingestion";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import { JsonSessionStore } from "./json-session-store.ts";

const SESSION_FILE_PATTERN = /^(session_[a-f0-9]{64})\.json$/u;
const MAX_SESSION_DOCUMENTS = 1_000;

/**
 * Reads whole session documents for one project, not just their events.
 *
 * `LocalHistoricalEventReader` flattens sessions into events because retrieval
 * ranks events. A list of past work needs the other half of the same document:
 * which agent produced the session and which model it ran, both already recorded
 * by ingestion. Nothing new is stored to answer this; a field that was being
 * dropped on the way out is now carried through.
 *
 * The same thousand-document bound applies, and for the same reason: a local read
 * that grows without limit is a read that eventually stops answering.
 */
export class LocalSessionReader {
  readonly #directory: string;
  readonly #sessions: JsonSessionStore;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "sessions");
    this.#sessions = new JsonSessionStore(workspaceHome);
  }

  public async list(projectId: string): Promise<readonly ImportedSession[]> {
    let entries: readonly string[];
    try {
      entries = await readdir(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return [];
      throw new SessionImportError(
        "Cannot read local session history. Check AI_WORKSPACE_HOME permissions and retry.",
        { cause: error },
      );
    }
    const sessionIds = entries
      .map((entry) => SESSION_FILE_PATTERN.exec(entry)?.[1])
      .filter((value): value is string => value !== undefined)
      .sort();
    if (sessionIds.length > MAX_SESSION_DOCUMENTS)
      throw new SessionImportError(
        `Local history contains more than ${MAX_SESSION_DOCUMENTS} sessions. Narrow the read to one project with fewer sessions, or migrate to an indexed adapter.`,
      );
    const sessions: ImportedSession[] = [];
    for (const id of sessionIds) {
      const session = await this.#sessions.load(id);
      if (session?.projectId === projectId) sessions.push(session);
    }
    return Object.freeze(sessions);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
