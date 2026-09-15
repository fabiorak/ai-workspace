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
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";

import {
  emptyStablePseudonymMap,
  validateStablePseudonymMap,
  type StablePseudonymMap,
} from "@ai-workspace/privacy-gateway";

const MAX_DOCUMENT_BYTES = 512 * 1024;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

type Envelope = Readonly<{
  metadata: Readonly<{
    schemaVersion: 1;
    algorithm: "AES-256-GCM";
    purpose: "STABLE_PRIVACY_MAP";
    scopeId: string;
    revision: number;
  }>;
  nonce: string;
  ciphertext: string;
  authenticationTag: string;
}>;

export class StablePrivacyMappingStoreError extends Error {
  public constructor(
    message = "Stable privacy mapping state is unavailable, corrupt, permission-unsafe, conflicting, or unauthenticated.",
  ) {
    super(message);
    this.name = "StablePrivacyMappingStoreError";
  }
}

export class EncryptedStablePrivacyMappingStore {
  readonly #directory: string;
  readonly #key: Buffer;

  public constructor(workspaceHome: string, key: Uint8Array) {
    if (
      !validText(workspaceHome) ||
      !(key instanceof Uint8Array) ||
      key.byteLength !== 32
    )
      throw invalid();
    this.#directory = join(workspaceHome, "stable-privacy-mappings");
    this.#key = Buffer.from(key);
  }

  public async load(scopeId: string): Promise<StablePseudonymMap> {
    if (!validText(scopeId)) throw invalid();
    const path = this.#path(scopeId);
    try {
      await privateMode(this.#directory, 0o700);
      await privateMode(path, 0o600);
      const content = await readFile(path);
      if (content.byteLength > MAX_DOCUMENT_BYTES) throw invalid();
      return decrypt(content.toString("utf8"), scopeId, this.#key);
    } catch (error) {
      if (nodeError(error, "ENOENT")) return emptyStablePseudonymMap(scopeId);
      if (error instanceof StablePrivacyMappingStoreError) throw error;
      throw invalid();
    }
  }

  public async replace(
    expectedRevision: number,
    mappingValue: StablePseudonymMap,
  ): Promise<StablePseudonymMap> {
    const mapping = validateStablePseudonymMap(mappingValue);
    if (mapping.revision !== expectedRevision + 1) throw conflict();
    const lockPath = join(this.#directory, ".stable-mappings.lock");
    const temporary = `${this.#path(mapping.scopeId)}.${randomUUID()}.tmp`;
    const ownerToken = randomUUID();
    let owns = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const lock = await open(lockPath, "wx", 0o600);
      owns = true;
      try {
        await lock.writeFile(
          `${JSON.stringify({ schemaVersion: 1, ownerToken })}\n`,
          "utf8",
        );
        await lock.sync();
      } finally {
        await lock.close();
      }
      const current = await this.load(mapping.scopeId);
      if (current.revision !== expectedRevision) throw conflict();
      const content = encrypt(mapping, this.#key);
      if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES)
        throw invalid();
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(content, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.#path(mapping.scopeId));
      await chmod(this.#path(mapping.scopeId), 0o600);
      const directory = await open(this.#directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      return await this.load(mapping.scopeId);
    } catch (error) {
      if (nodeError(error, "EEXIST")) throw conflict();
      if (error instanceof StablePrivacyMappingStoreError) throw error;
      throw invalid();
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
      if (owns) {
        const value = await readFile(lockPath, "utf8").catch(() => "");
        if (value === `${JSON.stringify({ schemaVersion: 1, ownerToken })}\n`)
          await rm(lockPath, { force: true }).catch(() => undefined);
      }
    }
  }

  #path(scopeId: string) {
    return join(
      this.#directory,
      `stable_${createHash("sha256").update(scopeId, "utf8").digest("hex")}.json`,
    );
  }
}

function encrypt(mapping: StablePseudonymMap, key: Buffer): string {
  const metadata: Envelope["metadata"] = Object.freeze({
    schemaVersion: 1,
    algorithm: "AES-256-GCM",
    purpose: "STABLE_PRIVACY_MAP",
    scopeId: mapping.scopeId,
    revision: mapping.revision,
  });
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata), "utf8"));
  const plaintext = Buffer.from(`${JSON.stringify(mapping)}\n`, "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: Envelope = Object.freeze({
    metadata,
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"),
  });
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function decrypt(content: string, scopeId: string, key: Buffer) {
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
      !exactKeys(value.metadata, [
        "algorithm",
        "purpose",
        "revision",
        "schemaVersion",
        "scopeId",
      ]) ||
      value.metadata.schemaVersion !== 1 ||
      value.metadata.algorithm !== "AES-256-GCM" ||
      value.metadata.purpose !== "STABLE_PRIVACY_MAP" ||
      value.metadata.scopeId !== scopeId ||
      !Number.isSafeInteger(value.metadata.revision) ||
      typeof value.nonce !== "string" ||
      typeof value.ciphertext !== "string" ||
      typeof value.authenticationTag !== "string" ||
      !BASE64.test(value.nonce) ||
      !BASE64.test(value.ciphertext) ||
      !BASE64.test(value.authenticationTag)
    )
      throw invalid();
    if (`${JSON.stringify(value, null, 2)}\n` !== content) throw invalid();
    const nonce = decode(value.nonce, 12);
    const tag = decode(value.authenticationTag, 16);
    const ciphertext = Buffer.from(value.ciphertext, "base64");
    if (
      ciphertext.length < 1 ||
      ciphertext.toString("base64") !== value.ciphertext
    )
      throw invalid();
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(Buffer.from(JSON.stringify(value.metadata), "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const mapping = validateStablePseudonymMap(JSON.parse(plaintext));
    if (
      `${JSON.stringify(mapping)}\n` !== plaintext ||
      mapping.scopeId !== scopeId ||
      mapping.revision !== value.metadata.revision
    )
      throw invalid();
    return mapping;
  } catch (error) {
    if (error instanceof StablePrivacyMappingStoreError) throw error;
    throw invalid();
  }
}

function decode(value: string, length: number) {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== length || bytes.toString("base64") !== value)
    throw invalid();
  return bytes;
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
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
async function privateMode(path: string, mode: number) {
  if (((await stat(path)).mode & 0o777) !== mode) throw invalid();
}
function nodeError(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
function invalid() {
  return new StablePrivacyMappingStoreError();
}
function conflict() {
  return new StablePrivacyMappingStoreError(
    "Stable privacy mapping changed concurrently.",
  );
}
