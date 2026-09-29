import { constants as fsConstants } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readdir,
  rename,
  rm,
  lstat,
  unlink,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PRIVACY_AUDIT_EVENT_LIMIT,
  PrivacyAuditError,
  canonicalJson,
  digestCanonical,
  hashTurnPrivacyAuditEvent,
  validateTurnPrivacyAuditEvent,
  validateTurnPrivacyAuditInput,
  validateTurnAuditScope,
  type TurnAuditScope,
  type TurnPrivacyAuditEvent,
  type TurnPrivacyAuditInput,
  type TurnPrivacyAuditStore,
} from "@ai-workspace/privacy-audit";

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const LOCK = ".turn-privacy-audit.lock";
const TEMPORARY = /\.tmp$/u;
const DOCUMENT = /^scope_[a-f0-9]{64}\.json$/u;
const READ_FLAGS = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
const DIRECTORY_FLAGS = READ_FLAGS | fsConstants.O_DIRECTORY;

type Aggregate = Readonly<{
  schemaVersion: 2;
  scope: TurnAuditScope;
  revision: number;
  events: readonly TurnPrivacyAuditEvent[];
}>;

type LockDocument = Readonly<{
  schemaVersion: 1;
  ownerToken: string;
}>;

export class JsonTurnPrivacyAuditStore implements TurnPrivacyAuditStore {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "turn-privacy-audit");
  }

  public async append(
    input: TurnPrivacyAuditInput,
  ): Promise<TurnPrivacyAuditEvent> {
    const candidate = validateTurnPrivacyAuditInput(input);
    return this.#locked(async (ownerToken) => {
      const aggregate = await this.#read(candidate.scope, true, ownerToken);
      if (aggregate.events.length >= PRIVACY_AUDIT_EVENT_LIMIT)
        throw new PrivacyAuditError();
      if (aggregate.events.some((event) => event.eventId === candidate.eventId))
        throw new PrivacyAuditError();
      const predecessorEventHash = aggregate.events.at(-1)?.eventHash ?? null;
      const withoutHash = Object.freeze({ ...candidate, predecessorEventHash });
      const event = validateTurnPrivacyAuditEvent({
        ...withoutHash,
        eventHash: hashTurnPrivacyAuditEvent(withoutHash),
      });
      const next: Aggregate = Object.freeze({
        schemaVersion: 2,
        scope: candidate.scope,
        revision: aggregate.revision + 1,
        events: Object.freeze([...aggregate.events, event]),
      });
      await this.#atomicCommit(this.#path(candidate.scope), encode(next));
      const reread = await this.#read(candidate.scope, true, ownerToken);
      const verified = reread.events.at(-1);
      if (verified === undefined || reread.revision !== next.revision)
        throw new PrivacyAuditError();
      if (verified.eventHash !== event.eventHash) throw new PrivacyAuditError();
      return verified;
    });
  }

  public async find(
    scope: TurnAuditScope,
    eventId: string,
  ): Promise<TurnPrivacyAuditEvent | null> {
    const candidate = validateTurnAuditScope(scope);
    const aggregate = await this.#read(candidate, false, null);
    return aggregate.events.find((event) => event.eventId === eventId) ?? null;
  }

  public async list(
    scope: TurnAuditScope,
  ): Promise<readonly TurnPrivacyAuditEvent[]> {
    const candidate = validateTurnAuditScope(scope);
    return (await this.#read(candidate, false, null)).events;
  }

  async #read(
    scope: TurnAuditScope,
    ownLock: boolean,
    ownerToken: string | null,
  ): Promise<Aggregate> {
    try {
      const directoryExists = await this.#ensureDirectory(false);
      if (!directoryExists) return empty(scope);
      await this.#inspectDirectory(ownLock ? ownerToken : null);
      const path = this.#path(scope);
      let content: string;
      try {
        content = await readBounded(path);
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return empty(scope);
        throw error;
      }
      return decode(content, scope);
    } catch (error) {
      if (error instanceof PrivacyAuditError) throw error;
      throw new PrivacyAuditError({ cause: error });
    }
  }

  async #ensureDirectory(create: boolean): Promise<boolean> {
    try {
      if (create)
        await mkdir(this.#directory, {
          recursive: true,
          mode: DIRECTORY_MODE,
        });
      else await lstat(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        if (!create) return false;
        await mkdir(this.#directory, { recursive: true, mode: DIRECTORY_MODE });
      } else {
        throw error;
      }
    }
    const metadata = await lstat(this.#directory);
    if (!metadata.isDirectory() || (metadata.mode & 0o777) !== DIRECTORY_MODE)
      throw new PrivacyAuditError();
    return true;
  }

  async #inspectDirectory(ownerToken: string | null): Promise<void> {
    const names = await readdir(this.#directory);
    if (
      names.some((name) => TEMPORARY.test(name)) ||
      names.some((name) => name === LOCK && ownerToken === null) ||
      names.some((name) => name.endsWith(".json") && !DOCUMENT.test(name))
    )
      throw new PrivacyAuditError();
    if (ownerToken !== null) {
      const lock = await readLock(this.#directory);
      if (lock.ownerToken !== ownerToken) throw new PrivacyAuditError();
    }
  }

  async #locked<T>(operation: (ownerToken: string) => Promise<T>): Promise<T> {
    await this.#ensureDirectory(true);
    const lockPath = join(this.#directory, LOCK);
    const ownerToken = randomUUID();
    let owns = false;
    try {
      const handle = await open(
        lockPath,
        fsConstants.O_WRONLY |
          fsConstants.O_CREAT |
          fsConstants.O_EXCL |
          fsConstants.O_NOFOLLOW,
        FILE_MODE,
      );
      owns = true;
      try {
        await handle.writeFile(
          `${JSON.stringify({ schemaVersion: 1, ownerToken })}\n`,
          "utf8",
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      return await operation(ownerToken);
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
      const handle = await open(
        temporary,
        fsConstants.O_WRONLY |
          fsConstants.O_CREAT |
          fsConstants.O_EXCL |
          fsConstants.O_NOFOLLOW,
        FILE_MODE,
      );
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, path);
      const directory = await open(this.#directory, DIRECTORY_FLAGS);
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  #path(scope: TurnAuditScope): string {
    return join(this.#directory, `scope_${digestCanonical(scope)}.json`);
  }
}

function empty(scope: TurnAuditScope): Aggregate {
  return Object.freeze({
    schemaVersion: 2,
    scope,
    revision: 0,
    events: Object.freeze([]),
  });
}

function encode(value: Aggregate): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function decode(content: string, scope: TurnAuditScope): Aggregate {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, ["events", "revision", "schemaVersion", "scope"]) ||
      value.schemaVersion !== 2 ||
      canonicalJson(value.scope) !== canonicalJson(scope) ||
      !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 ||
      !Array.isArray(value.events) ||
      value.events.length > PRIVACY_AUDIT_EVENT_LIMIT ||
      value.revision !== value.events.length
    )
      throw new PrivacyAuditError();
    const validatedScope = validateTurnAuditScope(value.scope);
    const events = Object.freeze(
      value.events.map(validateTurnPrivacyAuditEvent),
    );
    let predecessor: string | null = null;
    const ids = new Set<string>();
    const hashes = new Set<string>();
    for (const event of events) {
      if (
        canonicalJson(event.scope) !== canonicalJson(validatedScope) ||
        event.predecessorEventHash !== predecessor ||
        ids.has(event.eventId) ||
        hashes.has(event.eventHash)
      )
        throw new PrivacyAuditError();
      ids.add(event.eventId);
      hashes.add(event.eventHash);
      predecessor = event.eventHash;
    }
    const aggregate = Object.freeze({
      schemaVersion: 2 as const,
      scope: validatedScope,
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

async function readLock(directory: string): Promise<LockDocument> {
  const value = JSON.parse(await readBounded(join(directory, LOCK))) as unknown;
  if (
    !record(value) ||
    !exactKeys(value, ["ownerToken", "schemaVersion"]) ||
    value.schemaVersion !== 1 ||
    typeof value.ownerToken !== "string" ||
    value.ownerToken.length < 1
  )
    throw new PrivacyAuditError();
  return Object.freeze({ schemaVersion: 1, ownerToken: value.ownerToken });
}

async function readBounded(path: string): Promise<string> {
  const handle = await open(path, READ_FLAGS);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || (metadata.mode & 0o777) !== FILE_MODE)
      throw new PrivacyAuditError();
    const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const result = await handle.read(
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        bytesRead,
      );
      if (result.bytesRead === 0) break;
      bytesRead += result.bytesRead;
    }
    if (bytesRead > MAX_DOCUMENT_BYTES) throw new PrivacyAuditError();
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function releaseOwnedLock(path: string, token: string): Promise<void> {
  try {
    const lock = await readLock(dirname(path));
    if (lock.ownerToken === token) await unlink(path);
  } catch {
    /* Missing or replaced locks are not ours. */
  }
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

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
