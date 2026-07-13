import { TextEncoder } from "node:util";
import type { ContextCategory, ContextPackPreview } from "./index.ts";

export const CONTEXT_PACK_CORPUS_REPORT_SCHEMA_VERSION = 1;

export type ContextPackCorpusSample = Readonly<{
  label: string;
  dimensions: Readonly<Record<string, string>>;
  preview: ContextPackPreview;
}>;

export type ContextPackCategoryMeasurement = Readonly<{
  budgetBytes: number;
  candidateBytes: number;
  includedBytes: number;
  omittedBytes: number;
  includedItems: number;
  omittedItems: number;
  retentionPercent: number | null;
  budgetUtilizationPercent: number;
}>;

export type ContextPackSampleMeasurement = Readonly<{
  label: string;
  dimensions: Readonly<Record<string, string>>;
  projectId: string;
  workItemId: string;
  handoffId: string;
  fit: "FULL_FIT" | "PARTIAL_FIT" | "NO_FIT";
  categories: Readonly<Record<ContextCategory, ContextPackCategoryMeasurement>>;
  exactCandidateBytes: number;
  exactIncludedBytes: number;
  exactOmittedBytes: number;
  estimatedIncludedTokens: number;
  tokenEstimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4";
}>;

export type ContextPackCategoryAggregate = Readonly<{
  candidateBytes: number;
  includedBytes: number;
  omittedBytes: number;
  samplesWithCandidates: number;
  samplesWithOmissions: number;
  retentionPercent: number | null;
}>;

export type ContextPackCorpusReport = Readonly<{
  schemaVersion: 1;
  sampleCount: number;
  samples: readonly ContextPackSampleMeasurement[];
  fitCounts: Readonly<Record<"FULL_FIT" | "PARTIAL_FIT" | "NO_FIT", number>>;
  categories: Readonly<Record<ContextCategory, ContextPackCategoryAggregate>>;
  includedByteDistribution: Readonly<{
    minimum: number;
    p50NearestRank: number;
    p90NearestRank: number;
    maximum: number;
  }>;
  decisionMethod: "EXACT_UTF8_CONTENT_BYTES";
  effect: "MEASUREMENT_ONLY_NO_SELECTION_POLICY_CHANGE";
}>;

const CATEGORIES = ["CONTINUITY", "INSTRUCTIONS"] as const;
const MAX_SAMPLES = 100;
const MAX_ITEMS_PER_SAMPLE = 1_000;
const MAX_ITEM_BYTES = 1_000_000;
const MAX_BUDGET_BYTES = 1_000_000;
const MAX_DIMENSIONS = 16;
const MAX_TEXT_LENGTH = 100;
const encoder = new TextEncoder();

export class ContextPackMeasurementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContextPackMeasurementError";
  }
}

export function measureContextPackCorpus(
  input: readonly ContextPackCorpusSample[],
): ContextPackCorpusReport {
  if (input.length < 1 || input.length > MAX_SAMPLES)
    fail(`Provide from 1 to ${MAX_SAMPLES} Context Pack samples.`);

  const labels = new Set<string>();
  const samples = [...input]
    .map((sample) => measureSample(sample, labels))
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
  const fitCounts = { FULL_FIT: 0, PARTIAL_FIT: 0, NO_FIT: 0 };
  for (const sample of samples) fitCounts[sample.fit] += 1;

  const categories = Object.fromEntries(
    CATEGORIES.map((category) => {
      const candidateBytes = sum(
        samples.map((sample) => sample.categories[category].candidateBytes),
      );
      const includedBytes = sum(
        samples.map((sample) => sample.categories[category].includedBytes),
      );
      const omittedBytes = candidateBytes - includedBytes;
      return [
        category,
        Object.freeze({
          candidateBytes,
          includedBytes,
          omittedBytes,
          samplesWithCandidates: samples.filter(
            (sample) => sample.categories[category].candidateBytes > 0,
          ).length,
          samplesWithOmissions: samples.filter(
            (sample) => sample.categories[category].omittedBytes > 0,
          ).length,
          retentionPercent: percentOrNull(includedBytes, candidateBytes),
        }),
      ];
    }),
  ) as Record<ContextCategory, ContextPackCategoryAggregate>;
  const included = samples
    .map((sample) => sample.exactIncludedBytes)
    .sort((left, right) => left - right);

  return Object.freeze({
    schemaVersion: CONTEXT_PACK_CORPUS_REPORT_SCHEMA_VERSION,
    sampleCount: samples.length,
    samples: Object.freeze(samples),
    fitCounts: Object.freeze(fitCounts),
    categories: Object.freeze(categories),
    includedByteDistribution: Object.freeze({
      minimum: included[0]!,
      p50NearestRank: nearestRank(included, 0.5),
      p90NearestRank: nearestRank(included, 0.9),
      maximum: included.at(-1)!,
    }),
    decisionMethod: "EXACT_UTF8_CONTENT_BYTES",
    effect: "MEASUREMENT_ONLY_NO_SELECTION_POLICY_CHANGE",
  });
}

function measureSample(
  sample: ContextPackCorpusSample,
  labels: Set<string>,
): ContextPackSampleMeasurement {
  const label = boundedText(sample.label, "Sample label");
  if (labels.has(label)) fail("Context Pack sample labels must be unique.");
  labels.add(label);
  const dimensions = normalizeDimensions(sample.dimensions);
  validatePreview(sample.preview);

  const categories = Object.fromEntries(
    CATEGORIES.map((category) => {
      const included = sample.preview.included.filter(
        (item) => item.category === category,
      );
      const omitted = sample.preview.omitted.filter(
        (item) => item.category === category,
      );
      const includedBytes = sum(included.map((item) => item.exactBytes));
      const omittedBytes = sum(omitted.map((item) => item.exactBytes));
      const candidateBytes = includedBytes + omittedBytes;
      return [
        category,
        Object.freeze({
          budgetBytes: sample.preview.budgets[category],
          candidateBytes,
          includedBytes,
          omittedBytes,
          includedItems: included.length,
          omittedItems: omitted.length,
          retentionPercent: percentOrNull(includedBytes, candidateBytes),
          budgetUtilizationPercent: percent(
            includedBytes,
            sample.preview.budgets[category],
          ),
        }),
      ];
    }),
  ) as Record<ContextCategory, ContextPackCategoryMeasurement>;
  const exactIncludedBytes =
    categories.CONTINUITY.includedBytes + categories.INSTRUCTIONS.includedBytes;
  const exactOmittedBytes =
    categories.CONTINUITY.omittedBytes + categories.INSTRUCTIONS.omittedBytes;

  return Object.freeze({
    label,
    dimensions,
    projectId: sample.preview.projectId,
    workItemId: sample.preview.workItemId,
    handoffId: sample.preview.handoffId,
    fit:
      exactOmittedBytes === 0
        ? "FULL_FIT"
        : exactIncludedBytes === 0
          ? "NO_FIT"
          : "PARTIAL_FIT",
    categories: Object.freeze(categories),
    exactCandidateBytes: exactIncludedBytes + exactOmittedBytes,
    exactIncludedBytes,
    exactOmittedBytes,
    estimatedIncludedTokens: Math.ceil(exactIncludedBytes / 4),
    tokenEstimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4",
  });
}

function validatePreview(preview: ContextPackPreview) {
  if (
    preview.schemaVersion !== 1 ||
    preview.effect !== "READ_ONLY_NOT_PERSISTED_OR_EXECUTED" ||
    !preview.projectId.trim() ||
    !preview.workItemId.trim() ||
    !preview.handoffId.trim()
  )
    fail("Context Pack samples require a valid schema-v1 read-only preview.");
  const itemCount = preview.included.length + preview.omitted.length;
  if (itemCount < 1 || itemCount > MAX_ITEMS_PER_SAMPLE)
    fail(
      `Context Pack samples require from 1 to ${MAX_ITEMS_PER_SAMPLE} candidate items.`,
    );
  const ids = new Set<string>();
  for (const item of preview.included) {
    validateItemIdentity(item.id, ids);
    if (
      !CATEGORIES.includes(item.category) ||
      !positive(item.exactBytes) ||
      item.exactBytes > MAX_ITEM_BYTES ||
      encoder.encode(item.content).byteLength !== item.exactBytes
    )
      fail("Context Pack included-item byte accounting is inconsistent.");
  }
  for (const item of preview.omitted) {
    validateItemIdentity(item.id, ids);
    if (
      !CATEGORIES.includes(item.category) ||
      !positive(item.exactBytes) ||
      item.exactBytes > MAX_ITEM_BYTES ||
      item.reason !== "BUDGET_EXCEEDED"
    )
      fail("Context Pack omitted-item accounting is inconsistent.");
  }
  for (const category of CATEGORIES) {
    const includedBytes = sum(
      preview.included
        .filter((item) => item.category === category)
        .map((item) => item.exactBytes),
    );
    if (
      !positive(preview.budgets[category]) ||
      preview.budgets[category] > MAX_BUDGET_BYTES ||
      preview.usedBytes[category] !== includedBytes ||
      includedBytes > preview.budgets[category]
    )
      fail("Context Pack category budget accounting is inconsistent.");
  }
  const exactIncludedBytes =
    preview.usedBytes.CONTINUITY + preview.usedBytes.INSTRUCTIONS;
  if (
    preview.measurement.exactIncludedBytes !== exactIncludedBytes ||
    preview.measurement.estimatedTokens !== Math.ceil(exactIncludedBytes / 4) ||
    preview.measurement.estimateMethod !==
      "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4"
  )
    fail("Context Pack total measurement is inconsistent.");
}

function normalizeDimensions(input: Readonly<Record<string, string>>) {
  const entries = Object.entries(input);
  if (entries.length < 1 || entries.length > MAX_DIMENSIONS)
    fail(`Provide from 1 to ${MAX_DIMENSIONS} sample dimensions.`);
  const normalized = entries
    .map(
      ([key, value]) =>
        [
          boundedText(key, "Dimension key"),
          boundedText(value, "Dimension value"),
        ] as const,
    )
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  if (new Set(normalized.map(([key]) => key)).size !== normalized.length)
    fail("Context Pack dimension keys must be unique after normalization.");
  return Object.freeze(Object.fromEntries(normalized));
}

function validateItemIdentity(id: string, ids: Set<string>) {
  if (!id.trim() || ids.has(id))
    fail(
      "Context Pack candidate item identities must be non-empty and unique.",
    );
  ids.add(id);
}

function boundedText(value: string, label: string) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_TEXT_LENGTH ||
    [...normalized].some((character) => {
      const code = character.codePointAt(0)!;
      return code <= 31 || code === 127;
    })
  )
    fail(`${label} must be bounded non-control text.`);
  return normalized;
}

function percent(numerator: number, denominator: number) {
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function percentOrNull(numerator: number, denominator: number) {
  return denominator === 0 ? null : percent(numerator, denominator);
}

function nearestRank(sorted: readonly number[], percentile: number) {
  return sorted[Math.ceil(sorted.length * percentile) - 1]!;
}

function positive(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function fail(message: string): never {
  throw new ContextPackMeasurementError(message);
}
