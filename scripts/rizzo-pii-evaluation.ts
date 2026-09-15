import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  BuiltInPiiDetector,
  type PiiDetector,
  type PiiEntityType,
  type PiiSpan,
} from "../packages/privacy-gateway/src/index.ts";
import {
  buildRizzoPiiEvaluationCorpus,
  RIZZO_PII_CORPUS_ID,
  type PiiEvaluationFixture,
  type PiiEvaluationKind,
  type PiiEvaluationTruth,
} from "./rizzo-pii-evaluation-corpus.ts";

const RIZZO_APP_VERSION = "2.0.0";
const RIZZO_MODEL_VERSION = "1.5.0";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const CRITICAL_TYPES = Object.freeze([
  "PERSON",
  "ORGANIZATION",
  "ADDRESS",
] as const satisfies readonly PiiEntityType[]);
const DETERMINISTIC_TYPES = Object.freeze([
  "EMAIL",
  "PHONE",
  "TAX_ID",
  "VAT_ID",
  "IBAN",
  "URL",
] as const satisfies readonly PiiEntityType[]);

type Score = Readonly<{
  groundTruth: number;
  proposed: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precisionPercent: number;
  recallPercent: number;
}>;

type DetectorMeasurement = Readonly<{
  status: "MEASURED";
  detector: "BUILT_IN" | "RIZZO" | "RIZZO_PLUS_BUILT_IN";
  score: Score;
  perType: Readonly<Record<PiiEntityType, Score | null>>;
  falsePositivesByNegativeKind: Readonly<
    Record<"HASH_NEGATIVE" | "CODE_NEGATIVE" | "LOG_NEGATIVE", number>
  >;
  latencyMilliseconds: Readonly<{ p50: number; p95: number; samples: number }>;
  validUtf8Boundaries: boolean;
  duplicateSpans: number;
  candidateSha256: string;
}>;

type RizzoUnavailable = Readonly<{
  status: "NOT_RUN";
  reason: "NO_ENDPOINT_REQUESTED" | "SIDECAR_UNAVAILABLE_OR_INCOMPATIBLE";
}>;

export type RizzoPiiEvaluationReport = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  corpus: Readonly<{
    id: typeof RIZZO_PII_CORPUS_ID;
    synthetic: true;
    fixtures: 140;
    languages: readonly ["it", "en"];
    corpusSha256: string;
    groundTruthSha256: string;
  }>;
  protocol: Readonly<{
    matching: "EXACT_TYPE_AND_UTF8_BYTE_RANGE";
    rizzoAppVersion: typeof RIZZO_APP_VERSION;
    rizzoModelVersion: typeof RIZZO_MODEL_VERSION;
    cpuOnly: true;
    warmupRequests: number;
    timeoutMilliseconds: number;
    maximumResponseBytes: number;
    confidenceSemantics: "VALIDATED_REGEX_ONE_MODEL_SCORE_UNAVAILABLE_ZERO_SENTINEL";
  }>;
  builtIn: DetectorMeasurement;
  rizzo: DetectorMeasurement | RizzoUnavailable;
  hybrid: DetectorMeasurement | RizzoUnavailable;
  gates: Readonly<{
    minimumOverallPrecisionPercent: 90;
    minimumCriticalRecallPercent: 80;
    minimumDeterministicPrecisionPercent: 90;
    maximumCodeFalsePositives: 2;
    maximumP95Milliseconds: 2_000;
  }>;
  decision:
    | "RIZZO_NOT_RUN_DEFAULT_UNCHANGED"
    | "DO_NOT_ADOPT_RIZZO_DEFAULT_UNCHANGED"
    | "ADR_0045_REVIEW_JUSTIFIED_DEFAULT_UNCHANGED";
  reasons: readonly string[];
  effect: "DEVELOPMENT_ONLY_DEFAULT_DETECTOR_UNCHANGED_NO_PROVIDER_OR_PRODUCTION_SIDE_CAR";
}>;

const RIZZO_TYPE_MAP = Object.freeze({
  FULLNAME: "PERSON",
  ORG: "ORGANIZATION",
  DATE: "DATE",
  STREET: "ADDRESS",
  BUILDINGNUM: "ADDRESS",
  ZIPCODE: "ADDRESS",
  CITY: "ADDRESS",
  PROVINCE: "ADDRESS",
  EMAIL: "EMAIL",
  TELEPHONENUM: "PHONE",
  CF: "TAX_ID",
  PIVA: "VAT_ID",
  IBAN: "IBAN",
  URL: "URL",
  ID_DOC: "BUSINESS_IDENTIFIER",
  DOCID: "BUSINESS_IDENTIFIER",
  CREDITCARDNUMBER: "BUSINESS_IDENTIFIER",
  TARGA: "BUSINESS_IDENTIFIER",
  CATASTO: "BUSINESS_IDENTIFIER",
  AGE: "OTHER",
  GENDER: "OTHER",
  TIME: "OTHER",
  AMOUNT: "OTHER",
} as const satisfies Readonly<Record<string, PiiEntityType>>);

export class RizzoPiiSpikeError extends Error {
  public constructor() {
    super("RIZZO_PII_SPIKE_FAILED_CLOSED");
    this.name = "RizzoPiiSpikeError";
  }
}

export function spansFromRizzoSegments(
  segmentsValue: unknown,
): readonly PiiSpan[] {
  if (!Array.isArray(segmentsValue)) throw new RizzoPiiSpikeError();
  const spans: PiiSpan[] = [];
  let cursor = 0;
  for (const value of segmentsValue) {
    if (
      !record(value) ||
      typeof value.t !== "string" ||
      !value.t.isWellFormed()
    )
      throw new RizzoPiiSpikeError();
    const startUtf8 = cursor;
    cursor += Buffer.byteLength(value.t, "utf8");
    if (value.label === undefined) continue;
    if (
      typeof value.label !== "string" ||
      !(value.label in RIZZO_TYPE_MAP) ||
      typeof value.validated !== "boolean"
    )
      throw new RizzoPiiSpikeError();
    spans.push(
      Object.freeze({
        startUtf8,
        endUtf8: cursor,
        type: RIZZO_TYPE_MAP[value.label as keyof typeof RIZZO_TYPE_MAP],
        confidence: value.validated ? 1 : 0,
        detector: `RIZZO_PII_${RIZZO_APP_VERSION}_MODEL_${RIZZO_MODEL_VERSION}`,
      }),
    );
  }
  return Object.freeze(spans);
}

export function createRizzoPiiSpikeDetector(
  endpointValue: string,
): PiiDetector {
  const endpoint = loopbackEndpoint(endpointValue);
  return Object.freeze({
    async detect(text: string): Promise<readonly PiiSpan[]> {
      if (
        typeof text !== "string" ||
        !text.isWellFormed() ||
        Buffer.byteLength(text, "utf8") > 1024 * 1024
      )
        throw new RizzoPiiSpikeError();
      const response = await fetch(new URL("/analyze", endpoint), {
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, include_mapping: true }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await boundedJson(response);
      if (!response.ok || !record(payload)) throw new RizzoPiiSpikeError();
      return spansFromRizzoSegments(payload.segments);
    },
  });
}

export async function evaluateRizzoPii(
  options: {
    rizzoEndpoint?: string;
    now?: Date;
  } = {},
): Promise<RizzoPiiEvaluationReport> {
  const corpus = buildRizzoPiiEvaluationCorpus();
  const builtInRuns = await runDetector(new BuiltInPiiDetector(), corpus);
  const builtIn = measure(
    "BUILT_IN",
    corpus,
    builtInRuns.spans,
    builtInRuns.times,
  );
  const unavailable = Object.freeze({
    status: "NOT_RUN" as const,
    reason: options.rizzoEndpoint
      ? ("SIDECAR_UNAVAILABLE_OR_INCOMPATIBLE" as const)
      : ("NO_ENDPOINT_REQUESTED" as const),
  });
  let rizzo: DetectorMeasurement | RizzoUnavailable = unavailable;
  let hybrid: DetectorMeasurement | RizzoUnavailable = unavailable;
  if (options.rizzoEndpoint) {
    try {
      await verifyHealth(options.rizzoEndpoint);
      const detector = createRizzoPiiSpikeDetector(options.rizzoEndpoint);
      for (const sample of corpus.slice(0, 5))
        await detector.detect(sample.text, sample.language);
      const rizzoRuns = await runDetector(detector, corpus);
      rizzo = measure("RIZZO", corpus, rizzoRuns.spans, rizzoRuns.times);
      const combined = rizzoRuns.spans.map((spans, index) =>
        union(spans, builtInRuns.spans[index]!),
      );
      hybrid = measure(
        "RIZZO_PLUS_BUILT_IN",
        corpus,
        combined,
        rizzoRuns.times.map(
          (value, index) => value + builtInRuns.times[index]!,
        ),
      );
    } catch {
      rizzo = unavailable;
      hybrid = unavailable;
    }
  }
  const decision = decide(builtIn, rizzo, hybrid);
  return Object.freeze({
    schemaVersion: 1 as const,
    generatedAt: (options.now ?? new Date()).toISOString(),
    corpus: Object.freeze({
      id: RIZZO_PII_CORPUS_ID,
      synthetic: true as const,
      fixtures: 140 as const,
      languages: Object.freeze(["it", "en"] as const),
      corpusSha256: digest(corpus),
      groundTruthSha256: digest(
        corpus.map(({ id, expected }) => ({ id, expected })),
      ),
    }),
    protocol: Object.freeze({
      matching: "EXACT_TYPE_AND_UTF8_BYTE_RANGE" as const,
      rizzoAppVersion: RIZZO_APP_VERSION,
      rizzoModelVersion: RIZZO_MODEL_VERSION,
      cpuOnly: true as const,
      warmupRequests: 5,
      timeoutMilliseconds: REQUEST_TIMEOUT_MS,
      maximumResponseBytes: MAX_RESPONSE_BYTES,
      confidenceSemantics:
        "VALIDATED_REGEX_ONE_MODEL_SCORE_UNAVAILABLE_ZERO_SENTINEL" as const,
    }),
    builtIn,
    rizzo,
    hybrid,
    gates: Object.freeze({
      minimumOverallPrecisionPercent: 90 as const,
      minimumCriticalRecallPercent: 80 as const,
      minimumDeterministicPrecisionPercent: 90 as const,
      maximumCodeFalsePositives: 2 as const,
      maximumP95Milliseconds: 2_000 as const,
    }),
    decision: decision.decision,
    reasons: Object.freeze(decision.reasons),
    effect:
      "DEVELOPMENT_ONLY_DEFAULT_DETECTOR_UNCHANGED_NO_PROVIDER_OR_PRODUCTION_SIDE_CAR" as const,
  });
}

async function runDetector(
  detector: PiiDetector,
  corpus: readonly PiiEvaluationFixture[],
) {
  const spans: (readonly PiiSpan[])[] = [];
  const times: number[] = [];
  for (const sample of corpus) {
    const started = performance.now();
    spans.push(await detector.detect(sample.text, sample.language));
    times.push(performance.now() - started);
  }
  return { spans, times };
}

function measure(
  detector: DetectorMeasurement["detector"],
  corpus: readonly PiiEvaluationFixture[],
  candidates: readonly (readonly PiiSpan[])[],
  times: readonly number[],
): DetectorMeasurement {
  const allTypes = [
    "PERSON",
    "ORGANIZATION",
    "CUSTOMER",
    "PROJECT",
    "EMAIL",
    "PHONE",
    "TAX_ID",
    "VAT_ID",
    "IBAN",
    "ADDRESS",
    "DATE",
    "PATH",
    "URL",
    "BUSINESS_IDENTIFIER",
    "OTHER",
  ] as const satisfies readonly PiiEntityType[];
  const overall = score(
    corpus.flatMap((sample) =>
      sample.expected.map((truth) => identity(sample.id, truth)),
    ),
    candidates.flatMap((spans, index) =>
      spans.map((span) => identity(corpus[index]!.id, span)),
    ),
  );
  const perType = Object.fromEntries(
    allTypes.map((type) => {
      const truth = corpus.flatMap((sample) =>
        sample.expected
          .filter((entry) => entry.type === type)
          .map((entry) => identity(sample.id, entry)),
      );
      const proposed = candidates.flatMap((spans, index) =>
        spans
          .filter((entry) => entry.type === type)
          .map((entry) => identity(corpus[index]!.id, entry)),
      );
      return [
        type,
        truth.length + proposed.length === 0 ? null : score(truth, proposed),
      ];
    }),
  ) as Record<PiiEntityType, Score | null>;
  const encoded = candidates.flatMap((spans, index) =>
    spans.map((span) => identity(corpus[index]!.id, span)),
  );
  const duplicates = encoded.length - new Set(encoded).size;
  return Object.freeze({
    status: "MEASURED" as const,
    detector,
    score: overall,
    perType: Object.freeze(perType),
    falsePositivesByNegativeKind: Object.freeze({
      HASH_NEGATIVE: falsePositivesFor("HASH_NEGATIVE", corpus, candidates),
      CODE_NEGATIVE: falsePositivesFor("CODE_NEGATIVE", corpus, candidates),
      LOG_NEGATIVE: falsePositivesFor("LOG_NEGATIVE", corpus, candidates),
    }),
    latencyMilliseconds: Object.freeze({
      p50: percentile(times, 50),
      p95: percentile(times, 95),
      samples: times.length,
    }),
    validUtf8Boundaries: candidates.every((spans, index) =>
      spans.every((span) => validSpan(corpus[index]!.text, span)),
    ),
    duplicateSpans: duplicates,
    candidateSha256: digest(encoded.sort()),
  });
}

function decide(
  builtIn: DetectorMeasurement,
  rizzo: DetectorMeasurement | RizzoUnavailable,
  hybrid: DetectorMeasurement | RizzoUnavailable,
): { decision: RizzoPiiEvaluationReport["decision"]; reasons: string[] } {
  if (rizzo.status !== "MEASURED" || hybrid.status !== "MEASURED")
    return {
      decision: "RIZZO_NOT_RUN_DEFAULT_UNCHANGED",
      reasons: [
        "The pinned local Rizzo sidecar was not measured.",
        "No production detector, dependency, or default changed.",
      ],
    };
  const reasons: string[] = [];
  if (!hybrid.validUtf8Boundaries || hybrid.duplicateSpans > 0)
    reasons.push("The hybrid output failed structural span gates.");
  if (hybrid.score.precisionPercent < 90)
    reasons.push("Hybrid overall precision is below 90%.");
  for (const type of CRITICAL_TYPES)
    if ((hybrid.perType[type]?.recallPercent ?? 0) < 80)
      reasons.push(`Hybrid ${type} recall is below 80%.`);
  for (const type of DETERMINISTIC_TYPES) {
    const candidate = hybrid.perType[type];
    const baseline = builtIn.perType[type];
    if ((candidate?.precisionPercent ?? 0) < 90)
      reasons.push(`Hybrid ${type} precision is below 90%.`);
    if ((candidate?.recallPercent ?? 0) < (baseline?.recallPercent ?? 0))
      reasons.push(`Hybrid ${type} recall regresses the built-in detector.`);
  }
  if (hybrid.falsePositivesByNegativeKind.CODE_NEGATIVE > 2)
    reasons.push("Hybrid code false positives exceed 2 of 10 fixtures.");
  if (rizzo.latencyMilliseconds.p95 > 2_000)
    reasons.push("Rizzo CPU p95 exceeds 2000 ms per bounded fixture.");
  reasons.push(
    "Rizzo 2.0 /analyze omits neural confidence; zero is only an explicit unavailable sentinel.",
  );
  if (reasons.length === 1)
    return {
      decision: "ADR_0045_REVIEW_JUSTIFIED_DEFAULT_UNCHANGED",
      reasons,
    };
  return {
    decision: "DO_NOT_ADOPT_RIZZO_DEFAULT_UNCHANGED",
    reasons,
  };
}

async function verifyHealth(endpointValue: string) {
  const response = await fetch(
    new URL("/health", loopbackEndpoint(endpointValue)),
    {
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  const value = await boundedJson(response);
  if (
    !response.ok ||
    !record(value) ||
    value.status !== "ok" ||
    value.model_loaded !== true ||
    value.app_version !== RIZZO_APP_VERSION ||
    value.model_version !== RIZZO_MODEL_VERSION ||
    value.device !== "cpu"
  )
    throw new RizzoPiiSpikeError();
}

function loopbackEndpoint(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RizzoPiiSpikeError();
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new RizzoPiiSpikeError();
  return url;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new RizzoPiiSpikeError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RizzoPiiSpikeError();
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RizzoPiiSpikeError();
  }
}

function union(
  primary: readonly PiiSpan[],
  fallback: readonly PiiSpan[],
): readonly PiiSpan[] {
  const result = [...primary];
  for (const span of fallback)
    if (
      !result.some(
        (other) =>
          span.startUtf8 < other.endUtf8 && span.endUtf8 > other.startUtf8,
      )
    )
      result.push(span);
  return Object.freeze(
    result.sort(
      (left, right) =>
        left.startUtf8 - right.startUtf8 || left.endUtf8 - right.endUtf8,
    ),
  );
}

function identity(
  fixtureId: string,
  span: PiiEvaluationTruth | PiiSpan,
): string {
  return `${fixtureId}\0${span.type}\0${span.startUtf8}\0${span.endUtf8}`;
}

function score(truth: readonly string[], proposed: readonly string[]): Score {
  const expected = new Set(truth);
  const actual = new Set(proposed);
  let truePositive = 0;
  for (const value of actual) if (expected.has(value)) truePositive += 1;
  const falsePositive = actual.size - truePositive;
  const falseNegative = expected.size - truePositive;
  return Object.freeze({
    groundTruth: expected.size,
    proposed: actual.size,
    truePositive,
    falsePositive,
    falseNegative,
    precisionPercent: percent(truePositive, truePositive + falsePositive),
    recallPercent: percent(truePositive, truePositive + falseNegative),
  });
}

function falsePositivesFor(
  kind: Extract<PiiEvaluationKind, `${string}_NEGATIVE`>,
  corpus: readonly PiiEvaluationFixture[],
  candidates: readonly (readonly PiiSpan[])[],
) {
  return candidates.reduce(
    (sum, spans, index) =>
      sum + (corpus[index]!.kind === kind ? spans.length : 0),
    0,
  );
}

function validSpan(text: string, span: PiiSpan) {
  const bytes = Buffer.from(text, "utf8");
  if (
    !Number.isSafeInteger(span.startUtf8) ||
    !Number.isSafeInteger(span.endUtf8) ||
    span.startUtf8 < 0 ||
    span.endUtf8 <= span.startUtf8 ||
    span.endUtf8 > bytes.length
  )
    return false;
  const selected = bytes
    .subarray(span.startUtf8, span.endUtf8)
    .toString("utf8");
  return (
    selected.isWellFormed() &&
    Buffer.byteLength(selected, "utf8") === span.endUtf8 - span.startUtf8
  );
}

function percentile(values: readonly number[], value: number) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return Number((sorted[index] ?? 0).toFixed(3));
}

function percent(numerator: number, denominator: number) {
  return denominator === 0
    ? 100
    : Number(((numerator / denominator) * 100).toFixed(2));
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function endpointArgument(argv: readonly string[]) {
  const prefix = "--rizzo-endpoint=";
  const values = argv.filter((value) => value.startsWith(prefix));
  if (values.length > 1 || argv.some((value) => !value.startsWith(prefix)))
    throw new RizzoPiiSpikeError();
  return values[0]?.slice(prefix.length);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const requestedEndpoint = endpointArgument(process.argv.slice(2));
  const report = await evaluateRizzoPii(
    requestedEndpoint === undefined ? {} : { rizzoEndpoint: requestedEndpoint },
  );
  const directory = join(process.cwd(), ".ai-workspace", "measurements");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "rizzo-pii-evaluation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
