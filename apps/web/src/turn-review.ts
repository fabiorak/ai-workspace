import { createHash, randomUUID } from "node:crypto";
import type { ConversationTurnRequest } from "@ai-workspace/conversation-turn";

export const TURN_REVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_REVIEWS = 32;
const MAX_PAYLOAD_BYTES = 256 * 1024;
type ReviewedRequest = Pick<
  ConversationTurnRequest,
  "conversationId" | "projectId" | "targetId" | "userText"
>;
type Review = Readonly<{
  requestDigest: string;
  bindingDigest: string;
  text: string;
  expiresAt: number;
}>;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const requestDigest = (request: ReviewedRequest) =>
  digest(
    JSON.stringify([
      request.conversationId,
      request.projectId,
      request.targetId,
      request.userText,
    ]),
  );

/** Volatile preparation only: restart invalidates it; the turn registry owns durable replay.
 * At most 32 protected payloads of 256 KiB, never original text or mappings. */
export class TurnReviews {
  readonly #pending = new Map<string, Review>();
  readonly #clock: () => number;
  constructor(clock: () => number) {
    this.#clock = clock;
  }

  prepare(request: ReviewedRequest, bindingDigest: string, text: string) {
    for (const [id, entry] of this.#pending)
      if (entry.expiresAt <= this.#clock()) this.#pending.delete(id);
    if (
      this.#pending.size >= MAX_REVIEWS ||
      Buffer.byteLength(text) > MAX_PAYLOAD_BYTES
    )
      throw new Error("TURN_REVIEW_UNAVAILABLE");
    const id = randomUUID();
    const expiresAt = this.#clock() + TURN_REVIEW_TTL_MS;
    this.#pending.set(
      id,
      Object.freeze({
        requestDigest: requestDigest(request),
        bindingDigest,
        text,
        expiresAt,
      }),
    );
    return Object.freeze({
      id,
      expiresAt: new Date(expiresAt).toISOString(),
      payloadDigest: digest(text),
    });
  }

  consume(id: string, request: ReviewedRequest): Review {
    const entry = this.#pending.get(id);
    // Consumption is synchronous, before any asynchronous confirmation work.
    this.#pending.delete(id);
    if (
      !entry ||
      entry.expiresAt <= this.#clock() ||
      entry.requestDigest !== requestDigest(request)
    )
      throw new Error("TURN_REVIEW_INVALID");
    return entry;
  }
}
