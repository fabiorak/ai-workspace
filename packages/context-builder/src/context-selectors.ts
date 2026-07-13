import { createHash } from "node:crypto";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export const CONTEXT_SELECTOR_REPORT_SCHEMA_VERSION = 1;
export type ContextSelectorSection = (typeof CONTINUITY_SECTION_ORDER)[number];
export type ContextSelector =
  | "handoff.objective"
  | "handoff.repository"
  | "handoff.selected_memory"
  | "handoff.known_failures"
  | "handoff.test_state"
  | "handoff.relevant_files"
  | "handoff.next_action"
  | "handoff.source_references";

export const CONTEXT_SELECTOR_VOCABULARY: Readonly<
  Record<ContextSelector, ContextSelectorSection>
> = Object.freeze({
  "handoff.objective": "objective",
  "handoff.repository": "repository",
  "handoff.selected_memory": "selectedMemory",
  "handoff.known_failures": "knownFailures",
  "handoff.test_state": "testState",
  "handoff.relevant_files": "relevantFiles",
  "handoff.next_action": "nextAction",
  "handoff.source_references": "sourceReferences",
});

export const CONTEXT_SELECTOR_SAFETY_FLOOR: readonly ContextSelectorSection[] =
  Object.freeze(["objective", "repository", "nextAction", "sourceReferences"]);

export type ContextSelectorInput = Readonly<{
  include: readonly string[];
  exclude: readonly string[];
}>;
export type ContextSelectorDecision = Readonly<{
  id: string;
  selector: ContextSelector;
  section: ContextSelectorSection;
  status: "SELECTED" | "EXCLUDED_NOT_INCLUDED" | "EXCLUDED_BY_SELECTOR";
  reason:
    | "SAFETY_FLOOR"
    | "DEFAULT_INCLUDE"
    | "EXPLICIT_INCLUDE"
    | "NOT_INCLUDED"
    | "EXPLICIT_EXCLUDE";
  trust: SectionMetadata["trust"];
  sourceCount: number;
  exactCandidateBytes: number;
  candidateSha256: string;
}>;
export type ContextSelectorProjection = Readonly<{
  handoffId: string;
  selectors: Readonly<{
    include: readonly ContextSelector[];
    exclude: readonly ContextSelector[];
  }>;
  safetyFloor: readonly ContextSelectorSection[];
  decisions: readonly ContextSelectorDecision[];
  baselineCandidateBytes: number;
  selectedCandidateBytes: number;
  excludedCandidateBytes: number;
  byteDifferenceFromBaseline: number;
  reductionPercentFromBaseline: number;
  safetyFloorLossCount: number;
  measurementMethod: "EXACT_UTF8_CONTEXT_BUILDER_V1_CANDIDATE_BYTES";
  effect: "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT_OR_POLICY";
}>;
export type ContextSelectorBudget = Readonly<{
  label: string;
  exactBytes: number;
}>;
export type ContextSelectorCorpusCase = Readonly<{
  label: string;
  handoff: Handoff;
  selectors: ContextSelectorInput;
  budgets: readonly ContextSelectorBudget[];
}>;
export type ContextSelectorCaseMeasurement = ContextSelectorProjection &
  Readonly<{
    label: string;
    projectId: string;
    workItemId: string;
    budgets: readonly Readonly<{
      label: string;
      exactBytes: number;
      baselineFits: boolean;
      selectorPolicyFits: boolean;
      baselineHeadroomBytes: number;
      selectorPolicyHeadroomBytes: number;
    }>[];
  }>;
export type ContextSelectorCorpusReport = Readonly<{
  schemaVersion: 1;
  caseCount: number;
  budgetObservationCount: number;
  cases: readonly ContextSelectorCaseMeasurement[];
  fitCounts: Readonly<{ BASELINE: number; SELECTOR_POLICY: number }>;
  aggregate: Readonly<{
    baselineCandidateBytes: number;
    selectedCandidateBytes: number;
    excludedCandidateBytes: number;
    byteDifferenceFromBaseline: number;
    reductionPercentFromBaseline: number;
    safetyFloorLossCount: number;
  }>;
  vocabulary: typeof CONTEXT_SELECTOR_VOCABULARY;
  safetyFloor: readonly ContextSelectorSection[];
  decisionMethod: "EXACT_UTF8_CONTEXT_BUILDER_V1_CANDIDATE_BYTES";
  interpretation: "FORMAT_AND_FIT_MEASUREMENT_NOT_RELEVANCE_QUALITY_OR_PRODUCTION_POLICY";
  effect: "MEASUREMENT_ONLY_NO_CONTEXT_BUILDER_OR_PROFILE_SCHEMA_CHANGE";
}>;

const MAX_CASES = 30;
const MAX_BUDGETS = 10;
const MAX_BUDGET_BYTES = 1_000_000;
const MAX_ID = 256;
const MAX_CANDIDATE_BYTES = 1_000_000;
const MAX_SOURCES_PER_SECTION = 100;
const SELECTOR_BY_SECTION = new Map<ContextSelectorSection, ContextSelector>(
  Object.entries(CONTEXT_SELECTOR_VOCABULARY).map(([selector, section]) => [
    section,
    selector as ContextSelector,
  ]),
);
const SAFETY_FLOOR = new Set(CONTEXT_SELECTOR_SAFETY_FLOOR);

export class ContextSelectorMeasurementError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The context-selector experiment is malformed, unsupported, oversized, conflicting, or cross-scoped. Use only the documented experiment-only handoff selectors and retry.",
      options,
    );
    this.name = "ContextSelectorMeasurementError";
  }
}

export function projectContextSelectors(
  handoff: Handoff,
  input: ContextSelectorInput,
): ContextSelectorProjection {
  try {
    validateId(handoff.id);
    validateId(handoff.projectId);
    validateId(handoff.workItemId);
    const include = selectors(input.include);
    const exclude = selectors(input.exclude);
    const includeSet = new Set(include);
    const excludeSet = new Set(exclude);
    if (
      include.some((selector) => excludeSet.has(selector)) ||
      exclude.some((selector) =>
        SAFETY_FLOOR.has(CONTEXT_SELECTOR_VOCABULARY[selector]),
      )
    )
      throw invalid();
    const decisions = CONTINUITY_SECTION_ORDER.map((section) => {
      const value = handoff.sections[section];
      if (
        value === undefined ||
        !Array.isArray(value.metadata?.sources) ||
        value.metadata.sources.length > MAX_SOURCES_PER_SECTION ||
        !["UNTRUSTED", "USER_CURATED", "OBSERVED"].includes(
          value.metadata.trust,
        )
      )
        throw invalid();
      const selector = SELECTOR_BY_SECTION.get(section);
      if (selector === undefined) throw invalid();
      const content = encode(value);
      const exactCandidateBytes = bytes(content);
      if (exactCandidateBytes > MAX_CANDIDATE_BYTES) throw invalid();
      const selection = decide(
        section,
        selector,
        include.length,
        includeSet,
        excludeSet,
      );
      return Object.freeze({
        id: `handoff:${section}`,
        selector,
        section,
        ...selection,
        trust: value.metadata.trust,
        sourceCount: value.metadata.sources.length,
        exactCandidateBytes,
        candidateSha256: sha256(content),
      });
    });
    const baselineCandidateBytes = sum(
      decisions.map((decision) => decision.exactCandidateBytes),
    );
    const selectedCandidateBytes = sum(
      decisions
        .filter((decision) => decision.status === "SELECTED")
        .map((decision) => decision.exactCandidateBytes),
    );
    const excludedCandidateBytes =
      baselineCandidateBytes - selectedCandidateBytes;
    const safetyFloorLossCount = decisions.filter(
      (decision) =>
        SAFETY_FLOOR.has(decision.section) && decision.status !== "SELECTED",
    ).length;
    if (safetyFloorLossCount !== 0) throw invalid();
    return Object.freeze({
      handoffId: handoff.id,
      selectors: Object.freeze({ include, exclude }),
      safetyFloor: CONTEXT_SELECTOR_SAFETY_FLOOR,
      decisions: Object.freeze(decisions),
      baselineCandidateBytes,
      selectedCandidateBytes,
      excludedCandidateBytes,
      byteDifferenceFromBaseline: excludedCandidateBytes,
      reductionPercentFromBaseline: percent(
        excludedCandidateBytes,
        baselineCandidateBytes,
      ),
      safetyFloorLossCount,
      measurementMethod:
        "EXACT_UTF8_CONTEXT_BUILDER_V1_CANDIDATE_BYTES" as const,
      effect: "EXPERIMENT_ONLY_NOT_CONTEXT_BUILDER_INPUT_OR_POLICY" as const,
    });
  } catch (error) {
    if (error instanceof ContextSelectorMeasurementError) throw error;
    throw invalid(error);
  }
}

export function measureContextSelectorCorpus(
  input: readonly ContextSelectorCorpusCase[],
): ContextSelectorCorpusReport {
  try {
    if (input.length < 1 || input.length > MAX_CASES) throw invalid();
    const labels = new Set<string>();
    const cases = input
      .map((value) => {
        const label = bounded(value.label);
        if (labels.has(label)) throw invalid();
        labels.add(label);
        const projection = projectContextSelectors(
          value.handoff,
          value.selectors,
        );
        if (value.budgets.length < 1 || value.budgets.length > MAX_BUDGETS)
          throw invalid();
        const budgetLabels = new Set<string>();
        const budgets = value.budgets
          .map((budget) => {
            const budgetLabel = bounded(budget.label);
            if (
              budgetLabels.has(budgetLabel) ||
              !Number.isSafeInteger(budget.exactBytes) ||
              budget.exactBytes < 1 ||
              budget.exactBytes > MAX_BUDGET_BYTES
            )
              throw invalid();
            budgetLabels.add(budgetLabel);
            return Object.freeze({
              label: budgetLabel,
              exactBytes: budget.exactBytes,
              baselineFits:
                projection.baselineCandidateBytes <= budget.exactBytes,
              selectorPolicyFits:
                projection.selectedCandidateBytes <= budget.exactBytes,
              baselineHeadroomBytes:
                budget.exactBytes - projection.baselineCandidateBytes,
              selectorPolicyHeadroomBytes:
                budget.exactBytes - projection.selectedCandidateBytes,
            });
          })
          .sort((left, right) => compare(left.label, right.label));
        return Object.freeze({
          label,
          projectId: value.handoff.projectId,
          workItemId: value.handoff.workItemId,
          ...projection,
          budgets: Object.freeze(budgets),
        });
      })
      .sort((left, right) => compare(left.label, right.label));
    const fitCounts = { BASELINE: 0, SELECTOR_POLICY: 0 };
    for (const value of cases)
      for (const budget of value.budgets) {
        if (budget.baselineFits) fitCounts.BASELINE += 1;
        if (budget.selectorPolicyFits) fitCounts.SELECTOR_POLICY += 1;
      }
    const baselineCandidateBytes = sum(
      cases.map((value) => value.baselineCandidateBytes),
    );
    const selectedCandidateBytes = sum(
      cases.map((value) => value.selectedCandidateBytes),
    );
    const excludedCandidateBytes =
      baselineCandidateBytes - selectedCandidateBytes;
    return Object.freeze({
      schemaVersion: CONTEXT_SELECTOR_REPORT_SCHEMA_VERSION,
      caseCount: cases.length,
      budgetObservationCount: sum(cases.map((value) => value.budgets.length)),
      cases: Object.freeze(cases),
      fitCounts: Object.freeze(fitCounts),
      aggregate: Object.freeze({
        baselineCandidateBytes,
        selectedCandidateBytes,
        excludedCandidateBytes,
        byteDifferenceFromBaseline: excludedCandidateBytes,
        reductionPercentFromBaseline: percent(
          excludedCandidateBytes,
          baselineCandidateBytes,
        ),
        safetyFloorLossCount: sum(
          cases.map((value) => value.safetyFloorLossCount),
        ),
      }),
      vocabulary: CONTEXT_SELECTOR_VOCABULARY,
      safetyFloor: CONTEXT_SELECTOR_SAFETY_FLOOR,
      decisionMethod: "EXACT_UTF8_CONTEXT_BUILDER_V1_CANDIDATE_BYTES" as const,
      interpretation:
        "FORMAT_AND_FIT_MEASUREMENT_NOT_RELEVANCE_QUALITY_OR_PRODUCTION_POLICY" as const,
      effect:
        "MEASUREMENT_ONLY_NO_CONTEXT_BUILDER_OR_PROFILE_SCHEMA_CHANGE" as const,
    });
  } catch (error) {
    if (error instanceof ContextSelectorMeasurementError) throw error;
    throw invalid(error);
  }
}

function selectors(value: readonly string[]): readonly ContextSelector[] {
  if (!Array.isArray(value) || value.length > CONTINUITY_SECTION_ORDER.length)
    throw invalid();
  const result = value.map((selector) => {
    if (!Object.hasOwn(CONTEXT_SELECTOR_VOCABULARY, selector)) throw invalid();
    return selector as ContextSelector;
  });
  if (new Set(result).size !== result.length) throw invalid();
  return Object.freeze(
    result.sort(
      (left, right) =>
        CONTINUITY_SECTION_ORDER.indexOf(CONTEXT_SELECTOR_VOCABULARY[left]) -
        CONTINUITY_SECTION_ORDER.indexOf(CONTEXT_SELECTOR_VOCABULARY[right]),
    ),
  );
}

function decide(
  section: ContextSelectorSection,
  selector: ContextSelector,
  includeCount: number,
  include: ReadonlySet<ContextSelector>,
  exclude: ReadonlySet<ContextSelector>,
) {
  if (SAFETY_FLOOR.has(section))
    return { status: "SELECTED" as const, reason: "SAFETY_FLOOR" as const };
  if (exclude.has(selector))
    return {
      status: "EXCLUDED_BY_SELECTOR" as const,
      reason: "EXPLICIT_EXCLUDE" as const,
    };
  if (includeCount === 0)
    return { status: "SELECTED" as const, reason: "DEFAULT_INCLUDE" as const };
  if (include.has(selector))
    return { status: "SELECTED" as const, reason: "EXPLICIT_INCLUDE" as const };
  return {
    status: "EXCLUDED_NOT_INCLUDED" as const,
    reason: "NOT_INCLUDED" as const,
  };
}

function encode(value: unknown) {
  try {
    const result = JSON.stringify(value);
    if (result === undefined) throw invalid();
    return result;
  } catch (error) {
    if (error instanceof ContextSelectorMeasurementError) throw error;
    throw invalid(error);
  }
}

function validateId(value: string) {
  bounded(value);
}

function bounded(value: string) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > MAX_ID ||
    /\p{Cc}/u.test(value)
  )
    throw invalid();
  return value.trim();
}

function bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function percent(value: number, baseline: number) {
  return Number(((value / baseline) * 100).toFixed(2));
}

function compare(left: string, right: string) {
  return left.localeCompare(right, "en");
}

function invalid(cause?: unknown): ContextSelectorMeasurementError {
  return new ContextSelectorMeasurementError(
    cause === undefined ? undefined : { cause },
  );
}
