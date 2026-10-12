import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  GeneralConversations,
  GeneralConversationError,
} from "@ai-workspace/general-conversation";
import { JsonGeneralConversationStore } from "../src/index.ts";

test("atomically persists, appends, lists, and validates restrictive General documents", async () => {
  const home = join(tmpdir(), `aiw-general-${crypto.randomUUID()}`);
  const store = new JsonGeneralConversationStore(home);
  const ids = ["conversation-a", "event-a"];
  const service = new GeneralConversations({
    store,
    ids: () => ids.shift()!,
    clock: () => new Date("2026-07-15T10:00:00.000Z"),
  });
  const created = await service.create("Fictional café");
  const updated = await service.append({
    conversationId: created.id,
    expectedEventCount: 0,
    content: "Where is the fictional café?",
  });
  assert.deepEqual(await store.list(), [updated]);
  const directory = join(home, "general-conversations");
  const names = await readdir(directory);
  assert.equal(names.filter((name) => name.endsWith(".json")).length, 1);
  assert.equal(
    names.some((name) => name.endsWith(".tmp") || name.endsWith(".lock")),
    false,
  );
  const mode = (await import("node:fs/promises")).stat;
  assert.equal((await mode(directory)).mode & 0o777, 0o700);
  assert.equal((await mode(join(directory, names[0]!))).mode & 0o777, 0o600);
  await assert.rejects(() =>
    service.append({
      conversationId: created.id,
      expectedEventCount: 0,
      content: "Duplicate stale append",
    }),
  );
});

test("fails closed on noncanonical corruption and incomplete temporary state", async () => {
  const home = join(tmpdir(), `aiw-general-corrupt-${crypto.randomUUID()}`);
  const directory = join(home, "general-conversations");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "orphan.tmp"), "partial", "utf8");
  const store = new JsonGeneralConversationStore(home);
  await assert.rejects(() => store.list(), GeneralConversationError);
  await chmod(directory, 0o700);
  const content = await readFile(join(directory, "orphan.tmp"), "utf8");
  assert.equal(content, "partial");
});

test("reads the optional execution class and refuses one it does not know", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const home = await mkdtemp(join(tmpdir(), "aiw-general-class-"));
  try {
    let count = 0;
    const service = new GeneralConversations({
      store: new JsonGeneralConversationStore(home),
      ids: () => `id-${++count}`,
      clock: () => new Date("2026-09-28T10:00:00.000Z"),
    });
    const created = await service.create("Synthetic agent conversation");
    await service.appendTurn({
      conversationId: created.id,
      expectedEventCount: 0,
      userText: "A synthetic question",
      assistantText: "A synthetic answer",
      attemptId: "attempt-1",
      model: "sonnet",
      displayName: "Claude Code",
      targetId: "claude",
      executionClass: "AGENT_EXECUTION",
    });
    const reread = await new JsonGeneralConversationStore(home).list();
    const answer = reread[0]!.events[1]!;
    assert.equal(
      answer.type === "AGENT_MESSAGE" && answer.provenance.executionClass,
      "AGENT_EXECUTION",
    );
    const directory = join(home, "general-conversations");
    const [name] = (await readdir(directory)).filter((entry) =>
      entry.endsWith(".json"),
    );
    const path = join(directory, name!);
    const original = await readFile(path, "utf8");
    await writeFile(
      path,
      original.replace('"AGENT_EXECUTION"', '"LOCAL_MODEL_X"'),
    );
    await assert.rejects(new JsonGeneralConversationStore(home).list());
    await writeFile(
      path,
      original.replace('"AGENT_EXECUTION"', '"LOCAL_MODEL"'),
    );
    const local = (await new JsonGeneralConversationStore(home).list())[0]!
      .events[1]!;
    assert.equal(
      local.type === "AGENT_MESSAGE" && local.provenance.executionClass,
      "LOCAL_MODEL",
    );
  } finally {
    await rm(home, { recursive: true });
  }
});
