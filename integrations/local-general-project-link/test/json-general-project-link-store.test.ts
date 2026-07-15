import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  GeneralProjectLinkError,
  type GeneralProjectLink,
} from "@ai-workspace/general-project-link";
import { JsonGeneralProjectLinkStore } from "../src/index.ts";

const link: GeneralProjectLink = Object.freeze({
  id: "link-a",
  sourceScope: "GENERAL",
  generalConversationId: "general-a",
  generalEventId: "event-a",
  generalContentSha256: "a".repeat(64),
  targetScope: "PROJECT",
  targetProjectId: "project-a",
  rationale: "Fictional relevance",
  rationaleExactBytes: 19,
  rationaleSha256:
    "961acbb08778048ab6949032e03a258c6d9a43163e539c942ec56301600fd32d",
  createdAt: "2026-07-15T11:00:00.000Z",
  actor: "LOCAL_USER",
  origin: "USER_AUTHORED",
  verification: "UNVERIFIED",
  dataClass: "CONFIDENTIAL",
  effect: "LINK_ONLY",
});

test("atomically stores immutable links with restrictive permissions", async () => {
  const home = join(tmpdir(), `aiw-links-${crypto.randomUUID()}`);
  const store = new JsonGeneralProjectLinkStore(home);
  await store.create(link);
  assert.deepEqual(await store.list(), [link]);
  const directory = join(home, "general-project-links");
  const names = await readdir(directory);
  assert.equal(
    names.some((name) => name.endsWith(".tmp") || name.endsWith(".lock")),
    false,
  );
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(join(directory, names[0]!))).mode & 0o777, 0o600);
  await assert.rejects(
    () => store.create({ ...link, id: "link-b" }),
    GeneralProjectLinkError,
  );
  const sameTextAndTimestampDifferentEvent = Object.freeze({
    ...link,
    id: "link-c",
    generalConversationId: "general-b",
    generalEventId: "event-b",
  });
  await store.create(sameTextAndTimestampDifferentEvent);
  assert.equal((await store.list()).length, 2);
});

test("fails closed on incomplete temporary state without deleting it", async () => {
  const home = join(tmpdir(), `aiw-links-corrupt-${crypto.randomUUID()}`);
  const directory = join(home, "general-project-links");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "orphan.tmp"), "partial", "utf8");
  await assert.rejects(
    () => new JsonGeneralProjectLinkStore(home).list(),
    GeneralProjectLinkError,
  );
  assert.equal(
    await readFile(join(directory, "orphan.tmp"), "utf8"),
    "partial",
  );
});
