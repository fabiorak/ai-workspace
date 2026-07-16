import { createHash } from "node:crypto";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";

export const CUSTOMER_ALIAS_SUGGESTION_EFFECT =
  "LOCAL_REVIEW_SUGGESTIONS_NOT_REVIEWED_TRANSFORMED_OR_AUTHORIZED" as const;

export type CustomerAliasEntry = Readonly<{
  entityType: "CUSTOMER";
  alias: string;
}>;
export type CustomerAliasSuggestion = Readonly<{
  itemId: string;
  contentSha256: string;
  entityType: "CUSTOMER";
  byteStart: number;
  byteEnd: number;
  reason: "EXACT_CONFIGURED_ALIAS";
  state: "SUGGESTED_NOT_REVIEWED";
}>;
export type CustomerAliasSuggestionReport = Readonly<{
  schemaVersion: 1;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  suggestions: readonly CustomerAliasSuggestion[];
  accounting: Readonly<{
    dictionaryEntries: number;
    evaluatedItems: number;
    suggestions: number;
  }>;
  limitations: readonly [
    "EXACT_CUSTOMER_ALIASES_ONLY_NOT_IDENTITY_OR_COMPLETE_PII_DETECTION",
    "SUGGESTIONS_REQUIRE_EXPLICIT_CURRENT_HASH_REVIEW",
  ];
  effect: typeof CUSTOMER_ALIAS_SUGGESTION_EFFECT;
}>;

const MAX_ALIASES = 1_000;
const MAX_ALIAS_BYTES = 256;
const MAX_MODEL_ID_BYTES = 256;

export class CustomerAliasSuggestionError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The customer-alias suggestion input is malformed, ambiguous, conflicting, oversized, or incompatible. Review the transient dictionary and exact current Context Pack, then retry.",
      options,
    );
    this.name = "CustomerAliasSuggestionError";
  }
}

export function suggestCustomerAliases(
  input: Readonly<{
    modelId: string;
    contextPack: ExpandedContextPackPreview;
    dictionary: readonly CustomerAliasEntry[];
  }>,
): CustomerAliasSuggestionReport {
  try {
    if (!safeText(input.modelId, MAX_MODEL_ID_BYTES)) throw invalid();
    const dictionary = validateDictionary(input.dictionary);
    const packet = input.contextPack;
    const suggestions: CustomerAliasSuggestion[] = [];
    for (const item of packet.included) {
      if (!wellFormed(item.content)) throw invalid();
      const contentSha256 = sha256(item.content);
      for (const entry of dictionary) {
        let cursor = 0;
        while (cursor <= item.content.length - entry.alias.length) {
          const start = item.content.indexOf(entry.alias, cursor);
          if (start < 0) break;
          const end = start + entry.alias.length;
          if (hasTokenBoundaries(item.content, start, end))
            suggestions.push(
              Object.freeze({
                itemId: item.id,
                contentSha256,
                entityType: "CUSTOMER" as const,
                byteStart: Buffer.byteLength(item.content.slice(0, start)),
                byteEnd: Buffer.byteLength(item.content.slice(0, end)),
                reason: "EXACT_CONFIGURED_ALIAS" as const,
                state: "SUGGESTED_NOT_REVIEWED" as const,
              }),
            );
          cursor = end;
        }
      }
    }
    suggestions.sort(compareSuggestion);
    for (let index = 1; index < suggestions.length; index += 1) {
      const previous = suggestions[index - 1]!;
      const current = suggestions[index]!;
      if (
        previous.itemId === current.itemId &&
        current.byteStart < previous.byteEnd
      )
        throw invalid();
    }
    return Object.freeze({
      schemaVersion: 1 as const,
      projectId: packet.projectId,
      workItemId: packet.workItemId,
      handoffId: packet.handoffId,
      modelId: input.modelId,
      suggestions: Object.freeze(suggestions),
      accounting: Object.freeze({
        dictionaryEntries: dictionary.length,
        evaluatedItems: packet.included.length,
        suggestions: suggestions.length,
      }),
      limitations: Object.freeze([
        "EXACT_CUSTOMER_ALIASES_ONLY_NOT_IDENTITY_OR_COMPLETE_PII_DETECTION",
        "SUGGESTIONS_REQUIRE_EXPLICIT_CURRENT_HASH_REVIEW",
      ] as const),
      effect: CUSTOMER_ALIAS_SUGGESTION_EFFECT,
    });
  } catch (error) {
    if (error instanceof CustomerAliasSuggestionError) throw error;
    throw invalid(error);
  }
}

function validateDictionary(
  value: readonly CustomerAliasEntry[],
): readonly CustomerAliasEntry[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ALIASES)
    throw invalid();
  const seen = new Set<string>();
  const entries = value.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Object.keys(entry).sort().join("\0") !== "alias\0entityType" ||
      entry.entityType !== "CUSTOMER" ||
      !safeText(entry.alias, MAX_ALIAS_BYTES) ||
      seen.has(entry.alias)
    )
      throw invalid();
    seen.add(entry.alias);
    return Object.freeze({
      entityType: "CUSTOMER" as const,
      alias: entry.alias,
    });
  });
  return Object.freeze(
    entries.sort((left, right) => compare(left.alias, right.alias)),
  );
}

function hasTokenBoundaries(
  value: string,
  start: number,
  end: number,
): boolean {
  const first = Array.from(value.slice(start, end))[0];
  const last = Array.from(value.slice(start, end)).at(-1);
  const previous = Array.from(value.slice(0, start)).at(-1);
  const next = Array.from(value.slice(end))[0];
  return !(
    (first !== undefined &&
      token(first) &&
      previous !== undefined &&
      token(previous)) ||
    (last !== undefined && token(last) && next !== undefined && token(next))
  );
}

function token(value: string): boolean {
  return /[\p{L}\p{M}\p{N}_]/u.test(value);
}
function safeText(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    wellFormed(value) &&
    !/\p{Cc}/u.test(value) &&
    Buffer.byteLength(value) <= maximumBytes
  );
}
function wellFormed(value: string): boolean {
  return Buffer.from(value, "utf8").toString("utf8") === value;
}
function compareSuggestion(
  left: CustomerAliasSuggestion,
  right: CustomerAliasSuggestion,
): number {
  return (
    compare(left.itemId, right.itemId) ||
    left.byteStart - right.byteStart ||
    left.byteEnd - right.byteEnd
  );
}
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function invalid(cause?: unknown): CustomerAliasSuggestionError {
  return new CustomerAliasSuggestionError(
    cause === undefined ? undefined : { cause },
  );
}
