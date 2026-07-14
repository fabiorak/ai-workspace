import { createHash } from "node:crypto";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import type { EffectiveInstructions } from "@ai-workspace/instruction-manager";
import { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export const CONTEXT_PACK_SCHEMA_VERSION = 2;
export const CONTEXT_PACK_LEGACY_SCHEMA_VERSION = 1;
export type ContextCategory = "CONTINUITY" | "INSTRUCTIONS";
export type ContextItem = Readonly<{
  id: string;
  category: ContextCategory;
  sourceType: "HANDOFF_SECTION" | "INSTRUCTION_RULE";
  sourceId: string;
  trust: "MIXED" | "USER_CONFIGURED";
  content: string;
  exactBytes: number;
}>;
export type ContextOmission = Readonly<{
  id: string;
  category: ContextCategory;
  sourceId: string;
  exactBytes: number;
  reason: "BUDGET_EXCEEDED";
  byteMethod?: "MARGINAL_CONTENT_AND_NEW_SHARED_SOURCES";
}>;
type ContextPackBase = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  budgets: Readonly<Record<ContextCategory, number>>;
  usedBytes: Readonly<Record<ContextCategory, number>>;
  included: readonly ContextItem[];
  omitted: readonly ContextOmission[];
  measurement: Readonly<{
    exactIncludedBytes: number;
    estimatedTokens: number;
    estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4";
  }>;
  effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED";
}>;
export type ContextPackPreviewV1 = ContextPackBase &
  Readonly<{ schemaVersion: 1 }>;
type ContextSource = SectionMetadata["sources"][number];
export type ContextSourceTableEntry = Readonly<{
  id: string;
  source: ContextSource;
}>;
export type ContextSourceTable = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  entries: readonly ContextSourceTableEntry[];
  exactBytes: number;
}>;
export type ContextPackPreviewV2 = ContextPackBase &
  Readonly<{
    schemaVersion: 2;
    sourceTable: ContextSourceTable | null;
  }>;
export type ContextPackPreview = ContextPackPreviewV1 | ContextPackPreviewV2;
export type ExpandedContextPackPreview = ContextPackBase &
  Readonly<{
    schemaVersion: 1 | 2;
    sourceTableSummary: Readonly<{
      entryCount: number;
      exactBytes: number;
    }> | null;
  }>;
export type BuildContextPackInput = Readonly<{
  handoff: Handoff;
  instructions?: EffectiveInstructions;
  budgets: Readonly<Record<ContextCategory, number>>;
}>;

const MAX_BUDGET = 1_000_000;
const MAX_ID = 256;
const MAX_SOURCE_TEXT = 4_096;
const MAX_SOURCES = 100;
const MAX_REFERENCES = 100;
const MAX_ITEM_BYTES = 1_000_000;
const MAX_ITEMS = 1_000;
const ORIGINS = [
  "WORK_ITEM",
  "ACTIVE_MEMORY",
  "REPOSITORY_OBSERVATION",
  "USER_INPUT",
  "CANONICAL_EVENT",
] as const;
const TRUST = ["UNTRUSTED", "USER_CURATED", "OBSERVED"] as const;
const CURATION = ["NONE", "USER_CURATED"] as const;
const VERIFICATION = ["UNVERIFIED", "VERIFIED", "NOT_APPLICABLE"] as const;
const OBSERVATION = [
  "IMPORTED",
  "USER_AUTHORED",
  "OBSERVED",
  "DERIVED",
] as const;

export class ContextBuilderError extends Error {
  public constructor() {
    super(
      "The Context Pack is malformed, unsupported, oversized, noncanonical, or cross-scoped. Rebuild it from the explicit immutable handoff and retry.",
    );
    this.name = "ContextBuilderError";
  }
}

export function buildContextPack(
  input: BuildContextPackInput,
): ContextPackPreviewV2 {
  validateInput(input);
  try {
    const used = { CONTINUITY: 0, INSTRUCTIONS: 0 };
    const included: ContextItem[] = [];
    const omitted: ContextOmission[] = [];
    const selectedSources = new Map<string, ContextSource>();
    let table: ContextSourceTable | null = null;

    for (const sectionName of CONTINUITY_SECTION_ORDER) {
      const section = input.handoff.sections[sectionName];
      const metadata = normalizeMetadata(section.metadata);
      const sources = metadata.sources.map((source) => sourceEntry(source));
      const tentative = new Map(selectedSources);
      for (const entry of sources) tentative.set(entry.id, entry.source);
      const tentativeTable = sourceTable(input.handoff, tentative);
      const content = encode({
        metadata: {
          origin: metadata.origin,
          trust: metadata.trust,
          curation: metadata.curation,
          verification: metadata.verification,
          observation: metadata.observation,
          sourceIds: sources.map((entry) => entry.id).sort(compareText),
        },
        value: section.value,
      });
      const contentBytes = bytes(content);
      if (contentBytes > MAX_ITEM_BYTES) throw corrupt();
      const marginalTableBytes =
        (tentativeTable?.exactBytes ?? 0) - (table?.exactBytes ?? 0);
      const marginalBytes = contentBytes + marginalTableBytes;
      if (used.CONTINUITY + marginalBytes <= input.budgets.CONTINUITY) {
        for (const [id, source] of tentative) selectedSources.set(id, source);
        table = tentativeTable;
        used.CONTINUITY += marginalBytes;
        included.push(
          freezeItem({
            id: `handoff:${sectionName}`,
            category: "CONTINUITY",
            sourceType: "HANDOFF_SECTION",
            sourceId: input.handoff.id,
            trust: "MIXED",
            content,
            exactBytes: contentBytes,
          }),
        );
      } else
        omitted.push(
          Object.freeze({
            id: `handoff:${sectionName}`,
            category: "CONTINUITY" as const,
            sourceId: input.handoff.id,
            exactBytes: marginalBytes,
            reason: "BUDGET_EXCEEDED" as const,
            byteMethod: "MARGINAL_CONTENT_AND_NEW_SHARED_SOURCES" as const,
          }),
        );
    }
    addInstructionCandidates(input, used, included, omitted);
    return freezeV2(input, used, included, omitted, table);
  } catch (error) {
    if (error instanceof ContextBuilderError) throw error;
    throw corrupt();
  }
}

export function buildContextPackV1(
  input: BuildContextPackInput,
): ContextPackPreviewV1 {
  validateInput(input);
  try {
    const candidates: Omit<ContextItem, "exactBytes">[] =
      CONTINUITY_SECTION_ORDER.map((section) => ({
        id: `handoff:${section}`,
        category: "CONTINUITY",
        sourceType: "HANDOFF_SECTION",
        sourceId: input.handoff.id,
        trust: "MIXED",
        content: encode(input.handoff.sections[section]),
      }));
    for (const rule of input.instructions?.rules ?? [])
      candidates.push({
        id: `instruction:${rule.sourceId}:${rule.position}:${rule.ruleId}`,
        category: "INSTRUCTIONS",
        sourceType: "INSTRUCTION_RULE",
        sourceId: `${rule.sourceId}@sha256:${rule.sourceDigest}`,
        trust: "USER_CONFIGURED",
        content: encode(rule),
      });
    const used = { CONTINUITY: 0, INSTRUCTIONS: 0 };
    const included: ContextItem[] = [];
    const omitted: ContextOmission[] = [];
    const ids = new Set<string>();
    for (const candidate of candidates) {
      if (ids.has(candidate.id)) throw corrupt();
      ids.add(candidate.id);
      const exactBytes = bytes(candidate.content);
      if (exactBytes > MAX_ITEM_BYTES) throw corrupt();
      if (
        used[candidate.category] + exactBytes <=
        input.budgets[candidate.category]
      ) {
        used[candidate.category] += exactBytes;
        included.push(freezeItem({ ...candidate, exactBytes }));
      } else
        omitted.push(
          Object.freeze({
            id: candidate.id,
            category: candidate.category,
            sourceId: candidate.sourceId,
            exactBytes,
            reason: "BUDGET_EXCEEDED" as const,
          }),
        );
    }
    const exactIncludedBytes = used.CONTINUITY + used.INSTRUCTIONS;
    return Object.freeze({
      schemaVersion: 1 as const,
      projectId: input.handoff.projectId,
      workItemId: input.handoff.workItemId,
      handoffId: input.handoff.id,
      budgets: Object.freeze({ ...input.budgets }),
      usedBytes: Object.freeze(used),
      included: Object.freeze(included),
      omitted: Object.freeze(omitted),
      measurement: measurement(exactIncludedBytes),
      effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED" as const,
    });
  } catch (error) {
    if (error instanceof ContextBuilderError) throw error;
    throw corrupt();
  }
}

export function expandContextPack(
  packet: ContextPackPreview,
): ExpandedContextPackPreview {
  try {
    validatePacketBase(packet);
    if (packet.schemaVersion === 1) {
      validateV1Accounting(packet);
      return Object.freeze({
        ...packet,
        sourceTableSummary: null,
      });
    }
    if (packet.schemaVersion !== 2) throw corrupt();
    const table = validateSourceTable(packet);
    const usedSourceIds = new Set<string>();
    const included = packet.included.map((item) => {
      validateItem(item);
      if (item.category !== "CONTINUITY") return item;
      const parsed = parseRecord(item.content);
      const metadata = parseInlineMetadata(parsed.metadata);
      const sources = metadata.sourceIds.map((id) => {
        if (table === null) throw corrupt();
        const source = table.get(id);
        if (source === undefined) throw corrupt();
        usedSourceIds.add(id);
        return source;
      });
      if (!("value" in parsed)) throw corrupt();
      return freezeItem({
        ...item,
        content: encode({
          metadata: {
            origin: metadata.origin,
            trust: metadata.trust,
            curation: metadata.curation,
            verification: metadata.verification,
            observation: metadata.observation,
            sources,
          },
          value: parsed.value,
        }),
      });
    });
    if (table !== null && usedSourceIds.size !== table.size) throw corrupt();
    validateV2Accounting(packet);
    return Object.freeze({
      schemaVersion: 2 as const,
      projectId: packet.projectId,
      workItemId: packet.workItemId,
      handoffId: packet.handoffId,
      budgets: packet.budgets,
      usedBytes: packet.usedBytes,
      included: Object.freeze(included),
      omitted: packet.omitted,
      measurement: packet.measurement,
      effect: packet.effect,
      sourceTableSummary:
        packet.sourceTable === null
          ? null
          : Object.freeze({
              entryCount: packet.sourceTable.entries.length,
              exactBytes: packet.sourceTable.exactBytes,
            }),
    });
  } catch (error) {
    if (error instanceof ContextBuilderError) throw error;
    throw corrupt();
  }
}

function validateInput(input: BuildContextPackInput) {
  validateBudget(input.budgets.CONTINUITY);
  validateBudget(input.budgets.INSTRUCTIONS);
  boundedText(input.handoff.projectId, MAX_ID);
  boundedText(input.handoff.workItemId, MAX_ID);
  boundedText(input.handoff.id, MAX_ID);
  if (
    input.instructions !== undefined &&
    input.instructions.projectId !== input.handoff.projectId
  )
    throw corrupt();
}

function addInstructionCandidates(
  input: BuildContextPackInput,
  used: Record<ContextCategory, number>,
  included: ContextItem[],
  omitted: ContextOmission[],
) {
  const ids = new Set(included.map((item) => item.id));
  for (const rule of input.instructions?.rules ?? []) {
    const candidate = {
      id: `instruction:${rule.sourceId}:${rule.position}:${rule.ruleId}`,
      category: "INSTRUCTIONS" as const,
      sourceType: "INSTRUCTION_RULE" as const,
      sourceId: `${rule.sourceId}@sha256:${rule.sourceDigest}`,
      trust: "USER_CONFIGURED" as const,
      content: encode(rule),
    };
    if (ids.has(candidate.id)) throw corrupt();
    ids.add(candidate.id);
    const exactBytes = bytes(candidate.content);
    if (exactBytes > MAX_ITEM_BYTES) throw corrupt();
    if (used.INSTRUCTIONS + exactBytes <= input.budgets.INSTRUCTIONS) {
      used.INSTRUCTIONS += exactBytes;
      included.push(freezeItem({ ...candidate, exactBytes }));
    } else
      omitted.push(
        Object.freeze({
          id: candidate.id,
          category: candidate.category,
          sourceId: candidate.sourceId,
          exactBytes,
          reason: "BUDGET_EXCEEDED" as const,
        }),
      );
  }
}

function freezeV2(
  input: BuildContextPackInput,
  used: Record<ContextCategory, number>,
  included: ContextItem[],
  omitted: ContextOmission[],
  table: ContextSourceTable | null,
): ContextPackPreviewV2 {
  const exactIncludedBytes = used.CONTINUITY + used.INSTRUCTIONS;
  return Object.freeze({
    schemaVersion: 2 as const,
    projectId: input.handoff.projectId,
    workItemId: input.handoff.workItemId,
    handoffId: input.handoff.id,
    budgets: Object.freeze({ ...input.budgets }),
    usedBytes: Object.freeze(used),
    included: Object.freeze(included),
    omitted: Object.freeze(omitted),
    sourceTable: table,
    measurement: measurement(exactIncludedBytes),
    effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED" as const,
  });
}

function sourceTable(
  handoff: Handoff,
  sources: ReadonlyMap<string, ContextSource>,
): ContextSourceTable | null {
  if (sources.size === 0) return null;
  if (sources.size > MAX_SOURCES) throw corrupt();
  const entries = [...sources.entries()]
    .map(([id, source]) => Object.freeze({ id, source }))
    .sort((left, right) => compareText(left.id, right.id));
  const value = {
    projectId: handoff.projectId,
    workItemId: handoff.workItemId,
    handoffId: handoff.id,
    entries,
  };
  const exactBytes = bytes(encode(value));
  if (exactBytes > MAX_ITEM_BYTES) throw corrupt();
  return Object.freeze({
    ...value,
    entries: Object.freeze(entries),
    exactBytes,
  });
}

function sourceEntry(sourceValue: ContextSource): ContextSourceTableEntry {
  const source = normalizeSource(sourceValue);
  return Object.freeze({ id: sourceId(source), source });
}

function normalizeMetadata(value: SectionMetadata): SectionMetadata {
  if (
    !ORIGINS.includes(value.origin) ||
    !TRUST.includes(value.trust) ||
    !CURATION.includes(value.curation) ||
    !VERIFICATION.includes(value.verification) ||
    !OBSERVATION.includes(value.observation) ||
    !Array.isArray(value.sources) ||
    value.sources.length > MAX_REFERENCES
  )
    throw corrupt();
  const sources = value.sources.map(normalizeSource).sort(compareSources);
  if (new Set(sources.map(sourceKey)).size !== sources.length) throw corrupt();
  return Object.freeze({ ...value, sources: Object.freeze(sources) });
}

function normalizeSource(value: ContextSource): ContextSource {
  if (
    !isRecord(value) ||
    !boundedTextOrFalse(value.eventId, MAX_SOURCE_TEXT) ||
    !boundedTextOrFalse(value.sessionId, MAX_SOURCE_TEXT) ||
    !boundedTextOrFalse(value.eventType, MAX_SOURCE_TEXT) ||
    !boundedTextOrFalse(value.trust, MAX_SOURCE_TEXT) ||
    !boundedTextOrFalse(value.sourceArtifactId, MAX_SOURCE_TEXT) ||
    !Number.isSafeInteger(value.sourcePosition) ||
    Number(value.sourcePosition) < 0 ||
    !boundedTextOrFalse(value.sourceRecordHash, MAX_SOURCE_TEXT)
  )
    throw corrupt();
  return Object.freeze({
    eventId: value.eventId,
    sessionId: value.sessionId,
    eventType: value.eventType,
    trust: value.trust,
    sourceArtifactId: value.sourceArtifactId,
    sourcePosition: value.sourcePosition,
    sourceRecordHash: value.sourceRecordHash,
  });
}

function validatePacketBase(packet: ContextPackPreview) {
  if (
    !isRecord(packet) ||
    ![1, 2].includes(Number(packet.schemaVersion)) ||
    packet.effect !== "READ_ONLY_NOT_PERSISTED_OR_EXECUTED" ||
    !boundedTextOrFalse(packet.projectId, MAX_ID) ||
    !boundedTextOrFalse(packet.workItemId, MAX_ID) ||
    !boundedTextOrFalse(packet.handoffId, MAX_ID) ||
    !isRecord(packet.budgets) ||
    !isRecord(packet.usedBytes) ||
    !Array.isArray(packet.included) ||
    !Array.isArray(packet.omitted) ||
    packet.included.length + packet.omitted.length < 1 ||
    packet.included.length + packet.omitted.length > MAX_ITEMS ||
    !isRecord(packet.measurement)
  )
    throw corrupt();
  validateBudget(packet.budgets.CONTINUITY);
  validateBudget(packet.budgets.INSTRUCTIONS);
  const ids = new Set<string>();
  for (const item of packet.included) {
    validateItem(item);
    if (ids.has(item.id)) throw corrupt();
    ids.add(item.id);
  }
  for (const item of packet.omitted) {
    if (
      !isRecord(item) ||
      !boundedTextOrFalse(item.id, MAX_ID) ||
      !["CONTINUITY", "INSTRUCTIONS"].includes(String(item.category)) ||
      !boundedTextOrFalse(item.sourceId, MAX_ID) ||
      !positive(item.exactBytes) ||
      item.exactBytes > MAX_ITEM_BYTES ||
      item.reason !== "BUDGET_EXCEEDED" ||
      ids.has(item.id)
    )
      throw corrupt();
    ids.add(item.id);
  }
}

function validateSourceTable(packet: ContextPackPreviewV2) {
  const value = packet.sourceTable;
  if (value === null) return null;
  if (
    !isRecord(value) ||
    value.projectId !== packet.projectId ||
    value.workItemId !== packet.workItemId ||
    value.handoffId !== packet.handoffId ||
    !Array.isArray(value.entries) ||
    value.entries.length < 1 ||
    value.entries.length > MAX_SOURCES ||
    !positive(value.exactBytes) ||
    value.exactBytes > MAX_ITEM_BYTES
  )
    throw corrupt();
  const entries = value.entries.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") throw corrupt();
    const source = normalizeSource(entry.source as ContextSource);
    if (entry.id !== sourceId(source)) throw corrupt();
    return { id: entry.id, source };
  });
  const ids = entries.map((entry) => entry.id);
  if (
    new Set(ids).size !== ids.length ||
    [...ids].sort(compareText).some((id, index) => id !== ids[index])
  )
    throw corrupt();
  const encoded = encode({
    projectId: value.projectId,
    workItemId: value.workItemId,
    handoffId: value.handoffId,
    entries: value.entries,
  });
  if (bytes(encoded) !== value.exactBytes) throw corrupt();
  return new Map(entries.map((entry) => [entry.id, entry.source]));
}

function parseInlineMetadata(value: unknown) {
  if (
    !isRecord(value) ||
    !ORIGINS.includes(value.origin as (typeof ORIGINS)[number]) ||
    !TRUST.includes(value.trust as (typeof TRUST)[number]) ||
    !CURATION.includes(value.curation as (typeof CURATION)[number]) ||
    !VERIFICATION.includes(
      value.verification as (typeof VERIFICATION)[number],
    ) ||
    !OBSERVATION.includes(value.observation as (typeof OBSERVATION)[number]) ||
    !Array.isArray(value.sourceIds) ||
    value.sourceIds.length > MAX_REFERENCES ||
    value.sourceIds.some((id) => typeof id !== "string")
  )
    throw corrupt();
  const ids = value.sourceIds as string[];
  if (
    new Set(ids).size !== ids.length ||
    [...ids].sort(compareText).some((id, index) => id !== ids[index])
  )
    throw corrupt();
  return {
    origin: value.origin,
    trust: value.trust,
    curation: value.curation,
    verification: value.verification,
    observation: value.observation,
    sourceIds: ids,
  } as const;
}

function validateV1Accounting(packet: ContextPackPreviewV1) {
  const continuity = sumItemBytes(packet.included, "CONTINUITY");
  const instructions = sumItemBytes(packet.included, "INSTRUCTIONS");
  validateAccounting(packet, continuity, instructions);
}

function validateV2Accounting(packet: ContextPackPreviewV2) {
  const continuity =
    sumItemBytes(packet.included, "CONTINUITY") +
    (packet.sourceTable?.exactBytes ?? 0);
  const instructions = sumItemBytes(packet.included, "INSTRUCTIONS");
  validateAccounting(packet, continuity, instructions);
}

function validateAccounting(
  packet: ContextPackPreview,
  continuity: number,
  instructions: number,
) {
  const total = continuity + instructions;
  if (
    packet.usedBytes.CONTINUITY !== continuity ||
    packet.usedBytes.INSTRUCTIONS !== instructions ||
    continuity > packet.budgets.CONTINUITY ||
    instructions > packet.budgets.INSTRUCTIONS ||
    packet.measurement.exactIncludedBytes !== total ||
    packet.measurement.estimatedTokens !== Math.ceil(total / 4) ||
    packet.measurement.estimateMethod !==
      "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4"
  )
    throw corrupt();
}

function validateItem(item: ContextItem) {
  if (
    !isRecord(item) ||
    !boundedTextOrFalse(item.id, MAX_ID) ||
    !["CONTINUITY", "INSTRUCTIONS"].includes(String(item.category)) ||
    !["HANDOFF_SECTION", "INSTRUCTION_RULE"].includes(
      String(item.sourceType),
    ) ||
    !boundedTextOrFalse(item.sourceId, MAX_SOURCE_TEXT) ||
    !["MIXED", "USER_CONFIGURED"].includes(String(item.trust)) ||
    typeof item.content !== "string" ||
    !positive(item.exactBytes) ||
    item.exactBytes > MAX_ITEM_BYTES ||
    bytes(item.content) !== item.exactBytes
  )
    throw corrupt();
}

function freezeItem(value: ContextItem): ContextItem {
  if (bytes(value.content) > MAX_ITEM_BYTES) throw corrupt();
  return Object.freeze(value);
}

function measurement(exactIncludedBytes: number) {
  return Object.freeze({
    exactIncludedBytes,
    estimatedTokens: Math.ceil(exactIncludedBytes / 4),
    estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4" as const,
  });
}

function sourceId(source: ContextSource) {
  return `source:sha256:${createHash("sha256").update(sourceKey(source), "utf8").digest("hex")}`;
}

function sourceKey(source: ContextSource) {
  return encode([
    source.eventId,
    source.sessionId,
    source.eventType,
    source.trust,
    source.sourceArtifactId,
    source.sourcePosition,
    source.sourceRecordHash,
  ]);
}

function compareSources(left: ContextSource, right: ContextSource) {
  return compareText(sourceId(left), sourceId(right));
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en");
}

function parseRecord(value: string): Record<string, unknown> {
  if (bytes(value) > MAX_ITEM_BYTES) throw corrupt();
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) throw corrupt();
  return parsed;
}

function encode(value: unknown) {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw corrupt();
  return encoded;
}

function sumItemBytes(
  items: readonly ContextItem[],
  category: ContextCategory,
) {
  return items
    .filter((item) => item.category === category)
    .reduce((total, item) => total + item.exactBytes, 0);
}

function validateBudget(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BUDGET)
    throw corrupt();
}

function boundedText(value: unknown, max: number): string {
  if (!boundedTextOrFalse(value, max)) throw corrupt();
  return value;
}

function boundedTextOrFalse(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    ![...value].some((character) => {
      const code = character.codePointAt(0)!;
      return code <= 31 || code === 127;
    })
  );
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function corrupt(): ContextBuilderError {
  return new ContextBuilderError();
}

export * from "./measurement.ts";
export * from "./continuity-disclosure.ts";
export * from "./metadata-envelope.ts";
export * from "./context-selectors.ts";
export * from "./continuity-evidence.ts";
