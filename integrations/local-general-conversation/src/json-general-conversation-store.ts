import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { join } from "node:path";

import {
  GENERAL_LIMITS,
  GeneralConversationConflictError,
  GeneralConversationError,
  type GeneralConversation,
  type GeneralConversationStore,
  type GeneralEvent,
} from "@ai-workspace/general-conversation";

const SCHEMA_VERSION = 1;
const MAX_DOCUMENTS = 1_000;
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const DOCUMENT_PATTERN = /^conversation_[a-f0-9]{64}\.json$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

export class JsonGeneralConversationStore implements GeneralConversationStore {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "general-conversations");
  }

  public async list(): Promise<readonly GeneralConversation[]> {
    let names: string[];
    try {
      names = await readdir(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT")
        return Object.freeze([]);
      throw storageError(error);
    }
    const documents = names
      .filter((name) => DOCUMENT_PATTERN.test(name))
      .sort();
    if (
      documents.length > MAX_DOCUMENTS ||
      names.some(
        (name) => name.endsWith(".json") && !DOCUMENT_PATTERN.test(name),
      ) ||
      names.some((name) => name.endsWith(".tmp"))
    )
      throw storageError();
    const conversations: GeneralConversation[] = [];
    let totalBytes = 0;
    for (const name of documents) {
      const content = await this.#readBounded(join(this.#directory, name));
      totalBytes += Buffer.byteLength(content, "utf8");
      if (totalBytes > MAX_TOTAL_BYTES) throw storageError();
      const conversation = decodeDocument(content);
      if (name !== documentName(conversation.id)) throw storageError();
      conversations.push(conversation);
    }
    return Object.freeze(conversations.sort(compareConversations));
  }

  public async find(id: string): Promise<GeneralConversation | null> {
    try {
      return decodeDocument(await this.#readBounded(this.#documentPath(id)));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return null;
      if (error instanceof GeneralConversationError) throw error;
      throw storageError(error);
    }
  }

  public async create(
    conversation: GeneralConversation,
  ): Promise<GeneralConversation> {
    validateConversation(conversation);
    const path = this.#documentPath(conversation.id);
    return this.#locked(path, async () => {
      try {
        await readFile(path);
        throw new GeneralConversationConflictError();
      } catch (error) {
        if (!(isNodeError(error) && error.code === "ENOENT")) throw error;
      }
      await this.#atomicCommit(path, encodeDocument(conversation));
      return conversation;
    });
  }

  public async append(
    id: string,
    expectedEventCount: number,
    event: GeneralEvent,
  ): Promise<GeneralConversation> {
    const path = this.#documentPath(id);
    return this.#locked(path, async () => {
      const current = decodeDocument(await this.#readBounded(path));
      if (
        current.id !== id ||
        current.events.length !== expectedEventCount ||
        event.conversationId !== id ||
        event.sequence !== expectedEventCount
      )
        throw new GeneralConversationConflictError();
      if (
        current.events.some(
          (candidate) =>
            candidate.id === event.id ||
            candidate.contentSha256 === event.contentSha256,
        )
      )
        throw new GeneralConversationConflictError();
      const updated = Object.freeze({
        ...current,
        events: Object.freeze([...current.events, event]),
      });
      validateConversation(updated);
      await this.#atomicCommit(path, encodeDocument(updated));
      return updated;
    });
  }

  async #locked<T>(
    documentPath: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const lockPath = `${documentPath}.lock`;
    const ownerToken = randomUUID();
    let ownsLock = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const handle = await open(lockPath, "wx", 0o600);
      ownsLock = true;
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
      if (isNodeError(error) && error.code === "EEXIST")
        throw new GeneralConversationError(
          "Another process holds the General conversation lock. Retry after it finishes; remove a stale lock only after confirming its owner is inactive.",
        );
      if (error instanceof GeneralConversationError) throw error;
      throw storageError(error);
    } finally {
      if (ownsLock) await releaseOwnedLock(lockPath, ownerToken);
    }
  }

  async #readBounded(path: string): Promise<string> {
    const content = await readFile(path, "utf8");
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
      throw storageError();
    return content;
  }

  async #atomicCommit(path: string, content: string): Promise<void> {
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
      throw storageError();
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporaryPath, "wx", 0o600);
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporaryPath, path);
      await chmod(path, 0o600);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  #documentPath(id: string): string {
    if (!validText(id, 256)) throw storageError();
    return join(this.#directory, documentName(id));
  }
}

function encodeDocument(conversation: GeneralConversation): string {
  return `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, conversation }, null, 2)}\n`;
}

function decodeDocument(content: string): GeneralConversation {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, ["conversation", "schemaVersion"]) ||
      value.schemaVersion !== SCHEMA_VERSION ||
      !record(value.conversation)
    )
      throw storageError();
    const conversation = value.conversation as unknown as GeneralConversation;
    validateConversation(conversation);
    if (encodeDocument(conversation) !== content) throw storageError();
    return conversation;
  } catch (error) {
    if (error instanceof GeneralConversationError) throw error;
    throw storageError(error);
  }
}

function validateConversation(value: GeneralConversation): void {
  if (
    !record(value) ||
    !exactKeys(value, ["createdAt", "events", "id", "scope", "title"]) ||
    !validText(value.id, 256) ||
    value.scope !== "GENERAL" ||
    !validText(value.title, GENERAL_LIMITS.titleBytes) ||
    !validTimestamp(value.createdAt) ||
    !Array.isArray(value.events) ||
    value.events.length > GENERAL_LIMITS.eventsPerConversation
  )
    throw storageError();
  const ids = new Set<string>();
  const hashes = new Set<string>();
  value.events.forEach((event, sequence) => {
    if (
      !record(event) ||
      !exactKeys(event, [
        "actor",
        "content",
        "contentSha256",
        "conversationId",
        "dataClass",
        "exactBytes",
        "id",
        "occurredAt",
        "origin",
        "provenance",
        "scope",
        "sequence",
        "type",
        "verification",
      ]) ||
      !validText(event.id, 256) ||
      event.conversationId !== value.id ||
      event.sequence !== sequence ||
      event.scope !== "GENERAL" ||
      event.type !== "USER_MESSAGE" ||
      event.actor !== "LOCAL_USER" ||
      event.origin !== "USER_AUTHORED" ||
      event.verification !== "UNVERIFIED" ||
      event.dataClass !== "CONFIDENTIAL" ||
      !validText(event.content, GENERAL_LIMITS.contentBytes) ||
      event.exactBytes !== Buffer.byteLength(event.content, "utf8") ||
      typeof event.contentSha256 !== "string" ||
      !DIGEST_PATTERN.test(event.contentSha256) ||
      event.contentSha256 !== sha256(event.content) ||
      !validTimestamp(event.occurredAt) ||
      !record(event.provenance) ||
      !exactKeys(event.provenance, ["capturedAt", "kind"]) ||
      event.provenance.kind !== "LOCAL_GENERAL_CAPTURE" ||
      event.provenance.capturedAt !== event.occurredAt ||
      ids.has(event.id) ||
      hashes.has(event.contentSha256)
    )
      throw storageError();
    ids.add(event.id);
    hashes.add(event.contentSha256);
  });
}

function compareConversations(
  left: GeneralConversation,
  right: GeneralConversation,
): number {
  const time = left.createdAt.localeCompare(right.createdAt);
  return time === 0 ? left.id.localeCompare(right.id, "en") : time;
}
function documentName(id: string): string {
  return `conversation_${sha256(id)}.json`;
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function validText(value: unknown, bytes: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= bytes &&
    !/\p{Cc}/u.test(value)
  );
}
function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
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
function storageError(cause?: unknown): GeneralConversationError {
  return new GeneralConversationError(
    "General conversation state is unreadable, corrupt, cross-scoped, oversized, noncanonical, or integrity-invalid. Preserve it, move the affected document aside, and retry without partial results.",
    cause === undefined ? undefined : { cause },
  );
}
async function releaseOwnedLock(path: string, token: string): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (record(value) && value.ownerToken === token) await rm(path);
  } catch {
    /* Missing or replaced locks are not ours to remove. */
  }
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
