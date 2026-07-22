import { createHash } from "node:crypto";
import {
  validatePseudonymMapping,
  type PseudonymMapping,
} from "./pseudonymization.ts";
import {
  validatePseudonymMappingV2,
  type PseudonymMappingV2,
  type VersionedPseudonymMapping,
} from "./pseudonymization-v2.ts";

export const OUTPUT_RESTORATION_EFFECT =
  "LOCAL_OUTPUT_INSPECTION_NOT_AUTHORIZED_DELIVERED_PERSISTED_OR_EXECUTED" as const;
export const OUTPUT_RESTORATION_MAX_BYTES = 1024 * 1024;
export type OutputRestorationPolicy =
  "STRICT_WHOLE_TOKEN" | "KNOWN_ONLY_BASELINE";
export type OutputRestorationDecision =
  "RESTORABLE_LOCAL_EVIDENCE" | "BLOCKED_INTEGRITY_FAILURE" | "NO_PSEUDONYMS";
export type OutputRestorationReason =
  | "ALL_TOKENS_OWNED_BY_MAPPING"
  | "NO_AI_WORKSPACE_PSEUDONYMS"
  | "UNKNOWN_OR_MALFORMED_TOKEN";

export type OutputRestorationScope = Readonly<{
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
}>;

export type OutputRestorationReport = Readonly<{
  schemaVersion: 1;
  mappingSchemaVersion: 1 | 2;
  mappingSetId: string;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  policy: OutputRestorationPolicy;
  decision: OutputRestorationDecision;
  reason: OutputRestorationReason;
  inputSha256: string;
  restoredSha256: string | null;
  inputBytes: number;
  restoredBytes: number | null;
  recognizedTokens: number;
  restoredTokens: number;
  anomalyCount: number;
  restoredContent: string | null;
  limitations: readonly [
    "EXACT_MAPPING_OWNED_TOKENS_ONLY_NOT_COMPLETE_OUTPUT_SAFETY",
    "LOCAL_INSPECTION_IS_NOT_MODEL_OR_DELIVERY_AUTHORIZATION",
  ];
  effect: typeof OUTPUT_RESTORATION_EFFECT;
}>;

const EXACT_TOKEN = /^\[\[AW_([A-Z_]+)_([A-F0-9]{16})\]\]/u;
const SUSPICIOUS_START = /\[\[AW/giu;

export class OutputRestorationError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The local output restoration request, mapping, scope, or candidate output is malformed, oversized, incompatible, or cross-scoped. Preserve encrypted state, select the exact mapping scope, and retry without altered placeholders.",
      options,
    );
    this.name = "OutputRestorationError";
  }
}

export function inspectPseudonymizedOutput(
  input: Readonly<{
    mapping: VersionedPseudonymMapping;
    scope: OutputRestorationScope;
    output: string;
  }>,
): OutputRestorationReport {
  return inspectPseudonymizedOutputWithPolicy({
    ...input,
    policy: "STRICT_WHOLE_TOKEN",
  });
}

export function inspectPseudonymizedOutputWithPolicy(
  input: Readonly<{
    mapping: VersionedPseudonymMapping;
    scope: OutputRestorationScope;
    output: string;
    policy: OutputRestorationPolicy;
  }>,
): OutputRestorationReport {
  try {
    const mapping = validateVersionedMapping(input.mapping);
    const policy = input.policy;
    if (
      !["STRICT_WHOLE_TOKEN", "KNOWN_ONLY_BASELINE"].includes(policy) ||
      !validOutput(input.output) ||
      !scopeMatches(mapping, input.scope)
    )
      throw invalid();
    const originals = mappingOriginals(mapping);
    const occurrences: { start: number; end: number; original: Buffer }[] = [];
    let anomalyCount = 0;
    let recognizedTokens = 0;
    SUSPICIOUS_START.lastIndex = 0;
    for (const start of input.output.matchAll(SUSPICIOUS_START)) {
      const index = start.index;
      const match = EXACT_TOKEN.exec(input.output.slice(index));
      if (
        match === null ||
        input.output[index + match[0].length] === "]" ||
        !entityAllowed(mapping.schemaVersion, match[1]!)
      ) {
        anomalyCount += 1;
        continue;
      }
      recognizedTokens += 1;
      const original = originals.get(match[0]);
      if (original === undefined) {
        anomalyCount += 1;
        continue;
      }
      occurrences.push({
        start: index,
        end: index + match[0].length,
        original,
      });
    }
    if (recognizedTokens === 0 && anomalyCount === 0)
      return report(mapping, input.scope, policy, input.output, {
        decision: "NO_PSEUDONYMS",
        reason: "NO_AI_WORKSPACE_PSEUDONYMS",
        recognizedTokens,
        restoredTokens: 0,
        anomalyCount,
        restoredContent: null,
      });
    if (policy === "STRICT_WHOLE_TOKEN" && anomalyCount > 0)
      return report(mapping, input.scope, policy, input.output, {
        decision: "BLOCKED_INTEGRITY_FAILURE",
        reason: "UNKNOWN_OR_MALFORMED_TOKEN",
        recognizedTokens,
        restoredTokens: 0,
        anomalyCount,
        restoredContent: null,
      });
    if (occurrences.length === 0)
      return report(mapping, input.scope, policy, input.output, {
        decision: "BLOCKED_INTEGRITY_FAILURE",
        reason: "UNKNOWN_OR_MALFORMED_TOKEN",
        recognizedTokens,
        restoredTokens: 0,
        anomalyCount,
        restoredContent: null,
      });
    const source = Buffer.from(input.output, "utf8");
    const byteOccurrences = occurrences.map((entry) => ({
      start: Buffer.byteLength(input.output.slice(0, entry.start), "utf8"),
      end: Buffer.byteLength(input.output.slice(0, entry.end), "utf8"),
      original: entry.original,
    }));
    const chunks: Buffer[] = [];
    let cursor = 0;
    for (const entry of byteOccurrences) {
      chunks.push(source.subarray(cursor, entry.start), entry.original);
      cursor = entry.end;
    }
    chunks.push(source.subarray(cursor));
    const restored = Buffer.concat(chunks).toString("utf8");
    return report(mapping, input.scope, policy, input.output, {
      decision: "RESTORABLE_LOCAL_EVIDENCE",
      reason: "ALL_TOKENS_OWNED_BY_MAPPING",
      recognizedTokens,
      restoredTokens: occurrences.length,
      anomalyCount,
      restoredContent: restored,
    });
  } catch (error) {
    if (error instanceof OutputRestorationError) throw error;
    throw invalid(error);
  }
}

function validateVersionedMapping(
  value: VersionedPseudonymMapping,
): PseudonymMapping | PseudonymMappingV2 {
  if (value.schemaVersion === 1) return validatePseudonymMapping(value);
  if (value.schemaVersion === 2) return validatePseudonymMappingV2(value);
  throw invalid();
}

function mappingOriginals(mapping: PseudonymMapping | PseudonymMappingV2) {
  const originals = new Map<string, Buffer>();
  for (const entry of mapping.entries) {
    const original = Buffer.from(entry.originalBase64, "base64");
    if (!Buffer.from(original.toString("utf8"), "utf8").equals(original))
      throw invalid();
    const existing = originals.get(entry.pseudonym);
    if (existing !== undefined && !existing.equals(original)) throw invalid();
    originals.set(entry.pseudonym, original);
  }
  return originals;
}

function entityAllowed(version: 1 | 2, entity: string) {
  const v1 = ["PERSON", "CUSTOMER", "EMAIL", "BUSINESS_IDENTIFIER", "OTHER"];
  return (version === 1 ? v1 : [...v1, "PROJECT"]).includes(entity);
}

function validOutput(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const bytes = Buffer.from(value, "utf8");
  return (
    bytes.length >= 1 &&
    bytes.length <= OUTPUT_RESTORATION_MAX_BYTES &&
    bytes.toString("utf8") === value
  );
}

function scopeMatches(
  mapping: PseudonymMapping | PseudonymMappingV2,
  scope: OutputRestorationScope,
) {
  return (
    mapping.mappingSetId === scope.mappingSetId &&
    mapping.projectId === scope.projectId &&
    mapping.workItemId === scope.workItemId &&
    mapping.handoffId === scope.handoffId &&
    mapping.modelId === scope.modelId
  );
}

function report(
  mapping: PseudonymMapping | PseudonymMappingV2,
  scope: OutputRestorationScope,
  policy: OutputRestorationPolicy,
  input: string,
  result: Readonly<{
    decision: OutputRestorationDecision;
    reason: OutputRestorationReason;
    recognizedTokens: number;
    restoredTokens: number;
    anomalyCount: number;
    restoredContent: string | null;
  }>,
): OutputRestorationReport {
  return Object.freeze({
    schemaVersion: 1 as const,
    mappingSchemaVersion: mapping.schemaVersion,
    mappingSetId: scope.mappingSetId,
    projectId: scope.projectId,
    workItemId: scope.workItemId,
    handoffId: scope.handoffId,
    modelId: scope.modelId,
    policy,
    decision: result.decision,
    reason: result.reason,
    inputSha256: sha256(input),
    restoredSha256:
      result.restoredContent === null ? null : sha256(result.restoredContent),
    inputBytes: Buffer.byteLength(input, "utf8"),
    restoredBytes:
      result.restoredContent === null
        ? null
        : Buffer.byteLength(result.restoredContent, "utf8"),
    recognizedTokens: result.recognizedTokens,
    restoredTokens: result.restoredTokens,
    anomalyCount: result.anomalyCount,
    restoredContent: result.restoredContent,
    limitations: Object.freeze([
      "EXACT_MAPPING_OWNED_TOKENS_ONLY_NOT_COMPLETE_OUTPUT_SAFETY",
      "LOCAL_INSPECTION_IS_NOT_MODEL_OR_DELIVERY_AUTHORIZATION",
    ] as const),
    effect: OUTPUT_RESTORATION_EFFECT,
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invalid(cause?: unknown) {
  return new OutputRestorationError(
    cause === undefined ? undefined : { cause },
  );
}
