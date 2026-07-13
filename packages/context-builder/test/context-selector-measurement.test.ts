import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  buildContextPackV1,
  CONTEXT_SELECTOR_SAFETY_FLOOR,
  ContextSelectorMeasurementError,
  measureContextSelectorCorpus,
  projectContextSelectors,
  type ContextSelectorCorpusCase,
  type ContextSelectorInput,
} from "../src/index.ts";
import {
  buildSyntheticContinuityBudgets,
  buildSyntheticContinuityHandoff,
  SYNTHETIC_CONTINUITY_PROFILES,
} from "./synthetic-context-corpus.ts";

const POLICIES: Readonly<Record<string, ContextSelectorInput>> = {
  focused: {
    include: ["handoff.test_state", "handoff.relevant_files"],
    exclude: [],
  },
  "floor-only": {
    include: ["handoff.objective"],
    exclude: [],
  },
  "risk-aware": {
    include: [
      "handoff.selected_memory",
      "handoff.known_failures",
      "handoff.test_state",
    ],
    exclude: [],
  },
};

export function buildSyntheticContextSelectorCorpus(): readonly ContextSelectorCorpusCase[] {
  return Object.freeze(
    Object.keys(SYNTHETIC_CONTINUITY_PROFILES).flatMap((profile) =>
      Object.entries(POLICIES).map(([policy, selectors]) =>
        Object.freeze({
          label: `${profile}-${policy}`,
          handoff: buildSyntheticContinuityHandoff(
            profile as keyof typeof SYNTHETIC_CONTINUITY_PROFILES,
          ),
          selectors,
          budgets: buildSyntheticContinuityBudgets(),
        }),
      ),
    ),
  );
}

function report() {
  return measureContextSelectorCorpus(buildSyntheticContextSelectorCorpus());
}

describe("profile context selector measurement", () => {
  it("keeps every projected candidate byte-identical to the historical builder baseline", () => {
    const handoff = buildSyntheticContinuityHandoff("working");
    const projection = projectContextSelectors(handoff, POLICIES.focused!);
    const baseline = buildContextPackV1({
      handoff,
      budgets: { CONTINUITY: 1_000_000, INSTRUCTIONS: 1 },
    });
    assert.equal(projection.decisions.length, 8);
    for (const decision of projection.decisions) {
      const candidate = baseline.included.find(
        (item) => item.id === decision.id,
      )!;
      assert.equal(decision.exactCandidateBytes, candidate.exactBytes);
      assert.equal(
        decision.candidateSha256,
        createHash("sha256").update(candidate.content).digest("hex"),
      );
    }
    assert.equal(
      projection.baselineCandidateBytes,
      baseline.usedBytes.CONTINUITY,
    );
  });

  it("applies include, exclude, default, and safety-floor semantics explicitly", () => {
    const handoff = buildSyntheticContinuityHandoff("compact");
    const focused = projectContextSelectors(handoff, POLICIES.focused!);
    assert.deepEqual(
      focused.decisions
        .filter((decision) => decision.status === "SELECTED")
        .map((decision) => decision.section),
      [
        "objective",
        "repository",
        "testState",
        "relevantFiles",
        "nextAction",
        "sourceReferences",
      ],
    );
    const exclude = projectContextSelectors(handoff, {
      include: [],
      exclude: ["handoff.relevant_files"],
    });
    assert.equal(
      exclude.decisions.find((decision) => decision.section === "testState")
        ?.reason,
      "DEFAULT_INCLUDE",
    );
    assert.equal(
      exclude.decisions.find((decision) => decision.section === "relevantFiles")
        ?.reason,
      "EXPLICIT_EXCLUDE",
    );
    assert.deepEqual(focused.safetyFloor, CONTEXT_SELECTOR_SAFETY_FLOOR);
    assert.equal(focused.safetyFloorLossCount, 0);
  });

  it("reports nine cases and twenty-seven budget observations deterministically", () => {
    const value = report();
    assert.equal(value.caseCount, 9);
    assert.equal(value.budgetObservationCount, 27);
    assert.deepEqual(value, report());
    assert.equal(value.aggregate.safetyFloorLossCount, 0);
    assert.equal(
      value.aggregate.baselineCandidateBytes,
      value.aggregate.selectedCandidateBytes +
        value.aggregate.excludedCandidateBytes,
    );
    assert.ok(value.fitCounts.SELECTOR_POLICY >= value.fitCounts.BASELINE);
  });

  it("normalizes case, selector, and budget ordering", () => {
    const permuted = [...buildSyntheticContextSelectorCorpus()]
      .reverse()
      .map((value) => ({
        ...value,
        selectors: {
          include: [...value.selectors.include].reverse(),
          exclude: [...value.selectors.exclude].reverse(),
        },
        budgets: [...value.budgets].reverse(),
      }));
    assert.deepEqual(
      measureContextSelectorCorpus(buildSyntheticContextSelectorCorpus()),
      measureContextSelectorCorpus(permuted),
    );
  });

  it("rejects unknown, conflicting, duplicate, floor-excluding, and oversized selectors without echo", () => {
    const handoff = buildSyntheticContinuityHandoff("compact");
    const canary = "PRIVATE-SYNTHETIC-SELECTOR-CANARY";
    const invalid = [
      { include: ["git_diff"], exclude: [] },
      { include: ["toString"], exclude: [] },
      { include: [canary], exclude: [] },
      {
        include: ["handoff.test_state"],
        exclude: ["handoff.test_state"],
      },
      {
        include: ["handoff.test_state", "handoff.test_state"],
        exclude: [],
      },
      { include: [], exclude: ["handoff.objective"] },
      { include: Array(9).fill("handoff.test_state"), exclude: [] },
    ];
    for (const selectors of invalid)
      assert.throws(
        () => projectContextSelectors(handoff, selectors),
        (error: unknown) =>
          error instanceof ContextSelectorMeasurementError &&
          !error.message.includes(canary),
      );
  });

  it("rejects invalid corpus bounds, duplicate labels, circular content, and bad budgets", () => {
    const value = buildSyntheticContextSelectorCorpus()[0]!;
    assert.throws(
      () => measureContextSelectorCorpus([]),
      ContextSelectorMeasurementError,
    );
    assert.throws(
      () => measureContextSelectorCorpus([value, value]),
      ContextSelectorMeasurementError,
    );
    assert.throws(
      () =>
        measureContextSelectorCorpus([
          { ...value, budgets: [{ label: "invalid", exactBytes: 0 }] },
        ]),
      ContextSelectorMeasurementError,
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(
      () =>
        projectContextSelectors(
          {
            ...value.handoff,
            sections: {
              ...value.handoff.sections,
              objective: {
                ...value.handoff.sections.objective,
                value: circular,
              },
            },
          } as never,
          value.selectors,
        ),
      ContextSelectorMeasurementError,
    );
    assert.throws(
      () =>
        projectContextSelectors(
          {
            ...value.handoff,
            sections: {
              ...value.handoff.sections,
              objective: {
                ...value.handoff.sections.objective,
                value: "x".repeat(1_000_001),
              },
            },
          },
          value.selectors,
        ),
      ContextSelectorMeasurementError,
    );
  });
});

if (process.env.AI_WORKSPACE_SELECTOR_REPORT === "1")
  process.stdout.write(`${JSON.stringify(report(), null, 2)}\n`);
