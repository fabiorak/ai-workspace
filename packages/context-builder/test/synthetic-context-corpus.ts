import type { WorkItemSource } from "@ai-workspace/core";
import type { Handoff, SectionMetadata } from "@ai-workspace/handoff";
import { composeInstructions } from "@ai-workspace/instruction-manager";
import {
  buildContextPackV1,
  measureContextPackCorpus,
  type ContextPackCorpusReport,
  type ContextPackCorpusSample,
} from "../src/index.ts";

const PROJECT_ID = "synthetic-context-project";
const WORK_ITEM_ID = "synthetic-context-work-item";

export const SYNTHETIC_CONTINUITY_PROFILES = {
  compact: { payloadBytes: 32, listItems: 1 },
  working: { payloadBytes: 256, listItems: 4 },
  extended: { payloadBytes: 1_024, listItems: 16 },
} as const;
const INSTRUCTION_PROFILES = {
  none: { ruleCount: 0, payloadBytes: 0 },
  focused: { ruleCount: 4, payloadBytes: 64 },
  broad: { ruleCount: 16, payloadBytes: 256 },
} as const;
export const SYNTHETIC_BUDGET_PROFILES = {
  constrained: { CONTINUITY: 64, INSTRUCTIONS: 64 },
  standard: { CONTINUITY: 4_096, INSTRUCTIONS: 2_048 },
  generous: { CONTINUITY: 100_000, INSTRUCTIONS: 100_000 },
} as const;

export function buildSyntheticContextCorpus(): readonly ContextPackCorpusSample[] {
  const samples: ContextPackCorpusSample[] = [];
  for (const [continuityName, continuity] of Object.entries(
    SYNTHETIC_CONTINUITY_PROFILES,
  ))
    for (const [instructionName, instruction] of Object.entries(
      INSTRUCTION_PROFILES,
    ))
      for (const [budgetName, budgets] of Object.entries(
        SYNTHETIC_BUDGET_PROFILES,
      )) {
        const handoff = syntheticHandoff(
          continuityName,
          continuity.payloadBytes,
          continuity.listItems,
        );
        samples.push(
          Object.freeze({
            label: `${continuityName}-${instructionName}-${budgetName}`,
            dimensions: Object.freeze({
              continuity: continuityName,
              instructions: instructionName,
              budget: budgetName,
            }),
            preview: buildContextPackV1({
              handoff,
              ...(instruction.ruleCount === 0
                ? {}
                : {
                    instructions: syntheticInstructions(
                      instructionName,
                      instruction.ruleCount,
                      instruction.payloadBytes,
                    ),
                  }),
              budgets,
            }),
          }),
        );
      }
  return Object.freeze(samples);
}

export function buildSyntheticContextCorpusReport(): ContextPackCorpusReport {
  return measureContextPackCorpus(buildSyntheticContextCorpus());
}

export function buildSyntheticContinuityHandoff(
  profile: keyof typeof SYNTHETIC_CONTINUITY_PROFILES,
): Handoff {
  const value = SYNTHETIC_CONTINUITY_PROFILES[profile];
  return syntheticHandoff(profile, value.payloadBytes, value.listItems);
}

export function buildSyntheticContinuityBudgets() {
  return Object.freeze(
    Object.entries(SYNTHETIC_BUDGET_PROFILES).map(([label, value]) =>
      Object.freeze({ label, exactBytes: value.CONTINUITY }),
    ),
  );
}

function syntheticHandoff(
  profile: string,
  payloadBytes: number,
  listItems: number,
): Handoff {
  const source = syntheticSource();
  const metadata = (
    origin: SectionMetadata["origin"],
    trust: SectionMetadata["trust"],
  ): SectionMetadata =>
    Object.freeze({
      origin,
      trust,
      curation: trust === "USER_CURATED" ? "USER_CURATED" : "NONE",
      verification: "UNVERIFIED",
      observation: origin === "REPOSITORY_OBSERVATION" ? "OBSERVED" : "DERIVED",
      sources: Object.freeze([source]),
    });
  const content = payload("c", payloadBytes);
  const memory = Object.freeze(
    Array.from({ length: listItems }, (_, index) =>
      Object.freeze({
        id: `memory-${profile}-${index.toString().padStart(2, "0")}`,
        type: index % 2 === 0 ? ("DECISION" as const) : ("CONSTRAINT" as const),
        content: `Synthetic memory ${index}: ${content}`,
        verification: "UNVERIFIED" as const,
        confidence: "UNASSESSED" as const,
      }),
    ),
  );
  const files = Object.freeze(
    Array.from(
      { length: listItems },
      (_, index) =>
        `src/synthetic-${profile}-${index.toString().padStart(2, "0")}.ts`,
    ),
  );
  return Object.freeze({
    schemaVersion: 1,
    id: `handoff-${profile}`,
    projectId: PROJECT_ID,
    workItemId: WORK_ITEM_ID,
    predecessorId: null,
    createdBy: "LOCAL_USER",
    createdAt: "2026-07-13T00:00:00.000Z",
    sections: Object.freeze({
      objective: Object.freeze({
        metadata: metadata("WORK_ITEM", "USER_CURATED"),
        value: `Continue the ${profile} synthetic task: ${content}`,
      }),
      repository: Object.freeze({
        metadata: metadata("REPOSITORY_OBSERVATION", "OBSERVED"),
        value: Object.freeze({
          branch: "main",
          head: "a".repeat(40),
          dirty: true,
          changedPaths: files,
        }),
      }),
      selectedMemory: Object.freeze({
        metadata: metadata("ACTIVE_MEMORY", "USER_CURATED"),
        value: memory,
      }),
      knownFailures: Object.freeze({
        metadata: metadata("ACTIVE_MEMORY", "USER_CURATED"),
        value: Object.freeze(memory.filter((_, index) => index % 3 === 0)),
      }),
      testState: Object.freeze({
        metadata: metadata("USER_INPUT", "USER_CURATED"),
        value: Object.freeze([
          Object.freeze({
            command: `npm run synthetic-${profile}`,
            outcome: "NOT_RUN" as const,
            observedAt: null,
          }),
        ]),
      }),
      relevantFiles: Object.freeze({
        metadata: metadata("USER_INPUT", "USER_CURATED"),
        value: files,
      }),
      nextAction: Object.freeze({
        metadata: metadata("USER_INPUT", "USER_CURATED"),
        value: `Inspect the next synthetic boundary: ${content}`,
      }),
      sourceReferences: Object.freeze({
        metadata: metadata("CANONICAL_EVENT", "UNTRUSTED"),
        value: Object.freeze([source]),
      }),
    }),
  });
}

function syntheticInstructions(
  profile: string,
  ruleCount: number,
  payloadBytes: number,
) {
  return composeInstructions(
    {
      schemaVersion: 1,
      projectId: PROJECT_ID,
      sources: [
        {
          id: `synthetic-${profile}-instructions`,
          projectId: PROJECT_ID,
          scope: "PROJECT",
          target: null,
          trust: "USER_CONFIGURED",
          sourceDigest: profile.at(0)!.repeat(64),
          rules: Array.from({ length: ruleCount }, (_, index) => ({
            id: `synthetic-rule-${index.toString().padStart(2, "0")}`,
            kind: index % 3 === 0 ? "CONSTRAINT" : "PREFERENCE",
            overridable: index % 3 !== 0,
            content: `Synthetic instruction ${index}: ${payload("i", payloadBytes)}`,
            position: index,
          })),
        },
      ],
    },
    { projectId: PROJECT_ID },
  );
}

function syntheticSource(): WorkItemSource {
  return Object.freeze({
    eventId: "synthetic-event-0001",
    sessionId: "synthetic-session-0001",
    eventType: "USER_MESSAGE",
    trust: "UNTRUSTED",
    sourceArtifactId: "artifact://sha256/" + "b".repeat(64),
    sourcePosition: 0,
    sourceRecordHash: "c".repeat(64),
  });
}

function payload(character: string, exactBytes: number) {
  return character.repeat(exactBytes);
}
