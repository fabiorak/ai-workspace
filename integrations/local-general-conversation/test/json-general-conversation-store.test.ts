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
