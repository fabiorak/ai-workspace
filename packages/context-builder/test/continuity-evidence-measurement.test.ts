import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildContextPack,
  continuityEvidenceHandoffDigest,
  ContinuityEvidenceMeasurementError,
  expandContextPack,
  measureContinuityEvidenceCorpus,
} from "../src/index.ts";
import {
  buildSyntheticContinuityEvidenceCorpus,
  SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
  SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
} from "./synthetic-continuity-evidence-corpus.ts";

function report() {
  return measureContinuityEvidenceCorpus(
    buildSyntheticContinuityEvidenceCorpus(),
    SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
    SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
  );
}

describe("selector continuity evidence retention", () => {
  it("freezes six digest-pinned manifests with balanced optional-section coverage", () => {
    const corpus = buildSyntheticContinuityEvidenceCorpus();
    assert.equal(corpus.length, 6);
    assert.equal(new Set(corpus.map((value) => value.manifest.intent)).size, 6);
    for (const section of [
      "selectedMemory",
      "knownFailures",
      "testState",
      "relevantFiles",
    ] as const) {
      assert.ok(
        corpus.some((value) =>
          value.manifest.anchors.some((anchor) => anchor.section === section),
        ),
      );
      assert.ok(
        corpus.some((value) =>
          value.manifest.anchors.every((anchor) => anchor.section !== section),
        ),
      );
    }
  });

  it("reports exact evidence retention for six baselines and eighteen policy observations", () => {
    const value = report();
    assert.equal(value.scenarioCount, 6);
    assert.equal(value.baselineObservationCount, 6);
    assert.equal(value.policyObservationCount, 18);
    assert.equal(value.budgetObservationCount, 54);
    for (const scenario of value.scenarios) {
      assert.equal(scenario.baseline.requiredAnswerRecallPercent, 100);
      assert.equal(scenario.baseline.expectedFirstActionRetentionPercent, 100);
      assert.equal(scenario.baseline.requiredSourceCoveragePercent, 100);
      assert.equal(scenario.baseline.criticalMissCount, 0);
      assert.equal(scenario.baseline.corpusPreserving, true);
    }
    assert.ok(value.policySummary.every((policy) => !policy.corpusPreserving));
    assert.ok(
      value.policySummary.every((policy) => policy.criticalMissCount > 0),
    );
  });

  it("keeps first action and source-reference navigation while exposing excluded anchors", () => {
    const value = report();
    for (const scenario of value.scenarios)
      for (const policy of scenario.policies) {
        assert.equal(policy.expectedFirstActionRetentionPercent, 100);
        assert.ok(policy.selectedSections.includes("sourceReferences"));
        for (const anchor of policy.anchors) {
          assert.match(anchor.exactAnswerSha256, /^[a-f0-9]{64}$/u);
          assert.equal(
            anchor.status === "RETAINED",
            anchor.selectorDecision === "SELECTED",
          );
        }
      }
  });

  it("matches production schema-v2 accounting for every complete baseline and expands losslessly", () => {
    const corpus = buildSyntheticContinuityEvidenceCorpus();
    const value = report();
    for (const scenario of value.scenarios) {
      const source = corpus.find(
        (candidate) => candidate.manifest.scenarioId === scenario.scenarioId,
      )!;
      const packet = buildContextPack({
        handoff: source.handoff,
        budgets: { CONTINUITY: 1_000_000, INSTRUCTIONS: 1 },
      });
      const expanded = expandContextPack(packet);
      assert.equal(
        scenario.baseline.schemaV2.serializedContinuityBytes,
        packet.usedBytes.CONTINUITY,
      );
      assert.equal(
        scenario.baseline.schemaV2.sourceTableBytes,
        packet.sourceTable?.exactBytes,
      );
      assert.deepEqual(
        scenario.baseline.schemaV2.sourceIds,
        packet.sourceTable?.entries.map((entry) => entry.id),
      );
      assert.equal(
        scenario.baseline.schemaV2.sectionContentBytes,
        packet.included.reduce((total, item) => total + item.exactBytes, 0),
      );
      assert.equal(expanded.included.length, 8);
      assert.equal(scenario.baseline.schemaV2.losslessExpansion, true);
    }
  });

  it("normalizes scenario, manifest, policy, selector, source, and budget permutations", () => {
    const corpus = buildSyntheticContinuityEvidenceCorpus();
    const permuted = [...corpus].reverse().map((scenario) => ({
      ...scenario,
      manifest: {
        ...scenario.manifest,
        anchors: [...scenario.manifest.anchors].reverse().map((anchor) => ({
          ...anchor,
          requiredSourceIds: [...anchor.requiredSourceIds].reverse(),
        })),
      },
    }));
    const policies = [...SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES]
      .reverse()
      .map((policy) => ({
        ...policy,
        selectors: {
          include: [...policy.selectors.include].reverse(),
          exclude: [...policy.selectors.exclude].reverse(),
        },
      }));
    assert.deepEqual(
      report(),
      measureContinuityEvidenceCorpus(
        permuted,
        policies,
        [...SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS].reverse(),
      ),
    );
  });

  it("keeps evidence and accounting invariant under canonical source permutations", () => {
    const corpus = buildSyntheticContinuityEvidenceCorpus();
    const permuted = corpus.map((scenario) => {
      const handoff = {
        ...scenario.handoff,
        sections: Object.fromEntries(
          Object.entries(scenario.handoff.sections).map(([section, value]) => [
            section,
            {
              ...value,
              metadata: {
                ...value.metadata,
                sources: [...value.metadata.sources].reverse(),
              },
              ...(section === "sourceReferences"
                ? {
                    value: [
                      ...scenario.handoff.sections.sourceReferences.value,
                    ].reverse(),
                  }
                : {}),
            },
          ]),
        ) as unknown as typeof scenario.handoff.sections,
      };
      return {
        handoff,
        manifest: {
          ...scenario.manifest,
          handoffSha256: continuityEvidenceHandoffDigest(handoff),
        },
      };
    });
    const original = report();
    const changed = measureContinuityEvidenceCorpus(
      permuted,
      SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
      SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
    );
    assert.deepEqual(changed.policySummary, original.policySummary);
    assert.deepEqual(changed.aggregate, original.aggregate);
    for (const [index, scenario] of changed.scenarios.entries()) {
      assert.deepEqual(
        scenario.baseline.schemaV2,
        original.scenarios[index]!.baseline.schemaV2,
      );
      assert.deepEqual(
        scenario.policies.map((policy) => policy.schemaV2),
        original.scenarios[index]!.policies.map((policy) => policy.schemaV2),
      );
    }
  });

  it("counts Unicode bytes and keeps v1 candidate and v2 serialized accounting separate", () => {
    const value = report();
    const regression = value.scenarios.find(
      (scenario) => scenario.intent === "REGRESSION",
    )!;
    assert.ok(
      regression.baseline.historicalV1CandidateBytes !==
        regression.baseline.schemaV2.serializedContinuityBytes,
    );
    assert.ok(
      regression.baseline.anchors.some(
        (anchor) =>
          anchor.status === "RETAINED" && anchor.section === "testState",
      ),
    );
  });

  it("rejects stale digests, ambiguity, invalid first actions, source loss, scope, controls, and bounds without echo", () => {
    const scenario = buildSyntheticContinuityEvidenceCorpus()[0]!;
    const canary = "PRIVATE-SYNTHETIC-EVIDENCE-CANARY";
    const invalid = [
      {
        ...scenario,
        manifest: { ...scenario.manifest, handoffSha256: "0".repeat(64) },
      },
      {
        ...scenario,
        manifest: {
          ...scenario.manifest,
          expectedFirstAction: "Run a different synthetic action.",
        },
      },
      {
        ...scenario,
        manifest: {
          ...scenario.manifest,
          projectId: "synthetic-foreign-project",
        },
      },
      {
        ...scenario,
        manifest: {
          ...scenario.manifest,
          anchors: [
            ...scenario.manifest.anchors,
            { ...scenario.manifest.anchors[0]!, id: "duplicate-answer-anchor" },
          ],
        },
      },
      {
        ...scenario,
        manifest: {
          ...scenario.manifest,
          anchors: scenario.manifest.anchors.map((anchor, index) =>
            index === 0 ? { ...anchor, question: `${canary}\u0000` } : anchor,
          ),
        },
      },
      {
        ...scenario,
        manifest: {
          ...scenario.manifest,
          anchors: scenario.manifest.anchors.map((anchor, index) =>
            index === 0
              ? {
                  ...anchor,
                  requiredSourceIds: [`source:sha256:${"f".repeat(64)}`],
                }
              : anchor,
          ),
        },
      },
      {
        ...scenario,
        manifest: {
          ...scenario.manifest,
          anchors: scenario.manifest.anchors.map((anchor, index) =>
            index === 0 ? { ...anchor, question: "x".repeat(4_097) } : anchor,
          ),
        },
      },
    ];
    for (const candidate of invalid)
      assert.throws(
        () =>
          measureContinuityEvidenceCorpus(
            [candidate, ...buildSyntheticContinuityEvidenceCorpus().slice(1)],
            SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
            SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
          ),
        (error: unknown) =>
          error instanceof ContinuityEvidenceMeasurementError &&
          !error.message.includes(canary),
      );
  });

  it("rejects missing coverage, malformed policy sets, bad budgets, and circular handoffs", () => {
    const corpus = buildSyntheticContinuityEvidenceCorpus();
    assert.throws(
      () =>
        measureContinuityEvidenceCorpus(
          corpus.slice(0, 5),
          SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
          SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
        ),
      ContinuityEvidenceMeasurementError,
    );
    assert.throws(
      () =>
        measureContinuityEvidenceCorpus(
          corpus,
          SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES.slice(0, 2),
          SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
        ),
      ContinuityEvidenceMeasurementError,
    );
    assert.throws(
      () =>
        measureContinuityEvidenceCorpus(
          corpus,
          SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
          [
            ...SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS.slice(0, 2),
            { label: "bad", exactBytes: 0 },
          ],
        ),
      ContinuityEvidenceMeasurementError,
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(
      () =>
        measureContinuityEvidenceCorpus(
          [
            {
              ...corpus[0]!,
              handoff: {
                ...corpus[0]!.handoff,
                sections: {
                  ...corpus[0]!.handoff.sections,
                  objective: {
                    ...corpus[0]!.handoff.sections.objective,
                    value: circular,
                  },
                },
              } as never,
            },
            ...corpus.slice(1),
          ],
          SYNTHETIC_CONTINUITY_EVIDENCE_POLICIES,
          SYNTHETIC_CONTINUITY_EVIDENCE_BUDGETS,
        ),
      ContinuityEvidenceMeasurementError,
    );
  });
});

if (process.env.AI_WORKSPACE_CONTINUITY_EVIDENCE_REPORT === "1")
  process.stdout.write(`${JSON.stringify(report(), null, 2)}\n`);
