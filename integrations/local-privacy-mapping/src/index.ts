import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
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
  validatePseudonymMapping,
  validatePseudonymMappingV2,
  type VersionedPseudonymMapping,
} from "@ai-workspace/privacy-gateway";

const MAX_DOCUMENT_BYTES = 256 * 1024;
const DOCUMENT = /^mapping_[a-f0-9]{64}\.json$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

type MetadataV1 = Readonly<{
  schemaVersion: 1;
  algorithm: "AES-256-GCM";
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
}>;
type MetadataV2 = Readonly<{
  schemaVersion: 1;
  mappingSchemaVersion: 2;
  algorithm: "AES-256-GCM";
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
}>;
type Metadata = MetadataV1 | MetadataV2;

export class LocalPrivacyMappingError extends Error {
  public constructor(
    message = "Encrypted privacy-mapping state is unreadable, corrupt, unauthenticated, oversized, noncanonical, permission-unsafe, incomplete, duplicate, or incompatible. Preserve it, verify the explicit key and exact scope, then retry without partial results.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LocalPrivacyMappingError";
  }
}

export class EncryptedPrivacyMappingStore {
  readonly #directory: string;
  readonly #key: Buffer;
  public constructor(workspaceHome: string, key: Uint8Array) {
    if (!(key instanceof Uint8Array) || key.byteLength !== 32)
      throw storageError();
    this.#directory = join(workspaceHome, "privacy-mappings");
    this.#key = Buffer.from(key);
  }

  public async save(mapping: VersionedPseudonymMapping): Promise<void> {
    const validated = validateMapping(mapping);
    await this.#locked(async () => {
      const names = await this.#names();
      this.#validateNames(names);
      const path = join(this.#directory, documentName(validated.mappingSetId));
      if (names.includes(documentName(validated.mappingSetId)))
        throw new LocalPrivacyMappingError(
          "An immutable encrypted mapping already exists for this mapping-set identity. Choose a new identity; existing ciphertext was unchanged.",
        );
      await this.#commit(path, encrypt(validated, this.#key));
    });
  }

  public async read(mappingSetId: string): Promise<VersionedPseudonymMapping> {
    if (!validText(mappingSetId)) throw storageError();
    let names: string[];
    try {
      names = await this.#names();
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT")
        throw storageError(error);
      throw storageError(error);
    }
    this.#validateNames(names);
    const name = documentName(mappingSetId);
    if (!names.includes(name)) throw storageError();
    await privateMode(this.#directory, 0o700);
    const path = join(this.#directory, name);
    await privateMode(path, 0o600);
    const bytes = await readFile(path);
    if (bytes.length > MAX_DOCUMENT_BYTES) throw storageError();
    const mapping = decrypt(bytes.toString("utf8"), this.#key);
    if (mapping.mappingSetId !== mappingSetId) throw storageError();
    return mapping;
  }

  async #names(): Promise<string[]> {
    return readdir(this.#directory);
  }
  #validateNames(names: readonly string[]): void {
    if (
      names.some((name) => name.endsWith(".tmp")) ||
      names.some((name) => name.endsWith(".json") && !DOCUMENT.test(name)) ||
      names.filter((name) => DOCUMENT.test(name)).length > 1_000
    )
      throw storageError();
  }
  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = join(this.#directory, ".mappings.lock");
    const ownerToken = randomUUID();
    let owns = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const handle = await open(lockPath, "wx", 0o600);
      owns = true;
      try {
        await handle.writeFile(
          `${JSON.stringify({ schemaVersion: 1, ownerToken, pid: process.pid })}\n`,
          "utf8",
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      return await operation();
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST")
        throw new LocalPrivacyMappingError(
          "Another process holds the encrypted privacy-mapping owner lock. Retry after it finishes; remove a stale lock only after confirming its owner is inactive.",
        );
      if (error instanceof LocalPrivacyMappingError) throw error;
      throw storageError(error);
    } finally {
      if (owns) await releaseOwnedLock(lockPath, ownerToken);
    }
  }
  async #commit(path: string, content: string): Promise<void> {
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

function encrypt(mapping: VersionedPseudonymMapping, key: Buffer): string {
  const metadata: Metadata = Object.freeze(
    mapping.schemaVersion === 1
      ? {
          schemaVersion: 1 as const,
          algorithm: "AES-256-GCM" as const,
          mappingSetId: mapping.mappingSetId,
          projectId: mapping.projectId,
          workItemId: mapping.workItemId,
          handoffId: mapping.handoffId,
          modelId: mapping.modelId,
        }
      : {
          schemaVersion: 1 as const,
          mappingSchemaVersion: 2 as const,
          algorithm: "AES-256-GCM" as const,
          mappingSetId: mapping.mappingSetId,
          projectId: mapping.projectId,
          workItemId: mapping.workItemId,
          handoffId: mapping.handoffId,
          modelId: mapping.modelId,
        },
  );
  const aad = Buffer.from(JSON.stringify(metadata), "utf8");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const plaintext = Buffer.from(`${JSON.stringify(mapping)}\n`, "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return `${JSON.stringify({ metadata, nonce: nonce.toString("base64"), ciphertext: ciphertext.toString("base64"), authenticationTag: cipher.getAuthTag().toString("base64") }, null, 2)}\n`;
}
function decrypt(content: string, key: Buffer): VersionedPseudonymMapping {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, [
        "authenticationTag",
        "ciphertext",
        "metadata",
        "nonce",
      ]) ||
      !record(value.metadata) ||
      value.metadata.schemaVersion !== 1 ||
      value.metadata.algorithm !== "AES-256-GCM" ||
      !validText(value.metadata.mappingSetId) ||
      !validText(value.metadata.projectId) ||
      !validText(value.metadata.workItemId) ||
      !validText(value.metadata.handoffId) ||
      !validText(value.metadata.modelId) ||
      typeof value.nonce !== "string" ||
      typeof value.ciphertext !== "string" ||
      typeof value.authenticationTag !== "string" ||
      !BASE64.test(value.nonce) ||
      !BASE64.test(value.ciphertext) ||
      !BASE64.test(value.authenticationTag)
    )
      throw storageError();
    const mappingSchemaVersion =
      value.metadata.mappingSchemaVersion === undefined
        ? 1
        : value.metadata.mappingSchemaVersion;
    if (
      (mappingSchemaVersion === 1 &&
        !exactKeys(value.metadata, [
          "algorithm",
          "handoffId",
          "mappingSetId",
          "modelId",
          "projectId",
          "schemaVersion",
          "workItemId",
        ])) ||
      (mappingSchemaVersion === 2 &&
        !exactKeys(value.metadata, [
          "algorithm",
          "handoffId",
          "mappingSchemaVersion",
          "mappingSetId",
          "modelId",
          "projectId",
          "schemaVersion",
          "workItemId",
        ])) ||
      (mappingSchemaVersion !== 1 && mappingSchemaVersion !== 2)
    )
      throw storageError();
    if (`${JSON.stringify(value, null, 2)}\n` !== content) throw storageError();
    const metadata = value.metadata as unknown as Metadata;
    const nonce = Buffer.from(value.nonce, "base64");
    const ciphertext = Buffer.from(value.ciphertext, "base64");
    const tag = Buffer.from(value.authenticationTag, "base64");
    if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length < 1)
      throw storageError();
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(Buffer.from(JSON.stringify(metadata), "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const mapping = validateMapping(JSON.parse(plaintext));
    if (
      `${JSON.stringify(mapping)}\n` !== plaintext ||
      mapping.schemaVersion !== mappingSchemaVersion ||
      mapping.mappingSetId !== metadata.mappingSetId ||
      mapping.projectId !== metadata.projectId ||
      mapping.workItemId !== metadata.workItemId ||
      mapping.handoffId !== metadata.handoffId ||
      mapping.modelId !== metadata.modelId
    )
      throw storageError();
    return mapping;
  } catch (error) {
    if (error instanceof LocalPrivacyMappingError) throw error;
    throw storageError(error);
  }
}
function validateMapping(value: unknown): VersionedPseudonymMapping {
  if (!record(value)) throw storageError();
  if (value.schemaVersion === 1) return validatePseudonymMapping(value);
  if (value.schemaVersion === 2) return validatePseudonymMappingV2(value);
  throw storageError();
}
function documentName(id: string): string {
  return `mapping_${createHash("sha256").update(id, "utf8").digest("hex")}.json`;
}
async function privateMode(path: string, expected: number): Promise<void> {
  if (((await stat(path)).mode & 0o777) !== expected) throw storageError();
}
async function releaseOwnedLock(path: string, token: string): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (record(value) && value.ownerToken === token) await rm(path);
  } catch {
    /* Missing or replaced locks are not ours. */
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
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
function storageError(cause?: unknown): LocalPrivacyMappingError {
  return new LocalPrivacyMappingError(
    undefined,
    cause === undefined ? undefined : { cause },
  );
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
