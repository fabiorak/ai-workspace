import { readFile, stat } from "node:fs/promises";
import { TextDecoder, TextEncoder } from "node:util";
import {
  SessionImportError,
  type SessionEventType,
  type SessionSource,
  type SessionSourceAdapter,
  type SkippedRecordSummary,
  type SourceEvent,
} from "@ai-workspace/session-ingestion";

/**
 * Reads a real local Claude Code transcript.
 *
 * The narrow `claude-code` adapter accepts only the authored synthetic subset of
 * Sprint 5 and rejects everything else, which makes it unable to read an actual
 * transcript: real files carry record types that are not conversation turns,
 * assistant reasoning blocks, records without a timestamp or a uuid, and a
 * trailing record that may still be being written. This adapter is tolerant
 * about shape and strict about accounting: every record it does not convert is
 * counted and reported, so a partial reading can never be mistaken for a
 * complete one.
 *
 * It is a separate `sourceType`, so the frozen synthetic corpus, its adapter,
 * and every already-imported session remain untouched.
 */

const MAX_SOURCE_BYTES = 64 * 1024 * 1024,
  MAX_RECORD_BYTES = 4 * 1024 * 1024,
  MAX_BLOCKS_PER_RECORD = 1_000,
  MAX_EVENTS = 200_000;
const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/u;
const decoder = new TextDecoder("utf8", { fatal: true }),
  encoder = new TextEncoder();

type CandidateEvent = Readonly<{
  type: SessionEventType;
  payload: string;
}>;

type ParsedRecord = Readonly<{
  sessionId: string | null;
  occurredAt: string | null;
  model: string | null;
  events: readonly CandidateEvent[];
}>;

export class ClaudeCodeLocalSessionSourceAdapter implements SessionSourceAdapter {
  public readonly sourceType = "claude-code-local";

  public async read(filePath: string): Promise<SessionSource> {
    const rawContent = await readSource(filePath);
    let content: string;

    try {
      content = decoder.decode(rawContent);
    } catch (error) {
      throw new SessionImportError(
        "The Claude Code transcript is not valid UTF-8. Pass the original JSONL file without re-encoding it.",
        { cause: error },
      );
    }

    const lines = content.split("\n").map(stripCarriageReturn);

    if (lines.at(-1) === "") {
      lines.pop();
    }

    if (lines.length === 0) {
      throw new SessionImportError("The Claude Code transcript is empty.");
    }

    const skipped = new Map<string, number>();
    const records = lines.map((line, index) =>
      parseLine(line, index + 1, index === lines.length - 1, skipped),
    );
    const events: SourceEvent[] = [];

    for (const [index, record] of records.entries()) {
      if (record.events.length === 0) {
        continue;
      }

      const rawRecord = encoder.encode(lines[index]!);

      for (const event of record.events) {
        if (events.length >= MAX_EVENTS) {
          throw new SessionImportError(
            `The Claude Code transcript expands to more than ${MAX_EVENTS} events. Import a shorter transcript.`,
          );
        }

        events.push(
          Object.freeze({
            position: events.length + 1,
            type: event.type,
            occurredAt: record.occurredAt,
            payload: event.payload,
            rawRecord,
          }),
        );
      }
    }

    if (events.length === 0) {
      throw new SessionImportError(
        "The Claude Code transcript contains no convertible conversation record.",
      );
    }

    const sessionId = resolveSessionId(records);
    const models = new Set(
      records
        .map((record) => record.model)
        .filter((value): value is string => value !== null),
    );
    const timestamps = records
      .map((record) => record.occurredAt)
      .filter((value): value is string => value !== null)
      .sort();

    return Object.freeze({
      sourceType: this.sourceType,
      sourceSessionId: sessionId,
      agent: "claude-code",
      model: models.size === 1 ? [...models][0]! : null,
      startedAt: timestamps[0] ?? null,
      rawContent,
      events: Object.freeze(events),
      skippedRecords: summarize(skipped),
    });
  }
}

async function readSource(filePath: string): Promise<Uint8Array> {
  try {
    const details = await stat(filePath);

    if (!details.isFile()) {
      throw new SessionImportError(
        "The Claude Code transcript path must be a regular JSONL file chosen explicitly.",
      );
    }

    if (details.size > MAX_SOURCE_BYTES) {
      throw new SessionImportError(
        `The Claude Code transcript exceeds ${MAX_SOURCE_BYTES} bytes.`,
      );
    }

    return await readFile(filePath);
  } catch (error) {
    if (error instanceof SessionImportError) {
      throw error;
    }

    if (isNodeError(error) && error.code === "ENOENT") {
      throw new SessionImportError(
        "Claude Code transcript not found. Select an existing file; nothing is discovered automatically.",
        { cause: error },
      );
    }

    throw new SessionImportError(
      "Cannot read the Claude Code transcript. Check the explicit file path and its permissions.",
      { cause: error },
    );
  }
}

function parseLine(
  line: string,
  lineNumber: number,
  isLastLine: boolean,
  skipped: Map<string, number>,
): ParsedRecord {
  if (line.trim().length === 0) {
    return skip("BLANK_LINE", skipped);
  }

  if (encoder.encode(line).byteLength > MAX_RECORD_BYTES) {
    throw invalidLine(lineNumber, `record exceeds ${MAX_RECORD_BYTES} bytes`);
  }

  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch (error) {
    // A transcript of a session that is still running can end with a record
    // that has not been fully flushed. Tolerating it only at end of file keeps
    // a live session importable without accepting corruption anywhere else.
    if (isLastLine) {
      return skip("INCOMPLETE_TRAILING_RECORD", skipped);
    }

    throw invalidLine(lineNumber, "record is not valid JSON", error);
  }

  if (!isRecord(value)) {
    throw invalidLine(lineNumber, "record must be an object");
  }

  const declaredType = optionalString(value.type);
  const recordType = messageRecordType(declaredType);

  if (recordType === null) {
    return skip(`NON_MESSAGE_RECORD_TYPE:${safeToken(declaredType)}`, skipped);
  }

  const message = value.message;

  if (!isRecord(message)) {
    return skip("MESSAGE_WITHOUT_CONTENT", skipped);
  }

  const provenance = Object.freeze({
    recordUuid: optionalString(value.uuid),
    recordType,
    isSidechain: value.isSidechain === true,
    isMeta: value.isMeta === true,
  });
  const events = convertContent(
    message.content,
    recordType,
    provenance,
    lineNumber,
  );

  if (events.length === 0) {
    return skip("MESSAGE_WITHOUT_CONTENT", skipped);
  }

  return Object.freeze({
    sessionId: optionalString(value.sessionId),
    occurredAt: canonicalTimestamp(value.timestamp),
    model: recordType === "assistant" ? optionalString(message.model) : null,
    events: Object.freeze(events),
  });
}

type Provenance = Readonly<{
  recordUuid: string | null;
  recordType: "user" | "assistant";
  isSidechain: boolean;
  isMeta: boolean;
}>;

function convertContent(
  content: unknown,
  recordType: "user" | "assistant",
  provenance: Provenance,
  lineNumber: number,
): CandidateEvent[] {
  if (typeof content === "string") {
    return content.trim().length === 0
      ? []
      : [
          {
            type: recordType === "user" ? "USER_MESSAGE" : "AGENT_MESSAGE",
            payload: payload(provenance, null, "text", { text: content }),
          },
        ];
  }

  if (!Array.isArray(content)) {
    return [];
  }

  if (content.length > MAX_BLOCKS_PER_RECORD) {
    throw invalidLine(
      lineNumber,
      `message content exceeds ${MAX_BLOCKS_PER_RECORD} blocks`,
    );
  }

  const events: CandidateEvent[] = [];

  for (const [blockIndex, block] of content.entries()) {
    if (!isRecord(block)) {
      continue;
    }

    const event = convertBlock(block, blockIndex, recordType, provenance);

    if (event !== null) {
      events.push(event);
    }
  }

  return events;
}

function convertBlock(
  block: Record<string, unknown>,
  blockIndex: number,
  recordType: "user" | "assistant",
  provenance: Provenance,
): CandidateEvent | null {
  const blockType = optionalString(block.type);

  if (blockType === "text") {
    const text = optionalString(block.text);

    return text === null
      ? null
      : {
          type: recordType === "user" ? "USER_MESSAGE" : "AGENT_MESSAGE",
          payload: payload(provenance, blockIndex, "text", { text }),
        };
  }

  // Reasoning is genuine agent output, so it becomes an AGENT_MESSAGE rather
  // than being discarded. The payload keeps the distinction, so a reader can
  // always tell reasoning from a reply without a new canonical event type.
  if (blockType === "thinking") {
    const thinking = optionalString(block.thinking);

    return thinking === null
      ? null
      : {
          type: "AGENT_MESSAGE",
          payload: payload(provenance, blockIndex, "thinking", {
            text: thinking,
          }),
        };
  }

  if (blockType === "tool_use") {
    return {
      type: "TOOL_CALL",
      payload: payload(provenance, blockIndex, "tool_use", {
        toolUseId: optionalString(block.id),
        name: optionalString(block.name),
        input: block.input ?? null,
      }),
    };
  }

  if (blockType === "tool_result") {
    const isError = block.is_error === true;

    return {
      type: isError ? "ERROR" : "TOOL_RESULT",
      payload: payload(provenance, blockIndex, "tool_result", {
        toolUseId: optionalString(block.tool_use_id),
        content: flatten(block.content),
        isError,
      }),
    };
  }

  // An unrecognized block is preserved as UNKNOWN instead of being dropped: the
  // transcript is evidence, and losing part of it silently would be worse than
  // storing it without a precise classification.
  return {
    type: "UNKNOWN",
    payload: payload(provenance, blockIndex, safeToken(blockType), {
      block: flatten(block),
    }),
  };
}

function payload(
  provenance: Provenance,
  blockIndex: number | null,
  blockType: string,
  value: Record<string, unknown>,
): string {
  return JSON.stringify({ ...provenance, blockIndex, blockType, ...value });
}

function flatten(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value ?? null);
}

function skip(reason: string, skipped: Map<string, number>): ParsedRecord {
  skipped.set(reason, (skipped.get(reason) ?? 0) + 1);

  return Object.freeze({
    sessionId: null,
    occurredAt: null,
    model: null,
    events: Object.freeze([]),
  });
}

function summarize(
  skipped: Map<string, number>,
): readonly SkippedRecordSummary[] {
  return Object.freeze(
    [...skipped.entries()]
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([reason, count]) => Object.freeze({ reason, count })),
  );
}

function resolveSessionId(records: readonly ParsedRecord[]): string {
  const identities = new Set(
    records
      .map((record) => record.sessionId)
      .filter((value): value is string => value !== null),
  );

  if (identities.size === 0) {
    throw new SessionImportError(
      "The Claude Code transcript declares no sessionId on any conversation record.",
    );
  }

  if (identities.size > 1) {
    throw new SessionImportError(
      "The Claude Code transcript mixes several sessionId values. Import one session per file.",
    );
  }

  return [...identities][0]!;
}

function messageRecordType(value: string | null): "user" | "assistant" | null {
  return value === "user" || value === "assistant" ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeToken(value: string | null): string {
  return value !== null && SAFE_TOKEN.test(value) ? value : "other";
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stripCarriageReturn(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function invalidLine(line: number, details: string, cause?: unknown) {
  return new SessionImportError(
    `Invalid Claude Code transcript: line ${line}: ${details}`,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
