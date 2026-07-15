import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  type PseudonymMapping,
  validatePseudonymMapping,
} from "@ai-workspace/privacy-gateway";
import {
  EncryptedPrivacyMappingStore,
  LocalPrivacyMappingError,
} from "../src/index.ts";

const key = Buffer.alloc(32, 11);
const mapping: PseudonymMapping = validatePseudonymMapping({
  schemaVersion: 1,
  mappingSetId: "mapping-1",
  projectId: "project-1",
  workItemId: "work-1",
  handoffId: "handoff-1",
  modelId: "model-balanced",
  entries: [
    {
      itemId: "handoff:objective",
      originalContentSha256: "a".repeat(64),
      transformedContentSha256: "b".repeat(64),
      originalByteStart: 5,
      originalByteEnd: 20,
      transformedByteStart: 5,
      transformedByteEnd: 37,
      entityType: "CUSTOMER",
      pseudonym: "[[AW_CUSTOMER_0123456789ABCDEF]]",
      originalBase64: Buffer.from("fictional-value").toString("base64"),
    },
  ],
});

test("stores separate authenticated ciphertext privately and reads it with the explicit key", async () => {
  const home = join(tmpdir(), `aiw-private-map-${crypto.randomUUID()}`);
  const store = new EncryptedPrivacyMappingStore(home, key);
  await store.save(mapping);
  assert.deepEqual(await store.read(mapping.mappingSetId), mapping);
  const directory = join(home, "privacy-mappings");
  const names = await readdir(directory);
  assert.equal(
    names.some((name) => name.endsWith(".tmp") || name.endsWith(".lock")),
    false,
  );
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  const path = join(directory, names[0]!);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  const ciphertext = await readFile(path, "utf8");
  assert.equal(ciphertext.includes("fictional-value"), false);
  assert.equal(ciphertext.includes(key.toString("hex")), false);
  await assert.rejects(
    () => store.save(mapping),
    /immutable encrypted mapping/u,
  );
});

test("uses fresh nonces and ciphertext for identical plaintext in separate stores", async () => {
  const firstHome = join(tmpdir(), `aiw-private-map-a-${crypto.randomUUID()}`);
  const secondHome = join(tmpdir(), `aiw-private-map-b-${crypto.randomUUID()}`);
  await new EncryptedPrivacyMappingStore(firstHome, key).save(mapping);
  await new EncryptedPrivacyMappingStore(secondHome, key).save(mapping);
  const firstName = (await readdir(join(firstHome, "privacy-mappings")))[0]!;
  const secondName = (await readdir(join(secondHome, "privacy-mappings")))[0]!;
  assert.notEqual(
    await readFile(join(firstHome, "privacy-mappings", firstName), "utf8"),
    await readFile(join(secondHome, "privacy-mappings", secondName), "utf8"),
  );
});

test("fails closed for wrong keys, tampering, unsafe permissions, temporary state, and owner locks", async () => {
  const home = join(tmpdir(), `aiw-private-map-invalid-${crypto.randomUUID()}`);
  const store = new EncryptedPrivacyMappingStore(home, key);
  await store.save(mapping);
  const directory = join(home, "privacy-mappings");
  const name = (await readdir(directory))[0]!;
  await assert.rejects(
    () =>
      new EncryptedPrivacyMappingStore(home, Buffer.alloc(32, 12)).read(
        mapping.mappingSetId,
      ),
    LocalPrivacyMappingError,
  );
  await chmod(join(directory, name), 0o644);
  await assert.rejects(
    () => store.read(mapping.mappingSetId),
    LocalPrivacyMappingError,
  );
  await chmod(join(directory, name), 0o600);
  const document = JSON.parse(
    await readFile(join(directory, name), "utf8"),
  ) as { ciphertext: string };
  document.ciphertext = `${document.ciphertext.slice(0, -4)}AAAA`;
  await writeFile(
    join(directory, name),
    `${JSON.stringify(document, null, 2)}\n`,
    { mode: 0o600 },
  );
  await assert.rejects(
    () => store.read(mapping.mappingSetId),
    LocalPrivacyMappingError,
  );

  const temporaryHome = join(
    tmpdir(),
    `aiw-private-map-temp-${crypto.randomUUID()}`,
  );
  const temporaryDirectory = join(temporaryHome, "privacy-mappings");
  await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
  await writeFile(join(temporaryDirectory, "orphan.tmp"), "partial", {
    mode: 0o600,
  });
  await assert.rejects(
    () =>
      new EncryptedPrivacyMappingStore(temporaryHome, key).read(
        mapping.mappingSetId,
      ),
    LocalPrivacyMappingError,
  );

  const lockHome = join(
    tmpdir(),
    `aiw-private-map-lock-${crypto.randomUUID()}`,
  );
  const lockDirectory = join(lockHome, "privacy-mappings");
  await mkdir(lockDirectory, { recursive: true, mode: 0o700 });
  await writeFile(
    join(lockDirectory, ".mappings.lock"),
    `${JSON.stringify({ schemaVersion: 1, ownerToken: "other", pid: 999999 })}\n`,
    { mode: 0o600 },
  );
  await assert.rejects(
    () => new EncryptedPrivacyMappingStore(lockHome, key).save(mapping),
    /owner lock/u,
  );
  await rm(lockHome, { recursive: true, force: true });
});

test("authenticates clear scope metadata and rejects oversized encrypted documents", async () => {
  const metadataHome = join(
    tmpdir(),
    `aiw-private-map-metadata-${crypto.randomUUID()}`,
  );
  const metadataStore = new EncryptedPrivacyMappingStore(metadataHome, key);
  await metadataStore.save(mapping);
  const metadataDirectory = join(metadataHome, "privacy-mappings");
  const metadataName = (await readdir(metadataDirectory))[0]!;
  const metadataPath = join(metadataDirectory, metadataName);
  const document = JSON.parse(await readFile(metadataPath, "utf8")) as {
    metadata: { modelId: string };
  };
  document.metadata.modelId = "different-model";
  await writeFile(metadataPath, `${JSON.stringify(document, null, 2)}\n`, {
    mode: 0o600,
  });
  await assert.rejects(
    () => metadataStore.read(mapping.mappingSetId),
    LocalPrivacyMappingError,
  );

  const oversizedHome = join(
    tmpdir(),
    `aiw-private-map-oversized-${crypto.randomUUID()}`,
  );
  const oversizedStore = new EncryptedPrivacyMappingStore(oversizedHome, key);
  await oversizedStore.save(mapping);
  const oversizedDirectory = join(oversizedHome, "privacy-mappings");
  const oversizedName = (await readdir(oversizedDirectory))[0]!;
  await writeFile(
    join(oversizedDirectory, oversizedName),
    "x".repeat(256 * 1024 + 1),
    { mode: 0o600 },
  );
  await assert.rejects(
    () => oversizedStore.read(mapping.mappingSetId),
    LocalPrivacyMappingError,
  );
});
