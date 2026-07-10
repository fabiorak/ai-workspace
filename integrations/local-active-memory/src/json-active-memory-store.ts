import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  ActiveMemoryConflictError,
  ActiveMemoryError,
  type ActiveMemoryStore,
  type MemoryInvalidationRecord,
  type MemoryItem,
  type MemorySupersessionRecord,
  type MemoryVerificationRecord,
  type SupersededMemory,
} from "@ai-workspace/active-memory";

import {
  appendMemoryOperation,
  decodeMemoryLog,
  emptyMemoryLog,
  encodeMemoryLog,
  MemoryLogError,
  reduceMemoryLog,
  type MemoryLogDocument,
  type MemoryLogOperation,
} from "./memory-log.ts";

const LOCK_SCHEMA_VERSION = 1;
const PROJECT_ID_MAX_LENGTH = 256;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export class JsonActiveMemoryStore implements ActiveMemoryStore {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "memory");
  }

  public async list(projectIdValue: string): Promise<readonly MemoryItem[]> {
    const projectId = projectIdValueChecked(projectIdValue);
    return (await this.#load(projectId)).items;
  }

  public async find(
    projectIdValue: string,
    memoryId: string,
  ): Promise<MemoryItem | null> {
    const projectId = projectIdValueChecked(projectIdValue);
    return (
      (await this.#load(projectId)).items.find(
        (item) => item.id === memoryId,
      ) ?? null
    );
  }

  public async create(item: MemoryItem): Promise<MemoryItem> {
    return this.#mutate(item.projectId, async (document, items) => {
      if (items.some((current) => current.id === item.id)) {
        throw new ActiveMemoryConflictError(item.id);
      }

      const updated = appendMemoryOperation(
        document,
        document.revision,
        Object.freeze({
          kind: "CREATE",
          id: item.creationOperationId,
          projectId: item.projectId,
          revision: document.revision + 1,
          actor: item.createdBy,
          occurredAt: item.createdAt,
          itemId: item.id,
          type: item.type,
          content: item.content,
          sources: item.sources,
        }),
      );
      return Object.freeze({ document: updated, resultId: item.id });
    });
  }

  public async verify(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    record: MemoryVerificationRecord,
  ): Promise<MemoryItem> {
    return this.#transition(projectId, memoryId, expectedVersion, (revision) =>
      Object.freeze({
        kind: "VERIFY",
        id: record.id,
        projectId,
        revision,
        actor: record.actor,
        occurredAt: record.occurredAt,
        itemId: memoryId,
        expectedItemVersion: expectedVersion,
        note: record.note,
        sources: record.sources,
      }),
    );
  }

  public async supersede(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    replacement: MemoryItem,
    record: MemorySupersessionRecord,
  ): Promise<SupersededMemory> {
    if (
      replacement.projectId !== projectId ||
      replacement.supersedes !== memoryId ||
      record.replacementId !== replacement.id
    ) {
      throw new ActiveMemoryError(
        "Supersession project, target, and replacement identifiers must agree. Reload the item and retry.",
      );
    }

    return this.#mutate(projectId, async (document, items) => {
      assertExpectedItem(items, memoryId, expectedVersion);
      const updated = appendMemoryOperation(
        document,
        document.revision,
        Object.freeze({
          kind: "SUPERSEDE",
          id: record.id,
          projectId,
          revision: document.revision + 1,
          actor: record.actor,
          occurredAt: record.occurredAt,
          itemId: memoryId,
          expectedItemVersion: expectedVersion,
          replacement: Object.freeze({
            id: replacement.id,
            creationOperationId: replacement.creationOperationId,
            type: replacement.type,
            content: replacement.content,
            sources: replacement.sources,
          }),
          sources: record.sources,
        }),
      );
      return Object.freeze({
        document: updated,
        resultId: replacement.id,
        previousId: memoryId,
      });
    });
  }

  public async invalidate(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    record: MemoryInvalidationRecord,
  ): Promise<MemoryItem> {
    return this.#transition(projectId, memoryId, expectedVersion, (revision) =>
      Object.freeze({
        kind: "INVALIDATE",
        id: record.id,
        projectId,
        revision,
        actor: record.actor,
        occurredAt: record.occurredAt,
        itemId: memoryId,
        expectedItemVersion: expectedVersion,
        reason: record.reason,
        sources: record.sources,
      }),
    );
  }

  async #transition(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    operation: (revision: number) => MemoryLogOperation,
  ): Promise<MemoryItem> {
    return this.#mutate(projectId, async (document, items) => {
      assertExpectedItem(items, memoryId, expectedVersion);
      const updated = appendMemoryOperation(
        document,
        document.revision,
        operation(document.revision + 1),
      );
      return Object.freeze({ document: updated, resultId: memoryId });
    });
  }

  async #mutate<T extends MemoryItem | SupersededMemory>(
    projectIdValue: string,
    change: (
      document: MemoryLogDocument,
      items: readonly MemoryItem[],
    ) => Promise<MutationResult>,
  ): Promise<T> {
    const projectId = projectIdValueChecked(projectIdValue);
    const documentPath = this.#documentPath(projectId);
    const lockPath = `${documentPath}.lock`;
    const ownerToken = randomUUID();
    let ownsLock = false;

    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      await this.#acquireLock(lockPath, ownerToken);
      ownsLock = true;
      const loaded = await this.#loadDocument(projectId, documentPath);
      const reduced = reduceMemoryLog(loaded);
      const mutation = await change(loaded, reduced.items);
      const finalState = reduceMemoryLog(mutation.document);
      const content = encodeMemoryLog(mutation.document);
      const result = finalState.items.find(
        (item) => item.id === mutation.resultId,
      );

      if (result === undefined) {
        throw new ActiveMemoryError(
          "Active-memory commit did not reconstruct the requested item. Move the memory document aside and rebuild it from canonical evidence.",
        );
      }

      if (mutation.previousId === undefined) {
        await this.#atomicCommit(documentPath, content);
        return result as T;
      }

      const previous = finalState.items.find(
        (item) => item.id === mutation.previousId,
      );
      if (previous === undefined) {
        throw new ActiveMemoryError(
          "Active-memory supersession did not reconstruct both items. Move the memory document aside and rebuild it from canonical evidence.",
        );
      }
      await this.#atomicCommit(documentPath, content);
      return Object.freeze({ previous, replacement: result }) as T;
    } catch (error) {
      if (error instanceof ActiveMemoryError) {
        throw error;
      }
      if (error instanceof MemoryLogError) {
        throw new ActiveMemoryError(error.message, { cause: error });
      }
      throw new ActiveMemoryError(
        "Cannot update local active memory. Check AI_WORKSPACE_HOME permissions and storage integrity, then retry.",
        { cause: error },
      );
    } finally {
      if (ownsLock) {
        await releaseOwnedLock(lockPath, ownerToken);
      }
    }
  }

  async #load(projectId: string): Promise<ReturnType<typeof reduceMemoryLog>> {
    try {
      return reduceMemoryLog(
        await this.#loadDocument(projectId, this.#documentPath(projectId)),
      );
    } catch (error) {
      if (error instanceof ActiveMemoryError) {
        throw error;
      }
      if (error instanceof MemoryLogError) {
        throw new ActiveMemoryError(error.message, { cause: error });
      }
      throw new ActiveMemoryError(
        "Cannot read local active memory. Check AI_WORKSPACE_HOME permissions and storage integrity, then retry.",
        { cause: error },
      );
    }
  }

  async #loadDocument(
    projectId: string,
    documentPath: string,
  ): Promise<MemoryLogDocument> {
    let content: string;

    try {
      content = await readFile(documentPath, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return emptyMemoryLog(projectId);
      }
      throw error;
    }

    const document = decodeMemoryLog(content);
    if (document.projectId !== projectId) {
      throw new ActiveMemoryError(
        "The active-memory document belongs to another project. Move it aside and rebuild memory from canonical evidence.",
      );
    }
    return document;
  }

  async #acquireLock(lockPath: string, ownerToken: string): Promise<void> {
    let createdLock = false;

    try {
      const lock = await open(lockPath, "wx", 0o600);
      createdLock = true;
      try {
        await lock.writeFile(
          `${JSON.stringify({
            schemaVersion: LOCK_SCHEMA_VERSION,
            ownerToken,
            pid: process.pid,
            createdAt: new Date().toISOString(),
          })}\n`,
          "utf8",
        );
        await lock.sync();
      } finally {
        await lock.close();
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") {
        const diagnostic = await readLockDiagnostic(lockPath);
        throw new ActiveMemoryError(
          `Another process holds the active-memory lock${diagnostic}. Retry after it finishes; remove the lock only after confirming that owner is no longer active.`,
          { cause: error },
        );
      }
      if (createdLock) {
        await rm(lockPath, { force: true }).catch(() => undefined);
      }
      throw error;
    }
  }

  async #atomicCommit(documentPath: string, content: string): Promise<void> {
    const temporaryPath = `${documentPath}.${randomUUID()}.tmp`;

    try {
      const temporary = await open(temporaryPath, "wx", 0o600);
      try {
        await temporary.writeFile(content, "utf8");
        await temporary.sync();
      } finally {
        await temporary.close();
      }
      await rename(temporaryPath, documentPath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  #documentPath(projectId: string): string {
    const digest = createHash("sha256").update(projectId, "utf8").digest("hex");
    return join(this.#directory, `project_${digest}.json`);
  }
}

type MutationResult = Readonly<{
  document: MemoryLogDocument;
  resultId: string;
  previousId?: string;
}>;

function assertExpectedItem(
  items: readonly MemoryItem[],
  memoryId: string,
  expectedVersion: number,
): void {
  const item = items.find((candidate) => candidate.id === memoryId);
  if (item === undefined || item.version !== expectedVersion) {
    throw new ActiveMemoryConflictError(memoryId);
  }
}

function projectIdValueChecked(value: string): string {
  const projectId = value.trim();
  if (projectId.length < 1 || projectId.length > PROJECT_ID_MAX_LENGTH) {
    throw new ActiveMemoryError(
      `Project ID must contain from 1 to ${PROJECT_ID_MAX_LENGTH} characters. Use project list to find a valid ID.`,
    );
  }
  return projectId;
}

async function readLockDiagnostic(lockPath: string): Promise<string> {
  try {
    const value: unknown = JSON.parse(await readFile(lockPath, "utf8"));
    if (
      !isRecord(value) ||
      value.schemaVersion !== LOCK_SCHEMA_VERSION ||
      typeof value.ownerToken !== "string" ||
      !UUID_PATTERN.test(value.ownerToken) ||
      typeof value.pid !== "number" ||
      !Number.isSafeInteger(value.pid) ||
      value.pid < 1 ||
      typeof value.createdAt !== "string" ||
      Number.isNaN(Date.parse(value.createdAt))
    ) {
      return " with unreadable ownership metadata";
    }
    return ` (PID ${value.pid}, created ${value.createdAt}, owner ${value.ownerToken})`;
  } catch {
    return " with unreadable ownership metadata";
  }
}

async function releaseOwnedLock(
  lockPath: string,
  ownerToken: string,
): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(lockPath, "utf8"));
    if (isRecord(value) && value.ownerToken === ownerToken) {
      await rm(lockPath);
    }
  } catch {
    // A missing, replaced, or malformed lock is not owned safely enough to remove.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
