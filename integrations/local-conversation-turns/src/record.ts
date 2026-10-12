import { createHash } from "node:crypto";
import {
  validateScope,
  type ConversationTurnAttempt,
  type ConversationTurnClaim,
  type ConversationTurnResult,
} from "@ai-workspace/conversation-turn";
import { unavailable } from "./files.ts";

export type Receipt =
  | Exclude<ConversationTurnResult, { kind: "COMPLETED" }>
  | Readonly<{
      kind: "COMPLETED";
      assistantMessageId: string;
      responseDigest: string;
      protection: { automatic: true; replacements: number } | null;
    }>;
export type ClaimRecord = Readonly<{
  schemaVersion: 1;
  claim: ConversationTurnClaim;
  owner: number;
}>;
export const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
export const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
export function identifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !!value &&
    value.trim() === value &&
    value.isWellFormed() &&
    Buffer.byteLength(value) <= 256 &&
    !/\p{Cc}/u.test(value)
  );
}
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function keys(
  value: Record<string, unknown>,
  expected: string[],
): boolean {
  return Object.keys(value).sort().join("|") === expected.sort().join("|");
}
export function envelope(value: unknown) {
  return { value, digest: digest(JSON.stringify(value)) };
}
export function unwrap(value: unknown): unknown {
  if (
    !object(value) ||
    !keys(value, ["value", "digest"]) ||
    value.digest !== digest(JSON.stringify(value.value))
  )
    throw unavailable();
  return value.value;
}
export function claimRecord(value: unknown): ClaimRecord {
  if (
    !object(value) ||
    !keys(value, ["schemaVersion", "claim", "owner"]) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.owner) ||
    (value.owner as number) < 1 ||
    !object(value.claim) ||
    !keys(value.claim, ["idempotencyKey", "requestDigest", "scope"]) ||
    !hash(value.claim.idempotencyKey) ||
    !hash(value.claim.requestDigest)
  )
    throw unavailable();
  return {
    schemaVersion: 1,
    owner: value.owner as number,
    claim: {
      idempotencyKey: value.claim.idempotencyKey,
      requestDigest: value.claim.requestDigest,
      scope: validateScope(value.claim.scope),
    },
  };
}
export function attempt(value: unknown): ConversationTurnAttempt {
  const classed = object(value) && Object.hasOwn(value, "executionClass");
  if (
    !object(value) ||
    !keys(value, [
      "projectId",
      "authorizationId",
      "attemptId",
      ...(classed ? ["executionClass"] : []),
    ]) ||
    ![value.projectId, value.authorizationId, value.attemptId].every(
      identifier,
    ) ||
    (classed &&
      value.executionClass !== "MODEL_DELIVERY" &&
      value.executionClass !== "AGENT_EXECUTION" &&
      value.executionClass !== "LOCAL_MODEL")
  )
    throw unavailable();
  return value as ConversationTurnAttempt;
}
export function receipt(value: unknown): Receipt {
  if (!object(value)) throw unavailable();
  if (
    value.kind === "COMPLETED" &&
    keys(value, [
      "kind",
      "assistantMessageId",
      "responseDigest",
      "protection",
    ]) &&
    identifier(value.assistantMessageId) &&
    hash(value.responseDigest) &&
    (value.protection === null ||
      (object(value.protection) &&
        keys(value.protection, ["automatic", "replacements"]) &&
        value.protection.automatic === true &&
        Number.isSafeInteger(value.protection.replacements) &&
        (value.protection.replacements as number) >= 0))
  )
    return value as Receipt;
  if (
    value.kind === "REFUSED_BEFORE_EXPOSURE" &&
    keys(value, ["kind", "reason"]) &&
    [
      "TARGET_UNAVAILABLE",
      "PRIVACY_BLOCKED",
      "CONTEXT_UNAVAILABLE",
      "REVIEW_INVALID",
      "LOCAL_EVIDENCE_UNAVAILABLE",
    ].includes(value.reason as string)
  )
    return value as Receipt;
  if (
    value.kind === "UNKNOWN_AFTER_EXPOSURE" &&
    keys(value, ["kind", "attemptId"]) &&
    identifier(value.attemptId)
  )
    return value as Receipt;
  if (
    value.kind === "RESPONSE_WITHHELD" &&
    keys(value, ["kind", "reason", "attemptId"]) &&
    identifier(value.attemptId) &&
    ["RESTORATION_FAILED", "CONTENT_BLOCKED", "SAVE_FAILED"].includes(
      value.reason as string,
    )
  )
    return value as Receipt;
  throw unavailable();
}
export function summarize(result: ConversationTurnResult): Receipt {
  return receipt(
    result.kind === "COMPLETED"
      ? {
          kind: result.kind,
          assistantMessageId: result.assistantMessageId,
          responseDigest: digest(result.text),
          protection: result.protection ?? null,
        }
      : result,
  );
}
