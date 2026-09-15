import assert from "node:assert/strict";
import {
  chmod,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  emptyStablePseudonymMap,
  protectWithStablePseudonyms,
} from "@ai-workspace/privacy-gateway";
import {
  EncryptedStablePrivacyMappingStore,
  StablePrivacyMappingStoreError,
} from "../src/index.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("encrypted stable privacy mapping store", () => {
  it("publishes private authenticated revisions and rereads them after restart", async () => {
    const home = temporary();
    const key = Buffer.alloc(32, 7);
    const store = new EncryptedStablePrivacyMappingStore(home, key);
    const empty = await store.load("PROJECT:synthetic");
    const mapping = protectWithStablePseudonyms({
      text: "anna@example.test",
      mapping: empty,
      spans: [
        {
          startUtf8: 0,
          endUtf8: 17,
          type: "EMAIL",
          confidence: 1,
          detector: "TEST",
        },
      ],
    }).mapping;
    await store.replace(0, mapping);
    assert.deepEqual(
      await new EncryptedStablePrivacyMappingStore(home, key).load(
        "PROJECT:synthetic",
      ),
      mapping,
    );
    const directory = join(home, "stable-privacy-mappings");
    const [name] = (await readdir(directory)).filter((candidate) =>
      candidate.endsWith(".json"),
    );
    assert.ok(name);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(join(directory, name))).mode & 0o777, 0o600);
    assert.equal(
      (await readFile(join(directory, name), "utf8")).includes(
        "anna@example.test",
      ),
      false,
    );
  });

  it("rejects stale revisions, wrong keys, corruption, and unsafe permissions", async () => {
    const home = temporary();
    const key = Buffer.alloc(32, 8);
    const store = new EncryptedStablePrivacyMappingStore(home, key);
    const mapping = protectWithStablePseudonyms({
      text: "anna@example.test",
      mapping: emptyStablePseudonymMap("GENERAL"),
      spans: [
        {
          startUtf8: 0,
          endUtf8: 17,
          type: "EMAIL",
          confidence: 1,
          detector: "TEST",
        },
      ],
    }).mapping;
    await store.replace(0, mapping);
    await assert.rejects(
      () => store.replace(0, mapping),
      StablePrivacyMappingStoreError,
    );
    await assert.rejects(
      () =>
        new EncryptedStablePrivacyMappingStore(home, Buffer.alloc(32, 9)).load(
          "GENERAL",
        ),
      StablePrivacyMappingStoreError,
    );
    const directory = join(home, "stable-privacy-mappings");
    const [name] = (await readdir(directory)).filter((candidate) =>
      candidate.endsWith(".json"),
    );
    assert.ok(name);
    await chmod(join(directory, name), 0o644);
    await assert.rejects(
      () => store.load("GENERAL"),
      StablePrivacyMappingStoreError,
    );
    await chmod(join(directory, name), 0o600);
    await writeFile(join(directory, name), "{\n", { mode: 0o600 });
    await assert.rejects(
      () => store.load("GENERAL"),
      StablePrivacyMappingStoreError,
    );
  });
});

function temporary() {
  const home = join(tmpdir(), `aiw-stable-map-${crypto.randomUUID()}`);
  roots.push(home);
  return home;
}
