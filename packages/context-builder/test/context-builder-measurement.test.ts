import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ContextPackMeasurementError,
  measureContextPackCorpus,
} from "../src/index.ts";
import {
  buildSyntheticContextCorpus,
  buildSyntheticContextCorpusReport,
} from "./synthetic-context-corpus.ts";

describe("Context Pack corpus measurement", () => {
  it("measures a deterministic 3 x 3 x 3 synthetic corpus", () => {
    const report = buildSyntheticContextCorpusReport();
    assert.equal(report.sampleCount, 27);
    assert.deepEqual(report, buildSyntheticContextCorpusReport());
    assert.deepEqual(report.fitCounts, {
      FULL_FIT: 9,
      PARTIAL_FIT: 9,
      NO_FIT: 9,
    });
    assert.equal(
      Object.values(report.fitCounts).reduce((sum, value) => sum + value, 0),
      report.sampleCount,
    );
    for (const category of ["CONTINUITY", "INSTRUCTIONS"] as const) {
      const aggregate = report.categories[category];
      assert.equal(
        aggregate.includedBytes + aggregate.omittedBytes,
        aggregate.candidateBytes,
      );
      assert.equal(
        aggregate.includedBytes,
        report.samples.reduce(
          (sum, sample) => sum + sample.categories[category].includedBytes,
          0,
        ),
      );
    }
    assert.equal(
      report.samples.find((sample) => sample.label === "compact-none-generous")!
        .categories.INSTRUCTIONS.retentionPercent,
      null,
    );
  });

  it("normalizes sample and dimension ordering", () => {
    const corpus = buildSyntheticContextCorpus();
    const permuted = [...corpus].reverse().map((sample) => ({
      ...sample,
      dimensions: Object.fromEntries(
        Object.entries(sample.dimensions).reverse(),
      ),
    }));
    assert.deepEqual(
      measureContextPackCorpus(corpus),
      measureContextPackCorpus(permuted),
    );
  });

  it("fails closed for duplicate, inconsistent, empty, and oversized input", () => {
    const sample = buildSyntheticContextCorpus()[0]!;
    assert.throws(
      () => measureContextPackCorpus([]),
      ContextPackMeasurementError,
    );
    assert.throws(
      () => measureContextPackCorpus([sample, sample]),
      /labels must be unique/u,
    );
    assert.throws(
      () =>
        measureContextPackCorpus([
          {
            ...sample,
            preview: {
              ...sample.preview,
              measurement: {
                ...sample.preview.measurement,
                exactIncludedBytes: 99,
              },
            },
          },
        ]),
      /total measurement is inconsistent/u,
    );
    assert.throws(
      () => measureContextPackCorpus(Array.from({ length: 101 }, () => sample)),
      /from 1 to 100/u,
    );
    assert.throws(
      () =>
        measureContextPackCorpus([
          {
            ...sample,
            dimensions: { "con\ntrol": "value" },
          },
        ]),
      /bounded non-control text/u,
    );
    assert.throws(
      () =>
        measureContextPackCorpus([
          {
            ...sample,
            preview: {
              ...sample.preview,
              budgets: {
                ...sample.preview.budgets,
                CONTINUITY: 1_000_001,
              },
            },
          },
        ]),
      /budget accounting is inconsistent/u,
    );
    assert.throws(
      () =>
        measureContextPackCorpus([
          {
            ...sample,
            preview: {
              ...sample.preview,
              omitted: [
                {
                  ...sample.preview.omitted[0]!,
                  exactBytes: 1_000_001,
                },
                ...sample.preview.omitted.slice(1),
              ],
            },
          },
        ]),
      /omitted-item accounting is inconsistent/u,
    );
  });

  it("rejects changed item bytes without echoing content", () => {
    const canary = "PRIVATE-SYNTHETIC-CANARY";
    const sample = buildSyntheticContextCorpus().find(
      (candidate) => candidate.preview.included.length > 0,
    )!;
    const changed = {
      ...sample,
      preview: {
        ...sample.preview,
        included: [
          { ...sample.preview.included[0]!, content: canary },
          ...sample.preview.included.slice(1),
        ],
      },
    };
    assert.throws(
      () => measureContextPackCorpus([changed]),
      (error: unknown) =>
        error instanceof ContextPackMeasurementError &&
        !error.message.includes(canary),
    );
  });
});

if (process.env.AI_WORKSPACE_CONTEXT_REPORT === "1")
  process.stdout.write(
    `${JSON.stringify(buildSyntheticContextCorpusReport(), null, 2)}\n`,
  );
