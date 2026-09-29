import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  JsonPrivacyAuditStore,
  JsonTurnPrivacyAuditStore,
} from "../src/index.ts";
import type {
  PrivacyAuditEventInput,
  TurnPrivacyAuditInput,
} from "@ai-workspace/privacy-audit";

const scope = Object.freeze({
  kind: "PROJECT" as const,
  projectId: "project-a",
});
const generalScope = Object.freeze({ kind: "GENERAL" as const });

const counts = Object.freeze({
  evaluatedItems: 2,
  omittedItems: 1,
  allowedItems: 2,
  blockedItems: 0,
  defaultedItems: 0,
  restrictedItems: 0,
  evaluatedItemBytes: 120,
  sharedSourceTableBytes: 30,
  contextPackIncludedBytes: 150,
  omittedBytes: 20,
  unknownByteOmissions: 1,
});

const base: TurnPrivacyAuditInput = Object.freeze({
  schemaVersion: 2,
  eventId: "turn-a",
  occurredAt: "2026-07-22T09:00:00.000Z",
  scope,
  conversationId: "conversation-a",
  modelId: "model-a",
  policyId: "policy-a",
  policyVersion: "1.0.0",
  policyDigest: "a".repeat(64),
  decision: "REVIEWABLE_NOT_AUTHORIZED",
  counts,
  preflightReportDigest: "b".repeat(64),
  payloadDigest: "c".repeat(64),
});

function home(prefix: string): string {
  return join(tmpdir(), `${prefix}-${randomUUID()}`);
}

test("keeps General and project turn audits in separate aggregates", async () => {
  const store = new JsonTurnPrivacyAuditStore(home("turn-audit-scope"));
  const projectEvent = await store.append(base);
  const generalEvent = await store.append({
    ...base,
    eventId: "turn-general",
    scope: generalScope,
  });

  assert.equal((await store.list(scope)).length, 1);
  assert.equal(
    (await store.find(scope, projectEvent.eventId))?.eventHash,
    projectEvent.eventHash,
  );
  assert.deepEqual(await store.list(generalScope), [generalEvent]);
});

test("appends, rereads, and persists a canonical v2 aggregate", async () => {
  const workspaceHome = home("turn-audit-reread");
  const store = new JsonTurnPrivacyAuditStore(workspaceHome);
  const event = await store.append(base);
  const reread = await store.find(scope, event.eventId);

  assert.deepEqual(reread, event);
  const directory = join(workspaceHome, "turn-privacy-audit");
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  const document = (await readdir(directory)).find((name) =>
    name.endsWith(".json"),
  );
  assert.ok(document);
  assert.equal((await stat(join(directory, document))).mode & 0o777, 0o600);
  const raw = await readFile(join(directory, document), "utf8");
  assert.equal(JSON.parse(raw).schemaVersion, 2);
  assert.equal(raw.includes("content"), false);
});

test("fails closed on a corrupted aggregate, unsafe mode, and interrupted temp", async () => {
  const workspaceHome = home("turn-audit-corrupt");
  const store = new JsonTurnPrivacyAuditStore(workspaceHome);
  await store.append(base);
  const directory = join(workspaceHome, "turn-privacy-audit");
  const document = (await readdir(directory)).find((name) =>
    name.endsWith(".json"),
  )!;
  const path = join(directory, document);
  const aggregate = JSON.parse(await readFile(path, "utf8")) as {
    events: Array<Record<string, unknown>>;
  };
  const firstEvent = aggregate.events[0];
  assert.ok(firstEvent);
  firstEvent.eventHash = "f".repeat(64);
  await writeFile(path, `${JSON.stringify(aggregate, null, 2)}\n`, {
    mode: 0o600,
  });
  await assert.rejects(() => store.list(scope));

  const secondHome = home("turn-audit-mode");
  const secondStore = new JsonTurnPrivacyAuditStore(secondHome);
  await secondStore.append(base);
  const secondDirectory = join(secondHome, "turn-privacy-audit");
  await chmod(secondDirectory, 0o755);
  await assert.rejects(() => secondStore.list(scope));

  const thirdHome = home("turn-audit-temp");
  const thirdStore = new JsonTurnPrivacyAuditStore(thirdHome);
  await thirdStore.append(base);
  await writeFile(
    join(thirdHome, "turn-privacy-audit", "orphan.tmp"),
    "partial",
    {
      mode: 0o600,
    },
  );
  await assert.rejects(() => thirdStore.list(scope));
});

test("refuses a foreign lock and serializes concurrent writers", async () => {
  const workspaceHome = home("turn-audit-lock");
  const directory = join(workspaceHome, "turn-privacy-audit");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    join(directory, ".turn-privacy-audit.lock"),
    `${JSON.stringify({ schemaVersion: 1, ownerToken: "foreign" })}\n`,
    { mode: 0o600 },
  );
  const store = new JsonTurnPrivacyAuditStore(workspaceHome);
  await assert.rejects(() => store.list(scope));

  const racingHome = home("turn-audit-race");
  const racingStore = new JsonTurnPrivacyAuditStore(racingHome);
  const results = await Promise.allSettled([
    racingStore.append(base),
    racingStore.append({ ...base, eventId: "turn-b" }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.equal((await racingStore.list(scope)).length, 1);
});

test("does not touch the legacy v1 privacy-audit namespace", async () => {
  const workspaceHome = home("turn-audit-v1");
  const legacy = new JsonPrivacyAuditStore(workspaceHome);
  const legacyInput: PrivacyAuditEventInput = {
    schemaVersion: 1,
    eventId: "legacy-a",
    occurredAt: base.occurredAt,
    projectId: "project-a",
    workItemId: "work-a",
    handoffId: "handoff-a",
    modelId: base.modelId,
    policyId: base.policyId,
    policyVersion: base.policyVersion,
    policyDigest: base.policyDigest,
    contextPackSchemaVersion: 2,
    decision: "REVIEWABLE_NOT_AUTHORIZED",
    counts: {
      evaluatedItems: 1,
      omittedItems: 0,
      allowedItems: 1,
      blockedItems: 0,
      defaultedItems: 0,
      restrictedItems: 0,
      evaluatedItemBytes: 10,
      sharedSourceTableBytes: 0,
      contextPackIncludedBytes: 10,
      omittedBytes: 0,
    },
    preflightReportDigest: base.preflightReportDigest,
  };
  await legacy.append(legacyInput);
  const legacyDirectory = join(workspaceHome, "privacy-audit");
  const legacyDocument = (await readdir(legacyDirectory)).find((name) =>
    name.endsWith(".json"),
  )!;
  const before = await readFile(join(legacyDirectory, legacyDocument), "utf8");

  await new JsonTurnPrivacyAuditStore(workspaceHome).append(base);
  assert.equal(
    await readFile(join(legacyDirectory, legacyDocument), "utf8"),
    before,
  );
});

test("turn input has no content-bearing fields", () => {
  const keys = Object.keys(base).sort();
  assert.deepEqual(keys, [
    "conversationId",
    "counts",
    "decision",
    "eventId",
    "modelId",
    "occurredAt",
    "payloadDigest",
    "policyDigest",
    "policyId",
    "policyVersion",
    "preflightReportDigest",
    "schemaVersion",
    "scope",
  ]);
  assert.equal("content" in base, false);
  assert.equal("text" in base, false);
});
