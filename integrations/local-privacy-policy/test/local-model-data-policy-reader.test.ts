import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LocalModelDataPolicyReader } from "../src/index.ts";

const fixture = (projectId: string) => ({
  schemaVersion: 1,
  id: "synthetic-policy",
  version: "1.0.0",
  projectId,
  modelId: "model-balanced",
  maximumDataClass: "CONFIDENTIAL",
  assertions: [],
  attribution: "USER_CONFIGURED",
  author: "AI Workspace contributors",
  license: "Apache-2.0",
});

test("reads a bounded digest-pinned same-project policy and returns only a safe basename", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-policy-"));
  try {
    const path = join(root, "synthetic-policy.json");
    const source = JSON.stringify(fixture("project-1"), null, 2);
    await writeFile(path, source);
    const digest = createHash("sha256").update(source).digest("hex");
    const value = await new LocalModelDataPolicyReader().read("project-1", {
      path,
      expectedDigest: digest,
    });
    assert.equal(value.sourceName, "synthetic-policy.json");
    assert.equal(value.sourceDigest, digest);
    assert.equal(value.policy.modelId, "model-balanced");
    assert.equal(JSON.stringify(value).includes(root), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails closed for stale digest, cross-project, malformed UTF-8, and oversized input", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-policy-invalid-"));
  const reader = new LocalModelDataPolicyReader();
  try {
    const path = join(root, "private-name.json");
    await writeFile(path, JSON.stringify(fixture("project-1")));
    await assert.rejects(
      reader.read("project-1", { path, expectedDigest: "0".repeat(64) }),
    );
    await assert.rejects(reader.read("project-2", { path }));
    await writeFile(path, Buffer.from([0xff, 0xfe]));
    await assert.rejects(reader.read("project-1", { path }));
    await writeFile(path, "x".repeat(256 * 1_024 + 1));
    await assert.rejects(reader.read("project-1", { path }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
