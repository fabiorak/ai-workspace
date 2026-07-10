import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import {
  SESSION_EVENT_TYPES,
  SessionImportError,
  type ArtifactReference,
  type EventPayload,
  type ImportedSession,
  type SessionEvent,
  type SessionEventType,
  type SessionStore,
  type SourceReference,
} from "@ai-workspace/session-ingestion";

const SCHEMA_VERSION = 1;
const SESSION_ID_PATTERN = /^session_[a-f0-9]{64}$/u;
const EVENT_ID_PATTERN = /^event_[a-f0-9]{64}$/u;
const ARTIFACT_ID_PATTERN = /^artifact:\/\/sha256\/[a-f0-9]{64}$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export class JsonSessionStore implements SessionStore {
  readonly #directory: string;

  public constructor(workspaceHome: string) {
    this.#directory = join(workspaceHome, "sessions");
  }

  public async load(sessionId: string): Promise<ImportedSession | null> {
    assertSessionId(sessionId);
    return this.#loadPath(this.#sessionPath(sessionId));
  }

  public async append(
    session: ImportedSession,
    expectedEventCount: number,
  ): Promise<void> {
    assertSessionId(session.id);
    const sessionPath = this.#sessionPath(session.id);
    const lockPath = `${sessionPath}.lock`;
    const temporaryPath = `${sessionPath}.${randomUUID()}.tmp`;
    let ownsLock = false;

    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);

      try {
        const lock = await open(lockPath, "wx", 0o600);
        ownsLock = true;
        await lock.close();
      } catch (error) {
        if (isNodeError(error) && error.code === "EEXIST") {
          throw new SessionImportError(
            "Another import holds the session lock; retry after it finishes or remove the lock only after confirming no importer is active",
          );
        }

        throw error;
      }

      const existing = await this.#loadPath(sessionPath);
      const validatedSession = validateSession(session);
      validateAppend(existing, validatedSession, expectedEventCount);
      const content = `${JSON.stringify(
        { schemaVersion: SCHEMA_VERSION, session: validatedSession },
        null,
        2,
      )}\n`;

      if (Buffer.byteLength(content) > MAX_DOCUMENT_BYTES) {
        throw new SessionImportError(
          `Session document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`,
        );
      }

      await writeFile(temporaryPath, content, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, sessionPath);
      await chmod(sessionPath, 0o600);
    } catch (error) {
      if (error instanceof SessionImportError) {
        throw error;
      }

      throw new SessionImportError("Cannot update the local session store", {
        cause: error,
      });
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);

      if (ownsLock) {
        await rm(lockPath, { force: true }).catch(() => undefined);
      }
    }
  }

  async #loadPath(sessionPath: string): Promise<ImportedSession | null> {
    let content: Buffer;

    try {
      content = await readFile(sessionPath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }

      throw new SessionImportError("Cannot read the local session store", {
        cause: error,
      });
    }

    if (content.byteLength > MAX_DOCUMENT_BYTES) {
      throw invalidSession("document exceeds the supported size limit");
    }

    let document: unknown;

    try {
      document = JSON.parse(content.toString("utf8"));
    } catch (error) {
      throw invalidSession("document is not valid JSON", error);
    }

    if (!isRecord(document) || document.schemaVersion !== SCHEMA_VERSION) {
      throw invalidSession("unsupported or missing schema version");
    }

    return validateSession(document.session);
  }

  #sessionPath(sessionId: string): string {
    return join(this.#directory, `${sessionId}.json`);
  }
}

function validateAppend(
  existing: ImportedSession | null,
  candidate: ImportedSession,
  expectedEventCount: number,
): void {
  if ((existing?.events.length ?? 0) !== expectedEventCount) {
    throw new SessionImportError(
      "The session changed during import; retry with the latest stored state",
    );
  }

  if (existing === null) {
    if (expectedEventCount !== 0) {
      throw new SessionImportError("The expected session state does not exist");
    }
    return;
  }

  if (
    existing.id !== candidate.id ||
    existing.projectId !== candidate.projectId ||
    existing.sourceType !== candidate.sourceType ||
    existing.sourceSessionId !== candidate.sourceSessionId ||
    existing.agent !== candidate.agent ||
    existing.model !== candidate.model ||
    existing.startedAt !== candidate.startedAt ||
    existing.createdAt !== candidate.createdAt
  ) {
    throw new SessionImportError("Stored session identity cannot be changed");
  }

  if (candidate.events.length < existing.events.length) {
    throw new SessionImportError("Stored session events cannot be truncated");
  }

  for (const [index, event] of existing.events.entries()) {
    if (JSON.stringify(candidate.events[index]) !== JSON.stringify(event)) {
      throw new SessionImportError(
        `Stored session event ${index + 1} cannot be changed`,
      );
    }
  }
}

function validateSession(value: unknown): ImportedSession {
  if (!isRecord(value)) {
    throw invalidSession("session must be an object");
  }

  const id = requiredString(value, "id");
  assertSessionId(id);
  const projectId = requiredString(value, "projectId");
  const sourceType = requiredString(value, "sourceType");
  const sourceSessionId = requiredString(value, "sourceSessionId");
  const agent = requiredString(value, "agent");
  const model = nullableString(value, "model");
  const startedAt = nullableTimestamp(value, "startedAt");
  const createdAt = requiredTimestamp(value, "createdAt");
  const lastImportedAt = requiredTimestamp(value, "lastImportedAt");
  const latestSourceArtifact = validateArtifact(value.latestSourceArtifact);

  if (!Array.isArray(value.events)) {
    throw invalidSession("events must be an array");
  }

  const events = value.events.map((event, index) =>
    validateEvent(event, id, index),
  );

  if (new Set(events.map((event) => event.id)).size !== events.length) {
    throw invalidSession("event identifiers must be unique");
  }

  return Object.freeze({
    id,
    projectId,
    sourceType,
    sourceSessionId,
    agent,
    model,
    startedAt,
    createdAt,
    lastImportedAt,
    latestSourceArtifact,
    events: Object.freeze(events),
  });
}

function validateEvent(
  value: unknown,
  sessionId: string,
  index: number,
): SessionEvent {
  if (!isRecord(value)) {
    throw invalidSession(`event ${index + 1} must be an object`);
  }

  const id = requiredString(value, "id");

  if (!EVENT_ID_PATTERN.test(id)) {
    throw invalidSession(`event ${index + 1} has an invalid id`);
  }

  if (value.sessionId !== sessionId || value.sequence !== index + 1) {
    throw invalidSession(`event ${index + 1} has invalid session ordering`);
  }

  if (!isEventType(value.type)) {
    throw invalidSession(`event ${index + 1} has an invalid type`);
  }

  if (value.trust !== "UNTRUSTED") {
    throw invalidSession(`event ${index + 1} has an invalid trust status`);
  }

  return Object.freeze({
    id,
    sessionId,
    sequence: index + 1,
    type: value.type,
    occurredAt: nullableTimestamp(value, "occurredAt"),
    trust: "UNTRUSTED",
    payload: validatePayload(value.payload, index),
    source: validateSource(value.source, index),
  });
}

function validatePayload(value: unknown, index: number): EventPayload {
  if (!isRecord(value)) {
    throw invalidSession(`event ${index + 1} has an invalid payload`);
  }

  if (value.kind === "INLINE_TEXT" && typeof value.text === "string") {
    return Object.freeze({ kind: "INLINE_TEXT", text: value.text });
  }

  if (
    value.kind === "ARTIFACT" &&
    (value.mediaType === "application/json" || value.mediaType === "text/plain")
  ) {
    return Object.freeze({
      kind: "ARTIFACT",
      artifact: validateArtifact(value.artifact),
      mediaType: value.mediaType,
    });
  }

  throw invalidSession(`event ${index + 1} has an invalid payload`);
}

function validateSource(value: unknown, index: number): SourceReference {
  if (!isRecord(value)) {
    throw invalidSession(`event ${index + 1} has an invalid source`);
  }

  const artifactId = requiredString(value, "artifactId");
  const sourceType = requiredString(value, "sourceType");
  const sourceSessionId = requiredString(value, "sourceSessionId");
  const recordHash = requiredString(value, "recordHash");

  if (
    !ARTIFACT_ID_PATTERN.test(artifactId) ||
    !HASH_PATTERN.test(recordHash) ||
    value.position !== index + 1
  ) {
    throw invalidSession(`event ${index + 1} has invalid source provenance`);
  }

  return Object.freeze({
    artifactId,
    sourceType,
    sourceSessionId,
    position: index + 1,
    recordHash,
  });
}

function validateArtifact(value: unknown): ArtifactReference {
  if (!isRecord(value)) {
    throw invalidSession("artifact reference must be an object");
  }

  const id = requiredString(value, "id");

  if (
    !ARTIFACT_ID_PATTERN.test(id) ||
    typeof value.byteLength !== "number" ||
    !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 0
  ) {
    throw invalidSession("artifact reference is invalid");
  }

  return Object.freeze({ id, byteLength: value.byteLength });
}

function requiredString(value: Record<string, unknown>, field: string): string {
  const candidate = value[field];

  if (typeof candidate !== "string" || candidate.length === 0) {
    throw invalidSession(`${field} must be a non-empty string`);
  }

  return candidate;
}

function nullableString(
  value: Record<string, unknown>,
  field: string,
): string | null {
  const candidate = value[field];

  if (candidate !== null && typeof candidate !== "string") {
    throw invalidSession(`${field} must be a string or null`);
  }

  return candidate;
}

function requiredTimestamp(
  value: Record<string, unknown>,
  field: string,
): string {
  const timestamp = requiredString(value, field);

  if (Number.isNaN(Date.parse(timestamp))) {
    throw invalidSession(`${field} must be a timestamp`);
  }

  return timestamp;
}

function nullableTimestamp(
  value: Record<string, unknown>,
  field: string,
): string | null {
  const timestamp = nullableString(value, field);

  if (timestamp !== null && Number.isNaN(Date.parse(timestamp))) {
    throw invalidSession(`${field} must be a timestamp or null`);
  }

  return timestamp;
}

function assertSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new SessionImportError("Session id has an invalid format");
  }
}

function isEventType(value: unknown): value is SessionEventType {
  return SESSION_EVENT_TYPES.some((type) => type === value);
}

function invalidSession(details: string, cause?: unknown): SessionImportError {
  return new SessionImportError(
    `The local session store is invalid: ${details}`,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
