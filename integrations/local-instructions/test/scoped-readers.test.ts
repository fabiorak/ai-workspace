import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  LocalAgentProfileReader,
  LocalInstructionBundleReader,
} from "../src/index.ts";
import { buildSyntheticAgentProfile } from "../../../packages/instruction-manager/test/synthetic-agent-profile.ts";

const general = { kind: "GENERAL" } as const;
test("scoped readers accept explicit General files, preserve digests, and reject changes and scope drift", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoped-instructions-"));
  try {
    const {
      projectId: _projectId,
      schemaVersion: _version,
      ...base
    } = buildSyntheticAgentProfile();
    void _projectId;
    void _version;
    const path = join(root, "profile.json");
    await writeFile(
      path,
      JSON.stringify({ ...base, schemaVersion: 2, scope: general }),
    );
    const reader = new LocalAgentProfileReader();
    const result = await reader.readScoped(general, { path });
    assert.deepEqual(result.bundle.scope, general);
    assert.equal(JSON.stringify(result).includes(root), false);
    await assert.rejects(
      reader.readScoped(general, { path, expectedDigest: "0".repeat(64) }),
    );
    await assert.rejects(
      reader.readScoped({ kind: "PROJECT", projectId: "other" }, { path }),
    );
    const bundlePath = join(root, "rules.json");
    const value = {
      schemaVersion: 2,
      ownerScope: general,
      source: {
        id: "confirmed",
        ownerScope: general,
        scope: "WORKSPACE",
        target: null,
        trust: "USER_CONFIGURED",
        rules: [
          {
            id: "rule",
            kind: "CONSTRAINT",
            overridable: false,
            content: "Use synthetic evidence.",
            position: 0,
          },
        ],
      },
    };
    const content = JSON.stringify(value);
    await writeFile(bundlePath, content);
    const bundleReader = new LocalInstructionBundleReader();
    const bundle = await bundleReader.readScoped(general, [
      { path: bundlePath },
    ]);
    assert.equal(
      bundle.sources[0]?.sourceDigest,
      createHash("sha256").update(content).digest("hex"),
    );
    await assert.rejects(
      bundleReader.readScoped(general, [
        { path: bundlePath, expectedDigest: "0".repeat(64) },
      ]),
    );
    await assert.rejects(
      bundleReader.readScoped(general, [
        { path: bundlePath },
        { path: bundlePath },
      ]),
    );
    await writeFile(path, JSON.stringify(buildSyntheticAgentProfile()));
    await assert.rejects(reader.readScoped(general, { path }));
    assert.deepEqual(
      (
        await reader.readScoped(
          { kind: "PROJECT", projectId: "synthetic-project" },
          { path },
        )
      ).bundle.scope,
      { kind: "PROJECT", projectId: "synthetic-project" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scoped readers reject huge sparse files and non-files before loading their text", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoped-instructions-bound-"));
  try {
    const path = join(root, "oversized.json");
    const handle = await open(path, "w");
    try {
      await handle.truncate(128 * 1024 * 1024);
    } finally {
      await handle.close();
    }
    const profile = new LocalAgentProfileReader();
    const bundles = new LocalInstructionBundleReader();
    await assert.rejects(profile.readScoped(general, { path }));
    await assert.rejects(bundles.readScoped(general, [{ path }]));
    await assert.rejects(profile.readScoped(general, { path: root }));
    await assert.rejects(bundles.readScoped(general, [{ path: root }]));
    await writeFile(path, Buffer.from([0xff]));
    await assert.rejects(profile.readScoped(general, { path }));
    await assert.rejects(bundles.readScoped(general, [{ path }]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
