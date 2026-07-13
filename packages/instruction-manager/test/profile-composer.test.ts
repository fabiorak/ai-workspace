import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeProfileInstructions,
  ProfileCompositionError,
  type InstructionBundle,
} from "../src/index.ts";
import { buildSyntheticAgentProfile } from "./synthetic-agent-profile.ts";

function instructions(projectId = "synthetic-project"): InstructionBundle {
  const source = (id: string, position: number) => ({
    id,
    projectId,
    scope: "PROJECT" as const,
    target: null,
    trust: "USER_CONFIGURED" as const,
    sourceDigest: String(position).padStart(64, "0"),
    rules: [
      {
        id: `rule-${position}`,
        kind: "CONSTRAINT" as const,
        overridable: false,
        content: `Synthetic rule ${position}`,
        position,
      },
    ],
  });
  return {
    schemaVersion: 1,
    projectId,
    sources: [
      source("test-review-rules", 2),
      source("project-review-rules", 0),
      source("dependency-review-rules", 1),
    ],
  };
}

describe("profile-governed instruction composition", () => {
  it("derives the agent and budgets while preserving source declarations", () => {
    const value = composeProfileInstructions(
      buildSyntheticAgentProfile(),
      instructions(),
      { model: "model-balanced", task: "review-change" },
    );
    assert.deepEqual(value.selection.target, {
      model: "model-balanced",
      agent: "review-agent",
      task: "review-change",
    });
    assert.deepEqual(value.selection.budgets, {
      CONTINUITY: 16_384,
      INSTRUCTIONS: 4_096,
    });
    assert.deepEqual(
      value.selection.instructionSources.map((source) => source.sourceId),
      ["dependency-review-rules", "project-review-rules", "test-review-rules"],
    );
    assert.deepEqual(value.instructions.target, value.selection.target);
    assert.equal(
      value.instructions.rules.every((rule) => rule.sourceDigest),
      true,
    );
    assert.equal(Object.isFrozen(value.selection), true);
  });

  it("preserves shared declaration provenance once", () => {
    const baseProfile = buildSyntheticAgentProfile();
    const profile = {
      ...baseProfile,
      skills: baseProfile.skills.map((skill, index) =>
        index === 0
          ? { ...skill, instructionSourceIds: ["project-review-rules"] }
          : skill,
      ),
    };
    const baseBundle = instructions();
    const bundle = {
      ...baseBundle,
      sources: baseBundle.sources.filter(
        (source) => source.id !== "dependency-review-rules",
      ),
    };
    const value = composeProfileInstructions(profile, bundle, {
      model: "model-small",
    });
    assert.deepEqual(value.selection.instructionSources[0], {
      sourceId: "project-review-rules",
      declaredBy: ["AGENT:review-agent", "SKILL:dependency-review"],
    });
  });

  it("rejects missing, extra, foreign, or model-incompatible selections without echo", () => {
    const canary = "PRIVATE-SYNTHETIC-COMPOSITION-CANARY";
    const cases = [
      () => {
        const value = instructions();
        return { ...value, sources: value.sources.slice(1) };
      },
      () => {
        const value = instructions();
        return {
          ...value,
          sources: [
            ...value.sources,
            {
              ...value.sources[0]!,
              id: canary,
              sourceDigest: "9".repeat(64),
            },
          ],
        };
      },
      () => instructions("foreign-project"),
    ];
    for (const instructionBundle of cases)
      assert.throws(
        () =>
          composeProfileInstructions(
            buildSyntheticAgentProfile(),
            instructionBundle(),
            { model: "model-balanced" },
          ),
        (error: unknown) =>
          error instanceof ProfileCompositionError &&
          !error.message.includes(canary),
      );
    assert.throws(
      () =>
        composeProfileInstructions(
          buildSyntheticAgentProfile(),
          instructions(),
          { model: "unavailable-model" },
        ),
      ProfileCompositionError,
    );
  });
});
