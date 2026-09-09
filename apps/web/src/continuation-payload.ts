import { createHash } from "node:crypto";
import type {
  ContextItem,
  ExpandedContextPackPreview,
} from "@ai-workspace/context-builder";

export const textDigest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
export const serializeContinuation = (
  items: readonly Pick<ContextItem, "id" | "content">[],
) => JSON.stringify(items.map(({ id, content }) => ({ id, content })));

/** Transient privacy projection: the original packet and its accounting stay immutable.
 * Additional user instructions and provenance are screened as text too. No invented
 * handoff section or canonical source is persisted by this adapter. */
export function continuationPrivacyInput(
  packet: ExpandedContextPackPreview,
  question: string,
): ExpandedContextPackPreview {
  if (
    !question.trim() ||
    !question.isWellFormed() ||
    Buffer.byteLength(question) > 8192
  )
    throw new Error("INVALID_QUESTION");
  const extra = (id: string, content: string): ContextItem =>
    Object.freeze({
      id,
      content,
      category: "INSTRUCTIONS",
      sourceType: "INSTRUCTION_RULE",
      sourceId: "local-user:continuation-envelope",
      trust: "USER_CONFIGURED",
      exactBytes: Buffer.byteLength(content),
    });
  const included = [
    ...packet.included,
    extra("continuation:question", question),
  ];
  const exactIncludedBytes = included.reduce(
    (sum, item) => sum + item.exactBytes,
    0,
  );
  if (Buffer.byteLength(serializeContinuation(included)) > 256 * 1024)
    throw new Error("PAYLOAD_TOO_LARGE");
  const usedBytes = {
    CONTINUITY: included
      .filter((item) => item.category === "CONTINUITY")
      .reduce((sum, item) => sum + item.exactBytes, 0),
    INSTRUCTIONS: 0,
  };
  usedBytes.INSTRUCTIONS = exactIncludedBytes - usedBytes.CONTINUITY;
  return Object.freeze({
    ...packet,
    sourceTableSummary: null,
    included: Object.freeze(included),
    usedBytes,
    budgets: {
      CONTINUITY: Math.max(packet.budgets.CONTINUITY, usedBytes.CONTINUITY),
      INSTRUCTIONS: Math.max(
        packet.budgets.INSTRUCTIONS,
        usedBytes.INSTRUCTIONS,
      ),
    },
    measurement: {
      ...packet.measurement,
      exactIncludedBytes,
      estimatedTokens: Math.ceil(exactIncludedBytes / 4),
    },
  });
}
