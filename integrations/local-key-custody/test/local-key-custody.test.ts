import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EncryptedPrivacyMappingStore } from "@ai-workspace/local-privacy-mapping";
import {
  type PseudonymMapping,
  validatePseudonymMapping,
} from "@ai-workspace/privacy-gateway";
import {
  inspectKeyCustodyCandidates,
  LocalKeyCustodyError,
  PassphraseKeyCustody,
} from "../src/index.ts";

const correct = "correct horse synthetic staple";
const wrong = "wrong horse synthetic staple";
const mapping: PseudonymMapping = validatePseudonymMapping({
  schemaVersion: 1,
  mappingSetId: "custody-compatible-mapping",
  projectId: "synthetic-project",
  workItemId: "synthetic-work",
  handoffId: "synthetic-handoff",
  modelId: "synthetic-model",
  entries: [
    {
      itemId: "handoff:objective",
      originalContentSha256: "a".repeat(64),
      transformedContentSha256: "b".repeat(64),
      originalByteStart: 0,
      originalByteEnd: 9,
      transformedByteStart: 0,
      transformedByteEnd: 29,
      entityType: "OTHER",
      pseudonym: "[[AW_OTHER_0123456789ABCDEF]]",
      originalBase64: Buffer.from("synthetic", "utf8").toString("base64"),
    },
  ],
});

test("candidate observations deterministically select passphrase wrapping", () => {
  const observations = inspectKeyCustodyCandidates();
  assert.deepEqual(
    observations.map(({ candidate, deterministicOutcome }) => ({
      candidate,
      deterministicOutcome,
    })),
    [
      { candidate: "VOLATILE_IMPORT", deterministicOutcome: "REJECT" },
      { candidate: "OS_CREDENTIAL_STORE", deterministicOutcome: "REJECT" },
      { candidate: "PASSPHRASE_WRAPPING", deterministicOutcome: "PASS" },
    ],
  );
  const accepted = observations[2]!;
  assert.equal(
    accepted.crossPlatformContract &&
      accepted.headless &&
      accepted.offlineWorkspaceMove &&
      accepted.acceptedDependenciesOnly &&
      accepted.generatedKeyNotExposed,
    true,
  );
});

test("creates a private randomized envelope and unlocks the exact key after a workspace move", async () => {
  const first = temporary("valid-a");
  const second = temporary("valid-b");
  try {
    const custody = new PassphraseKeyCustody(first);
    const key = await custody.create("synthetic-mapping", correct);
    assert.equal(key.byteLength, 32);
    const directory = join(first, "privacy-key-custody");
    const [name] = await import("node:fs/promises").then(({ readdir }) =>
      readdir(directory),
    );
    assert.ok(name);
    const content = await readFile(join(directory, name), "utf8");
    assert.equal(content.includes(Buffer.from(key).toString("hex")), false);
    assert.equal(content.includes(correct), false);
    await mkdir(second, { recursive: true, mode: 0o700 });
    await import("node:fs/promises").then(({ cp }) =>
      cp(directory, join(second, "privacy-key-custody"), { recursive: true }),
    );
    await chmod(join(second, "privacy-key-custody"), 0o700);
    await chmod(join(second, "privacy-key-custody", name), 0o600);
    const moved = await new PassphraseKeyCustody(second).unlock(
      "synthetic-mapping",
      correct,
    );
    assert.deepEqual(moved, key);
  } finally {
    await cleanup(first, second);
  }
});

test("uses fresh envelope randomness and rejects duplicates without changing state", async () => {
  const first = temporary("random-a");
  const second = temporary("random-b");
  try {
    const a = new PassphraseKeyCustody(first);
    const b = new PassphraseKeyCustody(second);
    await a.create("same-synthetic-scope", correct);
    await b.create("same-synthetic-scope", correct);
    const documentA = await onlyEnvelope(first);
    const documentB = await onlyEnvelope(second);
    assert.notEqual(documentA, documentB);
    await assert.rejects(
      () => a.create("same-synthetic-scope", correct),
      /already exists/u,
    );
    assert.equal(await onlyEnvelope(first), documentA);
  } finally {
    await cleanup(first, second);
  }
});

test("wrong passphrase, corruption, noncanonical state, unsafe permissions, and incomplete writes fail closed", async () => {
  const homes = Array.from({ length: 5 }, (_, index) =>
    temporary(`invalid-${String(index)}`),
  );
  try {
    const wrongHome = homes[0]!;
    const wrongStore = new PassphraseKeyCustody(wrongHome);
    await wrongStore.create("wrong-secret", correct);
    await assert.rejects(
      () => wrongStore.unlock("wrong-secret", wrong),
      LocalKeyCustodyError,
    );

    const corruptHome = homes[1]!;
    const corruptStore = new PassphraseKeyCustody(corruptHome);
    await corruptStore.create("corrupt", correct);
    const corruptPath = await onlyEnvelopePath(corruptHome);
    const corrupt = JSON.parse(await readFile(corruptPath, "utf8")) as {
      ciphertext: string;
    };
    corrupt.ciphertext = `${corrupt.ciphertext.slice(0, -4)}AAAA`;
    await writeFile(corruptPath, `${JSON.stringify(corrupt, null, 2)}\n`, {
      mode: 0o600,
    });
    await assert.rejects(
      () => corruptStore.unlock("corrupt", correct),
      LocalKeyCustodyError,
    );

    const permissionHome = homes[2]!;
    const permissionStore = new PassphraseKeyCustody(permissionHome);
    await permissionStore.create("permissions", correct);
    const permissionPath = await onlyEnvelopePath(permissionHome);
    const permissionDirectory = join(permissionHome, "privacy-key-custody");
    await chmod(permissionDirectory, 0o755);
    await assert.rejects(
      () => permissionStore.unlock("permissions", correct),
      LocalKeyCustodyError,
    );
    await chmod(permissionDirectory, 0o700);
    await chmod(permissionPath, 0o644);
    await assert.rejects(
      () => permissionStore.unlock("permissions", correct),
      LocalKeyCustodyError,
    );

    const noncanonicalHome = homes[3]!;
    const noncanonicalStore = new PassphraseKeyCustody(noncanonicalHome);
    await noncanonicalStore.create("noncanonical", correct);
    const noncanonicalPath = await onlyEnvelopePath(noncanonicalHome);
    const noncanonical = JSON.parse(
      await readFile(noncanonicalPath, "utf8"),
    ) as Record<string, unknown>;
    await writeFile(noncanonicalPath, `${JSON.stringify(noncanonical)}\n`, {
      mode: 0o600,
    });
    await assert.rejects(
      () => noncanonicalStore.unlock("noncanonical", correct),
      LocalKeyCustodyError,
    );

    const temporaryHome = homes[4]!;
    const directory = join(temporaryHome, "privacy-key-custody");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, "orphan.tmp"), "synthetic partial", {
      mode: 0o600,
    });
    await assert.rejects(
      () => new PassphraseKeyCustody(temporaryHome).unlock("missing", correct),
      LocalKeyCustodyError,
    );
  } finally {
    await cleanup(...homes);
  }
});

test("altered scope and KDF, truncation, oversized state, and owner locks fail closed", async () => {
  const homes = Array.from({ length: 5 }, (_, index) =>
    temporary(`structural-${String(index)}`),
  );
  try {
    const scopeHome = homes[0]!;
    const scopeStore = new PassphraseKeyCustody(scopeHome);
    await scopeStore.create("scope", correct);
    const scopePath = await onlyEnvelopePath(scopeHome);
    const scopeDocument = JSON.parse(await readFile(scopePath, "utf8")) as {
      metadata: { mappingSetId: string };
    };
    scopeDocument.metadata.mappingSetId = "different-scope";
    await writeFile(scopePath, `${JSON.stringify(scopeDocument, null, 2)}\n`, {
      mode: 0o600,
    });
    await assert.rejects(
      () => scopeStore.unlock("scope", correct),
      LocalKeyCustodyError,
    );

    const kdfHome = homes[1]!;
    const kdfStore = new PassphraseKeyCustody(kdfHome);
    await kdfStore.create("kdf", correct);
    const kdfPath = await onlyEnvelopePath(kdfHome);
    const kdfDocument = JSON.parse(await readFile(kdfPath, "utf8")) as {
      metadata: { kdf: { N: number } };
    };
    kdfDocument.metadata.kdf.N = 16_384;
    await writeFile(kdfPath, `${JSON.stringify(kdfDocument, null, 2)}\n`, {
      mode: 0o600,
    });
    await assert.rejects(
      () => kdfStore.unlock("kdf", correct),
      LocalKeyCustodyError,
    );

    const truncatedHome = homes[2]!;
    const truncatedStore = new PassphraseKeyCustody(truncatedHome);
    await truncatedStore.create("truncated", correct);
    await writeFile(await onlyEnvelopePath(truncatedHome), "{\n", {
      mode: 0o600,
    });
    await assert.rejects(
      () => truncatedStore.unlock("truncated", correct),
      LocalKeyCustodyError,
    );

    const oversizedHome = homes[3]!;
    const oversizedStore = new PassphraseKeyCustody(oversizedHome);
    await oversizedStore.create("oversized", correct);
    await writeFile(
      await onlyEnvelopePath(oversizedHome),
      "x".repeat(16 * 1024 + 1),
      { mode: 0o600 },
    );
    await assert.rejects(
      () => oversizedStore.unlock("oversized", correct),
      LocalKeyCustodyError,
    );

    const lockHome = homes[4]!;
    const lockDirectory = join(lockHome, "privacy-key-custody");
    await mkdir(lockDirectory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(lockDirectory, ".custody.lock"),
      `${JSON.stringify({ schemaVersion: 1, ownerToken: "synthetic-other", pid: 999_999 })}\n`,
      { mode: 0o600 },
    );
    await assert.rejects(
      () => new PassphraseKeyCustody(lockHome).create("locked", correct),
      /owner lock/u,
    );
  } finally {
    await cleanup(...homes);
  }
});

test("rotation is additive through a new mapping-set identity", async () => {
  const home = temporary("rotation");
  try {
    const custody = new PassphraseKeyCustody(home);
    const first = await custody.create("rotation-1", correct);
    const second = await custody.create("rotation-2", correct);
    assert.notDeepEqual(first, second);
    assert.deepEqual(await custody.unlock("rotation-1", correct), first);
    assert.deepEqual(await custody.unlock("rotation-2", correct), second);
  } finally {
    await cleanup(home);
  }
});

test("validates passphrase bounds and sanitizes failures", async () => {
  const home = temporary("bounds");
  try {
    const custody = new PassphraseKeyCustody(home);
    await assert.rejects(() => custody.create("short", "too short"), /16/u);
    await assert.rejects(
      () => custody.create("long", "x".repeat(1_025)),
      /1024/u,
    );
    await assert.rejects(
      () => custody.unlock("missing", correct),
      (error: unknown) => {
        assert.ok(error instanceof LocalKeyCustodyError);
        assert.equal(error.message.includes(home), false);
        assert.equal(error.message.includes(correct), false);
        return true;
      },
    );
  } finally {
    await cleanup(home);
  }
});

test("unlocks existing schema-v1 mapping ciphertext without migration or mutation", async () => {
  const home = temporary("schema-v1");
  try {
    const custody = new PassphraseKeyCustody(home);
    const key = await custody.create(mapping.mappingSetId, correct);
    const mappingStore = new EncryptedPrivacyMappingStore(home, key);
    await mappingStore.save(mapping);
    const mappingDirectory = join(home, "privacy-mappings");
    const mappingNames = await import("node:fs/promises").then(({ readdir }) =>
      readdir(mappingDirectory),
    );
    const mappingPath = join(mappingDirectory, mappingNames[0]!);
    const before = await readFile(mappingPath);
    const unlocked = await custody.unlock(mapping.mappingSetId, correct);
    assert.deepEqual(
      await new EncryptedPrivacyMappingStore(home, unlocked).read(
        mapping.mappingSetId,
      ),
      mapping,
    );
    assert.deepEqual(await readFile(mappingPath), before);
  } finally {
    await cleanup(home);
  }
});

function temporary(label: string): string {
  return join(tmpdir(), `aiw-custody-${label}-${randomUUID()}`);
}

async function onlyEnvelopePath(home: string): Promise<string> {
  const directory = join(home, "privacy-key-custody");
  const names = await import("node:fs/promises").then(({ readdir }) =>
    readdir(directory),
  );
  const name = names.find((candidate) => candidate.endsWith(".json"));
  assert.ok(name);
  return join(directory, name);
}

async function onlyEnvelope(home: string): Promise<string> {
  return readFile(await onlyEnvelopePath(home), "utf8");
}

async function cleanup(...homes: readonly string[]): Promise<void> {
  await Promise.all(
    homes.map((home) => rm(home, { recursive: true, force: true })),
  );
}
