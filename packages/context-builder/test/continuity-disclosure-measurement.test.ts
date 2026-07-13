import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  buildContextPack,
  ContinuityDisclosureError,
  measureContinuityDisclosureCorpus,
  projectContinuityDisclosure,
  type ContinuityDisclosureCorpusCase,
} from "../src/index.ts";
import {
  buildSyntheticContinuityBudgets,
  buildSyntheticContinuityHandoff,
  SYNTHETIC_CONTINUITY_PROFILES,
} from "./synthetic-context-corpus.ts";

function corpus(): readonly ContinuityDisclosureCorpusCase[] {
  return Object.freeze(
    Object.keys(SYNTHETIC_CONTINUITY_PROFILES).map((profile) =>
      Object.freeze({
        label: profile,
        handoff: buildSyntheticContinuityHandoff(
          profile as keyof typeof SYNTHETIC_CONTINUITY_PROFILES,
        ),
        budgets: buildSyntheticContinuityBudgets(),
      }),
    ),
  );
}

function report() {
  return measureContinuityDisclosureCorpus(corpus());
}

describe("continuity disclosure measurement", () => {
  it("keeps FULL byte-identical to current Context Builder candidates", () => {
    for (const value of corpus()) {
      const projected = projectContinuityDisclosure(value.handoff);
      const preview = buildContextPack({
        handoff: value.handoff,
        budgets: { CONTINUITY: 100_000, INSTRUCTIONS: 1 },
      });
      assert.equal(projected.length, 8);
      for (const section of projected) {
        const current = preview.included.find((item) => item.id === section.id);
        assert.equal(section.representations.FULL.content, current?.content);
        assert.equal(
          section.representations.FULL.exactBytes,
          current?.exactBytes,
        );
      }
    }
  });

  it("preserves metadata and verifiable resolution identity at every level", () => {
    const handoff = buildSyntheticContinuityHandoff("working");
    for (const projected of projectContinuityDisclosure(handoff)) {
      const sourceSection = handoff.sections[projected.section];
      const serializedValue = JSON.stringify(sourceSection.value);
      assert.equal(
        projected.resolver.serializedValueExactBytes,
        Buffer.byteLength(serializedValue),
      );
      assert.equal(
        projected.resolver.serializedValueSha256,
        createHash("sha256").update(serializedValue).digest("hex"),
      );
      for (const level of ["REFERENCE", "OUTLINE", "FULL"] as const) {
        const decoded = JSON.parse(
          projected.representations[level].content,
        ) as { metadata: unknown };
        assert.deepEqual(decoded.metadata, sourceSection.metadata);
      }
      assert.equal(Object.isFrozen(projected.metadata), true);
      assert.equal(Object.isFrozen(projected.metadata.sources), true);
      assert.equal(
        projected.metadata.sources.every((source) => Object.isFrozen(source)),
        true,
      );
    }
  });

  it("reports three profiles and nine budget observations deterministically", () => {
    const measured = report();
    assert.equal(measured.profileCount, 3);
    assert.equal(measured.budgetObservationCount, 9);
    assert.deepEqual(measured, report());
    assert.equal(
      Object.values(measured.fitCounts).every(
        (count) => Number.isSafeInteger(count) && count >= 0,
      ),
      true,
    );
    for (const profile of measured.profiles)
      for (const level of ["REFERENCE", "OUTLINE", "FULL"] as const)
        assert.equal(
          profile.levels[level].exactBytes,
          profile.sections.reduce(
            (total, section) => total + section.levels[level].exactBytes,
            0,
          ),
        );
  });

  it("normalizes profile and budget ordering", () => {
    const permuted = [...corpus()].reverse().map((profile) => ({
      ...profile,
      budgets: [...profile.budgets].reverse(),
    }));
    assert.deepEqual(
      measureContinuityDisclosureCorpus(corpus()),
      measureContinuityDisclosureCorpus(permuted),
    );
  });

  it("retains negative section-level representation results", () => {
    const compact = report().profiles.find(
      (profile) => profile.label === "compact",
    )!;
    assert.equal(
      compact.sections.some(
        (section) =>
          section.levels.REFERENCE.byteDifferenceFromFull < 0 ||
          section.levels.OUTLINE.byteDifferenceFromFull < 0,
      ),
      true,
    );
  });

  it("fails closed for duplicate, malformed, circular, and oversized input", () => {
    const value = corpus()[0]!;
    assert.throws(
      () => measureContinuityDisclosureCorpus([]),
      ContinuityDisclosureError,
    );
    assert.throws(
      () => measureContinuityDisclosureCorpus([value, value]),
      /profile labels must be unique/u,
    );
    assert.throws(
      () =>
        measureContinuityDisclosureCorpus([
          value,
          { ...value, label: "duplicate-handoff" },
        ]),
      /handoff identities must be unique/u,
    );
    assert.throws(
      () =>
        measureContinuityDisclosureCorpus([
          { ...value, budgets: [value.budgets[0]!, value.budgets[0]!] },
        ]),
      /Budget labels must be unique/u,
    );
    assert.throws(
      () =>
        measureContinuityDisclosureCorpus([
          { ...value, budgets: [{ label: "invalid", exactBytes: 0 }] },
        ]),
      /from 1 to 1000000 exact bytes/u,
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(
      () =>
        projectContinuityDisclosure({
          ...value.handoff,
          sections: {
            ...value.handoff.sections,
            objective: {
              ...value.handoff.sections.objective,
              value: circular,
            },
          },
        } as never),
      /circular, unsupported, or oversized/u,
    );
    assert.throws(
      () =>
        projectContinuityDisclosure({
          ...value.handoff,
          sections: {
            ...value.handoff.sections,
            objective: {
              ...value.handoff.sections.objective,
              value: "x".repeat(1_000_001),
            },
          },
        }),
      /exceeds the exact-byte bound/u,
    );
  });

  it("does not echo rejected content", () => {
    const canary = "PRIVATE-SYNTHETIC-DISCLOSURE-CANARY";
    const value = corpus()[0]!;
    assert.throws(
      () =>
        projectContinuityDisclosure({
          ...value.handoff,
          sections: {
            ...value.handoff.sections,
            objective: {
              ...value.handoff.sections.objective,
              value: { content: canary, unsupported: Symbol(canary) },
            },
          },
        } as never),
      (error: unknown) =>
        error instanceof ContinuityDisclosureError &&
        !error.message.includes(canary),
    );
  });
});

if (process.env.AI_WORKSPACE_DISCLOSURE_REPORT === "1")
  process.stdout.write(`${JSON.stringify(report(), null, 2)}\n`);
