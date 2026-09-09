import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { buildSyntheticContextCorpus } from "../packages/context-builder/test/synthetic-context-corpus.ts";
import { measureContextPackCorpus } from "../packages/context-builder/src/index.ts";

export type ContinuationBaselineReport = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  corpus: { sampleCount: number; labels: readonly string[]; synthetic: true };
  variants: Readonly<
    Record<
      "FULL" | "BASE",
      Readonly<{
        runs: readonly number[];
        medianMs: number;
        candidateBytes: number;
        includedBytes: number;
        omittedBytes: number;
        estimatedTokens: number;
        executable: boolean;
        limitation: string | null;
      }>
    >
  >;
  accounting: {
    transportMs: null;
    generationMs: null;
    retrievalMs: null;
    cacheReadTokens: null;
    cacheWriteTokens: null;
    cost: null;
    toolCalls: 0;
  };
  decision: "MEASUREMENT_ONLY_NO_PROVIDER_OR_SELECTION_CHANGE";
}>;
const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const aggregate = (
  report: ReturnType<typeof measureContextPackCorpus>,
  variant: "FULL" | "BASE",
) => {
  const candidateBytes = Object.values(report.categories).reduce(
    (sum, category) => sum + category.candidateBytes,
    0,
  );
  const includedBytes = Object.values(report.categories).reduce(
    (sum, category) => sum + category.includedBytes,
    0,
  );
  const included = variant === "FULL" ? candidateBytes : includedBytes;
  return {
    candidateBytes,
    includedBytes: included,
    omittedBytes: candidateBytes - included,
    estimatedTokens: Math.ceil(included / 4),
    executable: false,
    limitation:
      "Synthetic corpus only; no provider, account, pricing, transcript baseline, or quality judgment.",
  };
};

export async function measureContinuationBaseline() {
  const samples = buildSyntheticContextCorpus();
  const variants = {} as Record<
    "FULL" | "BASE",
    ContinuationBaselineReport["variants"]["FULL"]
  >;
  const baseReport = measureContextPackCorpus(samples);
  for (const variant of ["FULL", "BASE"] as const) {
    const runs: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const started = performance.now();
      measureContextPackCorpus(samples);
      runs.push(Number((performance.now() - started).toFixed(3)));
    }
    variants[variant] = Object.freeze({
      ...aggregate(baseReport, variant),
      runs: Object.freeze(runs),
      medianMs: median(runs),
    });
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    corpus: Object.freeze({
      sampleCount: samples.length,
      labels: Object.freeze(samples.map((sample) => sample.label)),
      synthetic: true as const,
    }),
    variants: Object.freeze(variants),
    accounting: Object.freeze({
      transportMs: null,
      generationMs: null,
      retrievalMs: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      cost: null,
      toolCalls: 0 as const,
    }),
    decision: "MEASUREMENT_ONLY_NO_PROVIDER_OR_SELECTION_CHANGE" as const,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await measureContinuationBaseline();
  const directory = join(process.cwd(), ".ai-workspace", "measurements");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "continuation-baseline.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
