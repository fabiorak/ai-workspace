import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";

export const PSEUDONYM_REVIEW_SCHEMA_VERSION = 1;
export const PSEUDONYM_MAPPING_SCHEMA_VERSION = 1;
export const PSEUDONYMIZATION_EFFECT =
  "LOCAL_TRANSFORMATION_REVIEW_EVIDENCE_NOT_AUTHORIZED_OR_DELIVERED" as const;
export const ENTITY_TYPES = [
  "PERSON",
  "CUSTOMER",
  "EMAIL",
  "BUSINESS_IDENTIFIER",
  "OTHER",
] as const;
export type PseudonymEntityType = (typeof ENTITY_TYPES)[number];

export type ReviewedSpan = Readonly<{
  itemId: string;
  contentSha256: string;
  byteStart: number;
  byteEnd: number;
  entityType: PseudonymEntityType;
}>;
export type PseudonymReview = Readonly<{
  schemaVersion: 1;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  attribution: "USER_REVIEWED";
  selections: readonly ReviewedSpan[];
}>;
export type PseudonymMappingEntry = Readonly<{
  itemId: string;
  originalContentSha256: string;
  transformedContentSha256: string;
  originalByteStart: number;
  originalByteEnd: number;
  transformedByteStart: number;
  transformedByteEnd: number;
  entityType: PseudonymEntityType;
  pseudonym: string;
  originalBase64: string;
}>;
export type PseudonymMapping = Readonly<{
  schemaVersion: 1;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  entries: readonly PseudonymMappingEntry[];
}>;
export type PseudonymizedItem = Readonly<{
  itemId: string;
  category: "CONTINUITY" | "INSTRUCTIONS";
  sourceId: string;
  originalContentSha256: string;
  transformedContentSha256: string;
  transformedContent: string;
  exactBytes: number;
}>;
export type PseudonymizationPreview = Readonly<{
  schemaVersion: 1;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  items: readonly PseudonymizedItem[];
  selections: readonly Readonly<{
    itemId: string;
    byteStart: number;
    byteEnd: number;
    entityType: PseudonymEntityType;
    pseudonym: string;
  }>[];
  accounting: Readonly<{
    transformedItems: number;
    reviewedSelections: number;
    originalBytes: number;
    transformedBytes: number;
  }>;
  limitations: readonly [
    "USER_REVIEWED_SPANS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION",
    "PSEUDONYMIZATION_IS_NOT_PERMISSION_OR_DELIVERY_AUTHORIZATION",
  ];
  effect: typeof PSEUDONYMIZATION_EFFECT;
}>;

const DIGEST = /^[a-f0-9]{64}$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const MAX_TEXT = 256;
const MAX_SELECTIONS = 1_000;
const MAX_ITEM_BYTES = 1_024 * 1_024;
const REVIEW_KEYS = [
  "attribution",
  "handoffId",
  "mappingSetId",
  "modelId",
  "projectId",
  "schemaVersion",
  "selections",
  "workItemId",
] as const;
const SELECTION_KEYS = [
  "byteEnd",
  "byteStart",
  "contentSha256",
  "entityType",
  "itemId",
] as const;

export class PseudonymizationError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The reviewed pseudonymization input, key, mapping, or transformed content is malformed, stale, oversized, overlapping, noncanonical, or cross-scoped. Review exact item hashes and UTF-8 byte ranges, then retry.",
      options,
    );
    this.name = "PseudonymizationError";
  }
}

export function validatePseudonymReview(value: unknown): PseudonymReview {
  try {
    if (
      !record(value) ||
      !exactKeys(value, REVIEW_KEYS) ||
      value.schemaVersion !== PSEUDONYM_REVIEW_SCHEMA_VERSION ||
      !text(value.mappingSetId) ||
      !text(value.projectId) ||
      !text(value.workItemId) ||
      !text(value.handoffId) ||
      !text(value.modelId) ||
      value.attribution !== "USER_REVIEWED" ||
      !Array.isArray(value.selections) ||
      value.selections.length < 1 ||
      value.selections.length > MAX_SELECTIONS
    )
      throw invalid();
    const selections = value.selections
      .map((entry): ReviewedSpan => {
        if (
          !record(entry) ||
          !exactKeys(entry, SELECTION_KEYS) ||
          !text(entry.itemId) ||
          typeof entry.contentSha256 !== "string" ||
          !DIGEST.test(entry.contentSha256) ||
          !integer(entry.byteStart) ||
          !integer(entry.byteEnd) ||
          entry.byteStart < 0 ||
          entry.byteEnd <= entry.byteStart ||
          !ENTITY_TYPES.includes(entry.entityType as PseudonymEntityType)
        )
          throw invalid();
        return Object.freeze({
          itemId: entry.itemId,
          contentSha256: entry.contentSha256,
          byteStart: entry.byteStart,
          byteEnd: entry.byteEnd,
          entityType: entry.entityType as PseudonymEntityType,
        });
      })
      .sort(compareSpan);
    for (let index = 1; index < selections.length; index += 1) {
      const previous = selections[index - 1]!;
      const current = selections[index]!;
      if (
        previous.itemId === current.itemId &&
        current.byteStart < previous.byteEnd
      )
        throw invalid();
    }
    return Object.freeze({
      schemaVersion: 1 as const,
      mappingSetId: value.mappingSetId,
      projectId: value.projectId,
      workItemId: value.workItemId,
      handoffId: value.handoffId,
      modelId: value.modelId,
      attribution: "USER_REVIEWED" as const,
      selections: Object.freeze(selections),
    });
  } catch (error) {
    if (error instanceof PseudonymizationError) throw error;
    throw invalid(error);
  }
}

export function pseudonymizeContextPack(
  input: Readonly<{
    review: PseudonymReview;
    contextPack: ExpandedContextPackPreview;
    key: Uint8Array;
  }>,
): Readonly<{ preview: PseudonymizationPreview; mapping: PseudonymMapping }> {
  try {
    const review = validatePseudonymReview(input.review);
    const key = validateKey(input.key);
    const packet = input.contextPack;
    if (
      review.projectId !== packet.projectId ||
      review.workItemId !== packet.workItemId ||
      review.handoffId !== packet.handoffId
    )
      throw invalid();
    const items = new Map(packet.included.map((item) => [item.id, item]));
    const grouped = new Map<string, ReviewedSpan[]>();
    for (const selection of review.selections) {
      const item = items.get(selection.itemId);
      if (
        item === undefined ||
        sha256(item.content) !== selection.contentSha256
      )
        throw invalid();
      const bytes = Buffer.from(item.content, "utf8");
      if (
        bytes.length > MAX_ITEM_BYTES ||
        selection.byteEnd > bytes.length ||
        !utf8Boundary(bytes, selection.byteStart) ||
        !utf8Boundary(bytes, selection.byteEnd)
      )
        throw invalid();
      const list = grouped.get(selection.itemId) ?? [];
      list.push(selection);
      grouped.set(selection.itemId, list);
    }

    const mappingEntries: PseudonymMappingEntry[] = [];
    const publicSelections: PseudonymizationPreview["selections"][number][] =
      [];
    const transformedItems: PseudonymizedItem[] = [];
    for (const [itemId, selections] of [...grouped].sort(([a], [b]) =>
      compare(a, b),
    )) {
      const item = items.get(itemId)!;
      const original = Buffer.from(item.content, "utf8");
      const chunks: Buffer[] = [];
      let cursor = 0;
      let transformedCursor = 0;
      for (const selection of selections) {
        const prefix = original.subarray(cursor, selection.byteStart);
        chunks.push(prefix);
        transformedCursor += prefix.length;
        const selected = original.subarray(
          selection.byteStart,
          selection.byteEnd,
        );
        const pseudonym = alias(key, selection.entityType, selected);
        const replacement = Buffer.from(pseudonym, "utf8");
        const transformedByteStart = transformedCursor;
        const transformedByteEnd = transformedCursor + replacement.length;
        chunks.push(replacement);
        transformedCursor = transformedByteEnd;
        cursor = selection.byteEnd;
        const pending = {
          itemId,
          originalContentSha256: selection.contentSha256,
          originalByteStart: selection.byteStart,
          originalByteEnd: selection.byteEnd,
          transformedByteStart,
          transformedByteEnd,
          entityType: selection.entityType,
          pseudonym,
          originalBase64: selected.toString("base64"),
        };
        mappingEntries.push({ ...pending, transformedContentSha256: "" });
        publicSelections.push(
          Object.freeze({
            itemId,
            byteStart: selection.byteStart,
            byteEnd: selection.byteEnd,
            entityType: selection.entityType,
            pseudonym,
          }),
        );
      }
      chunks.push(original.subarray(cursor));
      const transformed = Buffer.concat(chunks);
      const transformedContent = transformed.toString("utf8");
      if (!Buffer.from(transformedContent, "utf8").equals(transformed))
        throw invalid();
      const transformedContentSha256 = sha256(transformedContent);
      for (let index = 0; index < mappingEntries.length; index += 1) {
        const entry = mappingEntries[index]!;
        if (entry.itemId === itemId && entry.transformedContentSha256 === "")
          mappingEntries[index] = Object.freeze({
            ...entry,
            transformedContentSha256,
          });
      }
      transformedItems.push(
        Object.freeze({
          itemId,
          category: item.category,
          sourceId: item.sourceId,
          originalContentSha256: sha256(item.content),
          transformedContentSha256,
          transformedContent,
          exactBytes: transformed.length,
        }),
      );
    }
    const mapping = validatePseudonymMapping({
      schemaVersion: 1,
      mappingSetId: review.mappingSetId,
      projectId: review.projectId,
      workItemId: review.workItemId,
      handoffId: review.handoffId,
      modelId: review.modelId,
      entries: mappingEntries,
    });
    const preview = Object.freeze({
      schemaVersion: 1 as const,
      mappingSetId: review.mappingSetId,
      projectId: review.projectId,
      workItemId: review.workItemId,
      handoffId: review.handoffId,
      modelId: review.modelId,
      items: Object.freeze(transformedItems),
      selections: Object.freeze(publicSelections),
      accounting: Object.freeze({
        transformedItems: transformedItems.length,
        reviewedSelections: publicSelections.length,
        originalBytes: transformedItems.reduce((sum, item) => {
          const source = items.get(item.itemId)!;
          return sum + Buffer.byteLength(source.content, "utf8");
        }, 0),
        transformedBytes: transformedItems.reduce(
          (sum, item) => sum + item.exactBytes,
          0,
        ),
      }),
      limitations: Object.freeze([
        "USER_REVIEWED_SPANS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION",
        "PSEUDONYMIZATION_IS_NOT_PERMISSION_OR_DELIVERY_AUTHORIZATION",
      ] as const),
      effect: PSEUDONYMIZATION_EFFECT,
    });
    return Object.freeze({ preview, mapping });
  } catch (error) {
    if (error instanceof PseudonymizationError) throw error;
    throw invalid(error);
  }
}

export function restorePseudonymizedItems(
  input: Readonly<{
    mapping: PseudonymMapping;
    items: readonly PseudonymizedItem[];
  }>,
): readonly Readonly<{
  itemId: string;
  content: string;
  contentSha256: string;
}>[] {
  try {
    const mapping = validatePseudonymMapping(input.mapping);
    const entries = new Map<string, PseudonymMappingEntry[]>();
    for (const entry of mapping.entries) {
      const list = entries.get(entry.itemId) ?? [];
      list.push(entry);
      entries.set(entry.itemId, list);
    }
    if (input.items.length !== entries.size) throw invalid();
    return Object.freeze(
      input.items.map((item) => {
        const selected = entries.get(item.itemId);
        if (
          selected === undefined ||
          sha256(item.transformedContent) !== item.transformedContentSha256
        )
          throw invalid();
        let bytes = Buffer.from(item.transformedContent, "utf8");
        for (const entry of [...selected].sort(
          (a, b) => b.transformedByteStart - a.transformedByteStart,
        )) {
          const expected = Buffer.from(entry.pseudonym, "utf8");
          const actual = bytes.subarray(
            entry.transformedByteStart,
            entry.transformedByteEnd,
          );
          if (
            actual.length !== expected.length ||
            !timingSafeEqual(actual, expected)
          )
            throw invalid();
          bytes = Buffer.concat([
            bytes.subarray(0, entry.transformedByteStart),
            Buffer.from(entry.originalBase64, "base64"),
            bytes.subarray(entry.transformedByteEnd),
          ]);
        }
        const content = bytes.toString("utf8");
        const contentSha256 = sha256(content);
        if (contentSha256 !== selected[0]!.originalContentSha256)
          throw invalid();
        return Object.freeze({ itemId: item.itemId, content, contentSha256 });
      }),
    );
  } catch (error) {
    if (error instanceof PseudonymizationError) throw error;
    throw invalid(error);
  }
}

export function validatePseudonymMapping(value: unknown): PseudonymMapping {
  try {
    if (
      !record(value) ||
      !exactKeys(value, [
        "entries",
        "handoffId",
        "mappingSetId",
        "modelId",
        "projectId",
        "schemaVersion",
        "workItemId",
      ]) ||
      value.schemaVersion !== 1 ||
      !text(value.mappingSetId) ||
      !text(value.projectId) ||
      !text(value.workItemId) ||
      !text(value.handoffId) ||
      !text(value.modelId) ||
      !Array.isArray(value.entries) ||
      value.entries.length < 1 ||
      value.entries.length > MAX_SELECTIONS
    )
      throw invalid();
    const entries = value.entries
      .map((entry): PseudonymMappingEntry => {
        if (
          !record(entry) ||
          !exactKeys(entry, [
            "entityType",
            "itemId",
            "originalBase64",
            "originalByteEnd",
            "originalByteStart",
            "originalContentSha256",
            "pseudonym",
            "transformedByteEnd",
            "transformedByteStart",
            "transformedContentSha256",
          ]) ||
          !text(entry.itemId) ||
          typeof entry.originalContentSha256 !== "string" ||
          !DIGEST.test(entry.originalContentSha256) ||
          typeof entry.transformedContentSha256 !== "string" ||
          !DIGEST.test(entry.transformedContentSha256) ||
          !integer(entry.originalByteStart) ||
          !integer(entry.originalByteEnd) ||
          entry.originalByteEnd <= entry.originalByteStart ||
          !integer(entry.transformedByteStart) ||
          !integer(entry.transformedByteEnd) ||
          entry.transformedByteEnd <= entry.transformedByteStart ||
          !ENTITY_TYPES.includes(entry.entityType as PseudonymEntityType) ||
          !text(entry.pseudonym) ||
          !/^\[\[AW_[A-Z_]+_[A-F0-9]{16}\]\]$/u.test(entry.pseudonym) ||
          typeof entry.originalBase64 !== "string" ||
          !BASE64.test(entry.originalBase64) ||
          Buffer.from(entry.originalBase64, "base64").length < 1 ||
          Buffer.from(entry.originalBase64, "base64").toString("base64") !==
            entry.originalBase64 ||
          Buffer.from(entry.originalBase64, "base64").length !==
            entry.originalByteEnd - entry.originalByteStart ||
          Buffer.byteLength(entry.pseudonym, "utf8") !==
            entry.transformedByteEnd - entry.transformedByteStart
        )
          throw invalid();
        return Object.freeze(entry as unknown as PseudonymMappingEntry);
      })
      .sort(
        (a, b) =>
          compare(a.itemId, b.itemId) ||
          a.transformedByteStart - b.transformedByteStart,
      );
    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1]!;
      const current = entries[index]!;
      if (
        previous.itemId === current.itemId &&
        (previous.originalContentSha256 !== current.originalContentSha256 ||
          previous.transformedContentSha256 !==
            current.transformedContentSha256 ||
          current.originalByteStart < previous.originalByteEnd ||
          current.transformedByteStart < previous.transformedByteEnd)
      )
        throw invalid();
    }
    return Object.freeze({
      schemaVersion: 1 as const,
      mappingSetId: value.mappingSetId,
      projectId: value.projectId,
      workItemId: value.workItemId,
      handoffId: value.handoffId,
      modelId: value.modelId,
      entries: Object.freeze(entries),
    });
  } catch (error) {
    if (error instanceof PseudonymizationError) throw error;
    throw invalid(error);
  }
}

function alias(
  key: Buffer,
  entityType: PseudonymEntityType,
  value: Buffer,
): string {
  const digest = createHmac("sha256", key)
    .update("ai-workspace/pseudonym/v1", "utf8")
    .update(Buffer.from([0]))
    .update(entityType, "utf8")
    .update(Buffer.from([0]))
    .update(value)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return `[[AW_${entityType}_${digest}]]`;
}
function validateKey(value: Uint8Array): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32)
    throw invalid();
  return Buffer.from(value);
}
function utf8Boundary(value: Buffer, offset: number): boolean {
  return (
    offset === 0 || offset === value.length || (value[offset]! & 0xc0) !== 0x80
  );
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function compareSpan(a: ReviewedSpan, b: ReviewedSpan): number {
  return (
    compare(a.itemId, b.itemId) ||
    a.byteStart - b.byteStart ||
    a.byteEnd - b.byteEnd ||
    compare(a.entityType, b.entityType)
  );
}
function compare(a: string, b: string): number {
  return a.localeCompare(b, "en");
}
function integer(value: unknown): value is number {
  return Number.isSafeInteger(value);
}
function text(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= MAX_TEXT &&
    !/\p{Cc}/u.test(value)
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compare);
  const sorted = [...expected].sort(compare);
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}
function invalid(cause?: unknown): PseudonymizationError {
  return new PseudonymizationError(cause === undefined ? undefined : { cause });
}
