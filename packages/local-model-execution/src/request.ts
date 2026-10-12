import { createHash } from "node:crypto";

import { LocalModelError } from "./endpoint.ts";
import { LOCAL_MODEL_LIMITS } from "./limits.ts";

export type LocalModelRequest = Readonly<{
  model: string;
  text: string;
}>;

export type LocalModelPlan = Readonly<{
  /** The exact JSON body that will be sent. */
  body: string;
  inputDigest: string;
  invocationDigest: string;
}>;

const digest = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

/**
 * ADR-0051. One user message, no streaming, the fixed `max_tokens`. Pure: it
 * performs no I/O and throws when the request cannot be sent within the limits.
 */
export function planChatRequest(request: LocalModelRequest): LocalModelPlan {
  if (
    typeof request.model !== "string" ||
    !request.model.trim() ||
    !request.model.isWellFormed() ||
    typeof request.text !== "string" ||
    !request.text.trim() ||
    !request.text.isWellFormed()
  )
    throw new LocalModelError("INVALID_LOCAL_MODEL_REQUEST");
  const body = JSON.stringify({
    model: request.model,
    messages: [{ role: "user", content: request.text }],
    stream: false,
    max_tokens: LOCAL_MODEL_LIMITS.maxTokens,
  });
  if (Buffer.byteLength(body, "utf8") > LOCAL_MODEL_LIMITS.requestBytes)
    throw new LocalModelError("LOCAL_MODEL_REQUEST_TOO_LARGE");
  return Object.freeze({
    body,
    inputDigest: digest(request.text),
    invocationDigest: digest(body),
  });
}
