import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  AppManagedKeyCustody,
  PassphraseKeyCustody,
} from "@ai-workspace/local-key-custody";
import {
  EncryptedPrivacyMappingStore,
  EncryptedStablePrivacyMappingStore,
} from "@ai-workspace/local-privacy-mapping";
import { validatePseudonymMapping } from "@ai-workspace/privacy-gateway";
import { privacyProtectionArea } from "../src/privacy-protection-area.ts";

test("imports a legacy mapping into stable project protection without changing its source", async () => {
  const home = await mkdtemp(join(tmpdir(), "aiw-privacy-migration-"));
  const mappingSetId = "legacy-synthetic";
  const passphrase = "synthetic-passphrase-123";
  try {
    const legacyKey = await new PassphraseKeyCustody(home).create(
      mappingSetId,
      passphrase,
    );
    try {
      await new EncryptedPrivacyMappingStore(home, legacyKey).save(
        validatePseudonymMapping({
          schemaVersion: 1,
          mappingSetId,
          projectId: "project-synthetic",
          workItemId: "work-synthetic",
          handoffId: "handoff-synthetic",
          modelId: "model-synthetic",
          entries: [
            {
              itemId: "handoff:objective",
              originalContentSha256: "a".repeat(64),
              transformedContentSha256: "b".repeat(64),
              originalByteStart: 0,
              originalByteEnd: 17,
              transformedByteStart: 0,
              transformedByteEnd: 32,
              entityType: "CUSTOMER",
              pseudonym: "[[AW_CUSTOMER_0123456789ABCDEF]]",
              originalBase64:
                Buffer.from("Cliente Sintetico").toString("base64"),
            },
          ],
        }),
      );
    } finally {
      legacyKey.fill(0);
    }
    const legacyDirectory = join(home, "privacy-mappings");
    const legacyName = (await readdir(legacyDirectory))[0]!;
    const before = await readFile(join(legacyDirectory, legacyName), "utf8");
    const area = privacyProtectionArea(home);
    assert.equal((await area.inspect()).legacyMappings, 1);

    const migrated = await area.migrateLegacy({ mappingSetId, passphrase });
    assert.deepEqual(migrated, {
      migrated: true,
      projectId: "project-synthetic",
      importedEntries: 1,
      stableEntries: 1,
      sourcePreserved: true,
    });
    assert.equal(
      await readFile(join(legacyDirectory, legacyName), "utf8"),
      before,
    );

    const managedKey = await new AppManagedKeyCustody(home).open(
      "PROJECT:project-synthetic",
    );
    try {
      const stable = await new EncryptedStablePrivacyMappingStore(
        home,
        managedKey,
      ).load("PROJECT:project-synthetic");
      assert.equal(stable.entries[0]?.pseudonym, "[[CLIENTE_1]]");
      assert.equal(
        Buffer.from(stable.entries[0]!.originalBase64, "base64").toString(
          "utf8",
        ),
        "Cliente Sintetico",
      );
    } finally {
      managedKey.fill(0);
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("a wrong migration passphrase fails closed and preserves legacy ciphertext", async () => {
  const home = await mkdtemp(join(tmpdir(), "aiw-privacy-migration-bad-"));
  const mappingSetId = "legacy-wrong-passphrase";
  try {
    const key = await new PassphraseKeyCustody(home).create(
      mappingSetId,
      "correct-passphrase-123",
    );
    try {
      await new EncryptedPrivacyMappingStore(home, key).save(
        validatePseudonymMapping({
          schemaVersion: 1,
          mappingSetId,
          projectId: "project-synthetic",
          workItemId: "work-synthetic",
          handoffId: "handoff-synthetic",
          modelId: "model-synthetic",
          entries: [
            {
              itemId: "handoff:objective",
              originalContentSha256: "a".repeat(64),
              transformedContentSha256: "b".repeat(64),
              originalByteStart: 0,
              originalByteEnd: 10,
              transformedByteStart: 0,
              transformedByteEnd: 30,
              entityType: "PERSON",
              pseudonym: "[[AW_PERSON_0123456789ABCDEF]]",
              originalBase64: Buffer.from("Mario Demo").toString("base64"),
            },
          ],
        }),
      );
    } finally {
      key.fill(0);
    }
    const directory = join(home, "privacy-mappings");
    const name = (await readdir(directory))[0]!;
    const before = await readFile(join(directory, name), "utf8");
    await assert.rejects(() =>
      privacyProtectionArea(home).migrateLegacy({
        mappingSetId,
        passphrase: "wrong-passphrase-123",
      }),
    );
    assert.equal(await readFile(join(directory, name), "utf8"), before);
    await assert.rejects(() =>
      new AppManagedKeyCustody(home).open("PROJECT:project-synthetic"),
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
