import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
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

const MAX_ENVELOPE_BYTES = 16 * 1024;
const MAX_ENVELOPES = 1_000;
const MIN_PASSPHRASE_BYTES = 16;
const MAX_PASSPHRASE_BYTES = 1_024;
const ENVELOPE = /^custody_[a-f0-9]{64}\.json$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const KDF = Object.freeze({
  name: "SCRYPT" as const,
  N: 32_768,
  r: 8,
  p: 1,
  keyLength: 32,
});

type EnvelopeMetadata = Readonly<{
  schemaVersion: 1;
  algorithm: "AES-256-GCM";
  purpose: "PRIVACY_MAPPING_KEY_CUSTODY";
  mappingSetId: string;
  kdf: typeof KDF;
}>;

type Envelope = Readonly<{
  metadata: EnvelopeMetadata;
  salt: string;
  nonce: string;
  ciphertext: string;
  authenticationTag: string;
}>;

export type KeyCustodyCandidateObservation = Readonly<{
  candidate: "VOLATILE_IMPORT" | "OS_CREDENTIAL_STORE" | "PASSPHRASE_WRAPPING";
  deterministicOutcome: "REJECT" | "PASS";
  crossPlatformContract: boolean;
  headless: boolean;
  offlineWorkspaceMove: boolean;
  acceptedDependenciesOnly: boolean;
  generatedKeyNotExposed: boolean;
}>;

export class LocalKeyCustodyError extends Error {
  public constructor(
    message = "Local key-custody state is unavailable, locked, corrupt, unauthenticated, oversized, noncanonical, permission-unsafe, incomplete, duplicate, or incompatible. Preserve existing ciphertext and custody state, verify the passphrase and mapping-set identity, then retry.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LocalKeyCustodyError";
  }
}

/**
 * Deterministic capability evidence. This performs no host credential-store
 * access and includes no host or user identity.
 */
export function inspectKeyCustodyCandidates(): readonly KeyCustodyCandidateObservation[] {
  return Object.freeze([
    Object.freeze({
      candidate: "VOLATILE_IMPORT" as const,
      deterministicOutcome: "REJECT" as const,
      crossPlatformContract: true,
      headless: true,
      offlineWorkspaceMove: true,
      acceptedDependenciesOnly: true,
      generatedKeyNotExposed: false,
    }),
    Object.freeze({
      candidate: "OS_CREDENTIAL_STORE" as const,
      deterministicOutcome: "REJECT" as const,
      crossPlatformContract: false,
      headless: false,
      offlineWorkspaceMove: false,
      acceptedDependenciesOnly: false,
      generatedKeyNotExposed: true,
    }),
    Object.freeze({
      candidate: "PASSPHRASE_WRAPPING" as const,
      deterministicOutcome: "PASS" as const,
      crossPlatformContract: true,
      headless: true,
      offlineWorkspaceMove: true,
      acceptedDependenciesOnly: true,
      generatedKeyNotExposed: true,
    }),
  ]);
}

export class PassphraseKeyCustody {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    if (!validText(workspaceHome)) throw custodyError();
    this.#directory = join(workspaceHome, "privacy-key-custody");
  }

  public async create(
    mappingSetId: string,
    passphrase: string,
  ): Promise<Uint8Array> {
    validateMappingSetId(mappingSetId);
    validatePassphrase(passphrase);
    const mappingKey = randomBytes(32);
    try {
      await this.#locked(async () => {
        const names = await this.#names();
        this.#validateNames(names);
        const name = envelopeName(mappingSetId);
        if (names.includes(name))
          throw new LocalKeyCustodyError(
            "An immutable custody envelope already exists for this mapping-set identity. Existing custody state and ciphertext were unchanged.",
          );
        await this.#commit(
          join(this.#directory, name),
          await wrap(mappingSetId, mappingKey, passphrase),
        );
      });
      return Uint8Array.from(mappingKey);
    } finally {
      mappingKey.fill(0);
    }
  }

  public async unlock(
    mappingSetId: string,
    passphrase: string,
  ): Promise<Uint8Array> {
    validateMappingSetId(mappingSetId);
    validatePassphrase(passphrase);
    try {
      const names = await this.#names();
      this.#validateNames(names);
      const name = envelopeName(mappingSetId);
      if (!names.includes(name)) throw custodyError();
      await privateMode(this.#directory, 0o700);
      const path = join(this.#directory, name);
      await privateMode(path, 0o600);
      const bytes = await readFile(path);
      if (bytes.length > MAX_ENVELOPE_BYTES) throw custodyError();
      return await unwrap(bytes.toString("utf8"), mappingSetId, passphrase);
    } catch (error) {
      if (error instanceof LocalKeyCustodyError) throw error;
      throw custodyError(error);
    }
  }

  async #names(): Promise<string[]> {
    return readdir(this.#directory);
  }

  #validateNames(names: readonly string[]): void {
    if (
      names.some((name) => name.endsWith(".tmp")) ||
      names.some((name) => name.endsWith(".json") && !ENVELOPE.test(name)) ||
      names.filter((name) => ENVELOPE.test(name)).length > MAX_ENVELOPES
    )
      throw custodyError();
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = join(this.#directory, ".custody.lock");
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
        throw new LocalKeyCustodyError(
          "Another process holds the key-custody owner lock. Retry after it finishes; remove a stale lock only after confirming its owner is inactive.",
        );
      if (error instanceof LocalKeyCustodyError) throw error;
      throw custodyError(error);
    } finally {
      if (owns) await releaseOwnedLock(lockPath, ownerToken);
    }
  }

  async #commit(path: string, content: string): Promise<void> {
    if (Buffer.byteLength(content, "utf8") > MAX_ENVELOPE_BYTES)
      throw custodyError();
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

async function wrap(
  mappingSetId: string,
  mappingKey: Buffer,
  passphrase: string,
): Promise<string> {
  const metadata = metadataFor(mappingSetId);
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const wrappingKey = await derive(passphrase, salt);
  try {
    const cipher = createCipheriv("aes-256-gcm", wrappingKey, nonce);
    cipher.setAAD(Buffer.from(JSON.stringify(metadata), "utf8"));
    const ciphertext = Buffer.concat([
      cipher.update(mappingKey),
      cipher.final(),
    ]);
    return serialize({
      metadata,
      salt: salt.toString("base64"),
      nonce: nonce.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      authenticationTag: cipher.getAuthTag().toString("base64"),
    });
  } finally {
    wrappingKey.fill(0);
  }
}

async function unwrap(
  content: string,
  mappingSetId: string,
  passphrase: string,
): Promise<Uint8Array> {
  try {
    const value: unknown = JSON.parse(content);
    const envelope = validateEnvelope(value, mappingSetId);
    if (serialize(envelope) !== content) throw custodyError();
    const salt = decode(envelope.salt, 16);
    const nonce = decode(envelope.nonce, 12);
    const ciphertext = decode(envelope.ciphertext, 32);
    const tag = decode(envelope.authenticationTag, 16);
    const wrappingKey = await derive(passphrase, salt);
    try {
      const decipher = createDecipheriv("aes-256-gcm", wrappingKey, nonce);
      decipher.setAAD(Buffer.from(JSON.stringify(envelope.metadata), "utf8"));
      decipher.setAuthTag(tag);
      const key = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      if (key.length !== 32) throw custodyError();
      return Uint8Array.from(key);
    } finally {
      wrappingKey.fill(0);
    }
  } catch (error) {
    if (error instanceof LocalKeyCustodyError) throw error;
    throw custodyError(error);
  }
}

function validateEnvelope(value: unknown, mappingSetId: string): Envelope {
  if (
    !record(value) ||
    !exactKeys(value, [
      "authenticationTag",
      "ciphertext",
      "metadata",
      "nonce",
      "salt",
    ]) ||
    !record(value.metadata) ||
    !exactKeys(value.metadata, [
      "algorithm",
      "kdf",
      "mappingSetId",
      "purpose",
      "schemaVersion",
    ]) ||
    value.metadata.schemaVersion !== 1 ||
    value.metadata.algorithm !== "AES-256-GCM" ||
    value.metadata.purpose !== "PRIVACY_MAPPING_KEY_CUSTODY" ||
    value.metadata.mappingSetId !== mappingSetId ||
    !record(value.metadata.kdf) ||
    !exactKeys(value.metadata.kdf, ["N", "keyLength", "name", "p", "r"]) ||
    value.metadata.kdf.name !== KDF.name ||
    value.metadata.kdf.N !== KDF.N ||
    value.metadata.kdf.r !== KDF.r ||
    value.metadata.kdf.p !== KDF.p ||
    value.metadata.kdf.keyLength !== KDF.keyLength ||
    typeof value.salt !== "string" ||
    typeof value.nonce !== "string" ||
    typeof value.ciphertext !== "string" ||
    typeof value.authenticationTag !== "string"
  )
    throw custodyError();
  return Object.freeze({
    metadata: metadataFor(mappingSetId),
    salt: value.salt,
    nonce: value.nonce,
    ciphertext: value.ciphertext,
    authenticationTag: value.authenticationTag,
  });
}

function metadataFor(mappingSetId: string): EnvelopeMetadata {
  return Object.freeze({
    schemaVersion: 1 as const,
    algorithm: "AES-256-GCM" as const,
    purpose: "PRIVACY_MAPPING_KEY_CUSTODY" as const,
    mappingSetId,
    kdf: KDF,
  });
}

function serialize(envelope: Envelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function derive(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      passphrase,
      salt,
      KDF.keyLength,
      { N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(custodyError(error));
        else resolve(key);
      },
    );
  });
}

function envelopeName(mappingSetId: string): string {
  return `custody_${createHash("sha256").update(mappingSetId, "utf8").digest("hex")}.json`;
}

function validateMappingSetId(value: string): void {
  if (!validText(value) || Buffer.byteLength(value, "utf8") > 256)
    throw custodyError();
}

function validatePassphrase(value: string): void {
  const bytes =
    typeof value === "string" ? Buffer.byteLength(value, "utf8") : 0;
  if (bytes < MIN_PASSPHRASE_BYTES || bytes > MAX_PASSPHRASE_BYTES)
    throw new LocalKeyCustodyError(
      "The local custody passphrase must contain between 16 and 1024 UTF-8 bytes. It was not stored.",
    );
}

function decode(value: string, bytes: number): Buffer {
  if (!BASE64.test(value)) throw custodyError();
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== bytes || decoded.toString("base64") !== value)
    throw custodyError();
  return decoded;
}

async function privateMode(path: string, expected: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  if (mode !== expected) throw custodyError();
}

async function releaseOwnedLock(
  path: string,
  ownerToken: string,
): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (record(value) && value.ownerToken === ownerToken)
      await rm(path, { force: true });
  } catch {
    // Preserve an unreadable or replaced lock for explicit operator review.
  }
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === keys[index])
  );
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && !/\p{Cc}/u.test(value)
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function custodyError(cause?: unknown): LocalKeyCustodyError {
  return new LocalKeyCustodyError(undefined, { cause });
}
