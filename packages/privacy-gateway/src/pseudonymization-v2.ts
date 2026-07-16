import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import {
  PseudonymizationError,
  type PseudonymMapping,
  type PseudonymizedItem,
} from "./pseudonymization.ts";

export const PSEUDONYM_REVIEW_SCHEMA_VERSION_V2 = 2;
export const PSEUDONYM_MAPPING_SCHEMA_VERSION_V2 = 2;
export const ENTITY_TYPES_V2 = [
  "PERSON",
  "CUSTOMER",
  "PROJECT",
  "EMAIL",
  "BUSINESS_IDENTIFIER",
  "OTHER",
] as const;
export type PseudonymEntityTypeV2 = (typeof ENTITY_TYPES_V2)[number];

export type ReviewedSpanV2 = Readonly<{
  itemId: string;
  contentSha256: string;
  byteStart: number;
  byteEnd: number;
  entityType: PseudonymEntityTypeV2;
}>;
export type PseudonymReviewV2 = Readonly<{
  schemaVersion: 2;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  attribution: "USER_REVIEWED";
  selections: readonly ReviewedSpanV2[];
}>;
export type PseudonymMappingEntryV2 = Readonly<{
  itemId: string;
  originalContentSha256: string;
  transformedContentSha256: string;
  originalByteStart: number;
  originalByteEnd: number;
  transformedByteStart: number;
  transformedByteEnd: number;
  entityType: PseudonymEntityTypeV2;
  pseudonym: string;
  originalBase64: string;
}>;
export type PseudonymMappingV2 = Readonly<{
  schemaVersion: 2;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  entries: readonly PseudonymMappingEntryV2[];
}>;
export type VersionedPseudonymMapping = PseudonymMapping | PseudonymMappingV2;
export type PseudonymizationPreviewV2 = Readonly<{
  schemaVersion: 2;
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
    entityType: PseudonymEntityTypeV2;
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
  effect: "LOCAL_TRANSFORMATION_REVIEW_EVIDENCE_NOT_AUTHORIZED_OR_DELIVERED";
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
const MAPPING_KEYS = [
  "entries",
  "handoffId",
  "mappingSetId",
  "modelId",
  "projectId",
  "schemaVersion",
  "workItemId",
] as const;
const ENTRY_KEYS = [
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
] as const;

export function validatePseudonymReviewV2(value: unknown): PseudonymReviewV2 {
  try {
    if (
      !record(value) ||
      !exactKeys(value, REVIEW_KEYS) ||
      value.schemaVersion !== 2 ||
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
      .map((entry): ReviewedSpanV2 => {
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
          !ENTITY_TYPES_V2.includes(entry.entityType as PseudonymEntityTypeV2)
        )
          throw invalid();
        return Object.freeze({
          itemId: entry.itemId,
          contentSha256: entry.contentSha256,
          byteStart: entry.byteStart,
          byteEnd: entry.byteEnd,
          entityType: entry.entityType as PseudonymEntityTypeV2,
        });
      })
      .sort(compareSpan);
    if (!selections.some((entry) => entry.entityType === "PROJECT"))
      throw invalid();
    rejectOverlaps(selections);
    return Object.freeze({
      schemaVersion: 2 as const,
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

export function pseudonymizeContextPackV2(
  input: Readonly<{
    review: PseudonymReviewV2;
    contextPack: ExpandedContextPackPreview;
    key: Uint8Array;
  }>,
): Readonly<{
  preview: PseudonymizationPreviewV2;
  mapping: PseudonymMappingV2;
}> {
  try {
    const review = validatePseudonymReviewV2(input.review);
    const key = validateKey(input.key);
    const packet = input.contextPack;
    if (
      review.projectId !== packet.projectId ||
      review.workItemId !== packet.workItemId ||
      review.handoffId !== packet.handoffId
    )
      throw invalid();
    const items = new Map(packet.included.map((item) => [item.id, item]));
    const grouped = new Map<string, ReviewedSpanV2[]>();
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

    const mappingEntries: PseudonymMappingEntryV2[] = [];
    const publicSelections: PseudonymizationPreviewV2["selections"][number][] =
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
      const startIndex = mappingEntries.length;
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
        mappingEntries.push({
          itemId,
          originalContentSha256: selection.contentSha256,
          originalByteStart: selection.byteStart,
          originalByteEnd: selection.byteEnd,
          transformedByteStart,
          transformedByteEnd,
          entityType: selection.entityType,
          pseudonym,
          originalBase64: selected.toString("base64"),
          transformedContentSha256: "",
        });
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
      for (let index = startIndex; index < mappingEntries.length; index += 1)
        mappingEntries[index] = Object.freeze({
          ...mappingEntries[index]!,
          transformedContentSha256,
        });
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
    const mapping = validatePseudonymMappingV2({
      schemaVersion: 2,
      mappingSetId: review.mappingSetId,
      projectId: review.projectId,
      workItemId: review.workItemId,
      handoffId: review.handoffId,
      modelId: review.modelId,
      entries: mappingEntries,
    });
    return Object.freeze({
      mapping,
      preview: Object.freeze({
        schemaVersion: 2 as const,
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
          originalBytes: transformedItems.reduce(
            (sum, transformed) =>
              sum + Buffer.byteLength(items.get(transformed.itemId)!.content),
            0,
          ),
          transformedBytes: transformedItems.reduce(
            (sum, transformed) => sum + transformed.exactBytes,
            0,
          ),
        }),
        limitations: Object.freeze([
          "USER_REVIEWED_SPANS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION",
          "PSEUDONYMIZATION_IS_NOT_PERMISSION_OR_DELIVERY_AUTHORIZATION",
        ] as const),
        effect:
          "LOCAL_TRANSFORMATION_REVIEW_EVIDENCE_NOT_AUTHORIZED_OR_DELIVERED" as const,
      }),
    });
  } catch (error) {
    if (error instanceof PseudonymizationError) throw error;
    throw invalid(error);
  }
}

export function validatePseudonymMappingV2(value: unknown): PseudonymMappingV2 {
  try {
    if (
      !record(value) ||
      !exactKeys(value, MAPPING_KEYS) ||
      value.schemaVersion !== 2 ||
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
      .map((entry): PseudonymMappingEntryV2 => {
        if (
          !record(entry) ||
          !exactKeys(entry, ENTRY_KEYS) ||
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
          !ENTITY_TYPES_V2.includes(
            entry.entityType as PseudonymEntityTypeV2,
          ) ||
          !text(entry.pseudonym) ||
          !pseudonymMatches(
            entry.pseudonym,
            entry.entityType as PseudonymEntityTypeV2,
          ) ||
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
        return Object.freeze(entry as unknown as PseudonymMappingEntryV2);
      })
      .sort(compareEntry);
    if (!entries.some((entry) => entry.entityType === "PROJECT"))
      throw invalid();
    rejectEntryConflicts(entries);
    return Object.freeze({
      schemaVersion: 2 as const,
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

export function restorePseudonymizedItemsV2(
  input: Readonly<{
    mapping: PseudonymMappingV2;
    items: readonly PseudonymizedItem[];
  }>,
) {
  try {
    const mapping = validatePseudonymMappingV2(input.mapping);
    const entries = new Map<string, PseudonymMappingEntryV2[]>();
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
          (left, right) =>
            right.transformedByteStart - left.transformedByteStart,
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

function alias(key: Buffer, entityType: PseudonymEntityTypeV2, value: Buffer) {
  const digest = createHmac("sha256", key)
    .update("ai-workspace/pseudonym/v2", "utf8")
    .update(Buffer.from([0]))
    .update(entityType, "utf8")
    .update(Buffer.from([0]))
    .update(value)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return `[[AW_${entityType}_${digest}]]`;
}
function validateKey(value: Uint8Array) {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32)
    throw invalid();
  return Buffer.from(value);
}
function rejectOverlaps(selections: readonly ReviewedSpanV2[]) {
  for (let index = 1; index < selections.length; index += 1) {
    const previous = selections[index - 1]!;
    const current = selections[index]!;
    if (
      previous.itemId === current.itemId &&
      current.byteStart < previous.byteEnd
    )
      throw invalid();
  }
}
function rejectEntryConflicts(entries: readonly PseudonymMappingEntryV2[]) {
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
}
function pseudonymMatches(value: string, entityType: PseudonymEntityTypeV2) {
  return new RegExp(`^\\[\\[AW_${entityType}_[A-F0-9]{16}\\]\\]$`, "u").test(
    value,
  );
}
function utf8Boundary(value: Buffer, offset: number) {
  return (
    offset === 0 || offset === value.length || (value[offset]! & 0xc0) !== 0x80
  );
}
function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function compareSpan(left: ReviewedSpanV2, right: ReviewedSpanV2) {
  return (
    compare(left.itemId, right.itemId) ||
    left.byteStart - right.byteStart ||
    left.byteEnd - right.byteEnd ||
    compare(left.entityType, right.entityType)
  );
}
function compareEntry(
  left: PseudonymMappingEntryV2,
  right: PseudonymMappingEntryV2,
) {
  return (
    compare(left.itemId, right.itemId) ||
    left.transformedByteStart - right.transformedByteStart
  );
}
function compare(left: string, right: string) {
  return left.localeCompare(right, "en");
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
) {
  const actual = Object.keys(value).sort(compare);
  const sorted = [...expected].sort(compare);
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}
function invalid(cause?: unknown) {
  return new PseudonymizationError(cause === undefined ? undefined : { cause });
}
