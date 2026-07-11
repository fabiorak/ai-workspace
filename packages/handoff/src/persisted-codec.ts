import type { WorkItemSource } from "@ai-workspace/core";
import { HandoffError } from "./handoffs.ts";
import type { Handoff, SectionMetadata } from "./model.ts";

const SECTION_NAMES = [
  "objective",
  "repository",
  "selectedMemory",
  "knownFailures",
  "testState",
  "relevantFiles",
  "nextAction",
  "sourceReferences",
] as const;
const MAX_SOURCES = 100;
const MAX_REFERENCES = 100;
const MAX_SOURCE_STRING = 4_096;

type PersistedMetadataV2 = Omit<SectionMetadata, "sources"> & {
  sourceIds: readonly string[];
};

export function encodePersistedHandoff(handoff: Handoff): string {
  validateLogicalScope(handoff);
  const occurrences = SECTION_NAMES.flatMap((name) => [
    ...handoff.sections[name].metadata.sources,
    ...(name === "sourceReferences"
      ? handoff.sections.sourceReferences.value
      : []),
  ]);
  const unique = new Map(
    occurrences.map((source) => [sourceKey(source), source]),
  );
  if (unique.size > MAX_SOURCES) throw corrupt();
  const ordered = [...unique.entries()].sort(([a], [b]) => a.localeCompare(b));
  const ids = new Map(ordered.map(([key], index) => [key, sourceId(index)]));
  const sections = Object.fromEntries(
    SECTION_NAMES.map((name) => {
      const section = handoff.sections[name];
      const metadata: PersistedMetadataV2 = {
        origin: section.metadata.origin,
        trust: section.metadata.trust,
        curation: section.metadata.curation,
        verification: section.metadata.verification,
        observation: section.metadata.observation,
        sourceIds: references(section.metadata.sources, ids),
      };
      return [
        name,
        {
          metadata,
          value:
            name === "sourceReferences"
              ? references(handoff.sections.sourceReferences.value, ids)
              : section.value,
        },
      ];
    }),
  );
  return `${JSON.stringify(
    {
      schemaVersion: 2,
      id: handoff.id,
      projectId: handoff.projectId,
      workItemId: handoff.workItemId,
      predecessorId: handoff.predecessorId,
      createdBy: handoff.createdBy,
      createdAt: handoff.createdAt,
      sourceTable: ordered.map(([, source], index) => ({
        id: sourceId(index),
        source,
      })),
      sections,
    },
    null,
    2,
  )}\n`;
}

export function decodePersistedHandoff(value: unknown): Handoff {
  if (!isRecord(value)) throw corrupt();
  if (value.schemaVersion === 1) return decodeV1(value);
  if (value.schemaVersion === 2) return decodeV2(value);
  throw corrupt();
}

function decodeV1(value: Record<string, unknown>): Handoff {
  validateEnvelope(value);
  if (!isRecord(value.sections)) throw corrupt();
  for (const name of SECTION_NAMES) {
    const section = value.sections[name];
    if (!isRecord(section) || !("value" in section)) throw corrupt();
    validateMetadata(section.metadata, "sources");
    if (name === "sourceReferences") {
      if (
        !Array.isArray(section.value) ||
        section.value.length > MAX_REFERENCES
      )
        throw corrupt();
      section.value.forEach(parseSource);
    }
  }
  const handoff = value as unknown as Handoff;
  validateLogicalScope(handoff);
  return handoff;
}

function decodeV2(value: Record<string, unknown>): Handoff {
  validateEnvelope(value);
  if (
    !Array.isArray(value.sourceTable) ||
    value.sourceTable.length > MAX_SOURCES
  )
    throw corrupt();
  const table = new Map<string, WorkItemSource>();
  const sourceValues = new Set<string>();
  value.sourceTable.forEach((entry, index) => {
    if (!isRecord(entry) || entry.id !== sourceId(index)) throw corrupt();
    const source = parseSource(entry.source);
    const key = sourceKey(source);
    if (table.has(entry.id) || sourceValues.has(key)) throw corrupt();
    table.set(entry.id, source);
    sourceValues.add(key);
  });
  if (!isRecord(value.sections)) throw corrupt();
  const persistedSections = value.sections;
  const used = new Set<string>();
  const sections = Object.fromEntries(
    SECTION_NAMES.map((name) => {
      const section = persistedSections[name];
      if (!isRecord(section) || !("value" in section)) throw corrupt();
      const metadata = validateMetadata(section.metadata, "sourceIds");
      const sources = expand(metadata.sourceIds, table, used);
      const logicalMetadata = { ...metadata, sources };
      delete (logicalMetadata as Partial<typeof metadata>).sourceIds;
      return [
        name,
        {
          metadata: logicalMetadata,
          value:
            name === "sourceReferences"
              ? expand(section.value, table, used)
              : section.value,
        },
      ];
    }),
  );
  if (used.size !== table.size) throw corrupt();
  const handoff = {
    schemaVersion: 1,
    id: value.id,
    projectId: value.projectId,
    workItemId: value.workItemId,
    predecessorId: value.predecessorId,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
    sections,
  } as unknown as Handoff;
  validateLogicalScope(handoff);
  return handoff;
}

function validateEnvelope(value: Record<string, unknown>) {
  if (
    !boundedString(value.id) ||
    !boundedString(value.projectId) ||
    !boundedString(value.workItemId) ||
    !(value.predecessorId === null || boundedString(value.predecessorId)) ||
    value.createdBy !== "LOCAL_USER" ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    throw corrupt();
}

function validateMetadata(
  value: unknown,
  sourceField: "sources" | "sourceIds",
) {
  if (
    !isRecord(value) ||
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
    ) ||
    !Array.isArray(value[sourceField])
  )
    throw corrupt();
  if (value[sourceField].length > MAX_REFERENCES) throw corrupt();
  if (sourceField === "sources")
    (value.sources as unknown[]).forEach(parseSource);
  return value as unknown as PersistedMetadataV2;
}

function parseSource(value: unknown): WorkItemSource {
  if (
    !isRecord(value) ||
    !boundedString(value.eventId, MAX_SOURCE_STRING) ||
    !boundedString(value.sessionId, MAX_SOURCE_STRING) ||
    !boundedString(value.eventType, MAX_SOURCE_STRING) ||
    !boundedString(value.trust, MAX_SOURCE_STRING) ||
    !boundedString(value.sourceArtifactId, MAX_SOURCE_STRING) ||
    !Number.isSafeInteger(value.sourcePosition) ||
    Number(value.sourcePosition) < 0 ||
    !boundedString(value.sourceRecordHash, MAX_SOURCE_STRING)
  )
    throw corrupt();
  return value as unknown as WorkItemSource;
}

function references(
  sources: readonly WorkItemSource[],
  ids: ReadonlyMap<string, string>,
): readonly string[] {
  if (sources.length > MAX_REFERENCES) throw corrupt();
  const result = sources.map((source) => {
    parseSource(source);
    const id = ids.get(sourceKey(source));
    if (id === undefined) throw corrupt();
    return id;
  });
  if (new Set(result).size !== result.length) throw corrupt();
  return result.sort();
}

function expand(
  value: unknown,
  table: ReadonlyMap<string, WorkItemSource>,
  used: Set<string>,
): readonly WorkItemSource[] {
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) throw corrupt();
  const ids = value.map((id) => {
    if (typeof id !== "string") throw corrupt();
    return id;
  });
  if (
    new Set(ids).size !== ids.length ||
    [...ids].sort().some((id, i) => id !== ids[i])
  )
    throw corrupt();
  return ids.map((id) => {
    const source = table.get(id);
    if (source === undefined) throw corrupt();
    used.add(id);
    return source;
  });
}

function validateLogicalScope(handoff: Handoff) {
  validateEnvelope(handoff as unknown as Record<string, unknown>);
  if (handoff.schemaVersion !== 1) throw corrupt();
}

function sourceKey(source: WorkItemSource): string {
  parseSource(source);
  return JSON.stringify([
    source.eventId,
    source.sessionId,
    source.eventType,
    source.trust,
    source.sourceArtifactId,
    source.sourcePosition,
    source.sourceRecordHash,
  ]);
}
function sourceId(index: number) {
  return `source-${String(index + 1).padStart(4, "0")}`;
}
function boundedString(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function corrupt(): HandoffError {
  return new HandoffError(
    "The handoff is malformed, unsupported, oversized, or cross-scoped. Preserve immutable files and create a valid successor from canonical sources.",
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
