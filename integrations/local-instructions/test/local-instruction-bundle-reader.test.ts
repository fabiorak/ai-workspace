import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { InstructionError } from "@ai-workspace/instruction-manager";
import { LocalInstructionBundleReader } from "../src/index.ts";

const fixture = (projectId = "project") =>
  `${JSON.stringify({
    schemaVersion: 1,
    projectId,
    source: {
      id: "synthetic-global",
      projectId,
      scope: "GLOBAL",
      target: null,
      trust: "USER_CONFIGURED",
      rules: [
        {
          id: "security.no-secrets",
          kind: "CONSTRAINT",
          overridable: false,
          content: "Never disclose synthetic credentials.",
          position: 0,
        },
      ],
    },
  })}\n`;

describe("LocalInstructionBundleReader", () => {
  it("preserves exact bytes through an adapter-owned digest", async () =>
    withFixture(async (path, bytes) => {
      const bundle = await new LocalInstructionBundleReader().read("project", [
        { path },
      ]);
      assert.equal(
        bundle.sources[0]?.sourceDigest,
        createHash("sha256").update(bytes).digest("hex"),
      );
      assert.deepEqual(await readFile(path), bytes);
    }));

  it("rejects changed, cross-project, malformed, extra-field, and oversized input", async () =>
    withFixture(async (path, bytes, home) => {
      const reader = new LocalInstructionBundleReader();
      await assert.rejects(
        reader.read("project", [{ path, expectedDigest: "0".repeat(64) }]),
        InstructionError,
      );
      await writeFile(path, fixture("foreign"));
      await assert.rejects(
        reader.read("project", [{ path }]),
        InstructionError,
      );
      await writeFile(path, "{broken\n");
      await assert.rejects(
        reader.read("project", [{ path }]),
        InstructionError,
      );
      await writeFile(
        path,
        JSON.stringify({ ...JSON.parse(fixture()), unexpected: true }),
      );
      await assert.rejects(
        reader.read("project", [{ path }]),
        InstructionError,
      );
      const large = join(home, "large.json");
      await writeFile(large, Buffer.alloc(256 * 1_024 + 1, 120));
      await assert.rejects(
        reader.read("project", [{ path: large }]),
        InstructionError,
      );
      assert.equal(bytes.includes(Buffer.from("Synthetic User")), false);
    }));
});

async function withFixture(
  run: (path: string, bytes: Buffer, home: string) => Promise<void>,
) {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-instructions-"));
  const path = join(home, "bundle.json");
  const bytes = Buffer.from(fixture());
  try {
    await writeFile(path, bytes);
    await run(path, bytes, home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
