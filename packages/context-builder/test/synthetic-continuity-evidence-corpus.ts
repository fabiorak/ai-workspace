import type { WorkItemSource } from "@ai-workspace/core";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import {
  continuityEvidenceHandoffDigest,
  continuityEvidenceSourceId,
  type ContextSelectorSection,
  type ContinuityEvidenceAnchor,
  type ContinuityEvidenceBudget,
  type ContinuityEvidencePolicy,
  type ContinuityEvidenceScenario,
  type ContinuityIntent,
} from "../src/index.ts";

export const SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES: readonly ContinuityEvidencePolicy[] =
  Object.freeze([
    Object.freeze({
      label: "focused",
      selectors: Object.freeze({
        include: Object.freeze([
          "handoff.test_state",
          "handoff.relevant_files",
        ]),
        exclude: Object.freeze([]),
      }),
    }),
    Object.freeze({
      label: "floor-only",
      selectors: Object.freeze({
        include: Object.freeze(["handoff.objective"]),
        exclude: Object.freeze([]),
      }),
    }),
    Object.freeze({
      label: "risk-aware",
      selectors: Object.freeze({
        include: Object.freeze([
          "handoff.selected_memory",
          "handoff.known_failures",
          "handoff.test_state",
        ]),
        exclude: Object.freeze([]),
      }),
    }),
  ]);

export const SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS: readonly ContinuityEvidenceBudget[] =
  Object.freeze([
    Object.freeze({ label: "constrained", exactBytes: 64 }),
    Object.freeze({ label: "standard", exactBytes: 4_096 }),
    Object.freeze({ label: "generous", exactBytes: 100_000 }),
  ]);

const DEFINITIONS: readonly Readonly<{
  intent: ContinuityIntent;
  required: readonly Readonly<{
    section: "selectedMemory" | "knownFailures" | "testState" | "relevantFiles";
    answer: string;
    question: string;
  }>[];
}>[] = Object.freeze([
  Object.freeze({
    intent: "DIAGNOSTIC",
    required: Object.freeze([
      Object.freeze({
        section: "knownFailures",
        answer: "DIAGNOSTIC-SYNTHETIC-FAILURE-PORT-4310",
        question: "Which synthetic failure must be reproduced?",
      }),
      Object.freeze({
        section: "testState",
        answer: "diagnostic:probe:pending",
        question: "Which synthetic diagnostic probe remains pending?",
      }),
    ]),
  }),
  Object.freeze({
    intent: "REGRESSION",
    required: Object.freeze([
      Object.freeze({
        section: "testState",
        answer: "regression:unicode:caffè-☕",
        question: "Which exact Unicode regression check failed?",
      }),
      Object.freeze({
        section: "relevantFiles",
        answer: "src/synthetic/regression-boundary.ts",
        question: "Which synthetic file contains the regression boundary?",
      }),
    ]),
  }),
  Object.freeze({
    intent: "MIGRATION",
    required: Object.freeze([
      Object.freeze({
        section: "selectedMemory",
        answer: "MIGRATION-SYNTHETIC-KEEP-V1-READER",
        question: "Which compatibility constraint must the migration preserve?",
      }),
      Object.freeze({
        section: "relevantFiles",
        answer: "src/synthetic/migration-codec.ts",
        question: "Which synthetic codec is the migration target?",
      }),
    ]),
  }),
  Object.freeze({
    intent: "REFACTOR",
    required: Object.freeze([
      Object.freeze({
        section: "selectedMemory",
        answer: "REFACTOR-SYNTHETIC-PRESERVE-ORDER-A-B-C",
        question: "Which ordering invariant must the refactor preserve?",
      }),
    ]),
  }),
  Object.freeze({
    intent: "SECURITY",
    required: Object.freeze([
      Object.freeze({
        section: "knownFailures",
        answer: "SECURITY-SYNTHETIC-REJECT-CROSS-SCOPE",
        question: "Which synthetic security failure must remain closed?",
      }),
    ]),
  }),
  Object.freeze({
    intent: "RELEASE",
    required: Object.freeze([
      Object.freeze({
        section: "testState",
        answer: "release:synthetic:gate-not-run",
        question: "Which synthetic release gate is not yet run?",
      }),
    ]),
  }),
]);

export function buildSyntheticContinuityEvidenceCorpus(): readonly ContinuityEvidenceScenario[] {
  return Object.freeze(DEFINITIONS.map(buildScenario));
}

function buildScenario(
  definition: (typeof DEFINITIONS)[number],
): ContinuityEvidenceScenario {
  const slug = definition.intent.toLowerCase();
  const projectId = `synthetic-evidence-${slug}-project`;
  const workItemId = `synthetic-evidence-${slug}-work-item`;
  const handoffId = `synthetic-evidence-${slug}-handoff`;
  const sources = Object.fromEntries(
    [
      "objective",
      "repository",
      "selectedMemory",
      "knownFailures",
      "testState",
      "relevantFiles",
      "nextAction",
      "sourceReferences",
    ].map((section, index) => [section, source(slug, section, index)]),
  ) as Record<ContextSelectorSection, WorkItemSource>;
  const answer = (section: ContextSelectorSection, fallback: string) =>
    definition.required.find((value) => value.section === section)?.answer ??
    fallback;
  const metadata = (
    section: ContextSelectorSection,
    origin: SectionMetadata["origin"],
    trust: SectionMetadata["trust"],
  ): SectionMetadata =>
    Object.freeze({
      origin,
      trust,
      curation: trust === "USER_CURATED" ? "USER_CURATED" : "NONE",
      verification: "UNVERIFIED",
      observation: origin === "REPOSITORY_OBSERVATION" ? "OBSERVED" : "DERIVED",
      sources: Object.freeze(
        section === "objective"
          ? [sources.objective]
          : [sources[section], sources.objective],
      ),
    });
  const expectedFirstAction = `Run the ${slug} synthetic continuation step exactly once.`;
  const handoff: Handoff = Object.freeze({
    schemaVersion: 1,
    id: handoffId,
    projectId,
    workItemId,
    predecessorId: null,
    createdBy: "LOCAL_USER",
    createdAt: "2026-07-14T00:00:00.000Z",
    sections: Object.freeze({
      objective: Object.freeze({
        metadata: metadata("objective", "WORK_ITEM", "USER_CURATED"),
        value: `Continue the bounded ${slug} synthetic scenario.`,
      }),
      repository: Object.freeze({
        metadata: metadata("repository", "REPOSITORY_OBSERVATION", "OBSERVED"),
        value: Object.freeze({
          branch: `synthetic/${slug}`,
          head: definition.intent.at(0)!.toLowerCase().repeat(40),
          dirty: true,
          changedPaths: Object.freeze([`src/synthetic/${slug}-workspace.ts`]),
        }),
      }),
      selectedMemory: Object.freeze({
        metadata: metadata("selectedMemory", "ACTIVE_MEMORY", "USER_CURATED"),
        value: Object.freeze([
          Object.freeze({
            id: `memory-${slug}`,
            type: "CONSTRAINT" as const,
            content: answer(
              "selectedMemory",
              `${definition.intent}-SYNTHETIC-OPTIONAL-MEMORY-NOT-REQUIRED`,
            ),
            verification: "UNVERIFIED" as const,
            confidence: "UNASSESSED" as const,
          }),
        ]),
      }),
      knownFailures: Object.freeze({
        metadata: metadata("knownFailures", "ACTIVE_MEMORY", "USER_CURATED"),
        value: Object.freeze([
          Object.freeze({
            id: `failure-${slug}`,
            type: "FAILURE" as const,
            content: answer(
              "knownFailures",
              `${definition.intent}-SYNTHETIC-OPTIONAL-FAILURE-NOT-REQUIRED`,
            ),
            verification: "UNVERIFIED" as const,
            confidence: "UNASSESSED" as const,
          }),
        ]),
      }),
      testState: Object.freeze({
        metadata: metadata("testState", "USER_INPUT", "USER_CURATED"),
        value: Object.freeze([
          Object.freeze({
            command: answer(
              "testState",
              `${slug}:synthetic:optional-test-not-required`,
            ),
            outcome: "NOT_RUN" as const,
            observedAt: null,
          }),
        ]),
      }),
      relevantFiles: Object.freeze({
        metadata: metadata("relevantFiles", "USER_INPUT", "USER_CURATED"),
        value: Object.freeze([
          answer(
            "relevantFiles",
            `src/synthetic/${slug}-optional-not-required.ts`,
          ),
        ]),
      }),
      nextAction: Object.freeze({
        metadata: metadata("nextAction", "USER_INPUT", "USER_CURATED"),
        value: expectedFirstAction,
      }),
      sourceReferences: Object.freeze({
        metadata: metadata("sourceReferences", "CANONICAL_EVENT", "UNTRUSTED"),
        value: Object.freeze(
          Object.values(sources).sort((left, right) =>
            continuityEvidenceSourceId(left).localeCompare(
              continuityEvidenceSourceId(right),
              "en",
            ),
          ),
        ),
      }),
    }),
  });
  const anchors: readonly ContinuityEvidenceAnchor[] = Object.freeze(
    definition.required.map((value, index) =>
      Object.freeze({
        id: `${slug}-anchor-${index + 1}`,
        question: value.question,
        exactAnswer: value.answer,
        section: value.section,
        requiredSourceIds: Object.freeze(
          [sources[value.section], sources.objective].map((source) =>
            continuityEvidenceSourceId(source),
          ),
        ),
      }),
    ),
  );
  return Object.freeze({
    handoff,
    manifest: Object.freeze({
      schemaVersion: 1,
      scenarioId: `scenario-${slug}`,
      intent: definition.intent,
      projectId,
      workItemId,
      handoffId,
      handoffSha256: continuityEvidenceHandoffDigest(handoff),
      anchors,
      expectedFirstAction,
    }),
  });
}

function source(
  slug: string,
  section: string,
  position: number,
): WorkItemSource {
  return Object.freeze({
    eventId: `synthetic-${slug}-${section}-event`,
    sessionId: `synthetic-${slug}-session`,
    eventType: "USER_MESSAGE",
    trust: "UNTRUSTED",
    sourceArtifactId: `artifact://sha256/${(position + 1).toString(16).repeat(64).slice(0, 64)}`,
    sourcePosition: position,
    sourceRecordHash: (position + 9).toString(16).repeat(64).slice(0, 64),
  });
}
