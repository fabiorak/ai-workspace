import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  composeScopedProfileInstructions,
  validateScopedAgentProfileBundle,
  validateScopedInstructionBundle,
  type ConfigurationScope,
} from "@ai-workspace/instruction-manager";
import { validateScopedModelDataPolicy } from "@ai-workspace/privacy-gateway";

import {
  buildGuidedTargetConfiguration,
  GUIDED_TARGET_CONFIGURATION_DEFAULTS,
  guidedTargetConfigurationDigest,
  recognizeGuidedTargetConfiguration,
  TargetConfigurationError,
} from "../src/index.ts";

const general = Object.freeze({ kind: "GENERAL" as const });
const project = Object.freeze({
  kind: "PROJECT" as const,
  projectId: "project-42",
});
const input = (overrides: Record<string, unknown> = {}) => ({
  scope: general,
  modelId: "model-b",
  rules: [
    "Use the supplied synthetic evidence.",
    "State when context is incomplete.",
  ],
  ...GUIDED_TARGET_CONFIGURATION_DEFAULTS,
  ...overrides,
});

/** Reads the files the way the turn's readers do: bytes, digest, validation. */
const readAsTurn = (
  files: ReturnType<typeof buildGuidedTargetConfiguration>["files"],
  scope: ConfigurationScope,
) => {
  const instructions = JSON.parse(files.instructions) as {
    ownerScope: unknown;
    source: Record<string, unknown>;
  };
  const profile = validateScopedAgentProfileBundle(
    JSON.parse(files.profile),
    scope,
  );
  const policy = validateScopedModelDataPolicy(JSON.parse(files.policy), scope);
  const bundle = validateScopedInstructionBundle(
    {
      schemaVersion: 2,
      ownerScope: instructions.ownerScope,
      sources: [
        {
          ...instructions.source,
          sourceDigest: createHash("sha256")
            .update(files.instructions)
            .digest("hex"),
        },
      ],
    },
    scope,
  );
  return { profile, policy, bundle };
};

describe("guided target configuration", () => {
  it("builds General files the turn's validators accept and compose", () => {
    const built = buildGuidedTargetConfiguration(input());
    const { profile, policy, bundle } = readAsTurn(built.files, general);
    const composed = composeScopedProfileInstructions(profile, bundle, {
      model: "model-b",
    });
    assert.deepEqual(
      composed.instructions.rules.map((rule) => rule.content),
      [
        "Use the supplied synthetic evidence.",
        "State when context is incomplete.",
      ],
    );
    assert.deepEqual(composed.selection.budgets, {
      CONTINUITY: 65_536,
      INSTRUCTIONS: 16_384,
    });
    assert.equal(policy.maximumDataClass, "CONFIDENTIAL");
    assert.deepEqual(policy.assertions, []);
    assert.equal(policy.modelId, "model-b");
    assert.equal(bundle.sources[0]!.scope, "WORKSPACE");
    assert.equal(built.digest, guidedTargetConfigurationDigest(built.files));
  });

  it("builds project files owned by that project only", () => {
    const built = buildGuidedTargetConfiguration(input({ scope: project }));
    const { bundle } = readAsTurn(built.files, project);
    assert.equal(bundle.sources[0]!.scope, "PROJECT");
    assert.throws(() => readAsTurn(built.files, general));
    assert.throws(() =>
      readAsTurn(built.files, { kind: "PROJECT", projectId: "project-7" }),
    );
  });

  it("is deterministic, and any chosen field changes the digest", () => {
    const first = buildGuidedTargetConfiguration(input());
    assert.deepEqual(buildGuidedTargetConfiguration(input()), first);
    for (const change of [
      { modelId: "model-c" },
      { rules: ["Answer briefly."] },
      { continuityBudgetBytes: 4_096 },
      { instructionBudgetBytes: 8_192 },
      { scope: project },
    ])
      assert.notEqual(
        buildGuidedTargetConfiguration(input(change)).digest,
        first.digest,
      );
  });

  it("recognizes its own files and nothing edited by hand", () => {
    const built = buildGuidedTargetConfiguration(input({ scope: project }));
    assert.deepEqual(recognizeGuidedTargetConfiguration(built.files), {
      scope: project,
      modelId: "model-b",
      rules: built.input.rules,
      ...GUIDED_TARGET_CONFIGURATION_DEFAULTS,
    });
    const edited = {
      ...built.files,
      policy: built.files.policy.replace("CONFIDENTIAL", "INTERNAL"),
    };
    assert.equal(recognizeGuidedTargetConfiguration(edited), null);
    assert.equal(
      recognizeGuidedTargetConfiguration({
        ...built.files,
        profile: built.files.profile.replace("\n", "\n "),
      }),
      null,
    );
    assert.equal(
      recognizeGuidedTargetConfiguration({ ...built.files, profile: "{" }),
      null,
    );
  });

  it("refuses incomplete or unsafe input with a recovery message", () => {
    const refusals: Record<string, unknown>[] = [
      { rules: [] },
      { rules: [""] },
      { rules: ["two\nlines"] },
      { rules: [" padded"] },
      { rules: ["x".repeat(8_193)] },
      { rules: Array.from({ length: 101 }, (_, index) => `Rule ${index}`) },
      { rules: ["-----BEGIN PRIVATE KEY-----"] },
      { modelId: "" },
      { modelId: "model\tb" },
      { scope: { kind: "PROJECT" } },
      { scope: { kind: "GENERAL", projectId: "project-42" } },
      { continuityBudgetBytes: 0 },
      { instructionBudgetBytes: 1_000_001 },
      { instructionBudgetBytes: 1.5 },
      { extra: true },
    ];
    for (const refusal of refusals)
      assert.throws(
        () => buildGuidedTargetConfiguration(input(refusal)),
        TargetConfigurationError,
        JSON.stringify(refusal),
      );
  });

  it("refuses rules that cannot fit the instruction budget", () => {
    assert.throws(
      () =>
        buildGuidedTargetConfiguration(input({ instructionBudgetBytes: 512 })),
      /instruction budget/u,
    );
  });
});
