import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PrivacyAuditError,
  hashPrivacyAuditEvent,
  type PrivacyAuditEvent,
  type PrivacyAuditEventInput,
} from "@ai-workspace/privacy-audit";
import { JsonPrivacyAuditStore } from "../src/index.ts";

const base: PrivacyAuditEventInput = Object.freeze({
  schemaVersion: 1,
  eventId: "reviewable-a",
  occurredAt: "2026-07-22T09:00:00.000Z",
  projectId: "project-a",
  workItemId: "work-a",
  handoffId: "handoff-a",
  modelId: "model-a",
  policyId: "fictional-balanced-policy",
  policyVersion: "1.0.0",
  policyDigest: "a".repeat(64),
  contextPackSchemaVersion: 2,
  decision: "REVIEWABLE_NOT_AUTHORIZED",
  counts: {
    evaluatedItems: 3,
    omittedItems: 1,
    allowedItems: 3,
    blockedItems: 0,
    defaultedItems: 1,
    restrictedItems: 0,
    evaluatedItemBytes: 120,
    sharedSourceTableBytes: 30,
    contextPackIncludedBytes: 150,
    omittedBytes: 20,
  },
  preflightReportDigest: "b".repeat(64),
});

test("appends distinct decisions, chains them, and paginates newest first", async () => {
  const home = join(tmpdir(), `aiw-audit-${crypto.randomUUID()}`);
  const store = new JsonPrivacyAuditStore(home);
  const first = await store.append(base);
  const second = await store.append({
    ...base,
    eventId: "blocked-b",
    occurredAt: "2026-07-22T09:00:01.000Z",
    decision: "BLOCKED",
    counts: {
      ...base.counts,
      allowedItems: 2,
      blockedItems: 1,
      defaultedItems: 0,
      restrictedItems: 1,
    },
    preflightReportDigest: "c".repeat(64),
  });
  assert.equal(second.predecessorEventHash, first.eventHash);
  const page = await store.list("project-a", { limit: 1 });
  assert.deepEqual(
    page.events.map((event) => event.eventId),
    ["blocked-b"],
  );
  assert.ok(page.nextCursor);
  assert.deepEqual(
    (
      await store.list("project-a", { limit: 1, cursor: page.nextCursor! })
    ).events.map((event) => event.eventId),
    ["reviewable-a"],
  );
  const directory = join(home, "privacy-audit");
  const document = (await readdir(directory)).find((name) =>
    name.endsWith(".json"),
  )!;
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(join(directory, document))).mode & 0o777, 0o600);
  assert.equal(
    (await readFile(join(directory, document), "utf8")).includes("content"),
    false,
  );
});

test("fails closed on corruption, incomplete state, unsafe mode, and foreign scope", async () => {
  const home = join(tmpdir(), `aiw-audit-bad-${crypto.randomUUID()}`);
  const directory = join(home, "privacy-audit");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, "orphan.tmp"), "partial", "utf8");
  await assert.rejects(
    () => new JsonPrivacyAuditStore(home).list("project-a", { limit: 25 }),
    PrivacyAuditError,
  );
  await rm(join(directory, "orphan.tmp"));
  await chmod(directory, 0o755);
  await assert.rejects(
    () => new JsonPrivacyAuditStore(home).list("project-a", { limit: 25 }),
    PrivacyAuditError,
  );
});

test("fails closed at the fixed bound and rejects malformed cursors", async () => {
  const home = join(tmpdir(), `aiw-audit-bound-${crypto.randomUUID()}`);
  const directory = join(home, "privacy-audit");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const events = [];
  let predecessorEventHash: string | null = null;
  for (let index = 0; index < 1_000; index += 1) {
    const input = {
      ...base,
      eventId: `event-${String(index).padStart(4, "0")}`,
      occurredAt: new Date(Date.parse(base.occurredAt) + index).toISOString(),
    };
    const hashable: PrivacyAuditEventInput & {
      predecessorEventHash: string | null;
    } = { ...input, predecessorEventHash };
    const event: PrivacyAuditEvent = {
      ...hashable,
      eventHash: hashPrivacyAuditEvent(hashable),
    };
    events.push(event);
    predecessorEventHash = event.eventHash;
  }
  const name = `project_${createHash("sha256").update("project-a").digest("hex")}.json`;
  const path = join(directory, name);
  await writeFile(
    path,
    `${JSON.stringify({ schemaVersion: 1, projectId: "project-a", revision: events.length, events }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await chmod(path, 0o600);
  const store = new JsonPrivacyAuditStore(home);
  await assert.rejects(
    () => store.append({ ...base, eventId: "over-bound" }),
    PrivacyAuditError,
  );
  await assert.rejects(
    () => store.list("project-a", { limit: 25, cursor: "not-a-cursor" }),
    PrivacyAuditError,
  );
});

test("serializes concurrent writers without lost events", async () => {
  const home = join(tmpdir(), `aiw-audit-race-${crypto.randomUUID()}`);
  const store = new JsonPrivacyAuditStore(home);
  const results = await Promise.allSettled([
    store.append(base),
    store.append({
      ...base,
      eventId: "reviewable-b",
      occurredAt: "2026-07-22T09:00:01.000Z",
    }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.equal((await store.list("project-a", { limit: 25 })).total, 1);
});
