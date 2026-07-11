import { TextEncoder } from "node:util";
import { HandoffError } from "./handoffs.ts";
import type { Handoff } from "./model.ts";
import { encodeHandoff } from "./render.ts";

export type SessionByteBaseline = Readonly<{
  label: string;
  recordCount: number;
  payloadBytes: number;
  fullSessionBytes: number;
}>;
export type HandoffSizeMeasurement = Readonly<
  SessionByteBaseline & {
    handoffBytes: number;
    byteDifference: number;
    handoffIsSmaller: boolean;
    estimatedFullSessionTokens: number;
    estimatedHandoffTokens: number;
    tokenEstimateMethod: "CEIL_UTF8_BYTES_DIVIDED_BY_4";
  }
>;
export type HandoffBreakEvenReport = Readonly<{
  handoffBytes: number;
  measurements: readonly HandoffSizeMeasurement[];
  firstBreakEven: HandoffSizeMeasurement | null;
  decisionMethod: "EXACT_UTF8_BYTES";
}>;
export type HandoffByteAttribution = Readonly<{
  totalBytes: number;
  envelopeAndStructureBytes: number;
  sectionContentBytes: number;
  sectionMetadataBytes: number;
  uniqueProvenanceBytes: number;
  repeatedProvenanceBytes: number;
  sourceOccurrences: number;
  uniqueSources: number;
  decisionMethod: "EXACT_UTF8_BYTES";
}>;
export function measureHandoffBreakEven(
  handoff: Handoff,
  baselines: readonly SessionByteBaseline[],
): HandoffBreakEvenReport {
  if (baselines.length < 1 || baselines.length > 100)
    throw new HandoffError(
      "Provide from 1 to 100 synthetic session baselines.",
    );
  const labels = new Set<string>();
  const handoffBytes = new TextEncoder().encode(
    encodeHandoff(handoff),
  ).byteLength;
  const measurements = baselines.map((baseline) => {
    if (
      !baseline.label.trim() ||
      labels.has(baseline.label) ||
      !positive(baseline.recordCount) ||
      !positive(baseline.payloadBytes) ||
      !positive(baseline.fullSessionBytes)
    )
      throw new HandoffError(
        "Synthetic baselines require unique labels and positive integer record, payload, and exact-byte values.",
      );
    labels.add(baseline.label);
    return Object.freeze({
      ...baseline,
      handoffBytes,
      byteDifference: baseline.fullSessionBytes - handoffBytes,
      handoffIsSmaller: handoffBytes < baseline.fullSessionBytes,
      estimatedFullSessionTokens: Math.ceil(baseline.fullSessionBytes / 4),
      estimatedHandoffTokens: Math.ceil(handoffBytes / 4),
      tokenEstimateMethod: "CEIL_UTF8_BYTES_DIVIDED_BY_4" as const,
    });
  });
  return Object.freeze({
    handoffBytes,
    measurements: Object.freeze(measurements),
    firstBreakEven:
      measurements.find((value) => value.handoffIsSmaller) ?? null,
    decisionMethod: "EXACT_UTF8_BYTES",
  });
}
function positive(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

export function attributeHandoffBytes(
  handoff: Handoff,
): HandoffByteAttribution {
  const sections = Object.entries(handoff.sections);
  let content = 0,
    metadata = 0;
  const occurrences: unknown[] = [];
  for (const [name, section] of sections) {
    metadata += compactBytes({ ...section.metadata, sources: undefined });
    occurrences.push(...section.metadata.sources);
    if (name === "sourceReferences")
      occurrences.push(...(section.value as readonly unknown[]));
    else content += compactBytes(section.value);
  }
  const unique = [
    ...new Map(
      occurrences.map((source) => [JSON.stringify(source), source]),
    ).values(),
  ];
  const allProvenance = compactBytes(occurrences),
    uniqueProvenance = compactBytes(unique),
    repeated = allProvenance - uniqueProvenance,
    total = new TextEncoder().encode(encodeHandoff(handoff)).byteLength,
    envelope = total - content - metadata - uniqueProvenance - repeated;
  if (envelope < 0)
    throw new HandoffError(
      "Handoff byte attribution exceeded the exact encoded size.",
    );
  return Object.freeze({
    totalBytes: total,
    envelopeAndStructureBytes: envelope,
    sectionContentBytes: content,
    sectionMetadataBytes: metadata,
    uniqueProvenanceBytes: uniqueProvenance,
    repeatedProvenanceBytes: repeated,
    sourceOccurrences: occurrences.length,
    uniqueSources: unique.length,
    decisionMethod: "EXACT_UTF8_BYTES",
  });
}
function compactBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
