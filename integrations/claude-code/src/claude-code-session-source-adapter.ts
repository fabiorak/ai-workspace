import { readFile, stat } from "node:fs/promises";
import { TextDecoder, TextEncoder } from "node:util";
import {
  SessionImportError,
  type SessionEventType,
  type SessionSource,
  type SessionSourceAdapter,
  type SourceEvent,
} from "@ai-workspace/session-ingestion";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024,
  MAX_RECORD_BYTES = 1024 * 1024,
  MAX_BLOCKS_PER_RECORD = 100,
  MAX_EVENTS = 50_000;
const decoder = new TextDecoder("utf8", { fatal: true }),
  encoder = new TextEncoder();
type ParsedRecord = Readonly<{
  sessionId: string;
  uuid: string;
  timestamp: string;
  model: string | null;
  events: readonly Readonly<{ type: SessionEventType; payload: string }>[];
  toolUseIds: readonly string[];
  toolResultIds: readonly string[];
}>;

export class ClaudeCodeSessionSourceAdapter implements SessionSourceAdapter {
  public readonly sourceType = "claude-code";
  public async read(filePath: string): Promise<SessionSource> {
    let rawContent: Uint8Array;
    try {
      const details = await stat(filePath);
      if (!details.isFile())
        throw new SessionImportError(
          "The narrow synthetic-only Claude Code source must be a regular JSONL file passed explicitly with --file.",
        );
      if (details.size > MAX_SOURCE_BYTES)
        throw new SessionImportError(
          `The Claude Code source exceeds ${MAX_SOURCE_BYTES} bytes.`,
        );
      rawContent = await readFile(filePath);
    } catch (error) {
      if (error instanceof SessionImportError) throw error;
      throw readError(error);
    }
    let content: string;
    try {
      content = decoder.decode(rawContent);
    } catch (error) {
      throw new SessionImportError(
        "The Claude Code source is not valid UTF-8.",
        { cause: error },
      );
    }
    if (content.includes("\r"))
      throw new SessionImportError(
        "The narrow Claude Code source supports LF-delimited JSONL only.",
      );
    const lines = content.split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (lines.length === 0)
      throw new SessionImportError("The Claude Code source is empty.");
    const records = lines.map((line, index) => parseLine(line, index + 1));
    const sessionId = records[0]!.sessionId;
    if (records.some((record) => record.sessionId !== sessionId))
      throw invalid("sessionId changes between records");
    const seenTools = new Set<string>();
    for (const record of records) {
      for (const id of record.toolResultIds)
        if (!seenTools.has(id))
          throw invalid("tool_result references an unknown prior tool_use");
      for (const id of record.toolUseIds) {
        if (seenTools.has(id)) throw invalid("tool_use id is duplicated");
        seenTools.add(id);
      }
    }
    const events: SourceEvent[] = [];
    for (const [recordIndex, record] of records.entries()) {
      const rawRecord = encoder.encode(lines[recordIndex]!);
      for (const event of record.events) {
        if (events.length >= MAX_EVENTS)
          throw invalid(`expanded event count exceeds ${MAX_EVENTS}`);
        events.push(
          Object.freeze({
            position: events.length + 1,
            type: event.type,
            occurredAt: record.timestamp,
            payload: event.payload,
            rawRecord,
          }),
        );
      }
    }
    const models = new Set(
      records
        .map((record) => record.model)
        .filter((value): value is string => value !== null),
    );
    const timestamps = records.map((record) => record.timestamp).sort();
    return Object.freeze({
      sourceType: this.sourceType,
      sourceSessionId: sessionId,
      agent: "claude-code",
      model: models.size === 1 ? [...models][0]! : null,
      startedAt: timestamps[0] ?? null,
      rawContent,
      events: Object.freeze(events),
    });
  }
}

function parseLine(line: string, lineNumber: number): ParsedRecord {
  if (line.length === 0)
    throw invalidLine(lineNumber, "empty records are not supported");
  if (encoder.encode(line).byteLength > MAX_RECORD_BYTES)
    throw invalidLine(lineNumber, `record exceeds ${MAX_RECORD_BYTES} bytes`);
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (error) {
    throw invalidLine(lineNumber, "record is not valid JSON", error);
  }
  if (!isRecord(value))
    throw invalidLine(lineNumber, "record must be an object");
  const type = required(value, "type", lineNumber),
    uuid = required(value, "uuid", lineNumber),
    sessionId = required(value, "sessionId", lineNumber),
    timestamp = canonicalTimestamp(value.timestamp, lineNumber);
  if (type !== "user" && type !== "assistant")
    throw invalidLine(lineNumber, "unsupported top-level type");
  if (!isRecord(value.message) || value.message.role !== type)
    throw invalidLine(
      lineNumber,
      "message role must match the supported record type",
    );
  const content = value.message.content;
  const events: { type: SessionEventType; payload: string }[] = [];
  const toolUseIds: string[] = [],
    toolResultIds: string[] = [];
  let model: string | null = null;
  if (type === "user" && typeof content === "string") {
    if (!content)
      throw invalidLine(lineNumber, "user content must not be empty");
    events.push({
      type: "USER_MESSAGE",
      payload: payload(uuid, null, { content }),
    });
  } else {
    if (
      !Array.isArray(content) ||
      content.length < 1 ||
      content.length > MAX_BLOCKS_PER_RECORD
    )
      throw invalidLine(
        lineNumber,
        `message content must contain from 1 to ${MAX_BLOCKS_PER_RECORD} blocks`,
      );
    if (type === "assistant")
      model = required(value.message, "model", lineNumber);
    for (const [blockIndex, block] of content.entries()) {
      if (!isRecord(block))
        throw invalidLine(lineNumber, "content block must be an object");
      if (type === "assistant" && block.type === "text") {
        events.push({
          type: "AGENT_MESSAGE",
          payload: payload(uuid, blockIndex, {
            text: required(block, "text", lineNumber),
          }),
        });
        continue;
      }
      if (type === "assistant" && block.type === "tool_use") {
        const id = required(block, "id", lineNumber),
          name = required(block, "name", lineNumber);
        if (!isRecord(block.input))
          throw invalidLine(lineNumber, "tool_use input must be an object");
        toolUseIds.push(id);
        events.push({
          type: "TOOL_CALL",
          payload: payload(uuid, blockIndex, { id, name, input: block.input }),
        });
        continue;
      }
      if (type === "user" && block.type === "tool_result") {
        const toolUseId = required(block, "tool_use_id", lineNumber);
        if (
          typeof block.content !== "string" ||
          typeof block.is_error !== "boolean"
        )
          throw invalidLine(
            lineNumber,
            "tool_result content and is_error are invalid",
          );
        toolResultIds.push(toolUseId);
        events.push({
          type: block.is_error ? "ERROR" : "TOOL_RESULT",
          payload: payload(uuid, blockIndex, {
            toolUseId,
            content: block.content,
            isError: block.is_error,
          }),
        });
        continue;
      }
      throw invalidLine(lineNumber, "unsupported content block type");
    }
  }
  return Object.freeze({
    sessionId,
    uuid,
    timestamp,
    model,
    events: Object.freeze(events),
    toolUseIds: Object.freeze(toolUseIds),
    toolResultIds: Object.freeze(toolResultIds),
  });
}
function payload(
  recordUuid: string,
  blockIndex: number | null,
  value: Record<string, unknown>,
): string {
  return JSON.stringify({ recordUuid, blockIndex, ...value });
}
function required(
  value: Record<string, unknown>,
  field: string,
  line: number,
): string {
  const candidate = value[field];
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.trim() !== candidate
  )
    throw invalidLine(line, `${field} must be a non-empty normalized string`);
  return candidate;
}
function canonicalTimestamp(value: unknown, line: number): string {
  if (typeof value !== "string")
    throw invalidLine(line, "timestamp must be a canonical ISO timestamp");
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value)
    throw invalidLine(line, "timestamp must be a canonical ISO timestamp");
  return value;
}
function invalid(details: string, cause?: unknown) {
  return new SessionImportError(
    `Invalid narrow Claude Code session source: ${details}`,
    cause === undefined ? undefined : { cause },
  );
}
function invalidLine(line: number, details: string, cause?: unknown) {
  return invalid(`line ${line}: ${details}`, cause);
}
function readError(error: unknown) {
  if (isNodeError(error) && error.code === "ENOENT")
    return new SessionImportError(
      "Claude Code source file not found. Pass the authored synthetic fixture explicitly; live provider discovery is unsupported.",
      { cause: error },
    );
  return new SessionImportError(
    "Cannot read the narrow synthetic-only Claude Code source. Check the explicit file path and permissions.",
    { cause: error },
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
