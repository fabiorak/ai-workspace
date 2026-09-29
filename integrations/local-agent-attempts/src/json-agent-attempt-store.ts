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
  AGENT_ATTEMPT_RECORD_LIMIT,
  AgentAttemptError,
  createAgentAttemptRecord,
  transitionAgentAttemptRecord,
  validateAgentAttemptRecord,
  validateAgentAttemptTransition,
  type AgentAttemptInput,
  type AgentAttemptPatch,
  type AgentAttemptRecord,
  type AgentAttemptSnapshot,
  type AgentAttemptState,
  type AgentAttemptStore,
} from "@ai-workspace/agent-execution";

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const DOCUMENT = /^scope_[a-f0-9]{64}\.json$/u;
const LOCK = ".agent-attempts.lock";
const EFFECT = "LOCAL_AGENT_ATTEMPT_STORE_NOT_AGENT_EXECUTION" as const;

/**
 * ADR-0049. One append-only, hash-chained document per scope, separate from
 * model-delivery attempts. A contended lock fails closed instead of waiting,
 * so a competing claim can refuse but never execute twice.
 */
export class JsonAgentAttemptStore implements AgentAttemptStore {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "agent-attempts");
  }

  public async prepare(input: AgentAttemptInput): Promise<AgentAttemptRecord> {
    return this.#locked(async () => {
      const aggregate = await this.#read(input.scopeId, true);
      const current = currentRecords(aggregate.records);
      if (
        current.has(input.attemptId) ||
        [...current.values()].some(
          (record) => record.authorizationId === input.authorizationId,
        )
      )
        throw new AgentAttemptError();
      return this.#append(
        aggregate,
        createAgentAttemptRecord(
          input,
          aggregate.revision + 1,
          aggregate.records.at(-1)?.recordHash ?? null,
        ),
      );
    });
  }

  public async transition(
    scopeId: string,
    attemptId: string,
    allowed: readonly AgentAttemptState[],
    patch: AgentAttemptPatch,
  ): Promise<AgentAttemptRecord> {
    return this.#locked(async () => {
      const aggregate = await this.#read(scopeId, true);
      const previous = currentRecords(aggregate.records).get(attemptId);
      if (previous === undefined || !allowed.includes(previous.state))
        throw new AgentAttemptError();
      return this.#append(
        aggregate,
        transitionAgentAttemptRecord(
          previous,
          aggregate.revision + 1,
          patch,
          aggregate.records.at(-1)!.recordHash,
        ),
      );
    });
  }

  public async inspect(
    scopeId: string,
    attemptId: string,
  ): Promise<AgentAttemptRecord> {
    const record = currentRecords(
      (await this.#read(scopeId, false)).records,
    ).get(attemptId);
    if (record === undefined) throw new AgentAttemptError();
    return record;
  }

  public list(scopeId: string): Promise<AgentAttemptSnapshot> {
    return this.#read(scopeId, false);
  }

  async #append(
    aggregate: AgentAttemptSnapshot,
    record: AgentAttemptRecord,
  ): Promise<AgentAttemptRecord> {
    const next = appendAggregate(aggregate, record);
    await this.#commit(next);
    const reread = await this.#read(next.scopeId, true);
    const persisted = reread.records.at(-1);
    if (
      reread.revision !== next.revision ||
      persisted?.recordHash !== record.recordHash
    )
      throw new AgentAttemptError();
    return persisted;
  }

  async #commit(value: AgentAttemptSnapshot): Promise<void> {
    const content = encode(value);
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
      throw new AgentAttemptError();
    const path = this.#path(value.scopeId);
    const temporary = `${path}.${randomUUID()}.tmp`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(content, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, path);
      const directory = await open(this.#directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      if (error instanceof AgentAttemptError) throw error;
      throw new AgentAttemptError({ cause: error });
    }
  }

  async #read(
    scopeId: string,
    ownLock: boolean,
  ): Promise<AgentAttemptSnapshot> {
    try {
      const directory = await stat(this.#directory);
      const names = await readdir(this.#directory);
      if (
        !directory.isDirectory() ||
        (directory.mode & 0o777) !== 0o700 ||
        names.some((name) => name.endsWith(".tmp")) ||
        (!ownLock && names.includes(LOCK)) ||
        names.some(
          (name) =>
            name !== LOCK && name.endsWith(".json") && !DOCUMENT.test(name),
        )
      )
        throw new AgentAttemptError();
      const path = this.#path(scopeId);
      const content = await readFile(path, "utf8");
      const document = await stat(path);
      if (
        !document.isFile() ||
        (document.mode & 0o777) !== 0o600 ||
        Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES
      )
        throw new AgentAttemptError();
      return decode(content, scopeId);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return empty(scopeId);
      if (error instanceof AgentAttemptError) throw error;
      throw new AgentAttemptError({ cause: error });
    }
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const ownerToken = randomUUID();
    const path = join(this.#directory, LOCK);
    let owns = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const handle = await open(path, "wx", 0o600);
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
      return await operation();
    } catch (error) {
      if (error instanceof AgentAttemptError) throw error;
      throw new AgentAttemptError({ cause: error });
    } finally {
      if (owns) await releaseOwnedLock(path, ownerToken);
    }
  }

  #path(scopeId: string): string {
    if (!validText(scopeId)) throw new AgentAttemptError();
    return join(this.#directory, `scope_${sha256(scopeId)}.json`);
  }
}

function appendAggregate(
  aggregate: AgentAttemptSnapshot,
  record: AgentAttemptRecord,
): AgentAttemptSnapshot {
  if (
    aggregate.records.length >= AGENT_ATTEMPT_RECORD_LIMIT ||
    record.scopeId !== aggregate.scopeId ||
    record.revision !== aggregate.revision + 1 ||
    record.predecessorRecordHash !==
      (aggregate.records.at(-1)?.recordHash ?? null)
  )
    throw new AgentAttemptError();
  return Object.freeze({
    schemaVersion: 1,
    scopeId: aggregate.scopeId,
    revision: record.revision,
    records: Object.freeze([...aggregate.records, record]),
    effect: EFFECT,
  });
}

function empty(scopeId: string): AgentAttemptSnapshot {
  if (!validText(scopeId)) throw new AgentAttemptError();
  return Object.freeze({
    schemaVersion: 1,
    scopeId,
    revision: 0,
    records: Object.freeze([]),
    effect: EFFECT,
  });
}

function encode(value: AgentAttemptSnapshot): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function decode(content: string, scopeId: string): AgentAttemptSnapshot {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, [
        "effect",
        "records",
        "revision",
        "schemaVersion",
        "scopeId",
      ]) ||
      value.schemaVersion !== 1 ||
      value.scopeId !== scopeId ||
      value.effect !== EFFECT ||
      !Number.isSafeInteger(value.revision) ||
      !Array.isArray(value.records) ||
      value.records.length > AGENT_ATTEMPT_RECORD_LIMIT ||
      value.revision !== value.records.length
    )
      throw new AgentAttemptError();
    const records = Object.freeze(
      value.records.map(validateAgentAttemptRecord),
    );
    let predecessor: string | null = null;
    const latest = new Map<string, AgentAttemptRecord>();
    const authorizations = new Map<string, string>();
    for (const [index, entry] of records.entries()) {
      if (
        entry.scopeId !== scopeId ||
        entry.revision !== index + 1 ||
        entry.predecessorRecordHash !== predecessor
      )
        throw new AgentAttemptError();
      validateAgentAttemptTransition(
        latest.get(entry.attemptId),
        entry,
        predecessor,
      );
      const prior = authorizations.get(entry.authorizationId);
      if (prior !== undefined && prior !== entry.attemptId)
        throw new AgentAttemptError();
      latest.set(entry.attemptId, entry);
      authorizations.set(entry.authorizationId, entry.attemptId);
      predecessor = entry.recordHash;
    }
    const aggregate: AgentAttemptSnapshot = Object.freeze({
      schemaVersion: 1,
      scopeId,
      revision: value.revision as number,
      records,
      effect: EFFECT,
    });
    // Byte-exact canonical form: an edited or reformatted file is not evidence.
    if (encode(aggregate) !== content) throw new AgentAttemptError();
    return aggregate;
  } catch (error) {
    if (error instanceof AgentAttemptError) throw error;
    throw new AgentAttemptError({ cause: error });
  }
}

function currentRecords(
  records: readonly AgentAttemptRecord[],
): Map<string, AgentAttemptRecord> {
  const current = new Map<string, AgentAttemptRecord>();
  for (const entry of records) current.set(entry.attemptId, entry);
  return current;
}

async function releaseOwnedLock(
  path: string,
  ownerToken: string,
): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      !record(value) ||
      !exactKeys(value, ["ownerToken", "schemaVersion"]) ||
      value.schemaVersion !== 1 ||
      value.ownerToken !== ownerToken
    )
      return;
    await rm(path, { force: true });
  } catch {
    return;
  }
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !/\p{Cc}/u.test(value)
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
