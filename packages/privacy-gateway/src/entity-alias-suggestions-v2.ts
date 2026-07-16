import { createHash } from "node:crypto";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import { CustomerAliasSuggestionError } from "./entity-alias-suggestions.ts";

export const ENTITY_ALIAS_SUGGESTION_EFFECT =
  "LOCAL_REVIEW_SUGGESTIONS_NOT_REVIEWED_TRANSFORMED_OR_AUTHORIZED" as const;
export type EntityAliasType = "CUSTOMER" | "PROJECT";
export type EntityAliasEntry = Readonly<{
  entityType: EntityAliasType;
  alias: string;
}>;
export type EntityAliasSuggestion = Readonly<{
  itemId: string;
  contentSha256: string;
  entityType: EntityAliasType;
  byteStart: number;
  byteEnd: number;
  reason: "EXACT_CONFIGURED_ALIAS";
  state: "SUGGESTED_NOT_REVIEWED";
}>;
export type EntityAliasSuggestionReport = Readonly<{
  schemaVersion: 2;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  suggestions: readonly EntityAliasSuggestion[];
  accounting: Readonly<{
    dictionaryEntries: number;
    customerEntries: number;
    projectEntries: number;
    evaluatedItems: number;
    suggestions: number;
  }>;
  limitations: readonly [
    "EXACT_CUSTOMER_AND_PROJECT_ALIASES_ONLY_NOT_IDENTITY_OR_COMPLETE_PII_DETECTION",
    "SUGGESTIONS_REQUIRE_EXPLICIT_CURRENT_HASH_REVIEW",
  ];
  effect: typeof ENTITY_ALIAS_SUGGESTION_EFFECT;
}>;

const MAX_ALIASES = 1_000;
const MAX_ALIAS_BYTES = 256;
const MAX_MODEL_ID_BYTES = 256;

export function suggestEntityAliases(
  input: Readonly<{
    modelId: string;
    contextPack: ExpandedContextPackPreview;
    dictionary: readonly EntityAliasEntry[];
  }>,
): EntityAliasSuggestionReport {
  try {
    if (!safeText(input.modelId, MAX_MODEL_ID_BYTES)) throw invalid();
    const dictionary = validateDictionary(input.dictionary);
    const packet = input.contextPack;
    const suggestions: EntityAliasSuggestion[] = [];
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
                entityType: entry.entityType,
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
      schemaVersion: 2 as const,
      projectId: packet.projectId,
      workItemId: packet.workItemId,
      handoffId: packet.handoffId,
      modelId: input.modelId,
      suggestions: Object.freeze(suggestions),
      accounting: Object.freeze({
        dictionaryEntries: dictionary.length,
        customerEntries: dictionary.filter(
          (entry) => entry.entityType === "CUSTOMER",
        ).length,
        projectEntries: dictionary.filter(
          (entry) => entry.entityType === "PROJECT",
        ).length,
        evaluatedItems: packet.included.length,
        suggestions: suggestions.length,
      }),
      limitations: Object.freeze([
        "EXACT_CUSTOMER_AND_PROJECT_ALIASES_ONLY_NOT_IDENTITY_OR_COMPLETE_PII_DETECTION",
        "SUGGESTIONS_REQUIRE_EXPLICIT_CURRENT_HASH_REVIEW",
      ] as const),
      effect: ENTITY_ALIAS_SUGGESTION_EFFECT,
    });
  } catch (error) {
    if (error instanceof CustomerAliasSuggestionError) throw error;
    throw invalid(error);
  }
}

function validateDictionary(value: readonly EntityAliasEntry[]) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ALIASES)
    throw invalid();
  const seen = new Set<string>();
  return Object.freeze(
    value
      .map((entry) => {
        const identity = `${entry.entityType}\0${entry.alias}`;
        if (
          typeof entry !== "object" ||
          entry === null ||
          Object.keys(entry).sort().join("\0") !== "alias\0entityType" ||
          !["CUSTOMER", "PROJECT"].includes(entry.entityType) ||
          !safeText(entry.alias, MAX_ALIAS_BYTES) ||
          seen.has(identity)
        )
          throw invalid();
        seen.add(identity);
        return Object.freeze({
          entityType: entry.entityType,
          alias: entry.alias,
        });
      })
      .sort(
        (left, right) =>
          compare(left.alias, right.alias) ||
          compare(left.entityType, right.entityType),
      ),
  );
}

function hasTokenBoundaries(value: string, start: number, end: number) {
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
function token(value: string) {
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
function wellFormed(value: string) {
  return Buffer.from(value, "utf8").toString("utf8") === value;
}
function compareSuggestion(
  left: EntityAliasSuggestion,
  right: EntityAliasSuggestion,
) {
  return (
    compare(left.itemId, right.itemId) ||
    left.byteStart - right.byteStart ||
    left.byteEnd - right.byteEnd ||
    compare(left.entityType, right.entityType)
  );
}
function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function invalid(cause?: unknown) {
  return new CustomerAliasSuggestionError(
    cause === undefined ? undefined : { cause },
  );
}
