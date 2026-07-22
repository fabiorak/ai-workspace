import { createHash } from "node:crypto";
import {
  inspectPseudonymizedOutputWithPolicy,
  type OutputRestorationDecision,
  type OutputRestorationScope,
} from "./output-restoration.ts";
import type { VersionedPseudonymMapping } from "./pseudonymization-v2.ts";

export type OutputRestorationCorpusCase = Readonly<{
  id: string;
  mapping: VersionedPseudonymMapping;
  scope: OutputRestorationScope;
  output: string;
  expectedStrictDecision: OutputRestorationDecision;
  expectedStrictRestoredSha256: string | null;
}>;

export type OutputRestorationCorpusReport = Readonly<{
  schemaVersion: 1;
  corpusSha256: string;
  caseCount: number;
  strict: Readonly<{
    exactCases: number;
    blockedCases: number;
    noPseudonymCases: number;
    incorrectCases: number;
    partialBlockedOutputs: number;
    decision: "ADOPT_FOR_LOCAL_INSPECTION" | "REFINE" | "NO_CHANGE";
  }>;
  baseline: Readonly<{
    partiallyRestoredAnomalyCases: number;
    productionEligible: false;
  }>;
  cases: readonly Readonly<{
    id: string;
    mappingSchemaVersion: 1 | 2;
    inputSha256: string;
    strictDecision: OutputRestorationDecision;
    strictReason: string;
    strictRestoredSha256: string | null;
    strictRestoredTokens: number;
    strictAnomalyCount: number;
    baselineDecision: OutputRestorationDecision;
    baselineRestoredTokens: number;
    baselineAnomalyCount: number;
    matchesExpected: boolean;
  }>[];
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_OR_DELIVERY_AUTHORITY";
}>;

export function measureOutputRestorationCorpus(
  input: readonly OutputRestorationCorpusCase[],
): OutputRestorationCorpusReport {
  if (
    input.length < 1 ||
    new Set(input.map((entry) => entry.id)).size !== input.length
  )
    throw new Error("The output-restoration corpus is empty or ambiguous.");
  const cases = [...input]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((entry) => {
      const strict = inspectPseudonymizedOutputWithPolicy({
        mapping: entry.mapping,
        scope: entry.scope,
        output: entry.output,
        policy: "STRICT_WHOLE_TOKEN",
      });
      const baseline = inspectPseudonymizedOutputWithPolicy({
        mapping: entry.mapping,
        scope: entry.scope,
        output: entry.output,
        policy: "KNOWN_ONLY_BASELINE",
      });
      return Object.freeze({
        id: entry.id,
        mappingSchemaVersion: entry.mapping.schemaVersion,
        inputSha256: strict.inputSha256,
        strictDecision: strict.decision,
        strictReason: strict.reason,
        strictRestoredSha256: strict.restoredSha256,
        strictRestoredTokens: strict.restoredTokens,
        strictAnomalyCount: strict.anomalyCount,
        baselineDecision: baseline.decision,
        baselineRestoredTokens: baseline.restoredTokens,
        baselineAnomalyCount: baseline.anomalyCount,
        matchesExpected:
          strict.decision === entry.expectedStrictDecision &&
          strict.restoredSha256 === entry.expectedStrictRestoredSha256 &&
          (strict.decision !== "BLOCKED_INTEGRITY_FAILURE" ||
            strict.restoredContent === null),
      });
    });
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  const partialBlockedOutputs = cases.filter(
    (entry) =>
      entry.strictDecision === "BLOCKED_INTEGRITY_FAILURE" &&
      entry.strictRestoredSha256 !== null,
  ).length;
  const strictDecision =
    incorrectCases > 0 || partialBlockedOutputs > 0
      ? ("NO_CHANGE" as const)
      : cases.every(
            (entry) =>
              entry.strictDecision === "RESTORABLE_LOCAL_EVIDENCE" ||
              entry.strictDecision === "BLOCKED_INTEGRITY_FAILURE" ||
              entry.strictDecision === "NO_PSEUDONYMS",
          )
        ? ("ADOPT_FOR_LOCAL_INSPECTION" as const)
        : ("REFINE" as const);
  const canonicalCases = cases.map((entry) => ({
    id: entry.id,
    mappingSchemaVersion: entry.mappingSchemaVersion,
    inputSha256: entry.inputSha256,
    strictDecision: entry.strictDecision,
    strictRestoredSha256: entry.strictRestoredSha256,
  }));
  return Object.freeze({
    schemaVersion: 1 as const,
    corpusSha256: sha256(JSON.stringify(canonicalCases)),
    caseCount: cases.length,
    strict: Object.freeze({
      exactCases: cases.filter(
        (entry) => entry.strictDecision === "RESTORABLE_LOCAL_EVIDENCE",
      ).length,
      blockedCases: cases.filter(
        (entry) => entry.strictDecision === "BLOCKED_INTEGRITY_FAILURE",
      ).length,
      noPseudonymCases: cases.filter(
        (entry) => entry.strictDecision === "NO_PSEUDONYMS",
      ).length,
      incorrectCases,
      partialBlockedOutputs,
      decision: strictDecision,
    }),
    baseline: Object.freeze({
      partiallyRestoredAnomalyCases: cases.filter(
        (entry) =>
          entry.baselineAnomalyCount > 0 && entry.baselineRestoredTokens > 0,
      ).length,
      productionEligible: false as const,
    }),
    cases: Object.freeze(cases),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_OR_DELIVERY_AUTHORITY" as const,
  });
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
