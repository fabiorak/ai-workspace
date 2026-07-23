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
  MODEL_ATTEMPT_RECORD_LIMIT,
  ModelAttemptError,
  createModelAttemptRecord,
  transitionModelAttemptRecord,
  validateModelAttemptRecord,
  validateModelAttemptTransition,
  type ModelAttemptInput,
  type ModelAttemptRecord,
  type ModelAttemptSnapshot,
  type ModelAttemptState,
  type ModelAttemptStore,
} from "@ai-workspace/model-attempts";

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const DOCUMENT = /^project_[a-f0-9]{64}\.json$/u;
const LOCK = ".model-attempts.lock";

type Aggregate = ModelAttemptSnapshot;

export class JsonModelAttemptStore implements ModelAttemptStore {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "model-attempts");
  }

  public async prepare(input: ModelAttemptInput): Promise<ModelAttemptRecord> {
    return this.#locked(async () => {
      const aggregate = await this.#read(input.projectId, true);
      const current = currentRecords(aggregate.records);
      if (
        current.has(input.attemptId) ||
        [...current.values()].some(
          (record) => record.authorizationId === input.authorizationId,
        )
      ) {
        throw new ModelAttemptError();
      }
      const next = createModelAttemptRecord(
        input,
        aggregate.revision + 1,
        aggregate.records.at(-1)?.recordHash ?? null,
      );
      return this.#append(aggregate, next);
    });
  }

  public async transition(
    projectId: string,
    attemptId: string,
    allowed: readonly ModelAttemptState[],
    patch: Readonly<
      Partial<
        Pick<
          ModelAttemptRecord,
          | "state"
          | "exposureCount"
          | "providerRequestIdDigest"
          | "responseIdDigest"
          | "outputDigest"
        >
      >
    >,
  ): Promise<ModelAttemptRecord> {
    return this.#locked(async () => {
      const aggregate = await this.#read(projectId, true);
      const previous = currentRecords(aggregate.records).get(attemptId);
      if (previous === undefined || !allowed.includes(previous.state)) {
        throw new ModelAttemptError();
      }
      const next = transitionModelAttemptRecord(
        previous,
        aggregate.revision + 1,
        patch,
      );
      return this.#append(aggregate, next);
    });
  }

  public async recover(projectId: string): Promise<ModelAttemptSnapshot> {
    return this.#locked(async () => {
      let aggregate = await this.#read(projectId, true);
      const recoverable = [...currentRecords(aggregate.records).values()]
        .filter(
          (record) =>
            record.state === "EXPOSURE_STARTED" ||
            record.state === "ACKNOWLEDGED",
        )
        .sort((left, right) => left.attemptId.localeCompare(right.attemptId));
      for (const previous of recoverable) {
        const next = transitionModelAttemptRecord(
          previous,
          aggregate.revision + 1,
          { state: "UNKNOWN_AFTER_EXPOSURE" },
        );
        aggregate = appendAggregate(aggregate, next);
      }
      if (recoverable.length > 0) {
        await this.#commit(aggregate);
        aggregate = await this.#verifiedReread(aggregate);
      }
      return aggregate;
    });
  }

  public async inspect(
    projectId: string,
    attemptId: string,
  ): Promise<ModelAttemptRecord> {
    const record = currentRecords(
      (await this.#read(projectId, false)).records,
    ).get(attemptId);
    if (record === undefined) {
      throw new ModelAttemptError();
    }
    return record;
  }

  public list(projectId: string): Promise<ModelAttemptSnapshot> {
    return this.#read(projectId, false);
  }

  async #append(
    aggregate: Aggregate,
    record: ModelAttemptRecord,
  ): Promise<ModelAttemptRecord> {
    const next = appendAggregate(aggregate, record);
    await this.#commit(next);
    const reread = await this.#verifiedReread(next);
    const persisted = reread.records.at(-1);
    if (persisted?.recordHash !== record.recordHash) {
      throw new ModelAttemptError();
    }
    return persisted;
  }

  async #verifiedReread(expected: Aggregate): Promise<Aggregate> {
    const reread = await this.#read(expected.projectId, true);
    if (
      reread.revision !== expected.revision ||
      reread.records.at(-1)?.recordHash !== expected.records.at(-1)?.recordHash
    ) {
      throw new ModelAttemptError();
    }
    return reread;
  }

  async #commit(value: Aggregate): Promise<void> {
    const content = encode(value);
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
      throw new ModelAttemptError();
    }
    const path = this.#path(value.projectId);
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
      if (error instanceof ModelAttemptError) {
        throw error;
      }
      throw new ModelAttemptError({ cause: error });
    }
  }

  async #read(projectId: string, ownLock: boolean): Promise<Aggregate> {
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
      ) {
        throw new ModelAttemptError();
      }
      const path = this.#path(projectId);
      const content = await readFile(path, "utf8");
      const document = await stat(path);
      if (
        !document.isFile() ||
        (document.mode & 0o777) !== 0o600 ||
        Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES
      ) {
        throw new ModelAttemptError();
      }
      return decode(content, projectId);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return empty(projectId);
      }
      if (error instanceof ModelAttemptError) {
        throw error;
      }
      throw new ModelAttemptError({ cause: error });
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
      if (error instanceof ModelAttemptError) {
        throw error;
      }
      throw new ModelAttemptError({ cause: error });
    } finally {
      if (owns) {
        await releaseOwnedLock(path, ownerToken);
      }
    }
  }

  #path(projectId: string): string {
    if (!validText(projectId)) {
      throw new ModelAttemptError();
    }
    return join(this.#directory, `project_${sha256(projectId)}.json`);
  }
}

function appendAggregate(
  aggregate: Aggregate,
  record: ModelAttemptRecord,
): Aggregate {
  if (
    aggregate.records.length >= MODEL_ATTEMPT_RECORD_LIMIT ||
    record.projectId !== aggregate.projectId ||
    record.revision !== aggregate.revision + 1 ||
    record.predecessorRecordHash !==
      (aggregate.records.at(-1)?.recordHash ?? null)
  ) {
    throw new ModelAttemptError();
  }
  return Object.freeze({
    schemaVersion: 1,
    projectId: aggregate.projectId,
    revision: record.revision,
    records: Object.freeze([...aggregate.records, record]),
    effect: "LOCAL_ATTEMPT_STORE_NOT_MODEL_DELIVERY",
  });
}

function empty(projectId: string): Aggregate {
  if (!validText(projectId)) {
    throw new ModelAttemptError();
  }
  return Object.freeze({
    schemaVersion: 1,
    projectId,
    revision: 0,
    records: Object.freeze([]),
    effect: "LOCAL_ATTEMPT_STORE_NOT_MODEL_DELIVERY",
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
      !exactKeys(value, [
        "effect",
        "projectId",
        "records",
        "revision",
        "schemaVersion",
      ]) ||
      value.schemaVersion !== 1 ||
      value.projectId !== projectId ||
      value.effect !== "LOCAL_ATTEMPT_STORE_NOT_MODEL_DELIVERY" ||
      !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 ||
      !Array.isArray(value.records) ||
      value.records.length > MODEL_ATTEMPT_RECORD_LIMIT ||
      value.revision !== value.records.length
    ) {
      throw new ModelAttemptError();
    }
    const records = Object.freeze(
      value.records.map(validateModelAttemptRecord),
    );
    let predecessor: string | null = null;
    const latest = new Map<string, ModelAttemptRecord>();
    const authorizations = new Map<string, string>();
    for (const entry of records) {
      if (
        entry.projectId !== projectId ||
        entry.predecessorRecordHash !== predecessor
      ) {
        throw new ModelAttemptError();
      }
      validateModelAttemptTransition(latest.get(entry.attemptId), entry);
      const prior = authorizations.get(entry.authorizationId);
      if (prior !== undefined && prior !== entry.attemptId) {
        throw new ModelAttemptError();
      }
      latest.set(entry.attemptId, entry);
      authorizations.set(entry.authorizationId, entry.attemptId);
      predecessor = entry.recordHash;
    }
    const aggregate = Object.freeze({
      schemaVersion: 1 as const,
      projectId,
      revision: value.revision as number,
      records,
      effect: "LOCAL_ATTEMPT_STORE_NOT_MODEL_DELIVERY" as const,
    });
    if (encode(aggregate) !== content) {
      throw new ModelAttemptError();
    }
    return aggregate;
  } catch (error) {
    if (error instanceof ModelAttemptError) {
      throw error;
    }
    throw new ModelAttemptError({ cause: error });
  }
}

function currentRecords(
  records: readonly ModelAttemptRecord[],
): Map<string, ModelAttemptRecord> {
  const current = new Map<string, ModelAttemptRecord>();
  for (const entry of records) {
    current.set(entry.attemptId, entry);
  }
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
    ) {
      return;
    }
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
