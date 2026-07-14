import { createHash } from "node:crypto";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import {
  projectContextSelectors,
  type ContextSelectorDecision,
  type ContextSelectorInput,
  type ContextSelectorSection,
} from "./context-selectors.ts";
import { CONTINUITY_SECTION_ORDER } from "./sections.ts";

export const CONTINUITY_EVIDENCE_REPORT_SCHEMA_VERSION = 1;
export type ContinuityIntent =
  | "DIAGNOSTIC"
  | "REGRESSION"
  | "MIGRATION"
  | "REFACTOR"
  | "SECURITY"
  | "RELEASE";
export type ContinuityEvidenceAnchor = Readonly<{
  id: string;
  question: string;
  exactAnswer: string;
  section: ContextSelectorSection;
  requiredSourceIds: readonly string[];
}>;
export type ContinuityEvidenceManifest = Readonly<{
  schemaVersion: 1;
  scenarioId: string;
  intent: ContinuityIntent;
  projectId: string;
  workItemId: string;
  handoffId: string;
  handoffSha256: string;
  anchors: readonly ContinuityEvidenceAnchor[];
  expectedFirstAction: string;
}>;
export type ContinuityEvidenceScenario = Readonly<{
  manifest: ContinuityEvidenceManifest;
  handoff: Handoff;
}>;
export type ContinuityEvidencePolicy = Readonly<{
  label: "focused" | "floor-only" | "risk-aware";
  selectors: ContextSelectorInput;
}>;
export type ContinuityEvidenceBudget = Readonly<{
  label: string;
  exactBytes: number;
}>;
type SelectorStatus = ContextSelectorDecision["status"] | "BASELINE_FULL";
export type ContinuityAnchorResult = Readonly<{
  anchorId: string;
  section: ContextSelectorSection;
  status: "RETAINED" | "EXCLUDED_WITH_SECTION";
  selectorDecision: SelectorStatus;
  exactAnswerSha256: string;
  requiredSourceCount: number;
  retainedSourceCount: number;
  sourceCoveragePercent: number;
  reason: "EXACT_BYTES_AVAILABLE" | "SUPPORTING_SECTION_EXCLUDED";
}>;
export type ContinuityV2Accounting = Readonly<{
  sectionContentBytes: number;
  sourceTableBytes: number;
  serializedContinuityBytes: number;
  sourceCount: number;
  sourceIds: readonly string[];
  sourceTableSha256: string | null;
  losslessExpansion: true;
  deterministicOrdering: true;
}>;
export type ContinuityEvidenceObservation = Readonly<{
  scenarioId: string;
  intent: ContinuityIntent;
  policy: "baseline" | ContinuityEvidencePolicy["label"];
  handoffSha256: string;
  digestMismatchCount: 0;
  anchors: readonly ContinuityAnchorResult[];
  requiredAnswerCount: number;
  retainedAnswerCount: number;
  requiredAnswerRecallPercent: number;
  expectedFirstActionCount: 1;
  retainedFirstActionCount: 0 | 1;
  expectedFirstActionRetentionPercent: 0 | 100;
  requiredSourceCount: number;
  retainedSourceCount: number;
  requiredSourceCoveragePercent: number;
  selectedRelevantSectionCount: number;
  selectedExcessSectionCount: number;
  criticalMissCount: number;
  selectedSections: readonly ContextSelectorSection[];
  historicalV1CandidateBytes: number;
  schemaV2: ContinuityV2Accounting;
  corpusPreserving: boolean;
}>;
export type ContinuityEvidenceCorpusReport = Readonly<{
  schemaVersion: 1;
  scenarioCount: 6;
  baselineObservationCount: 6;
  policyObservationCount: 18;
  budgetObservationCount: 54;
  scenarios: readonly Readonly<{
    scenarioId: string;
    intent: ContinuityIntent;
    handoffSha256: string;
    requiredSections: readonly ContextSelectorSection[];
    baseline: ContinuityEvidenceObservation;
    policies: readonly ContinuityEvidenceObservation[];
  }>[];
  policySummary: readonly Readonly<{
    policy: ContinuityEvidencePolicy["label"];
    requiredAnswerCount: number;
    retainedAnswerCount: number;
    requiredAnswerRecallPercent: number;
    expectedFirstActionCount: number;
    retainedFirstActionCount: number;
    expectedFirstActionRetentionPercent: number;
    requiredSourceCount: number;
    retainedSourceCount: number;
    requiredSourceCoveragePercent: number;
    criticalMissCount: number;
    digestMismatchCount: 0;
    corpusPreserving: boolean;
  }>[];
  budgets: readonly Readonly<{
    scenarioId: string;
    policy: ContinuityEvidencePolicy["label"];
    budget: string;
    exactBytes: number;
    baselineV1Fits: boolean;
    policyV1Fits: boolean;
    baselineV2Fits: boolean;
    policyV2Fits: boolean;
    baselineV1HeadroomBytes: number;
    policyV1HeadroomBytes: number;
    baselineV2HeadroomBytes: number;
    policyV2HeadroomBytes: number;
  }>[];
  aggregate: Readonly<{
    baselineHistoricalV1CandidateBytes: number;
    policyHistoricalV1CandidateBytes: number;
    baselineSchemaV2SerializedBytes: number;
    policySchemaV2SerializedBytes: number;
    baselineV1FitCount: number;
    policyV1FitCount: number;
    baselineV2FitCount: number;
    policyV2FitCount: number;
  }>;
  measurementMethod: "EXACT_ANSWER_AND_SOURCE_AVAILABILITY_WITH_SEPARATE_V1_CANDIDATE_AND_V2_SERIALIZED_BYTES";
  interpretation: "EXACT_EVIDENCE_AVAILABILITY_NOT_ANSWER_CORRECTNESS_COMPREHENSION_RELEVANCE_OR_RESUME_SUCCESS";
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_SELECTOR_BUILDER_SCHEMA_GUI_OR_EXECUTION_CHANGE";
}>;

const INTENTS: readonly ContinuityIntent[] = Object.freeze([
  "DIAGNOSTIC",
  "REGRESSION",
  "MIGRATION",
  "REFACTOR",
  "SECURITY",
  "RELEASE",
]);
const OPTIONAL_SECTIONS: readonly ContextSelectorSection[] = Object.freeze([
  "selectedMemory",
  "knownFailures",
  "testState",
  "relevantFiles",
]);
const POLICY_LABELS: readonly ContinuityEvidencePolicy["label"][] =
  Object.freeze(["focused", "floor-only", "risk-aware"]);
const MAX_TEXT = 4_096;
const MAX_ID = 256;
const MAX_ANCHORS = 12;
const MAX_SOURCES = 100;
const MAX_BYTES = 1_000_000;

type Source = SectionMetadata["sources"][number];

export class ContinuityEvidenceMeasurementError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The continuity-evidence experiment is malformed, ambiguous, oversized, stale, or cross-scoped. Rebuild the bounded synthetic manifest and retry.",
      options,
    );
    this.name = "ContinuityEvidenceMeasurementError";
  }
}

export function continuityEvidenceHandoffDigest(handoff: Handoff): string {
  try {
    return sha256(encode(handoff));
  } catch (error) {
    throw invalid(error);
  }
}

export function continuityEvidenceSourceId(source: Source): string {
  try {
    return sourceId(normalizeSource(source));
  } catch (error) {
    if (error instanceof ContinuityEvidenceMeasurementError) throw error;
    throw invalid(error);
  }
}

export function measureContinuityEvidenceCorpus(
  scenariosInput: readonly ContinuityEvidenceScenario[],
  policiesInput: readonly ContinuityEvidencePolicy[],
  budgetsInput: readonly ContinuityEvidenceBudget[],
): ContinuityEvidenceCorpusReport {
  try {
    if (scenariosInput.length !== 6) throw invalid();
    const policies = validatePolicies(policiesInput);
    const budgets = validateBudgets(budgetsInput);
    const scenarioIds = new Set<string>();
    const intents = new Set<ContinuityIntent>();
    const scenarios = scenariosInput
      .map((scenario) => {
        const manifest = validateManifest(scenario);
        if (
          scenarioIds.has(manifest.scenarioId) ||
          intents.has(manifest.intent)
        )
          throw invalid();
        scenarioIds.add(manifest.scenarioId);
        intents.add(manifest.intent);
        const baseline = observation(scenario, manifest, "baseline", null);
        const policyResults = policies.map((policy) =>
          observation(scenario, manifest, policy.label, policy.selectors),
        );
        return Object.freeze({
          scenarioId: manifest.scenarioId,
          intent: manifest.intent,
          handoffSha256: manifest.handoffSha256,
          requiredSections: Object.freeze(
            [...new Set(manifest.anchors.map((anchor) => anchor.section))].sort(
              sectionCompare,
            ),
          ),
          baseline,
          policies: Object.freeze(policyResults),
        });
      })
      .sort((left, right) => compare(left.scenarioId, right.scenarioId));
    if (
      intents.size !== INTENTS.length ||
      INTENTS.some((value) => !intents.has(value))
    )
      throw invalid();
    validateOptionalCoverage(scenarios);

    const policySummary = policies.map((policy) => {
      const values = scenarios.map((scenario) =>
        scenario.policies.find((value) => value.policy === policy.label)!,
      );
      const requiredAnswerCount = sum(
        values.map((value) => value.requiredAnswerCount),
      );
      const retainedAnswerCount = sum(
        values.map((value) => value.retainedAnswerCount),
      );
      const expectedFirstActionCount = values.length;
      const retainedFirstActionCount = sum(
        values.map((value) => value.retainedFirstActionCount),
      );
      const requiredSourceCount = sum(
        values.map((value) => value.requiredSourceCount),
      );
      const retainedSourceCount = sum(
        values.map((value) => value.retainedSourceCount),
      );
      const criticalMissCount = sum(
        values.map((value) => value.criticalMissCount),
      );
      const corpusPreserving =
        retainedAnswerCount === requiredAnswerCount &&
        retainedFirstActionCount === expectedFirstActionCount &&
        retainedSourceCount === requiredSourceCount &&
        criticalMissCount === 0;
      return Object.freeze({
        policy: policy.label,
        requiredAnswerCount,
        retainedAnswerCount,
        requiredAnswerRecallPercent: percent(
          retainedAnswerCount,
          requiredAnswerCount,
        ),
        expectedFirstActionCount,
        retainedFirstActionCount,
        expectedFirstActionRetentionPercent: percent(
          retainedFirstActionCount,
          expectedFirstActionCount,
        ),
        requiredSourceCount,
        retainedSourceCount,
        requiredSourceCoveragePercent: percent(
          retainedSourceCount,
          requiredSourceCount,
        ),
        criticalMissCount,
        digestMismatchCount: 0 as const,
        corpusPreserving,
      });
    });

    const budgetResults = scenarios.flatMap((scenario) =>
      scenario.policies.flatMap((policy) =>
        budgets.map((budget) => ({
          scenarioId: scenario.scenarioId,
          policy: policy.policy as ContinuityEvidencePolicy["label"],
          budget: budget.label,
          exactBytes: budget.exactBytes,
          baselineV1Fits:
            scenario.baseline.historicalV1CandidateBytes <= budget.exactBytes,
          policyV1Fits: policy.historicalV1CandidateBytes <= budget.exactBytes,
          baselineV2Fits:
            scenario.baseline.schemaV2.serializedContinuityBytes <=
            budget.exactBytes,
          policyV2Fits:
            policy.schemaV2.serializedContinuityBytes <= budget.exactBytes,
          baselineV1HeadroomBytes:
            budget.exactBytes - scenario.baseline.historicalV1CandidateBytes,
          policyV1HeadroomBytes:
            budget.exactBytes - policy.historicalV1CandidateBytes,
          baselineV2HeadroomBytes:
            budget.exactBytes -
            scenario.baseline.schemaV2.serializedContinuityBytes,
          policyV2HeadroomBytes:
            budget.exactBytes - policy.schemaV2.serializedContinuityBytes,
        })),
      ),
    );
    const policyObservations = scenarios.flatMap((value) => value.policies);
    const baselineV1FitCount = budgetResults.filter(
      (value) => value.baselineV1Fits,
    ).length;
    const policyV1FitCount = budgetResults.filter(
      (value) => value.policyV1Fits,
    ).length;
    const baselineV2FitCount = budgetResults.filter(
      (value) => value.baselineV2Fits,
    ).length;
    const policyV2FitCount = budgetResults.filter(
      (value) => value.policyV2Fits,
    ).length;
    return Object.freeze({
      schemaVersion: CONTINUITY_EVIDENCE_REPORT_SCHEMA_VERSION,
      scenarioCount: 6 as const,
      baselineObservationCount: 6 as const,
      policyObservationCount: 18 as const,
      budgetObservationCount: 54 as const,
      scenarios: Object.freeze(scenarios),
      policySummary: Object.freeze(policySummary),
      budgets: Object.freeze(budgetResults),
      aggregate: Object.freeze({
        baselineHistoricalV1CandidateBytes: sum(
          scenarios.map((value) => value.baseline.historicalV1CandidateBytes),
        ),
        policyHistoricalV1CandidateBytes: sum(
          policyObservations.map((value) => value.historicalV1CandidateBytes),
        ),
        baselineSchemaV2SerializedBytes: sum(
          scenarios.map(
            (value) => value.baseline.schemaV2.serializedContinuityBytes,
          ),
        ),
        policySchemaV2SerializedBytes: sum(
          policyObservations.map(
            (value) => value.schemaV2.serializedContinuityBytes,
          ),
        ),
        baselineV1FitCount,
        policyV1FitCount,
        baselineV2FitCount,
        policyV2FitCount,
      }),
      measurementMethod:
        "EXACT_ANSWER_AND_SOURCE_AVAILABILITY_WITH_SEPARATE_V1_CANDIDATE_AND_V2_SERIALIZED_BYTES" as const,
      interpretation:
        "EXACT_EVIDENCE_AVAILABILITY_NOT_ANSWER_CORRECTNESS_COMPREHENSION_RELEVANCE_OR_RESUME_SUCCESS" as const,
      effect:
        "DEVELOPMENT_ONLY_NO_PRODUCTION_SELECTOR_BUILDER_SCHEMA_GUI_OR_EXECUTION_CHANGE" as const,
    });
  } catch (error) {
    if (error instanceof ContinuityEvidenceMeasurementError) throw error;
    throw invalid(error);
  }
}

function validateManifest(scenario: ContinuityEvidenceScenario) {
  const { manifest, handoff } = scenario;
  const rawAnchors: unknown = manifest.anchors;
  if (
    manifest.schemaVersion !== 1 ||
    !INTENTS.includes(manifest.intent) ||
    text(manifest.scenarioId, MAX_ID) !== manifest.scenarioId ||
    text(manifest.projectId, MAX_ID) !== manifest.projectId ||
    text(manifest.workItemId, MAX_ID) !== manifest.workItemId ||
    text(manifest.handoffId, MAX_ID) !== manifest.handoffId ||
    !digest(manifest.handoffSha256) ||
    manifest.projectId !== handoff.projectId ||
    manifest.workItemId !== handoff.workItemId ||
    manifest.handoffId !== handoff.id ||
    continuityEvidenceHandoffDigest(handoff) !== manifest.handoffSha256 ||
    !Array.isArray(rawAnchors) ||
    rawAnchors.length < 1 ||
    rawAnchors.length > MAX_ANCHORS ||
    text(manifest.expectedFirstAction, MAX_TEXT) !==
      manifest.expectedFirstAction ||
    manifest.expectedFirstAction !== handoff.sections.nextAction.value
  )
    throw invalid();
  const manifestAnchors = rawAnchors as readonly ContinuityEvidenceAnchor[];
  const ids = new Set<string>();
  const answers = new Set<string>();
  const anchors = manifestAnchors
    .map((anchor) => {
      const id = text(anchor.id, MAX_ID);
      const question = text(anchor.question, MAX_TEXT);
      const exactAnswer = text(anchor.exactAnswer, MAX_TEXT);
      if (
        ids.has(id) ||
        answers.has(exactAnswer) ||
        !CONTINUITY_SECTION_ORDER.includes(anchor.section) ||
        !Array.isArray(anchor.requiredSourceIds) ||
        anchor.requiredSourceIds.length < 1 ||
        anchor.requiredSourceIds.length > MAX_SOURCES
      )
        throw invalid();
      ids.add(id);
      answers.add(exactAnswer);
      const requiredSourceIds = anchor.requiredSourceIds.map((value) => {
        if (!sourceDigest(value)) throw invalid();
        return value;
      });
      if (new Set(requiredSourceIds).size !== requiredSourceIds.length)
        throw invalid();
      const declared = encode(handoff.sections[anchor.section].value);
      if (occurrences(declared, exactAnswer) !== 1) throw invalid();
      for (const section of CONTINUITY_SECTION_ORDER)
        if (
          section !== anchor.section &&
          occurrences(encode(handoff.sections[section].value), exactAnswer) !==
            0
        )
          throw invalid();
      const sectionSources = new Set(
        handoff.sections[anchor.section].metadata.sources.map((source) =>
          continuityEvidenceSourceId(source),
        ),
      );
      const referenceSources = new Set(
        handoff.sections.sourceReferences.value.map((source) =>
          continuityEvidenceSourceId(source),
        ),
      );
      if (
        requiredSourceIds.some(
          (value) => !sectionSources.has(value) || !referenceSources.has(value),
        )
      )
        throw invalid();
      return Object.freeze({
        id,
        question,
        exactAnswer,
        section: anchor.section,
        requiredSourceIds: Object.freeze([...requiredSourceIds].sort(compare)),
      });
    })
    .sort((left, right) => compare(left.id, right.id));
  if (!anchors.some((anchor) => OPTIONAL_SECTIONS.includes(anchor.section)))
    throw invalid();
  return Object.freeze({ ...manifest, anchors: Object.freeze(anchors) });
}

function observation(
  scenario: ContinuityEvidenceScenario,
  manifest: ContinuityEvidenceManifest,
  policy: ContinuityEvidenceObservation["policy"],
  selectors: ContextSelectorInput | null,
): ContinuityEvidenceObservation {
  const decisions =
    selectors === null
      ? CONTINUITY_SECTION_ORDER.map((section) => ({
          section,
          status: "BASELINE_FULL" as const,
          exactCandidateBytes: bytes(
            encode(scenario.handoff.sections[section]),
          ),
        }))
      : projectContextSelectors(scenario.handoff, selectors).decisions;
  const selectedSections = decisions
    .filter(
      (decision) =>
        decision.status === "SELECTED" || decision.status === "BASELINE_FULL",
    )
    .map((decision) => decision.section)
    .sort(sectionCompare);
  const selected = new Set(selectedSections);
  const requiredSources = new Set(
    manifest.anchors.flatMap((anchor) => anchor.requiredSourceIds),
  );
  const retainedSources = new Set<string>();
  const anchors = manifest.anchors.map((anchor) => {
    const decision = decisions.find(
      (value) => value.section === anchor.section,
    )!;
    const retained = selected.has(anchor.section);
    if (retained)
      for (const sourceIdValue of anchor.requiredSourceIds)
        retainedSources.add(sourceIdValue);
    return Object.freeze({
      anchorId: anchor.id,
      section: anchor.section,
      status: retained
        ? ("RETAINED" as const)
        : ("EXCLUDED_WITH_SECTION" as const),
      selectorDecision: decision.status,
      exactAnswerSha256: sha256(anchor.exactAnswer),
      requiredSourceCount: anchor.requiredSourceIds.length,
      retainedSourceCount: retained ? anchor.requiredSourceIds.length : 0,
      sourceCoveragePercent: retained ? 100 : 0,
      reason: retained
        ? ("EXACT_BYTES_AVAILABLE" as const)
        : ("SUPPORTING_SECTION_EXCLUDED" as const),
    });
  });
  const retainedAnswerCount = anchors.filter(
    (anchor) => anchor.status === "RETAINED",
  ).length;
  const retainedFirstActionCount = selected.has("nextAction") ? 1 : 0;
  const relevantSections = new Set<ContextSelectorSection>([
    ...manifest.anchors.map((anchor) => anchor.section),
    "nextAction",
    "sourceReferences",
  ]);
  const selectedRelevantSectionCount = selectedSections.filter((section) =>
    relevantSections.has(section),
  ).length;
  const selectedExcessSectionCount =
    selectedSections.length - selectedRelevantSectionCount;
  const requiredSourceCount = requiredSources.size;
  const retainedSourceCount = [...requiredSources].filter((value) =>
    retainedSources.has(value),
  ).length;
  const criticalMissCount =
    anchors.length -
    retainedAnswerCount +
    (1 - retainedFirstActionCount) +
    (requiredSourceCount - retainedSourceCount);
  const historicalV1CandidateBytes = sum(
    decisions
      .filter(
        (decision) =>
          decision.status === "SELECTED" || decision.status === "BASELINE_FULL",
      )
      .map((decision) => decision.exactCandidateBytes),
  );
  const schemaV2 = v2Accounting(scenario.handoff, selectedSections);
  return Object.freeze({
    scenarioId: manifest.scenarioId,
    intent: manifest.intent,
    policy,
    handoffSha256: manifest.handoffSha256,
    digestMismatchCount: 0 as const,
    anchors: Object.freeze(anchors),
    requiredAnswerCount: anchors.length,
    retainedAnswerCount,
    requiredAnswerRecallPercent: percent(retainedAnswerCount, anchors.length),
    expectedFirstActionCount: 1 as const,
    retainedFirstActionCount: retainedFirstActionCount as 0 | 1,
    expectedFirstActionRetentionPercent: (retainedFirstActionCount * 100) as
      0 | 100,
    requiredSourceCount,
    retainedSourceCount,
    requiredSourceCoveragePercent: percent(
      retainedSourceCount,
      requiredSourceCount,
    ),
    selectedRelevantSectionCount,
    selectedExcessSectionCount,
    criticalMissCount,
    selectedSections: Object.freeze(selectedSections),
    historicalV1CandidateBytes,
    schemaV2,
    corpusPreserving: criticalMissCount === 0,
  });
}

function v2Accounting(
  handoff: Handoff,
  selectedSections: readonly ContextSelectorSection[],
): ContinuityV2Accounting {
  const sourceMap = new Map<string, Source>();
  let sectionContentBytes = 0;
  for (const sectionName of selectedSections) {
    const section = handoff.sections[sectionName];
    const sources = section.metadata.sources
      .map(normalizeSource)
      .sort(compareSources);
    const sourceIds = sources.map((source) => sourceId(source));
    for (const source of sources) sourceMap.set(sourceId(source), source);
    const content = encode({
      metadata: {
        origin: section.metadata.origin,
        trust: section.metadata.trust,
        curation: section.metadata.curation,
        verification: section.metadata.verification,
        observation: section.metadata.observation,
        sourceIds,
      },
      value: section.value,
    });
    sectionContentBytes += bytes(content);
    const expanded = {
      metadata: {
        origin: section.metadata.origin,
        trust: section.metadata.trust,
        curation: section.metadata.curation,
        verification: section.metadata.verification,
        observation: section.metadata.observation,
        sources,
      },
      value: section.value,
    };
    const normalized = {
      metadata: { ...section.metadata, sources },
      value: section.value,
    };
    if (encode(expanded) !== encode(normalized)) throw invalid();
  }
  const entries = [...sourceMap.entries()]
    .map(([id, source]) => ({ id, source }))
    .sort((left, right) => compare(left.id, right.id));
  const tableContent =
    entries.length === 0
      ? null
      : encode({
          projectId: handoff.projectId,
          workItemId: handoff.workItemId,
          handoffId: handoff.id,
          entries,
        });
  const sourceTableBytes = tableContent === null ? 0 : bytes(tableContent);
  return Object.freeze({
    sectionContentBytes,
    sourceTableBytes,
    serializedContinuityBytes: sectionContentBytes + sourceTableBytes,
    sourceCount: entries.length,
    sourceIds: Object.freeze(entries.map((entry) => entry.id)),
    sourceTableSha256: tableContent === null ? null : sha256(tableContent),
    losslessExpansion: true as const,
    deterministicOrdering: true as const,
  });
}

function validatePolicies(input: readonly ContinuityEvidencePolicy[]) {
  if (input.length !== 3) throw invalid();
  const labels = input.map((value) => value.label);
  if (
    new Set(labels).size !== 3 ||
    POLICY_LABELS.some((value) => !labels.includes(value))
  )
    throw invalid();
  return Object.freeze(
    input
      .map((value) =>
        Object.freeze({
          label: value.label,
          selectors: value.selectors,
        }),
      )
      .sort((left, right) => compare(left.label, right.label)),
  );
}

function validateBudgets(input: readonly ContinuityEvidenceBudget[]) {
  if (input.length !== 3) throw invalid();
  const labels = new Set<string>();
  return Object.freeze(
    input
      .map((value) => {
        const label = text(value.label, MAX_ID);
        if (
          labels.has(label) ||
          !Number.isSafeInteger(value.exactBytes) ||
          value.exactBytes < 1 ||
          value.exactBytes > MAX_BYTES
        )
          throw invalid();
        labels.add(label);
        return Object.freeze({ label, exactBytes: value.exactBytes });
      })
      .sort((left, right) => compare(left.label, right.label)),
  );
}

function validateOptionalCoverage(
  scenarios: readonly Readonly<{
    requiredSections: readonly ContextSelectorSection[];
  }>[],
) {
  for (const section of OPTIONAL_SECTIONS) {
    if (
      !scenarios.some((scenario) => scenario.requiredSections.includes(section))
    )
      throw invalid();
    if (
      !scenarios.some(
        (scenario) => !scenario.requiredSections.includes(section),
      )
    )
      throw invalid();
  }
}

function normalizeSource(value: Source): Source {
  if (
    text(value.eventId, MAX_TEXT) !== value.eventId ||
    text(value.sessionId, MAX_TEXT) !== value.sessionId ||
    text(value.eventType, MAX_TEXT) !== value.eventType ||
    text(value.trust, MAX_TEXT) !== value.trust ||
    text(value.sourceArtifactId, MAX_TEXT) !== value.sourceArtifactId ||
    !Number.isSafeInteger(value.sourcePosition) ||
    value.sourcePosition < 0 ||
    text(value.sourceRecordHash, MAX_TEXT) !== value.sourceRecordHash
  )
    throw invalid();
  return Object.freeze({ ...value });
}

function sourceId(source: Source) {
  return `source:sha256:${sha256(
    encode([
      source.eventId,
      source.sessionId,
      source.eventType,
      source.trust,
      source.sourceArtifactId,
      source.sourcePosition,
      source.sourceRecordHash,
    ]),
  )}`;
}

function compareSources(left: Source, right: Source) {
  return compare(sourceId(left), sourceId(right));
}

function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    !value.trim() ||
    value.length > max ||
    /\p{Cc}/u.test(value)
  )
    throw invalid();
  return value;
}

function digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function sourceDigest(value: unknown): value is string {
  return (
    typeof value === "string" && /^source:sha256:[a-f0-9]{64}$/u.test(value)
  );
}

function occurrences(content: string, anchor: string) {
  let count = 0;
  let offset = 0;
  while ((offset = content.indexOf(anchor, offset)) !== -1) {
    count += 1;
    offset += anchor.length;
  }
  return count;
}

function sectionCompare(
  left: ContextSelectorSection,
  right: ContextSelectorSection,
) {
  return (
    CONTINUITY_SECTION_ORDER.indexOf(left) -
    CONTINUITY_SECTION_ORDER.indexOf(right)
  );
}

function encode(value: unknown) {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || bytes(encoded) > MAX_BYTES) throw invalid();
    return encoded;
  } catch (error) {
    if (error instanceof ContinuityEvidenceMeasurementError) throw error;
    throw invalid(error);
  }
}

function bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function percent(value: number, total: number) {
  return total === 0 ? 100 : Number(((value / total) * 100).toFixed(2));
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function compare(left: string, right: string) {
  return left.localeCompare(right, "en");
}

function invalid(cause?: unknown): ContinuityEvidenceMeasurementError {
  return new ContinuityEvidenceMeasurementError(
    cause === undefined ? undefined : { cause },
  );
}
