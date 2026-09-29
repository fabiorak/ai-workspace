import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeScopedProfileInstructions,
  validateScopedAgentProfileBundle,
  validateScopedInstructionBundle,
} from "../src/index.ts";
import { buildSyntheticAgentProfile } from "./synthetic-agent-profile.ts";

const general = { kind: "GENERAL" } as const;
function fixture() {
  const {
    projectId: _projectId,
    schemaVersion: _version,
    ...legacy
  } = buildSyntheticAgentProfile();
  void _projectId;
  void _version;
  const profile = { ...legacy, schemaVersion: 2, scope: general };
  const bundle = {
    schemaVersion: 2,
    ownerScope: general,
    sources: [
      "project-review-rules",
      "dependency-review-rules",
      "test-review-rules",
    ].map((id, index) => ({
      id,
      ownerScope: general,
      scope: index === 0 ? "GLOBAL" : "WORKSPACE",
      target: null,
      trust: "USER_CONFIGURED",
      sourceDigest: "a".repeat(64),
      rules: [
        {
          id: `rule-${index}`,
          kind: "CONSTRAINT",
          overridable: false,
          content: `Confirmed instruction ${index}`,
          position: 0,
        },
      ],
    })),
  };
  return { profile, bundle };
}

test("General composes configured rules with scope, provenance and profile budgets", () => {
  const { profile, bundle } = fixture();
  const result = composeScopedProfileInstructions(profile, bundle, {
    model: "model-balanced",
  });
  assert.deepEqual(result.instructions.scope, general);
  assert.equal("projectId" in result.instructions, false);
  assert.equal(result.selection.budgets.INSTRUCTIONS, 4096);
  assert.equal(result.instructions.rules.length, 3);
  assert.ok(
    result.instructions.rules.every(
      (rule) =>
        rule.status === "ACTIVE" &&
        rule.sourceTrust === "USER_CONFIGURED" &&
        rule.sourceDigest === "a".repeat(64),
    ),
  );
});

test("General refuses project config, project precedence, foreign sources and undeclared sources", () => {
  const { profile, bundle } = fixture();
  assert.throws(() =>
    validateScopedAgentProfileBundle(buildSyntheticAgentProfile(), general),
  );
  assert.throws(() =>
    validateScopedInstructionBundle({
      ...bundle,
      sources: bundle.sources.map((source) => ({
        ...source,
        scope: "PROJECT",
      })),
    }),
  );
  assert.throws(() =>
    validateScopedInstructionBundle({
      ...bundle,
      sources: bundle.sources.map((source) => ({
        ...source,
        ownerScope: { kind: "PROJECT", projectId: "foreign" },
      })),
    }),
  );
  assert.throws(() =>
    composeScopedProfileInstructions(
      profile,
      { ...bundle, sources: bundle.sources.slice(1) },
      { model: "model-balanced" },
    ),
  );
  assert.throws(() =>
    composeScopedProfileInstructions(profile, bundle, {
      model: "foreign-model",
    }),
  );
});

test("scope-aware composition reuses precedence and blocks conflicting constraints", () => {
  const { profile, bundle } = fixture();
  const conflict = {
    ...bundle,
    sources: bundle.sources.map((source) => ({
      ...source,
      rules: source.rules.map((rule) => ({ ...rule, id: "same-rule" })),
    })),
  };
  assert.throws(() =>
    composeScopedProfileInstructions(profile, conflict, {
      model: "model-balanced",
    }),
  );
  const preferences = {
    ...bundle,
    sources: bundle.sources.map((source, index) => ({
      ...source,
      scope: index === 2 ? "MODEL" : index === 1 ? "WORKSPACE" : "GLOBAL",
      target: index === 2 ? "model-balanced" : null,
      rules: source.rules.map((rule) => ({
        ...rule,
        id: "same-rule",
        kind: "PREFERENCE",
        overridable: true,
      })),
    })),
  };
  const result = composeScopedProfileInstructions(profile, preferences, {
    model: "model-balanced",
  });
  assert.equal(
    result.instructions.rules.find((rule) => rule.status === "ACTIVE")
      ?.sourceId,
    "test-review-rules",
  );
  assert.equal(
    result.instructions.rules.filter((rule) => rule.status === "OVERRIDDEN")
      .length,
    2,
  );
});

test("legacy project profile normalizes without changing the legacy source", () => {
  const legacy = buildSyntheticAgentProfile("actual-project");
  const before = JSON.stringify(legacy);
  const normalized = validateScopedAgentProfileBundle(legacy, {
    kind: "PROJECT",
    projectId: "actual-project",
  });
  assert.deepEqual(normalized.scope, {
    kind: "PROJECT",
    projectId: "actual-project",
  });
  assert.equal(JSON.stringify(legacy), before);
  assert.throws(() =>
    validateScopedAgentProfileBundle(legacy, {
      kind: "PROJECT",
      projectId: "other",
    }),
  );
});
