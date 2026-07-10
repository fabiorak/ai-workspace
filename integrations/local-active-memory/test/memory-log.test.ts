import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryLogError,
  appendMemoryOperation,
  decodeMemoryLog,
  emptyMemoryLog,
  encodeMemoryLog,
  reduceMemoryLog,
  type CreateMemoryOperation,
  type InvalidateMemoryOperation,
  type MemoryLogDocument,
  type SupersedeMemoryOperation,
  type VerifyMemoryOperation,
} from "../src/memory-log.ts";

const PROJECT_ID = "synthetic-project";
const ITEM_1 = uuid(1);
const ITEM_2 = uuid(2);

test("round-trips an empty schema-versioned project log", () => {
  const empty = emptyMemoryLog(PROJECT_ID);
  assert.deepEqual(reduceMemoryLog(empty), { revision: 0, items: [] });
  assert.deepEqual(decodeMemoryLog(encodeMemoryLog(empty)), empty);
});

test("reconstructs create, verify, supersede, and invalidate transitions", () => {
  let document = emptyMemoryLog(PROJECT_ID);
  document = appendMemoryOperation(document, 0, createOperation());
  document = appendMemoryOperation(document, 1, verifyOperation());
  document = appendMemoryOperation(document, 2, supersedeOperation());
  document = appendMemoryOperation(document, 3, invalidateOperation());

  const reloaded = decodeMemoryLog(encodeMemoryLog(document));
  const reduced = reduceMemoryLog(reloaded);
  const original = reduced.items.find((item) => item.id === ITEM_1);
  const replacement = reduced.items.find((item) => item.id === ITEM_2);

  assert.equal(reduced.revision, 4);
  assert.equal(original?.validity, "SUPERSEDED");
  assert.equal(original?.verification, "VERIFIED");
  assert.equal(original?.version, 3);
  assert.equal(original?.supersession?.replacementId, ITEM_2);
  assert.equal(replacement?.validity, "INVALIDATED");
  assert.equal(replacement?.verification, "UNVERIFIED");
  assert.equal(replacement?.confidence, "UNASSESSED");
  assert.equal(replacement?.version, 2);
  assert.equal(replacement?.supersedes, ITEM_1);
  assert.equal(
    replacement?.invalidation?.reason,
    "Synthetic replacement expired",
  );
  assert.equal(replacement?.sources[0]?.trust, "UNTRUSTED");
});

test("rejects stale revisions and item versions", () => {
  const created = appendMemoryOperation(
    emptyMemoryLog(PROJECT_ID),
    0,
    createOperation(),
  );

  assert.throws(
    () => appendMemoryOperation(created, 0, verifyOperation()),
    /project revision changed.*Reload/u,
  );
  assert.throws(
    () =>
      appendMemoryOperation(created, 1, {
        ...verifyOperation(),
        expectedItemVersion: 2,
      }),
    /stale expected item version.*rebuild memory/u,
  );
});

test("rejects duplicate identities and terminal transitions", () => {
  const created = appendMemoryOperation(
    emptyMemoryLog(PROJECT_ID),
    0,
    createOperation(),
  );
  const invalidated = appendMemoryOperation(created, 1, {
    ...invalidateOperation(),
    revision: 2,
    itemId: ITEM_1,
  });

  assert.throws(
    () =>
      appendMemoryOperation(invalidated, 2, {
        ...verifyOperation(),
        revision: 3,
        expectedItemVersion: 2,
      }),
    /cannot transition a terminal memory item/u,
  );
  assert.throws(
    () =>
      appendMemoryOperation(created, 1, {
        ...createOperation(),
        id: uuid(9),
        revision: 2,
      }),
    /memory item identifiers must be unique/u,
  );
  assert.throws(
    () =>
      appendMemoryOperation(created, 1, {
        ...verifyOperation(),
        id: createOperation().id,
      }),
    /operation identifiers must be unique/u,
  );
});

test("fails closed on unsupported, foreign-project, and malformed documents", () => {
  assert.throws(
    () => decodeMemoryLog('{"schemaVersion":2}'),
    /unsupported or missing schema version.*rebuild memory/u,
  );
  assert.throws(
    () => decodeMemoryLog("synthetic invalid JSON"),
    /not valid JSON.*rebuild memory/u,
  );

  const foreign = documentValue({
    ...createOperation(),
    projectId: "another-project",
  });
  assert.throws(
    () => decodeMemoryLog(JSON.stringify(foreign)),
    /belongs to another project/u,
  );

  const malformed = documentValue({
    ...createOperation(),
    sources: [],
  });
  assert.throws(
    () => decodeMemoryLog(JSON.stringify(malformed)),
    /sources must contain from 1 to 20 links/u,
  );
});

function createOperation(): CreateMemoryOperation {
  return Object.freeze({
    kind: "CREATE",
    id: uuid(11),
    projectId: PROJECT_ID,
    revision: 1,
    actor: "LOCAL_USER",
    occurredAt: "2026-07-10T10:00:00.000Z",
    itemId: ITEM_1,
    type: "CONSTRAINT",
    content: "Synthetic runtime constraint",
    sources: Object.freeze([source(1)]),
  });
}

function verifyOperation(): VerifyMemoryOperation {
  return Object.freeze({
    kind: "VERIFY",
    id: uuid(12),
    projectId: PROJECT_ID,
    revision: 2,
    actor: "LOCAL_USER",
    occurredAt: "2026-07-10T11:00:00.000Z",
    itemId: ITEM_1,
    expectedItemVersion: 1,
    note: "Synthetic verification method",
    sources: Object.freeze([source(2)]),
  });
}

function supersedeOperation(): SupersedeMemoryOperation {
  return Object.freeze({
    kind: "SUPERSEDE",
    id: uuid(13),
    projectId: PROJECT_ID,
    revision: 3,
    actor: "LOCAL_USER",
    occurredAt: "2026-07-10T12:00:00.000Z",
    itemId: ITEM_1,
    expectedItemVersion: 2,
    replacement: Object.freeze({
      id: ITEM_2,
      creationOperationId: uuid(14),
      type: "CONSTRAINT",
      content: "Synthetic replacement constraint",
      sources: Object.freeze([source(3)]),
    }),
    sources: Object.freeze([source(3)]),
  });
}

function invalidateOperation(): InvalidateMemoryOperation {
  return Object.freeze({
    kind: "INVALIDATE",
    id: uuid(15),
    projectId: PROJECT_ID,
    revision: 4,
    actor: "LOCAL_USER",
    occurredAt: "2026-07-10T13:00:00.000Z",
    itemId: ITEM_2,
    expectedItemVersion: 1,
    reason: "Synthetic replacement expired",
    sources: Object.freeze([source(4)]),
  });
}

function source(position: number) {
  return Object.freeze({
    eventId: `event_${String(position).padStart(64, "a")}`,
    sessionId: `session_${"b".repeat(64)}`,
    eventType: "AGENT_MESSAGE" as const,
    trust: "UNTRUSTED" as const,
    sourceArtifactId: `artifact://sha256/${"c".repeat(64)}`,
    sourcePosition: position,
    sourceRecordHash: "d".repeat(64),
  });
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function documentValue(operation: unknown): MemoryLogDocument {
  return {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    revision: 1,
    operations: [operation],
  } as MemoryLogDocument;
}

assert.ok(MemoryLogError.prototype instanceof Error);
