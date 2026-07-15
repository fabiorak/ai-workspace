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
  GENERAL_PROJECT_LINK_LIMITS,
  GeneralProjectLinkConflictError,
  GeneralProjectLinkError,
  type GeneralProjectLink,
  type GeneralProjectLinkStore,
} from "@ai-workspace/general-project-link";

const SCHEMA_VERSION = 1;
const MAX_DOCUMENT_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const DOCUMENT_PATTERN = /^link_[a-f0-9]{64}\.json$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

export class JsonGeneralProjectLinkStore implements GeneralProjectLinkStore {
  readonly #directory: string;
  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "general-project-links");
  }

  public async list(): Promise<readonly GeneralProjectLink[]> {
    let names: string[];
    try {
      names = await readdir(this.#directory);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT")
        return Object.freeze([]);
      throw storageError(error);
    }
    return this.#decodeNames(names);
  }

  public async create(link: GeneralProjectLink): Promise<GeneralProjectLink> {
    validateLink(link);
    return this.#locked(async () => {
      let names: string[] = [];
      try {
        names = await readdir(this.#directory);
      } catch (error) {
        if (!(isNodeError(error) && error.code === "ENOENT")) throw error;
      }
      const links = await this.#decodeNames(names);
      if (
        links.some(
          (candidate) =>
            candidate.id === link.id ||
            (candidate.generalEventId === link.generalEventId &&
              candidate.generalContentSha256 === link.generalContentSha256 &&
              candidate.targetProjectId === link.targetProjectId),
        )
      )
        throw new GeneralProjectLinkConflictError();
      if (links.length >= GENERAL_PROJECT_LINK_LIMITS.links)
        throw new GeneralProjectLinkError(
          `General project links exceed the bounded ${GENERAL_PROJECT_LINK_LIMITS.links}-document store.`,
        );
      await this.#atomicCommit(
        join(this.#directory, documentName(link.id)),
        encodeDocument(link),
      );
      return link;
    });
  }

  async #decodeNames(
    names: readonly string[],
  ): Promise<readonly GeneralProjectLink[]> {
    const documents = names
      .filter((name) => DOCUMENT_PATTERN.test(name))
      .sort();
    if (
      documents.length > GENERAL_PROJECT_LINK_LIMITS.links ||
      names.some(
        (name) => name.endsWith(".json") && !DOCUMENT_PATTERN.test(name),
      ) ||
      names.some((name) => name.endsWith(".tmp"))
    )
      throw storageError();
    const links: GeneralProjectLink[] = [];
    let total = 0;
    for (const name of documents) {
      const content = await readFile(join(this.#directory, name), "utf8");
      const bytes = Buffer.byteLength(content, "utf8");
      total += bytes;
      if (bytes > MAX_DOCUMENT_BYTES || total > MAX_TOTAL_BYTES)
        throw storageError();
      const link = decodeDocument(content);
      if (name !== documentName(link.id)) throw storageError();
      links.push(link);
    }
    const ids = new Set<string>();
    const tuples = new Set<string>();
    for (const link of links) {
      const tuple = `${link.generalEventId}\0${link.generalContentSha256}\0${link.targetProjectId}`;
      if (ids.has(link.id) || tuples.has(tuple)) throw storageError();
      ids.add(link.id);
      tuples.add(tuple);
    }
    return Object.freeze(
      links.sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id, "en"),
      ),
    );
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = join(this.#directory, ".links.lock");
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
      if (isNodeError(error) && error.code === "EEXIST")
        throw new GeneralProjectLinkError(
          "Another process holds the General project-link lock. Retry after it finishes; remove a stale lock only after confirming its owner is inactive.",
        );
      if (error instanceof GeneralProjectLinkError) throw error;
      throw storageError(error);
    } finally {
      if (owns) await releaseOwnedLock(lockPath, ownerToken);
    }
  }

  async #atomicCommit(path: string, content: string): Promise<void> {
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
      throw storageError();
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
}

function encodeDocument(link: GeneralProjectLink): string {
  return `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, link }, null, 2)}\n`;
}
function decodeDocument(content: string): GeneralProjectLink {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, ["link", "schemaVersion"]) ||
      value.schemaVersion !== SCHEMA_VERSION ||
      !record(value.link)
    )
      throw storageError();
    const link = value.link as unknown as GeneralProjectLink;
    validateLink(link);
    if (encodeDocument(link) !== content) throw storageError();
    return link;
  } catch (error) {
    if (error instanceof GeneralProjectLinkError) throw error;
    throw storageError(error);
  }
}
function validateLink(link: GeneralProjectLink): void {
  if (
    !record(link) ||
    !exactKeys(link, [
      "actor",
      "createdAt",
      "dataClass",
      "effect",
      "generalContentSha256",
      "generalConversationId",
      "generalEventId",
      "id",
      "origin",
      "rationale",
      "rationaleExactBytes",
      "rationaleSha256",
      "sourceScope",
      "targetProjectId",
      "targetScope",
      "verification",
    ]) ||
    !validText(link.id, 256) ||
    link.sourceScope !== "GENERAL" ||
    !validText(link.generalConversationId, 256) ||
    !validText(link.generalEventId, 256) ||
    !DIGEST_PATTERN.test(link.generalContentSha256) ||
    link.targetScope !== "PROJECT" ||
    !validText(link.targetProjectId, 256) ||
    !validText(link.rationale, GENERAL_PROJECT_LINK_LIMITS.rationaleBytes) ||
    link.rationaleExactBytes !== Buffer.byteLength(link.rationale, "utf8") ||
    !DIGEST_PATTERN.test(link.rationaleSha256) ||
    link.rationaleSha256 !== sha256(link.rationale) ||
    !validTimestamp(link.createdAt) ||
    link.actor !== "LOCAL_USER" ||
    link.origin !== "USER_AUTHORED" ||
    link.verification !== "UNVERIFIED" ||
    link.dataClass !== "CONFIDENTIAL" ||
    link.effect !== "LINK_ONLY"
  )
    throw storageError();
}
function documentName(id: string): string {
  return `link_${sha256(id)}.json`;
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
function storageError(cause?: unknown): GeneralProjectLinkError {
  return new GeneralProjectLinkError(
    "General project-link state is unreadable, corrupt, cross-scoped, oversized, noncanonical, duplicate, or integrity-invalid. Preserve it, move only the diagnosed document aside, and retry without partial results.",
    cause === undefined ? undefined : { cause },
  );
}
async function releaseOwnedLock(path: string, token: string): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (record(value) && value.ownerToken === token) await rm(path);
  } catch {
    /* Missing or replaced locks are not ours. */
  }
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
