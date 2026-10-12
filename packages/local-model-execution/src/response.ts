import { LOCAL_MODEL_LIMITS } from "./limits.ts";

export type LocalModelResponseReason =
  | "RESPONSE_TOO_LARGE"
  | "MALFORMED_RESPONSE"
  | "NOT_ONE_CHOICE"
  | "FINISH_REASON_NOT_STOP"
  | "EMPTY_CONTENT"
  | "ANSWER_TOO_LARGE";

export type LocalModelAnswer =
  | Readonly<{ kind: "ANSWER"; text: string; reportedModel: string | null }>
  | Readonly<{ kind: "UNKNOWN"; reason: LocalModelResponseReason }>;

const unknown = (reason: LocalModelResponseReason): LocalModelAnswer =>
  Object.freeze({ kind: "UNKNOWN", reason });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * ADR-0051. An answer is valid only for one whole JSON document within the
 * limits, exactly one choice, finish reason `stop` and non-empty string
 * content. Reasoning text beside the content is ignored, never returned. Every
 * other outcome is unknown, never a shorter answer.
 */
export function readChatAnswer(body: Uint8Array): LocalModelAnswer {
  if (body.byteLength > LOCAL_MODEL_LIMITS.responseBytes)
    return unknown("RESPONSE_TOO_LARGE");
  let document: unknown;
  try {
    document = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    );
  } catch {
    return unknown("MALFORMED_RESPONSE");
  }
  if (!isRecord(document)) return unknown("MALFORMED_RESPONSE");
  const choices = document["choices"];
  if (!Array.isArray(choices) || choices.length !== 1)
    return unknown("NOT_ONE_CHOICE");
  const choice: unknown = choices[0];
  if (!isRecord(choice)) return unknown("MALFORMED_RESPONSE");
  if (choice["finish_reason"] !== "stop")
    return unknown("FINISH_REASON_NOT_STOP");
  const message = choice["message"];
  const content = isRecord(message) ? message["content"] : undefined;
  if (typeof content !== "string" || !content.trim() || !content.isWellFormed())
    return unknown("EMPTY_CONTENT");
  if (Buffer.byteLength(content, "utf8") > LOCAL_MODEL_LIMITS.answerBytes)
    return unknown("ANSWER_TOO_LARGE");
  const model = document["model"];
  return Object.freeze({
    kind: "ANSWER",
    text: content,
    reportedModel:
      typeof model === "string" && model.trim() && model.length <= 256
        ? model
        : null,
  });
}
