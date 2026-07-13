import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export const METADATA_ENVELOPE_REPORT_SCHEMA_VERSION = 1;
export type MetadataEnvelopeAlternative =
  "EMBEDDED" | "SOURCE_TABLE" | "METADATA_TABLE";
export type MetadataEnvelopeItemKind =
  "SOURCE_TABLE" | "METADATA_TABLE" | "SECTION";
export type MetadataEnvelopePacketItem = Readonly<{
  id: string;
  kind: MetadataEnvelopeItemKind;
  content: string;
}>;
export type MetadataEnvelopePacket = Readonly<{
  schemaVersion: 1;
  alternative: MetadataEnvelopeAlternative;
  projectId: string;
  workItemId: string;
  handoffId: string;
  items: readonly MetadataEnvelopePacketItem[];
  effect: "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT";
}>;
export type MetadataEnvelopeRepresentation = Readonly<{
  alternative: MetadataEnvelopeAlternative;
  packet: MetadataEnvelopePacket;
  exactBytes: number;
  byteCategories: Readonly<{
    sourceTable: number;
    metadataTable: number;
    sections: number;
    total: number;
  }>;
  tableCounts: Readonly<{ sources: number; metadata: number }>;
}>;
export type MetadataEnvelopeCorpusCase = Readonly<{
  label: string;
  handoff: Handoff;
  budgets: readonly Readonly<{ label: string; exactBytes: number }>[];
}>;
export type MetadataEnvelopeProfileMeasurement = Readonly<{
  label: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  alternatives: Readonly<
    Record<
      MetadataEnvelopeAlternative,
      Readonly<{
        exactBytes: number;
        byteDifferenceFromEmbedded: number;
        reductionPercentFromEmbedded: number;
        byteCategories: MetadataEnvelopeRepresentation["byteCategories"];
        tableCounts: MetadataEnvelopeRepresentation["tableCounts"];
      }>
    >
  >;
  budgets: readonly Readonly<{
    label: string;
    exactBytes: number;
    fits: Readonly<Record<MetadataEnvelopeAlternative, boolean>>;
    byteDifference: Readonly<Record<MetadataEnvelopeAlternative, number>>;
  }>[];
}>;
export type MetadataEnvelopeCorpusReport = Readonly<{
  schemaVersion: 1;
  profileCount: number;
  budgetObservationCount: number;
  profiles: readonly MetadataEnvelopeProfileMeasurement[];
  fitCounts: Readonly<Record<MetadataEnvelopeAlternative, number>>;
  decisionMethod: "EXACT_UTF8_CONTEXT_CONTENT_BYTES";
  effect: "MEASUREMENT_ONLY_NO_CONTEXT_BUILDER_CHANGE";
}>;

type Source = SectionMetadata["sources"][number];
type LogicalSections = Handoff["sections"];
type SourceTableEntry = Readonly<{ id: string; source: Source }>;
type InlineMetadata = Omit<SectionMetadata, "sources"> & {
  sourceIds: readonly string[];
};
type MetadataTableEntry = Readonly<{
  id: string;
  metadata: InlineMetadata;
}>;

const ALTERNATIVES = ["EMBEDDED", "SOURCE_TABLE", "METADATA_TABLE"] as const;
const MAX_ID = 256;
const MAX_CASES = 20;
const MAX_BUDGETS = 10;
const MAX_BUDGET_BYTES = 1_000_000;
const MAX_ITEM_BYTES = 1_000_000;
const MAX_ITEMS = 10;
const MAX_SOURCES = 100;
const MAX_METADATA = 100;
const MAX_REFERENCES = 100;
const MAX_SOURCE_TEXT = 4_096;
const encoder = new TextEncoder();

export class MetadataEnvelopeError extends Error {
  public constructor() {
    super(
      "The experimental metadata envelope is malformed, unsupported, oversized, noncanonical, or cross-scoped.",
    );
    this.name = "MetadataEnvelopeError";
  }
}

export function projectMetadataEnvelope(
  handoff: Handoff,
): Readonly<
  Record<MetadataEnvelopeAlternative, MetadataEnvelopeRepresentation>
> {
  validateScope(handoff.projectId, handoff.workItemId, handoff.id);
  const sections = validateAndCanonicalizeSections(handoff.sections);
  const sourceTable = buildSourceTable(sections);
  const sourceIds = new Map(
    sourceTable.map((entry) => [sourceKey(entry.source), entry.id]),
  );
  const metadataTable = buildMetadataTable(sections, sourceIds);
  const metadataIds = new Map(
    metadataTable.map((entry) => [
      metadataKey(expandInlineMetadata(entry.metadata, sourceTable)),
      entry.id,
    ]),
  );
  return Object.freeze({
    EMBEDDED: buildRepresentation(
      handoff,
      "EMBEDDED",
      sections,
      sourceTable,
      metadataTable,
      sourceIds,
      metadataIds,
    ),
    SOURCE_TABLE: buildRepresentation(
      handoff,
      "SOURCE_TABLE",
      sections,
      sourceTable,
      metadataTable,
      sourceIds,
      metadataIds,
    ),
    METADATA_TABLE: buildRepresentation(
      handoff,
      "METADATA_TABLE",
      sections,
      sourceTable,
      metadataTable,
      sourceIds,
      metadataIds,
    ),
  });
}

export function expandMetadataEnvelope(
  packet: MetadataEnvelopePacket,
): LogicalSections {
  try {
    return decodePacket(packet);
  } catch (error) {
    if (error instanceof MetadataEnvelopeError) throw error;
    throw corrupt();
  }
}

export function measureMetadataEnvelopeCorpus(
  input: readonly MetadataEnvelopeCorpusCase[],
): MetadataEnvelopeCorpusReport {
  if (input.length < 1 || input.length > MAX_CASES) throw corrupt();
  const labels = new Set<string>();
  const handoffIds = new Set<string>();
  const profiles = input
    .map((value) => measureProfile(value, labels, handoffIds))
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
  const fitCounts = { EMBEDDED: 0, SOURCE_TABLE: 0, METADATA_TABLE: 0 };
  for (const profile of profiles)
    for (const budget of profile.budgets)
      for (const alternative of ALTERNATIVES)
        if (budget.fits[alternative]) fitCounts[alternative] += 1;
  return Object.freeze({
    schemaVersion: METADATA_ENVELOPE_REPORT_SCHEMA_VERSION,
    profileCount: profiles.length,
    budgetObservationCount: profiles.reduce(
      (total, profile) => total + profile.budgets.length,
      0,
    ),
    profiles: Object.freeze(profiles),
    fitCounts: Object.freeze(fitCounts),
    decisionMethod: "EXACT_UTF8_CONTEXT_CONTENT_BYTES",
    effect: "MEASUREMENT_ONLY_NO_CONTEXT_BUILDER_CHANGE",
  });
}

function buildRepresentation(
  handoff: Handoff,
  alternative: MetadataEnvelopeAlternative,
  sections: LogicalSections,
  sourceTable: readonly SourceTableEntry[],
  metadataTable: readonly MetadataTableEntry[],
  sourceIds: ReadonlyMap<string, string>,
  metadataIds: ReadonlyMap<string, string>,
): MetadataEnvelopeRepresentation {
  const items: MetadataEnvelopePacketItem[] = [];
  let sourceTableBytes = 0;
  let metadataTableBytes = 0;
  if (alternative !== "EMBEDDED") {
    const content = encode({
      projectId: handoff.projectId,
      workItemId: handoff.workItemId,
      handoffId: handoff.id,
      entries: sourceTable,
    });
    sourceTableBytes = bytes(content);
    items.push(item("packet:source-table", "SOURCE_TABLE", content));
  }
  if (alternative === "METADATA_TABLE") {
    const content = encode({
      projectId: handoff.projectId,
      workItemId: handoff.workItemId,
      handoffId: handoff.id,
      entries: metadataTable,
    });
    metadataTableBytes = bytes(content);
    items.push(item("packet:metadata-table", "METADATA_TABLE", content));
  }
  let sectionBytes = 0;
  for (const sectionName of CONTINUITY_SECTION_ORDER) {
    const section = sections[sectionName];
    let value: unknown = section;
    if (alternative === "SOURCE_TABLE")
      value = {
        metadata: inlineMetadata(section.metadata, sourceIds),
        value: section.value,
      };
    if (alternative === "METADATA_TABLE") {
      const metadataId = metadataIds.get(metadataKey(section.metadata));
      if (metadataId === undefined) throw corrupt();
      value = { metadataId, value: section.value };
    }
    const content = encode(value);
    sectionBytes += bytes(content);
    items.push(item(`handoff:${sectionName}`, "SECTION", content));
  }
  const total = sourceTableBytes + metadataTableBytes + sectionBytes;
  const packet = Object.freeze({
    schemaVersion: 1 as const,
    alternative,
    projectId: handoff.projectId,
    workItemId: handoff.workItemId,
    handoffId: handoff.id,
    items: Object.freeze(items),
    effect: "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT" as const,
  });
  return Object.freeze({
    alternative,
    packet,
    exactBytes: total,
    byteCategories: Object.freeze({
      sourceTable: sourceTableBytes,
      metadataTable: metadataTableBytes,
      sections: sectionBytes,
      total,
    }),
    tableCounts: Object.freeze({
      sources: alternative === "EMBEDDED" ? 0 : sourceTable.length,
      metadata: alternative === "METADATA_TABLE" ? metadataTable.length : 0,
    }),
  });
}

function decodePacket(packet: MetadataEnvelopePacket): LogicalSections {
  if (
    !isRecord(packet) ||
    packet.schemaVersion !== 1 ||
    !ALTERNATIVES.includes(packet.alternative) ||
    packet.effect !== "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT" ||
    !Array.isArray(packet.items) ||
    packet.items.length < 8 ||
    packet.items.length > MAX_ITEMS
  )
    throw corrupt();
  validateScope(packet.projectId, packet.workItemId, packet.handoffId);
  const parsedItems = packet.items.map(parseItem);
  const expectedKinds = [
    ...(packet.alternative === "EMBEDDED" ? [] : ["SOURCE_TABLE" as const]),
    ...(packet.alternative === "METADATA_TABLE"
      ? ["METADATA_TABLE" as const]
      : []),
    ...CONTINUITY_SECTION_ORDER.map(() => "SECTION" as const),
  ];
  if (
    new Set(parsedItems.map((entry) => entry.id)).size !== parsedItems.length ||
    parsedItems.some((entry, index) => entry.kind !== expectedKinds[index])
  )
    throw corrupt();
  let cursor = 0;
  let sourceTable: readonly SourceTableEntry[] = [];
  let metadataTable: readonly MetadataTableEntry[] = [];
  if (packet.alternative !== "EMBEDDED") {
    const entry = parsedItems[cursor++]!;
    if (entry.id !== "packet:source-table") throw corrupt();
    sourceTable = parseSourceTable(
      entry.value,
      packet.projectId,
      packet.workItemId,
      packet.handoffId,
    );
  }
  if (packet.alternative === "METADATA_TABLE") {
    const entry = parsedItems[cursor++]!;
    if (entry.id !== "packet:metadata-table") throw corrupt();
    metadataTable = parseMetadataTable(
      entry.value,
      packet.projectId,
      packet.workItemId,
      packet.handoffId,
      sourceTable,
    );
  }
  const usedSources = new Set<string>();
  const usedMetadata = new Set<string>();
  const sections = Object.fromEntries(
    CONTINUITY_SECTION_ORDER.map((sectionName) => {
      const entry = parsedItems[cursor++]!;
      if (entry.id !== `handoff:${sectionName}` || !isRecord(entry.value))
        throw corrupt();
      let metadata: SectionMetadata;
      if (packet.alternative === "EMBEDDED")
        metadata = parseEmbeddedMetadata(entry.value.metadata);
      else if (packet.alternative === "SOURCE_TABLE")
        metadata = expandInlineMetadata(
          parseInlineMetadata(entry.value.metadata),
          sourceTable,
          usedSources,
        );
      else {
        if (typeof entry.value.metadataId !== "string") throw corrupt();
        const metadataId = entry.value.metadataId;
        const found = metadataTable.find(
          (candidate) => candidate.id === metadataId,
        );
        if (found === undefined) throw corrupt();
        usedMetadata.add(found.id);
        metadata = expandInlineMetadata(
          found.metadata,
          sourceTable,
          usedSources,
        );
      }
      if (!("value" in entry.value)) throw corrupt();
      return [
        sectionName,
        Object.freeze({ metadata, value: entry.value.value }),
      ];
    }),
  ) as unknown as LogicalSections;
  if (
    (packet.alternative !== "EMBEDDED" &&
      usedSources.size !== sourceTable.length) ||
    (packet.alternative === "METADATA_TABLE" &&
      usedMetadata.size !== metadataTable.length)
  )
    throw corrupt();
  return validateAndCanonicalizeSections(sections);
}

function measureProfile(
  value: MetadataEnvelopeCorpusCase,
  labels: Set<string>,
  handoffIds: Set<string>,
): MetadataEnvelopeProfileMeasurement {
  const label = boundedText(value.label, MAX_ID);
  if (labels.has(label) || handoffIds.has(value.handoff.id)) throw corrupt();
  labels.add(label);
  handoffIds.add(value.handoff.id);
  if (value.budgets.length < 1 || value.budgets.length > MAX_BUDGETS)
    throw corrupt();
  const representations = projectMetadataEnvelope(value.handoff);
  const embedded = representations.EMBEDDED.exactBytes;
  const alternatives = Object.fromEntries(
    ALTERNATIVES.map((alternative) => {
      const representation = representations[alternative];
      const difference = embedded - representation.exactBytes;
      return [
        alternative,
        Object.freeze({
          exactBytes: representation.exactBytes,
          byteDifferenceFromEmbedded: difference,
          reductionPercentFromEmbedded: Number(
            ((difference / embedded) * 100).toFixed(2),
          ),
          byteCategories: representation.byteCategories,
          tableCounts: representation.tableCounts,
        }),
      ];
    }),
  ) as MetadataEnvelopeProfileMeasurement["alternatives"];
  const budgetLabels = new Set<string>();
  const budgets = [...value.budgets]
    .map((budget) => {
      const budgetLabel = boundedText(budget.label, MAX_ID);
      if (
        budgetLabels.has(budgetLabel) ||
        !Number.isSafeInteger(budget.exactBytes) ||
        budget.exactBytes < 1 ||
        budget.exactBytes > MAX_BUDGET_BYTES
      )
        throw corrupt();
      budgetLabels.add(budgetLabel);
      return Object.freeze({
        label: budgetLabel,
        exactBytes: budget.exactBytes,
        fits: Object.freeze(
          Object.fromEntries(
            ALTERNATIVES.map((alternative) => [
              alternative,
              alternatives[alternative].exactBytes <= budget.exactBytes,
            ]),
          ) as Record<MetadataEnvelopeAlternative, boolean>,
        ),
        byteDifference: Object.freeze(
          Object.fromEntries(
            ALTERNATIVES.map((alternative) => [
              alternative,
              budget.exactBytes - alternatives[alternative].exactBytes,
            ]),
          ) as Record<MetadataEnvelopeAlternative, number>,
        ),
      });
    })
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
  return Object.freeze({
    label,
    projectId: value.handoff.projectId,
    workItemId: value.handoff.workItemId,
    handoffId: value.handoff.id,
    alternatives: Object.freeze(alternatives),
    budgets: Object.freeze(budgets),
  });
}

function buildSourceTable(
  sections: LogicalSections,
): readonly SourceTableEntry[] {
  const unique = new Map<string, Source>();
  for (const sectionName of CONTINUITY_SECTION_ORDER)
    for (const source of sections[sectionName].metadata.sources)
      unique.set(sourceKey(source), source);
  if (unique.size < 1 || unique.size > MAX_SOURCES) throw corrupt();
  return Object.freeze(
    [...unique.entries()]
      .map(([key, source]) =>
        Object.freeze({ id: digestId("source", key), source }),
      )
      .sort((left, right) => left.id.localeCompare(right.id, "en")),
  );
}

function buildMetadataTable(
  sections: LogicalSections,
  sourceIds: ReadonlyMap<string, string>,
): readonly MetadataTableEntry[] {
  const unique = new Map<string, SectionMetadata>();
  for (const name of CONTINUITY_SECTION_ORDER) {
    const metadata = sections[name].metadata;
    unique.set(metadataKey(metadata), metadata);
  }
  if (unique.size < 1 || unique.size > MAX_METADATA) throw corrupt();
  return Object.freeze(
    [...unique.entries()]
      .map(([key, metadata]) =>
        Object.freeze({
          id: digestId("metadata", key),
          metadata: inlineMetadata(metadata, sourceIds),
        }),
      )
      .sort((left, right) => left.id.localeCompare(right.id, "en")),
  );
}

function parseSourceTable(
  value: unknown,
  projectId: string,
  workItemId: string,
  handoffId: string,
): readonly SourceTableEntry[] {
  const envelope = tableEnvelope(value, projectId, workItemId, handoffId);
  if (envelope.entries.length < 1 || envelope.entries.length > MAX_SOURCES)
    throw corrupt();
  const result = envelope.entries.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") throw corrupt();
    const source = parseSource(entry.source);
    if (entry.id !== digestId("source", sourceKey(source))) throw corrupt();
    return Object.freeze({ id: entry.id, source });
  });
  validateCanonicalIds(result.map((entry) => entry.id));
  return Object.freeze(result);
}

function parseMetadataTable(
  value: unknown,
  projectId: string,
  workItemId: string,
  handoffId: string,
  sourceTable: readonly SourceTableEntry[],
): readonly MetadataTableEntry[] {
  const envelope = tableEnvelope(value, projectId, workItemId, handoffId);
  if (envelope.entries.length < 1 || envelope.entries.length > MAX_METADATA)
    throw corrupt();
  const result = envelope.entries.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string") throw corrupt();
    const metadata = parseInlineMetadata(entry.metadata);
    const logical = expandInlineMetadata(metadata, sourceTable);
    if (entry.id !== digestId("metadata", metadataKey(logical)))
      throw corrupt();
    return Object.freeze({ id: entry.id, metadata });
  });
  validateCanonicalIds(result.map((entry) => entry.id));
  return Object.freeze(result);
}

function tableEnvelope(
  value: unknown,
  projectId: string,
  workItemId: string,
  handoffId: string,
) {
  if (
    !isRecord(value) ||
    value.projectId !== projectId ||
    value.workItemId !== workItemId ||
    value.handoffId !== handoffId ||
    !Array.isArray(value.entries)
  )
    throw corrupt();
  return { entries: value.entries };
}

function validateAndCanonicalizeSections(
  sections: LogicalSections,
): LogicalSections {
  if (!isRecord(sections)) throw corrupt();
  const result = Object.fromEntries(
    CONTINUITY_SECTION_ORDER.map((name) => {
      const section = sections[name];
      if (!isRecord(section) || !("value" in section)) throw corrupt();
      const metadata = parseEmbeddedMetadata(section.metadata);
      const serialized = encode(section.value);
      if (bytes(serialized) > MAX_ITEM_BYTES) throw corrupt();
      return [name, Object.freeze({ metadata, value: section.value })];
    }),
  ) as unknown as LogicalSections;
  return Object.freeze(result);
}

function parseEmbeddedMetadata(value: unknown): SectionMetadata {
  if (!isRecord(value) || !Array.isArray(value.sources)) throw corrupt();
  const sources = value.sources.map(parseSource).sort(compareSources);
  validateUniqueSources(sources);
  return metadataScalars(value, Object.freeze(sources));
}

function parseInlineMetadata(value: unknown): InlineMetadata {
  if (!isRecord(value) || !Array.isArray(value.sourceIds)) throw corrupt();
  if (
    value.sourceIds.length < 1 ||
    value.sourceIds.length > MAX_REFERENCES ||
    value.sourceIds.some((id) => typeof id !== "string")
  )
    throw corrupt();
  validateCanonicalIds(value.sourceIds as string[]);
  const metadata = metadataScalars(value, Object.freeze([]));
  return Object.freeze({
    origin: metadata.origin,
    trust: metadata.trust,
    curation: metadata.curation,
    verification: metadata.verification,
    observation: metadata.observation,
    sourceIds: Object.freeze([...(value.sourceIds as string[])]),
  });
}

function metadataScalars(
  value: Record<string, unknown>,
  sources: readonly Source[],
): SectionMetadata {
  if (
    ![
      "WORK_ITEM",
      "ACTIVE_MEMORY",
      "REPOSITORY_OBSERVATION",
      "USER_INPUT",
      "CANONICAL_EVENT",
    ].includes(String(value.origin)) ||
    !["UNTRUSTED", "USER_CURATED", "OBSERVED"].includes(String(value.trust)) ||
    !["NONE", "USER_CURATED"].includes(String(value.curation)) ||
    !["UNVERIFIED", "VERIFIED", "NOT_APPLICABLE"].includes(
      String(value.verification),
    ) ||
    !["IMPORTED", "USER_AUTHORED", "OBSERVED", "DERIVED"].includes(
      String(value.observation),
    )
  )
    throw corrupt();
  return Object.freeze({
    origin: value.origin as SectionMetadata["origin"],
    trust: value.trust as SectionMetadata["trust"],
    curation: value.curation as SectionMetadata["curation"],
    verification: value.verification as SectionMetadata["verification"],
    observation: value.observation as SectionMetadata["observation"],
    sources,
  });
}

function parseSource(value: unknown): Source {
  if (
    !isRecord(value) ||
    !sourceText(value.eventId) ||
    !sourceText(value.sessionId) ||
    !sourceText(value.eventType) ||
    !sourceText(value.trust) ||
    !sourceText(value.sourceArtifactId) ||
    !Number.isSafeInteger(value.sourcePosition) ||
    Number(value.sourcePosition) < 0 ||
    !sourceText(value.sourceRecordHash)
  )
    throw corrupt();
  return Object.freeze({
    eventId: value.eventId,
    sessionId: value.sessionId,
    eventType: value.eventType,
    trust: value.trust,
    sourceArtifactId: value.sourceArtifactId,
    sourcePosition: value.sourcePosition as number,
    sourceRecordHash: value.sourceRecordHash,
  });
}

function inlineMetadata(
  metadata: SectionMetadata,
  sourceIds: ReadonlyMap<string, string>,
): InlineMetadata {
  const ids = [...metadata.sources]
    .sort(compareSources)
    .map((source) => sourceIds.get(sourceKey(source)));
  if (ids.some((id) => id === undefined)) throw corrupt();
  validateCanonicalIds(ids as string[]);
  return Object.freeze({
    origin: metadata.origin,
    trust: metadata.trust,
    curation: metadata.curation,
    verification: metadata.verification,
    observation: metadata.observation,
    sourceIds: Object.freeze(ids as string[]),
  });
}

function expandInlineMetadata(
  metadata: InlineMetadata,
  sourceTable: readonly SourceTableEntry[],
  used?: Set<string>,
): SectionMetadata {
  const table = new Map(sourceTable.map((entry) => [entry.id, entry.source]));
  const sources = metadata.sourceIds.map((id) => {
    const source = table.get(id);
    if (source === undefined) throw corrupt();
    used?.add(id);
    return source;
  });
  return Object.freeze({
    origin: metadata.origin,
    trust: metadata.trust,
    curation: metadata.curation,
    verification: metadata.verification,
    observation: metadata.observation,
    sources: Object.freeze(sources),
  });
}

function parseItem(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !boundedTextOrNull(value.id, MAX_ID) ||
    !["SOURCE_TABLE", "METADATA_TABLE", "SECTION"].includes(
      String(value.kind),
    ) ||
    typeof value.content !== "string" ||
    bytes(value.content) > MAX_ITEM_BYTES
  )
    throw corrupt();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.content) as unknown;
  } catch {
    throw corrupt();
  }
  return {
    id: value.id,
    kind: value.kind as MetadataEnvelopeItemKind,
    value: parsed,
  };
}

function item(
  id: string,
  kind: MetadataEnvelopeItemKind,
  content: string,
): MetadataEnvelopePacketItem {
  if (bytes(content) > MAX_ITEM_BYTES) throw corrupt();
  return Object.freeze({ id, kind, content });
}

function validateScope(
  projectId: string,
  workItemId: string,
  handoffId: string,
) {
  boundedText(projectId, MAX_ID);
  boundedText(workItemId, MAX_ID);
  boundedText(handoffId, MAX_ID);
}

function validateUniqueSources(sources: readonly Source[]) {
  if (sources.length < 1 || sources.length > MAX_REFERENCES) throw corrupt();
  const keys = sources.map(sourceKey);
  if (new Set(keys).size !== keys.length) throw corrupt();
}

function validateCanonicalIds(ids: readonly string[]) {
  if (
    ids.length < 1 ||
    new Set(ids).size !== ids.length ||
    [...ids]
      .sort((a, b) => a.localeCompare(b, "en"))
      .some((id, index) => id !== ids[index])
  )
    throw corrupt();
}

function metadataKey(metadata: SectionMetadata) {
  return encode({
    origin: metadata.origin,
    trust: metadata.trust,
    curation: metadata.curation,
    verification: metadata.verification,
    observation: metadata.observation,
    sources: [...metadata.sources].sort(compareSources),
  });
}

function sourceKey(source: Source) {
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

function compareSources(left: Source, right: Source) {
  return digestId("source", sourceKey(left)).localeCompare(
    digestId("source", sourceKey(right)),
    "en",
  );
}

function digestId(prefix: "source" | "metadata", value: string) {
  return `${prefix}:sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function encode(value: unknown) {
  try {
    const result = JSON.stringify(value);
    if (result === undefined) throw corrupt();
    return result;
  } catch (error) {
    if (error instanceof MetadataEnvelopeError) throw error;
    throw corrupt();
  }
}

function boundedText(value: unknown, max: number): string {
  if (!boundedTextOrNull(value, max)) throw corrupt();
  return value;
}

function boundedTextOrNull(value: unknown, max: number): value is string {
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

function sourceText(value: unknown): value is string {
  return boundedTextOrNull(value, MAX_SOURCE_TEXT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bytes(value: string) {
  return encoder.encode(value).byteLength;
}

function corrupt(): MetadataEnvelopeError {
  return new MetadataEnvelopeError();
}
