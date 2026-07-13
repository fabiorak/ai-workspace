import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AgentProfileError } from "@ai-workspace/instruction-manager";
import { LocalAgentProfileReader } from "../src/index.ts";
import { buildSyntheticAgentProfile } from "../../../packages/instruction-manager/test/synthetic-agent-profile.ts";

describe("controlled local agent profile reader", () => {
  it("returns digest, safe name, exact bytes, and canonical round trip", async () =>
    withTemp(async (root) => {
      const path = join(root, "reviewed-profile.json");
      const source = JSON.stringify(buildSyntheticAgentProfile(), null, 2);
      await writeFile(path, source);
      const digest = createHash("sha256").update(source).digest("hex");
      const result = await new LocalAgentProfileReader().read(
        "synthetic-project",
        { path, expectedDigest: digest },
      );
      assert.equal(result.sourceName, "reviewed-profile.json");
      assert.equal(result.sourceDigest, digest);
      assert.equal(result.sourceBytes, Buffer.byteLength(source));
      assert.equal(
        result.canonicalBytes,
        Buffer.byteLength(result.canonicalEncoding),
      );
      assert.equal(result.bundle.agent.id, "review-agent");
      assert.equal(JSON.stringify(result).includes(root), false);
      assert.equal(
        result.effect,
        "DESCRIPTIVE_NOT_INSTALLED_SELECTED_ENFORCED_OR_EXECUTED",
      );
    }));

  it("fails closed for changed, cross-project, malformed, unreadable, and oversized input without echo", async () =>
    withTemp(async (root) => {
      const reader = new LocalAgentProfileReader();
      const path = join(root, "profile.json");
      const canary = "PRIVATE-SYNTHETIC-LOCAL-PROFILE-CANARY";
      await writeFile(path, JSON.stringify(buildSyntheticAgentProfile()));
      const rejects = async (input: {
        path: string;
        expectedDigest?: string;
      }) =>
        assert.rejects(
          () => reader.read("synthetic-project", input),
          (error: unknown) =>
            error instanceof AgentProfileError &&
            !error.message.includes(canary) &&
            !error.message.includes(root),
        );
      await rejects({ path, expectedDigest: "0".repeat(64) });
      await writeFile(
        path,
        JSON.stringify(buildSyntheticAgentProfile("other")),
      );
      await rejects({ path });
      await writeFile(path, `{${canary}`);
      await rejects({ path });
      await writeFile(path, Buffer.from([0xff, 0xfe]));
      await rejects({ path });
      await writeFile(path, "x".repeat(256 * 1_024 + 1));
      await rejects({ path });
      await rejects({ path: join(root, "missing.json") });
    }));
});

async function withTemp(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-agent-profile-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
