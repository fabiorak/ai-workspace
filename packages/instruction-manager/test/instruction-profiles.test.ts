import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AgentProfileError,
  encodeAgentProfileBundle,
  validateAgentProfileBundle,
} from "../src/index.ts";
import { buildSyntheticAgentProfile } from "./synthetic-agent-profile.ts";

type MutableProfile = {
  schemaVersion: number;
  agent: {
    allowedTools: string[];
    allowedModels: string[];
    skillIds: string[];
    preferredModels: string[];
    forbiddenTools: string[];
    version: string;
    description: string;
    context: { continuityBudgetBytes: number };
    unknown?: boolean;
  };
  skills: Array<{ requiresConfirmation: string[] }>;
};

function mutable(): MutableProfile {
  return structuredClone(
    buildSyntheticAgentProfile(),
  ) as unknown as MutableProfile;
}

describe("portable agent and skill profiles", () => {
  it("normalizes set ordering and round-trips canonically", () => {
    const input = mutable();
    input.agent.allowedTools.reverse();
    input.agent.allowedModels.reverse();
    input.agent.skillIds.reverse();
    input.skills.reverse();
    const value = validateAgentProfileBundle(input);
    assert.deepEqual(value.agent.allowedTools, ["read_file", "run_tests"]);
    assert.deepEqual(value.agent.preferredModels, [
      "model-balanced",
      "model-small",
    ]);
    assert.deepEqual(
      value.skills.map((skill) => skill.id),
      ["dependency-review", "test-review"],
    );
    const encoded = encodeAgentProfileBundle(value);
    assert.equal(encoded.endsWith("\n"), true);
    assert.equal(
      encodeAgentProfileBundle(JSON.parse(encoded) as unknown),
      encoded,
    );
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.skills), true);
  });

  it("rejects missing or unreferenced skills and incompatible models or tools", () => {
    const rejects = (mutate: (value: MutableProfile) => void) => {
      const value = mutable();
      mutate(value);
      assert.throws(() => validateAgentProfileBundle(value), AgentProfileError);
    };
    rejects((value) => value.skills.pop());
    rejects((value) => value.agent.skillIds.pop());
    rejects((value) => value.agent.preferredModels.push("unavailable-model"));
    rejects((value) => value.agent.forbiddenTools.push("read_file"));
    rejects((value) => value.agent.allowedTools.splice(0, 1));
    rejects((value) => value.skills[1]!.requiresConfirmation.splice(0, 1));
    rejects((value) => value.skills.push(value.skills[0]!));
  });

  it("rejects duplicates, unknown keys, unsupported versions, bad semver, and bounds without echo", () => {
    const canary = "PRIVATE-SYNTHETIC-PROFILE-CANARY";
    const cases = [
      (value: MutableProfile) => value.agent.allowedTools.push("read_file"),
      (value: MutableProfile) => (value.agent.unknown = true),
      (value: MutableProfile) => (value.schemaVersion = 2),
      (value: MutableProfile) => (value.agent.version = "latest"),
      (value: MutableProfile) =>
        (value.agent.description = `${canary}${"x".repeat(4_096)}`),
      (value: MutableProfile) =>
        (value.agent.context.continuityBudgetBytes = 0),
    ];
    for (const mutate of cases) {
      const value = mutable();
      mutate(value);
      assert.throws(
        () => validateAgentProfileBundle(value),
        (error: unknown) =>
          error instanceof AgentProfileError && !error.message.includes(canary),
      );
    }
  });
});
