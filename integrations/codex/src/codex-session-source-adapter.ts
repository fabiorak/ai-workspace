import { readFile, stat } from "node:fs/promises";
import { TextDecoder, TextEncoder } from "node:util";

import {
  SessionImportError,
  type SessionEventType,
  type SessionSource,
  type SessionSourceAdapter,
  type SourceEvent,
} from "@ai-workspace/session-ingestion";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024;
const MAX_EVENTS = 50_000;
const decoder = new TextDecoder("utf8", { fatal: true });
const encoder = new TextEncoder();

const EVENT_TYPES: Readonly<Record<string, SessionEventType>> = Object.freeze({
  user_message: "USER_MESSAGE",
  agent_message: "AGENT_MESSAGE",
  tool_call: "TOOL_CALL",
  tool_result: "TOOL_RESULT",
  command_result: "COMMAND_RESULT",
  file_change: "FILE_CHANGE",
  test_result: "TEST_RESULT",
  error: "ERROR",
});

export class CodexSessionSourceAdapter implements SessionSourceAdapter {
  public readonly sourceType = "codex";

  public async read(filePath: string): Promise<SessionSource> {
    let rawContent: Uint8Array;

    try {
      const sourceStat = await stat(filePath);

      if (!sourceStat.isFile()) {
        throw new SessionImportError(
          `The Codex session source '${filePath}' is not a regular file. Pass an existing JSONL file with --file.`,
        );
      }

      if (sourceStat.size > MAX_SOURCE_BYTES) {
        throw new SessionImportError(
          `The Codex session source exceeds ${MAX_SOURCE_BYTES} bytes`,
        );
      }

      rawContent = await readFile(filePath);
    } catch (error) {
      if (error instanceof SessionImportError) {
        throw error;
      }

      throw sourceReadError(filePath, error);
    }

    let content: string;

    try {
      content = decoder.decode(rawContent);
    } catch (error) {
      throw new SessionImportError(
        "The Codex session source is not valid UTF-8",
        {
          cause: error,
        },
      );
    }

    const lines = content.split(/\r?\n/u);

    if (lines.at(-1) === "") {
      lines.pop();
    }

    if (lines.length === 0) {
      throw new SessionImportError("The Codex session source is empty");
    }

    const metadata = parseRecord(lines[0] ?? "", 1);
    const session = parseMetadata(metadata);
    const eventLines = lines.slice(1);

    if (eventLines.length > MAX_EVENTS) {
      throw new SessionImportError(
        `The Codex session source exceeds ${MAX_EVENTS} events`,
      );
    }

    const events = eventLines.map((line, index) =>
      parseEvent(line, index + 2, index + 1),
    );

    return Object.freeze({
      sourceType: this.sourceType,
      sourceSessionId: session.sessionId,
      agent: session.agent,
      model: session.model,
      startedAt: session.startedAt,
      rawContent,
      events: Object.freeze(events),
    });
  }
}

function parseRecord(
  line: string,
  lineNumber: number,
): Record<string, unknown> {
  if (line.length === 0) {
    throw invalidLine(lineNumber, "empty records are not supported");
  }

  if (encoder.encode(line).byteLength > MAX_RECORD_BYTES) {
    throw invalidLine(lineNumber, `record exceeds ${MAX_RECORD_BYTES} bytes`);
  }

  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch (error) {
    throw invalidLine(lineNumber, "record is not valid JSON", error);
  }

  if (!isRecord(value)) {
    throw invalidLine(lineNumber, "record must be an object");
  }

  return value;
}

function parseMetadata(value: Record<string, unknown>): Readonly<{
  sessionId: string;
  agent: string;
  model: string | null;
  startedAt: string | null;
}> {
  if (value.schemaVersion !== 1) {
    throw invalidLine(1, "unsupported schema version");
  }

  if (value.recordType !== "session") {
    throw invalidLine(1, "first record must contain session metadata");
  }

  return Object.freeze({
    sessionId: requiredString(value, "sessionId", 1),
    agent: requiredString(value, "agent", 1),
    model: nullableString(value, "model", 1),
    startedAt: nullableTimestamp(value, "timestamp", 1),
  });
}

function parseEvent(
  line: string,
  lineNumber: number,
  position: number,
): SourceEvent {
  const value = parseRecord(line, lineNumber);

  if (value.recordType !== "event") {
    throw invalidLine(lineNumber, "recordType must be 'event'");
  }

  const sourceEventType = requiredString(value, "eventType", lineNumber);
  const type = EVENT_TYPES[sourceEventType] ?? "UNKNOWN";
  const payloadValue = type === "UNKNOWN" ? value : value.payload;

  if (payloadValue === undefined) {
    throw invalidLine(lineNumber, "event payload is required");
  }

  const payload =
    typeof payloadValue === "string"
      ? payloadValue
      : JSON.stringify(payloadValue);

  if (payload === undefined) {
    throw invalidLine(lineNumber, "event payload is not serializable");
  }

  return Object.freeze({
    position,
    type,
    occurredAt: nullableTimestamp(value, "timestamp", lineNumber),
    payload,
    rawRecord: encoder.encode(line),
  });
}

function requiredString(
  value: Record<string, unknown>,
  field: string,
  lineNumber: number,
): string {
  const candidate = value[field];

  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw invalidLine(lineNumber, `${field} must be a non-empty string`);
  }

  return candidate;
}

function nullableString(
  value: Record<string, unknown>,
  field: string,
  lineNumber: number,
): string | null {
  const candidate = value[field];

  if (candidate !== null && typeof candidate !== "string") {
    throw invalidLine(lineNumber, `${field} must be a string or null`);
  }

  return candidate;
}

function nullableTimestamp(
  value: Record<string, unknown>,
  field: string,
  lineNumber: number,
): string | null {
  const timestamp = nullableString(value, field, lineNumber);

  if (timestamp !== null && Number.isNaN(Date.parse(timestamp))) {
    throw invalidLine(lineNumber, `${field} must be an ISO timestamp or null`);
  }

  return timestamp;
}

function invalidLine(
  lineNumber: number,
  details: string,
  cause?: unknown,
): SessionImportError {
  return new SessionImportError(
    `Invalid Codex session source at line ${lineNumber}: ${details}`,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceReadError(filePath: string, cause: unknown): SessionImportError {
  if (isNodeError(cause) && cause.code === "ENOENT") {
    return new SessionImportError(
      `Codex session source file not found at '${filePath}'. Check the path or try the bundled fixture: integrations/codex/test/fixtures/session.jsonl`,
      { cause },
    );
  }

  if (
    isNodeError(cause) &&
    (cause.code === "EACCES" || cause.code === "EPERM")
  ) {
    return new SessionImportError(
      `Codex session source '${filePath}' is not readable. Check its permissions and retry.`,
      { cause },
    );
  }

  return new SessionImportError(
    `Cannot read Codex session source '${filePath}'. Check that it exists, is a readable regular file, and retry.`,
    { cause },
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
