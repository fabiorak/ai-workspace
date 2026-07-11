import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeInstructions,
  encodeEffectiveInstructions,
  InstructionError,
} from "../src/index.ts";

const source = (
  id: string,
  scope: string,
  rules: readonly Record<string, unknown>[],
  target: string | null = null,
) => ({
  id,
  projectId: "project",
  scope,
  target,
  trust: "USER_CONFIGURED",
  sourceDigest: id.at(0)!.repeat(64),
  rules,
});
const rule = (
  id: string,
  content: string,
  position = 0,
  kind: "CONSTRAINT" | "PREFERENCE" = "PREFERENCE",
) => ({ id, kind, overridable: kind === "PREFERENCE", content, position });
const bundle = {
  schemaVersion: 1,
  projectId: "project",
  sources: [
    source("aaa", "GLOBAL", [
      rule("language", "Prefer TypeScript"),
      rule("no-secrets", "Never disclose secrets", 1, "CONSTRAINT"),
    ]),
    source("bbb", "PROJECT", [
      rule("language", "Prefer Rust"),
      rule("no-secrets", "Disclose secrets", 1, "CONSTRAINT"),
    ]),
    source("ccc", "MODEL", [rule("format", "Use JSON")], "codex"),
  ],
};

describe("instruction composition", () => {
  it("applies preference precedence and rejects constraint replacement visibly", () => {
    const result = composeInstructions(bundle, {
      projectId: "project",
      model: "codex",
    });
    assert.deepEqual(
      result.rules.map(({ ruleId, status, reason }) => ({
        ruleId,
        status,
        reason,
      })),
      [
        {
          ruleId: "language",
          status: "OVERRIDDEN",
          reason: "OVERRIDDEN_BY_HIGHER_SCOPE",
        },
        {
          ruleId: "no-secrets",
          status: "ACTIVE",
          reason: "NON_OVERRIDABLE_CONSTRAINT",
        },
        { ruleId: "language", status: "ACTIVE", reason: "HIGHEST_PRECEDENCE" },
        {
          ruleId: "no-secrets",
          status: "REJECTED",
          reason: "FORBIDDEN_CONSTRAINT_OVERRIDE",
        },
        { ruleId: "format", status: "ACTIVE", reason: "HIGHEST_PRECEDENCE" },
      ],
    );
    assert.equal(
      result.enforcement,
      "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY",
    );
  });

  it("excludes nonmatching targeted sources with a reason", () => {
    const result = composeInstructions(bundle, { projectId: "project" });
    const targeted = result.rules.find((value) => value.sourceId === "ccc");
    assert.equal(targeted?.status, "EXCLUDED");
    assert.equal(targeted?.reason, "TARGET_NOT_SELECTED");
  });

  it("is deterministic across source and rule input permutations", () => {
    const first = composeInstructions(bundle, {
      projectId: "project",
      model: "codex",
    });
    const permuted = {
      ...bundle,
      sources: [...bundle.sources]
        .reverse()
        .map((value) => ({ ...value, rules: [...value.rules].reverse() })),
    };
    assert.equal(
      encodeEffectiveInstructions(first),
      encodeEffectiveInstructions(
        composeInstructions(permuted, { projectId: "project", model: "codex" }),
      ),
    );
  });

  it("fails closed on equal-scope preference ambiguity and kind conflicts", () => {
    assert.throws(
      () =>
        composeInstructions(
          {
            ...bundle,
            sources: [
              source("aaa", "PROJECT", [rule("language", "one")]),
              source("bbb", "PROJECT", [rule("language", "two")]),
            ],
          },
          { projectId: "project" },
        ),
      InstructionError,
    );
    assert.throws(
      () =>
        composeInstructions(
          {
            ...bundle,
            sources: [
              source("aaa", "GLOBAL", [rule("same", "one")]),
              source("bbb", "PROJECT", [rule("same", "two", 0, "CONSTRAINT")]),
            ],
          },
          { projectId: "project" },
        ),
      InstructionError,
    );
  });
});
