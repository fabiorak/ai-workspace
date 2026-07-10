import { SESSION_EVENT_TYPES } from "@ai-workspace/session-ingestion";
import type {
  MemoryItem,
  MemoryItemType,
  MemorySourceLink,
} from "@ai-workspace/active-memory";

const SCHEMA_VERSION = 1;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_OPERATIONS = 100_000;
const MAX_CONTENT_LENGTH = 4_096;
const MAX_NOTE_LENGTH = 1_024;
const MAX_REASON_LENGTH = 1_024;
const MAX_SOURCES = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const EVENT_ID_PATTERN = /^event_[a-f0-9]{64}$/u;
const SESSION_ID_PATTERN = /^session_[a-f0-9]{64}$/u;
const ARTIFACT_ID_PATTERN = /^artifact:\/\/sha256\/[a-f0-9]{64}$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;

type OperationBase = Readonly<{
  id: string;
  projectId: string;
  revision: number;
  actor: "LOCAL_USER";
  occurredAt: string;
}>;

export type CreateMemoryOperation = OperationBase &
  Readonly<{
    kind: "CREATE";
    itemId: string;
    type: MemoryItemType;
    content: string;
    sources: readonly MemorySourceLink[];
  }>;

export type VerifyMemoryOperation = OperationBase &
  Readonly<{
    kind: "VERIFY";
    itemId: string;
    expectedItemVersion: number;
    note: string;
    sources: readonly MemorySourceLink[];
  }>;

export type SupersedeMemoryOperation = OperationBase &
  Readonly<{
    kind: "SUPERSEDE";
    itemId: string;
    expectedItemVersion: number;
    replacement: Readonly<{
      id: string;
      creationOperationId: string;
      type: MemoryItemType;
      content: string;
      sources: readonly MemorySourceLink[];
    }>;
    sources: readonly MemorySourceLink[];
  }>;

export type InvalidateMemoryOperation = OperationBase &
  Readonly<{
    kind: "INVALIDATE";
    itemId: string;
    expectedItemVersion: number;
    reason: string;
    sources: readonly MemorySourceLink[];
  }>;

export type MemoryLogOperation =
  | CreateMemoryOperation
  | VerifyMemoryOperation
  | SupersedeMemoryOperation
  | InvalidateMemoryOperation;

export type MemoryLogDocument = Readonly<{
  schemaVersion: 1;
  projectId: string;
  revision: number;
  operations: readonly MemoryLogOperation[];
}>;

export type ReducedMemoryLog = Readonly<{
  revision: number;
  items: readonly MemoryItem[];
}>;

export class MemoryLogError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MemoryLogError";
  }
}

export function emptyMemoryLog(projectId: string): MemoryLogDocument {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    projectId: boundedString(projectId, "projectId", 256),
    revision: 0,
    operations: Object.freeze([]),
  });
}

export function decodeMemoryLog(content: string): MemoryLogDocument {
  if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
    throw invalidLog("document exceeds the supported size limit");
  }

  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch (error) {
    throw invalidLog("document is not valid JSON", error);
  }

  return validateDocument(value);
}

export function encodeMemoryLog(document: MemoryLogDocument): string {
  const validated = validateDocument(document);
  reduceMemoryLog(validated);
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
    throw invalidLog("document exceeds the supported size limit");
  }

  return content;
}

export function appendMemoryOperation(
  document: MemoryLogDocument,
  expectedRevision: number,
  operation: MemoryLogOperation,
): MemoryLogDocument {
  const current = validateDocument(document);
  reduceMemoryLog(current);

  if (current.revision !== expectedRevision) {
    throw new MemoryLogError(
      "Active-memory project revision changed. Reload the project memory and retry the operation.",
    );
  }

  if (operation.revision !== expectedRevision + 1) {
    throw invalidLog("appended operation has a non-sequential revision");
  }

  const candidate = validateDocument({
    schemaVersion: SCHEMA_VERSION,
    projectId: current.projectId,
    revision: operation.revision,
    operations: [...current.operations, operation],
  });
  reduceMemoryLog(candidate);
  return candidate;
}

export function reduceMemoryLog(document: MemoryLogDocument): ReducedMemoryLog {
  const validated = validateDocument(document);
  const items = new Map<string, MemoryItem>();
  const operationIds = new Set<string>();

  for (const operation of validated.operations) {
    if (operationIds.has(operation.id)) {
      throw invalidLog("operation identifiers must be unique");
    }
    operationIds.add(operation.id);

    switch (operation.kind) {
      case "CREATE": {
        assertNewItem(items, operation.itemId);
        items.set(
          operation.itemId,
          newItem(validated.projectId, operation, null),
        );
        break;
      }
      case "VERIFY": {
        const current = currentItem(items, operation);
        assertActive(current, operation.kind);

        if (current.verification === "VERIFIED") {
          throw invalidLog("an item cannot be verified more than once");
        }

        items.set(
          current.id,
          Object.freeze({
            ...current,
            verification: "VERIFIED",
            version: current.version + 1,
            updatedAt: operation.occurredAt,
            verifications: Object.freeze([
              ...current.verifications,
              Object.freeze({
                id: operation.id,
                actor: operation.actor,
                occurredAt: operation.occurredAt,
                note: operation.note,
                sources: operation.sources,
              }),
            ]),
          }),
        );
        break;
      }
      case "SUPERSEDE": {
        const current = currentItem(items, operation);
        assertActive(current, operation.kind);
        assertNewItem(items, operation.replacement.id);

        if (operation.replacement.type !== current.type) {
          throw invalidLog("a replacement must preserve the memory item type");
        }

        const record = Object.freeze({
          id: operation.id,
          actor: operation.actor,
          occurredAt: operation.occurredAt,
          replacementId: operation.replacement.id,
          sources: operation.sources,
        });
        items.set(
          current.id,
          Object.freeze({
            ...current,
            validity: "SUPERSEDED",
            version: current.version + 1,
            updatedAt: operation.occurredAt,
            supersession: record,
          }),
        );
        items.set(
          operation.replacement.id,
          newItem(
            validated.projectId,
            Object.freeze({
              kind: "CREATE",
              id: operation.replacement.creationOperationId,
              projectId: operation.projectId,
              revision: operation.revision,
              actor: operation.actor,
              occurredAt: operation.occurredAt,
              itemId: operation.replacement.id,
              type: operation.replacement.type,
              content: operation.replacement.content,
              sources: operation.replacement.sources,
            }),
            current.id,
          ),
        );
        if (operationIds.has(operation.replacement.creationOperationId)) {
          throw invalidLog("operation identifiers must be unique");
        }
        operationIds.add(operation.replacement.creationOperationId);
        break;
      }
      case "INVALIDATE": {
        const current = currentItem(items, operation);
        assertActive(current, operation.kind);
        items.set(
          current.id,
          Object.freeze({
            ...current,
            validity: "INVALIDATED",
            version: current.version + 1,
            updatedAt: operation.occurredAt,
            invalidation: Object.freeze({
              id: operation.id,
              actor: operation.actor,
              occurredAt: operation.occurredAt,
              reason: operation.reason,
              sources: operation.sources,
            }),
          }),
        );
        break;
      }
    }
  }

  return Object.freeze({
    revision: validated.revision,
    items: Object.freeze([...items.values()]),
  });
}

function validateDocument(value: unknown): MemoryLogDocument {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) {
    throw invalidLog("unsupported or missing schema version");
  }

  const projectId = boundedString(value.projectId, "projectId", 256);

  if (!Array.isArray(value.operations)) {
    throw invalidLog("operations must be an array");
  }
  if (value.operations.length > MAX_OPERATIONS) {
    throw invalidLog("operation count exceeds the supported limit");
  }
  if (!isNonNegativeInteger(value.revision)) {
    throw invalidLog("revision must be a non-negative integer");
  }
  if (value.revision !== value.operations.length) {
    throw invalidLog("revision must equal the operation count");
  }

  const operations = value.operations.map((operation, index) =>
    validateOperation(operation, index + 1, projectId),
  );

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    projectId,
    revision: value.revision,
    operations: Object.freeze(operations),
  });
}

function validateOperation(
  value: unknown,
  revision: number,
  projectId: string,
): MemoryLogOperation {
  if (!isRecord(value)) {
    throw invalidLog(`operation ${revision} must be an object`);
  }
  if (value.revision !== revision) {
    throw invalidLog(`operation ${revision} has a non-sequential revision`);
  }

  const base = Object.freeze({
    id: uuid(value.id, `operation ${revision} id`),
    projectId: boundedString(
      value.projectId,
      `operation ${revision} projectId`,
      256,
    ),
    revision,
    actor: localActor(value.actor, revision),
    occurredAt: timestamp(value.occurredAt, `operation ${revision} occurredAt`),
  });

  if (base.projectId !== projectId) {
    throw invalidLog(`operation ${revision} belongs to another project`);
  }

  switch (value.kind) {
    case "CREATE":
      return Object.freeze({
        ...base,
        kind: "CREATE",
        itemId: uuid(value.itemId, `operation ${revision} itemId`),
        type: memoryType(value.type, revision),
        content: boundedString(
          value.content,
          `operation ${revision} content`,
          MAX_CONTENT_LENGTH,
        ),
        sources: sources(value.sources, revision, "sources"),
      });
    case "VERIFY":
      return Object.freeze({
        ...base,
        kind: "VERIFY",
        itemId: uuid(value.itemId, `operation ${revision} itemId`),
        expectedItemVersion: positiveInteger(
          value.expectedItemVersion,
          `operation ${revision} expectedItemVersion`,
        ),
        note: boundedString(
          value.note,
          `operation ${revision} note`,
          MAX_NOTE_LENGTH,
        ),
        sources: sources(value.sources, revision, "sources"),
      });
    case "SUPERSEDE": {
      if (!isRecord(value.replacement)) {
        throw invalidLog(`operation ${revision} replacement must be an object`);
      }
      return Object.freeze({
        ...base,
        kind: "SUPERSEDE",
        itemId: uuid(value.itemId, `operation ${revision} itemId`),
        expectedItemVersion: positiveInteger(
          value.expectedItemVersion,
          `operation ${revision} expectedItemVersion`,
        ),
        replacement: Object.freeze({
          id: uuid(
            value.replacement.id,
            `operation ${revision} replacement id`,
          ),
          creationOperationId: uuid(
            value.replacement.creationOperationId,
            `operation ${revision} replacement creationOperationId`,
          ),
          type: memoryType(value.replacement.type, revision),
          content: boundedString(
            value.replacement.content,
            `operation ${revision} replacement content`,
            MAX_CONTENT_LENGTH,
          ),
          sources: sources(
            value.replacement.sources,
            revision,
            "replacement sources",
          ),
        }),
        sources: sources(value.sources, revision, "sources"),
      });
    }
    case "INVALIDATE":
      return Object.freeze({
        ...base,
        kind: "INVALIDATE",
        itemId: uuid(value.itemId, `operation ${revision} itemId`),
        expectedItemVersion: positiveInteger(
          value.expectedItemVersion,
          `operation ${revision} expectedItemVersion`,
        ),
        reason: boundedString(
          value.reason,
          `operation ${revision} reason`,
          MAX_REASON_LENGTH,
        ),
        sources: sources(value.sources, revision, "sources"),
      });
    default:
      throw invalidLog(`operation ${revision} has an unsupported kind`);
  }
}

function sources(
  value: unknown,
  revision: number,
  label: string,
): readonly MemorySourceLink[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SOURCES) {
    throw invalidLog(
      `operation ${revision} ${label} must contain from 1 to ${MAX_SOURCES} links`,
    );
  }

  const links = value.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw invalidLog(
        `operation ${revision} ${label} link ${index + 1} must be an object`,
      );
    }
    const sourcePosition = positiveInteger(
      candidate.sourcePosition,
      "sourcePosition",
    );
    const eventType = SESSION_EVENT_TYPES.find(
      (type) => type === candidate.eventType,
    );

    if (
      typeof candidate.eventId !== "string" ||
      !EVENT_ID_PATTERN.test(candidate.eventId) ||
      typeof candidate.sessionId !== "string" ||
      !SESSION_ID_PATTERN.test(candidate.sessionId) ||
      eventType === undefined ||
      candidate.trust !== "UNTRUSTED" ||
      typeof candidate.sourceArtifactId !== "string" ||
      !ARTIFACT_ID_PATTERN.test(candidate.sourceArtifactId) ||
      typeof candidate.sourceRecordHash !== "string" ||
      !HASH_PATTERN.test(candidate.sourceRecordHash)
    ) {
      throw invalidLog(
        `operation ${revision} ${label} link ${index + 1} is invalid`,
      );
    }

    return Object.freeze({
      eventId: candidate.eventId,
      sessionId: candidate.sessionId,
      eventType,
      trust: "UNTRUSTED" as const,
      sourceArtifactId: candidate.sourceArtifactId,
      sourcePosition,
      sourceRecordHash: candidate.sourceRecordHash,
    });
  });

  if (new Set(links.map((link) => link.eventId)).size !== links.length) {
    throw invalidLog(`operation ${revision} ${label} event IDs must be unique`);
  }
  return Object.freeze(links);
}

function newItem(
  projectId: string,
  operation: CreateMemoryOperation,
  supersedes: string | null,
): MemoryItem {
  return Object.freeze({
    id: operation.itemId,
    projectId,
    type: operation.type,
    content: operation.content,
    curation: "USER_CURATED",
    validity: "ACTIVE",
    verification: "UNVERIFIED",
    confidence: "UNASSESSED",
    version: 1,
    sources: operation.sources,
    creationOperationId: operation.id,
    createdBy: operation.actor,
    createdAt: operation.occurredAt,
    updatedAt: operation.occurredAt,
    supersedes,
    supersession: null,
    verifications: Object.freeze([]),
    invalidation: null,
  });
}

function currentItem(
  items: ReadonlyMap<string, MemoryItem>,
  operation:
    | VerifyMemoryOperation
    | SupersedeMemoryOperation
    | InvalidateMemoryOperation,
): MemoryItem {
  const item = items.get(operation.itemId);

  if (item === undefined) {
    throw invalidLog(`${operation.kind} references an unknown memory item`);
  }
  if (item.version !== operation.expectedItemVersion) {
    throw invalidLog(`${operation.kind} has a stale expected item version`);
  }
  return item;
}

function assertNewItem(
  items: ReadonlyMap<string, MemoryItem>,
  id: string,
): void {
  if (items.has(id)) {
    throw invalidLog("memory item identifiers must be unique");
  }
}

function assertActive(item: MemoryItem, kind: string): void {
  if (item.validity !== "ACTIVE") {
    throw invalidLog(`${kind} cannot transition a terminal memory item`);
  }
}

function memoryType(value: unknown, revision: number): MemoryItemType {
  if (value !== "DECISION" && value !== "CONSTRAINT" && value !== "FAILURE") {
    throw invalidLog(`operation ${revision} has an invalid memory type`);
  }
  return value;
}

function localActor(value: unknown, revision: number): "LOCAL_USER" {
  if (value !== "LOCAL_USER") {
    throw invalidLog(`operation ${revision} has an invalid actor`);
  }
  return value;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw invalidLog(`${label} must be a UUID`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw invalidLog(`${label} must be a canonical timestamp`);
  }
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw invalidLog(`${label} must be a canonical timestamp`);
  }
  return value;
}

function boundedString(value: unknown, label: string, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw invalidLog(`${label} must be a non-empty bounded string`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw invalidLog(`${label} must be a positive integer`);
  }
  return value as number;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function invalidLog(details: string, cause?: unknown): MemoryLogError {
  return new MemoryLogError(
    `The active-memory log is invalid: ${details}. Restore a valid backup or move the corrupt file aside and rebuild memory from canonical evidence.`,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
