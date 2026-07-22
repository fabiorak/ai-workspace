import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import {
  PRIVACY_AUDIT_EFFECT,
  PRIVACY_AUDIT_EVENT_LIMIT,
  PrivacyAuditError,
  hashPrivacyAuditEvent,
  validatePrivacyAuditEvent,
  validatePrivacyAuditEventInput,
  type PrivacyAuditEvent,
  type PrivacyAuditEventInput,
  type PrivacyAuditPage,
  type PrivacyAuditStore,
} from "@ai-workspace/privacy-audit";

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const DOCUMENT = /^project_[a-f0-9]{64}\.json$/u;
const LOCK = ".privacy-audit.lock";

type Aggregate = Readonly<{
  schemaVersion: 1;
  projectId: string;
  revision: number;
  events: readonly PrivacyAuditEvent[];
}>;

export class JsonPrivacyAuditStore implements PrivacyAuditStore {
  readonly #directory: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "privacy-audit");
  }

  public async append(
    input: PrivacyAuditEventInput,
  ): Promise<PrivacyAuditEvent> {
    const candidate = validatePrivacyAuditEventInput(input);
    return this.#locked(async () => {
      const aggregate = await this.#read(candidate.projectId, true);
      if (aggregate.events.length >= PRIVACY_AUDIT_EVENT_LIMIT)
        throw new PrivacyAuditError();
      if (aggregate.events.some((event) => event.eventId === candidate.eventId))
        throw new PrivacyAuditError();
      const predecessorEventHash = aggregate.events.at(-1)?.eventHash ?? null;
      const withoutHash = Object.freeze({ ...candidate, predecessorEventHash });
      const event = validatePrivacyAuditEvent({
        ...withoutHash,
        eventHash: hashPrivacyAuditEvent(withoutHash),
      });
      const next: Aggregate = Object.freeze({
        schemaVersion: 1,
        projectId: candidate.projectId,
        revision: aggregate.revision + 1,
        events: Object.freeze([...aggregate.events, event]),
      });
      await this.#atomicCommit(this.#path(candidate.projectId), encode(next));
      const reread = await this.#read(candidate.projectId, true);
      const verified = reread.events.at(-1);
      if (
        verified?.eventHash !== event.eventHash ||
        reread.revision !== next.revision
      )
        throw new PrivacyAuditError();
      return verified;
    });
  }

  public async find(
    projectId: string,
    eventId: string,
  ): Promise<PrivacyAuditEvent | null> {
    const aggregate = await this.#read(projectId, false);
    return aggregate.events.find((event) => event.eventId === eventId) ?? null;
  }

  public async list(
    projectId: string,
    query: Readonly<{ limit: number; cursor?: string }>,
  ): Promise<PrivacyAuditPage> {
    const aggregate = await this.#read(projectId, false);
    const offset =
      query.cursor === undefined
        ? 0
        : decodeCursor(query.cursor, aggregate.revision);
    if (
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100 ||
      offset > aggregate.events.length
    )
      throw new PrivacyAuditError();
    const newest = [...aggregate.events].reverse();
    const events = Object.freeze(newest.slice(offset, offset + query.limit));
    const nextOffset = offset + events.length;
    return Object.freeze({
      events,
      nextCursor:
        nextOffset < newest.length
          ? encodeCursor(nextOffset, aggregate.revision)
          : null,
      total: newest.length,
      effect: PRIVACY_AUDIT_EFFECT,
    });
  }

  async #read(projectId: string, ownLock: boolean): Promise<Aggregate> {
    try {
      validText(projectId);
      let names: string[];
      try {
        names = await readdir(this.#directory);
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT")
          return empty(projectId);
        throw error;
      }
      if (((await stat(this.#directory)).mode & 0o777) !== 0o700)
        throw new PrivacyAuditError();
      if (
        names.some((name) => name.endsWith(".tmp")) ||
        (!ownLock && names.includes(LOCK)) ||
        names.some((name) => name.endsWith(".json") && !DOCUMENT.test(name))
      )
        throw new PrivacyAuditError();
      const path = this.#path(projectId);
      let content: string;
      try {
        content = await readFile(path, "utf8");
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT")
          return empty(projectId);
        throw error;
      }
      if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
        throw new PrivacyAuditError();
      const fileMode = (await stat(path)).mode & 0o777;
      if (fileMode !== 0o600) throw new PrivacyAuditError();
      return decode(content, projectId);
    } catch (error) {
      if (error instanceof PrivacyAuditError) throw error;
      throw new PrivacyAuditError({ cause: error });
    }
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = join(this.#directory, LOCK);
    const ownerToken = randomUUID();
    let owns = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const handle = await open(lockPath, "wx", 0o600);
      owns = true;
      try {
        await handle.writeFile(
          `${JSON.stringify({ schemaVersion: 1, ownerToken, pid: process.pid, createdAt: new Date().toISOString() })}\n`,
          "utf8",
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      return await operation();
    } catch (error) {
      if (error instanceof PrivacyAuditError) throw error;
      throw new PrivacyAuditError({ cause: error });
    } finally {
      if (owns) await releaseOwnedLock(lockPath, ownerToken);
    }
  }

  async #atomicCommit(path: string, content: string): Promise<void> {
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
      throw new PrivacyAuditError();
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, path);
      await chmod(path, 0o600);
      const directory = await open(this.#directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  #path(projectId: string): string {
    return join(this.#directory, `project_${sha256(projectId)}.json`);
  }
}

function empty(projectId: string): Aggregate {
  return Object.freeze({
    schemaVersion: 1,
    projectId,
    revision: 0,
    events: Object.freeze([]),
  });
}
function encode(value: Aggregate): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
function decode(content: string, projectId: string): Aggregate {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, ["events", "projectId", "revision", "schemaVersion"]) ||
      value.schemaVersion !== 1 ||
      value.projectId !== projectId ||
      !Number.isSafeInteger(value.revision) ||
      !Array.isArray(value.events) ||
      value.events.length > PRIVACY_AUDIT_EVENT_LIMIT ||
      value.revision !== value.events.length
    )
      throw new PrivacyAuditError();
    const events = Object.freeze(value.events.map(validatePrivacyAuditEvent));
    let predecessor: string | null = null;
    const ids = new Set<string>();
    for (const event of events) {
      if (
        event.projectId !== projectId ||
        event.predecessorEventHash !== predecessor ||
        ids.has(event.eventId)
      )
        throw new PrivacyAuditError();
      ids.add(event.eventId);
      predecessor = event.eventHash;
    }
    const aggregate = Object.freeze({
      schemaVersion: 1 as const,
      projectId,
      revision: value.revision as number,
      events,
    });
    if (encode(aggregate) !== content) throw new PrivacyAuditError();
    return aggregate;
  } catch (error) {
    if (error instanceof PrivacyAuditError) throw error;
    throw new PrivacyAuditError({ cause: error });
  }
}
function encodeCursor(offset: number, revision: number): string {
  return Buffer.from(JSON.stringify({ offset, revision }), "utf8").toString(
    "base64url",
  );
}
function decodeCursor(cursor: string, revision: number): number {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      !record(value) ||
      !exactKeys(value, ["offset", "revision"]) ||
      !Number.isSafeInteger(value.offset) ||
      (value.offset as number) < 0 ||
      value.revision !== revision ||
      encodeCursor(value.offset as number, revision) !== cursor
    )
      throw new PrivacyAuditError();
    return value.offset as number;
  } catch (error) {
    if (error instanceof PrivacyAuditError) throw error;
    throw new PrivacyAuditError({ cause: error });
  }
}
async function releaseOwnedLock(path: string, token: string): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (record(value) && value.ownerToken === token) await rm(path);
  } catch {
    /* Missing or replaced locks are not ours. */
  }
}
function validText(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    /\p{Cc}/u.test(value)
  )
    throw new PrivacyAuditError();
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
