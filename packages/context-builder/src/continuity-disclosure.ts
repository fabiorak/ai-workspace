import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export const CONTINUITY_DISCLOSURE_REPORT_SCHEMA_VERSION = 1;
export type ContinuitySectionName = (typeof CONTINUITY_SECTION_ORDER)[number];
export type ContinuityDisclosureLevel = "REFERENCE" | "OUTLINE" | "FULL";

export type ContinuityValueResolver = Readonly<{
  handoffId: string;
  section: ContinuitySectionName;
  serializedValueExactBytes: number;
  serializedValueSha256: string;
}>;
export type ContinuityDisclosureRepresentation = Readonly<{
  level: ContinuityDisclosureLevel;
  content: string;
  exactBytes: number;
}>;
export type ContinuityDisclosureSection = Readonly<{
  id: string;
  handoffId: string;
  section: ContinuitySectionName;
  metadata: SectionMetadata;
  resolver: ContinuityValueResolver;
  representations: Readonly<
    Record<ContinuityDisclosureLevel, ContinuityDisclosureRepresentation>
  >;
  effect: "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT";
}>;

export type ContinuityDisclosureBudget = Readonly<{
  label: string;
  exactBytes: number;
}>;
export type ContinuityDisclosureCorpusCase = Readonly<{
  label: string;
  handoff: Handoff;
  budgets: readonly ContinuityDisclosureBudget[];
}>;
export type ContinuityDisclosureLevelMeasurement = Readonly<{
  exactBytes: number;
  byteDifferenceFromFull: number;
  reductionPercentFromFull: number;
}>;
export type ContinuityDisclosureSectionMeasurement = Readonly<{
  section: ContinuitySectionName;
  trust: SectionMetadata["trust"];
  sourceCount: number;
  resolver: ContinuityValueResolver;
  levels: Readonly<
    Record<ContinuityDisclosureLevel, ContinuityDisclosureLevelMeasurement>
  >;
}>;
export type ContinuityDisclosureProfileMeasurement = Readonly<{
  label: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  metadataOnlyEncodingBytes: number;
  sections: readonly ContinuityDisclosureSectionMeasurement[];
  levels: Readonly<
    Record<ContinuityDisclosureLevel, ContinuityDisclosureLevelMeasurement>
  >;
  budgets: readonly Readonly<{
    label: string;
    exactBytes: number;
    fits: Readonly<Record<ContinuityDisclosureLevel, boolean>>;
    byteDifference: Readonly<Record<ContinuityDisclosureLevel, number>>;
  }>[];
}>;
export type ContinuityDisclosureCorpusReport = Readonly<{
  schemaVersion: 1;
  profileCount: number;
  budgetObservationCount: number;
  profiles: readonly ContinuityDisclosureProfileMeasurement[];
  fitCounts: Readonly<Record<ContinuityDisclosureLevel, number>>;
  levelDistributions: Readonly<
    Record<
      ContinuityDisclosureLevel,
      Readonly<{ minimum: number; medianNearestRank: number; maximum: number }>
    >
  >;
  decisionMethod: "EXACT_UTF8_REPRESENTATION_BYTES";
  effect: "MEASUREMENT_ONLY_NO_DISCLOSURE_POLICY_CHANGE";
}>;

const LEVELS = ["REFERENCE", "OUTLINE", "FULL"] as const;
const MAX_ID = 256;
const MAX_CASES = 20;
const MAX_BUDGETS = 10;
const MAX_BUDGET_BYTES = 1_000_000;
const MAX_REPRESENTATION_BYTES = 1_000_000;
const MAX_VALUE_NODES = 10_000;
const MAX_VALUE_DEPTH = 32;
const MAX_SOURCES_PER_SECTION = 100;
const encoder = new TextEncoder();

export class ContinuityDisclosureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContinuityDisclosureError";
  }
}

export function projectContinuityDisclosure(
  handoff: Handoff,
): readonly ContinuityDisclosureSection[] {
  validateId(handoff.id, "Handoff ID");
  validateId(handoff.projectId, "Project ID");
  validateId(handoff.workItemId, "Work Item ID");
  return Object.freeze(
    CONTINUITY_SECTION_ORDER.map((sectionName) => {
      const section = handoff.sections[sectionName];
      if (section === undefined)
        fail("Continuity disclosure requires all eight handoff sections.");
      const valueContent = encode(section.value, "section value");
      if (bytes(valueContent) > MAX_REPRESENTATION_BYTES)
        fail("Continuity section value exceeds the exact-byte bound.");
      const metadata = freezeMetadata(section.metadata);
      const resolver = Object.freeze({
        handoffId: handoff.id,
        section: sectionName,
        serializedValueExactBytes: bytes(valueContent),
        serializedValueSha256: sha256(valueContent),
      });
      const state = { nodes: 0 };
      const referenceContent = encode(
        { metadata, valueReference: resolver },
        "reference representation",
      );
      const outlineContent = encode(
        {
          metadata,
          valueOutline: outline(section.value, state, 0),
          valueReference: resolver,
        },
        "outline representation",
      );
      const fullContent = encode(section, "full representation");
      return Object.freeze({
        id: `handoff:${sectionName}`,
        handoffId: handoff.id,
        section: sectionName,
        metadata,
        resolver,
        representations: Object.freeze({
          REFERENCE: representation("REFERENCE", referenceContent),
          OUTLINE: representation("OUTLINE", outlineContent),
          FULL: representation("FULL", fullContent),
        }),
        effect: "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT" as const,
      });
    }),
  );
}

export function measureContinuityDisclosureCorpus(
  input: readonly ContinuityDisclosureCorpusCase[],
): ContinuityDisclosureCorpusReport {
  if (input.length < 1 || input.length > MAX_CASES)
    fail(`Provide from 1 to ${MAX_CASES} continuity disclosure profiles.`);
  const labels = new Set<string>();
  const handoffIds = new Set<string>();
  const profiles = input
    .map((value) => measureProfile(value, labels, handoffIds))
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
  const fitCounts = { REFERENCE: 0, OUTLINE: 0, FULL: 0 };
  for (const profile of profiles)
    for (const budget of profile.budgets)
      for (const level of LEVELS) if (budget.fits[level]) fitCounts[level] += 1;
  const levelDistributions = Object.fromEntries(
    LEVELS.map((level) => {
      const values = profiles
        .map((profile) => profile.levels[level].exactBytes)
        .sort((left, right) => left - right);
      return [
        level,
        Object.freeze({
          minimum: values[0]!,
          medianNearestRank: values[Math.ceil(values.length / 2) - 1]!,
          maximum: values.at(-1)!,
        }),
      ];
    }),
  ) as Record<
    ContinuityDisclosureLevel,
    Readonly<{ minimum: number; medianNearestRank: number; maximum: number }>
  >;
  return Object.freeze({
    schemaVersion: CONTINUITY_DISCLOSURE_REPORT_SCHEMA_VERSION,
    profileCount: profiles.length,
    budgetObservationCount: profiles.reduce(
      (total, profile) => total + profile.budgets.length,
      0,
    ),
    profiles: Object.freeze(profiles),
    fitCounts: Object.freeze(fitCounts),
    levelDistributions: Object.freeze(levelDistributions),
    decisionMethod: "EXACT_UTF8_REPRESENTATION_BYTES",
    effect: "MEASUREMENT_ONLY_NO_DISCLOSURE_POLICY_CHANGE",
  });
}

function measureProfile(
  value: ContinuityDisclosureCorpusCase,
  labels: Set<string>,
  handoffIds: Set<string>,
): ContinuityDisclosureProfileMeasurement {
  const label = boundedLabel(value.label, "Profile label");
  if (labels.has(label)) fail("Continuity profile labels must be unique.");
  labels.add(label);
  if (handoffIds.has(value.handoff.id))
    fail("Continuity corpus handoff identities must be unique.");
  handoffIds.add(value.handoff.id);
  if (value.budgets.length < 1 || value.budgets.length > MAX_BUDGETS)
    fail(`Provide from 1 to ${MAX_BUDGETS} budgets per continuity profile.`);
  const sections = projectContinuityDisclosure(value.handoff);
  const levelTotals = Object.fromEntries(
    LEVELS.map((level) => [
      level,
      sum(sections.map((section) => section.representations[level].exactBytes)),
    ]),
  ) as Record<ContinuityDisclosureLevel, number>;
  const fullTotal = levelTotals.FULL;
  const levels = Object.fromEntries(
    LEVELS.map((level) => [
      level,
      levelMeasurement(levelTotals[level], fullTotal),
    ]),
  ) as Record<ContinuityDisclosureLevel, ContinuityDisclosureLevelMeasurement>;
  const budgetLabels = new Set<string>();
  const budgets = [...value.budgets]
    .map((budget) => {
      const budgetLabel = boundedLabel(budget.label, "Budget label");
      if (budgetLabels.has(budgetLabel))
        fail("Budget labels must be unique inside one continuity profile.");
      budgetLabels.add(budgetLabel);
      if (
        !Number.isSafeInteger(budget.exactBytes) ||
        budget.exactBytes < 1 ||
        budget.exactBytes > MAX_BUDGET_BYTES
      )
        fail(
          `Disclosure budgets must contain from 1 to ${MAX_BUDGET_BYTES} exact bytes.`,
        );
      return Object.freeze({
        label: budgetLabel,
        exactBytes: budget.exactBytes,
        fits: Object.freeze(
          Object.fromEntries(
            LEVELS.map((level) => [
              level,
              levelTotals[level] <= budget.exactBytes,
            ]),
          ) as Record<ContinuityDisclosureLevel, boolean>,
        ),
        byteDifference: Object.freeze(
          Object.fromEntries(
            LEVELS.map((level) => [
              level,
              budget.exactBytes - levelTotals[level],
            ]),
          ) as Record<ContinuityDisclosureLevel, number>,
        ),
      });
    })
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
  return Object.freeze({
    label,
    projectId: value.handoff.projectId,
    workItemId: value.handoff.workItemId,
    handoffId: value.handoff.id,
    metadataOnlyEncodingBytes: sum(
      CONTINUITY_SECTION_ORDER.map((section) =>
        bytes(
          encode(
            { metadata: value.handoff.sections[section].metadata },
            "metadata",
          ),
        ),
      ),
    ),
    sections: Object.freeze(
      sections.map((section) => {
        const full = section.representations.FULL.exactBytes;
        return Object.freeze({
          section: section.section,
          trust: section.metadata.trust,
          sourceCount: section.metadata.sources.length,
          resolver: section.resolver,
          levels: Object.freeze(
            Object.fromEntries(
              LEVELS.map((level) => [
                level,
                levelMeasurement(
                  section.representations[level].exactBytes,
                  full,
                ),
              ]),
            ) as Record<
              ContinuityDisclosureLevel,
              ContinuityDisclosureLevelMeasurement
            >,
          ),
        });
      }),
    ),
    levels: Object.freeze(levels),
    budgets: Object.freeze(budgets),
  });
}

function outline(
  value: unknown,
  state: { nodes: number },
  depth: number,
): unknown {
  state.nodes += 1;
  if (state.nodes > MAX_VALUE_NODES || depth > MAX_VALUE_DEPTH)
    fail("Continuity value structure is oversized or too deeply nested.");
  if (typeof value === "string") {
    const serialized = JSON.stringify(value);
    return Object.freeze({
      kind: "STRING_REFERENCE" as const,
      serializedExactBytes: bytes(serialized),
      serializedSha256: sha256(serialized),
    });
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value))
    return Object.freeze(value.map((item) => outline(item, state, depth + 1)));
  if (isPlainRecord(value))
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          outline(item, state, depth + 1),
        ]),
      ),
    );
  fail("Continuity values must contain only JSON-compatible data.");
}

function representation(
  level: ContinuityDisclosureLevel,
  content: string,
): ContinuityDisclosureRepresentation {
  const exactBytes = bytes(content);
  if (exactBytes > MAX_REPRESENTATION_BYTES)
    fail("Continuity disclosure representation exceeds the exact-byte bound.");
  return Object.freeze({ level, content, exactBytes });
}

function freezeMetadata(metadata: SectionMetadata): SectionMetadata {
  if (metadata.sources.length > MAX_SOURCES_PER_SECTION)
    fail(
      "Continuity section source metadata exceeds the bounded source count.",
    );
  return Object.freeze({
    ...metadata,
    sources: Object.freeze(
      metadata.sources.map((source) => Object.freeze({ ...source })),
    ),
  });
}

function levelMeasurement(
  exactBytes: number,
  fullBytes: number,
): ContinuityDisclosureLevelMeasurement {
  const difference = fullBytes - exactBytes;
  return Object.freeze({
    exactBytes,
    byteDifferenceFromFull: difference,
    reductionPercentFromFull: Number(
      ((difference / fullBytes) * 100).toFixed(2),
    ),
  });
}

function encode(value: unknown, label: string) {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined)
      fail(`Continuity ${label} is not JSON-compatible.`);
    return encoded;
  } catch (error) {
    if (error instanceof ContinuityDisclosureError) throw error;
    throw new ContinuityDisclosureError(
      `Continuity ${label} is circular, unsupported, or oversized.`,
    );
  }
}

function validateId(value: string, label: string) {
  if (!value.trim() || value.length > MAX_ID || hasControl(value))
    fail(`${label} must be bounded non-control text.`);
}

function boundedLabel(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID || hasControl(normalized))
    fail(`${label} must be bounded non-control text.`);
  return normalized;
}

function hasControl(value: string) {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return code <= 31 || code === 127;
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function bytes(value: string) {
  return encoder.encode(value).byteLength;
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function fail(message: string): never {
  throw new ContinuityDisclosureError(message);
}
