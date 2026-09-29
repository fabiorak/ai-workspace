import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileArtifactStore } from "@ai-workspace/local-session-ingestion";
import { localConversationSources } from "../src/conversation-sources.ts";

test("local conversation sources expose a bounded fatal-UTF-8 artifact reader", async () => {
  const home = await mkdtemp(
    join(tmpdir(), "ai-workspace-conversation-source-"),
  );
  const store = new FileArtifactStore(home);
  try {
    const text = Buffer.from("Synthetic text", "utf8");
    const valid = await store.put(text);
    const invalid = await store.put(Buffer.from([0xff]));
    const sources = localConversationSources({
      workspaceHome: home,
      artifact: async () => "unused legacy reader",
      projects: { load: async () => [] },
      notes: { list: async () => [] },
      workItems: { list: async () => [] },
      handoffs: () => ({ list: async () => [] }),
    });

    assert.equal(
      await sources.boundedArtifact(valid.id, text.byteLength),
      "Synthetic text",
    );
    await assert.rejects(
      sources.boundedArtifact(valid.id, text.byteLength - 1),
    );
    await assert.rejects(sources.boundedArtifact(invalid.id, 1));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
