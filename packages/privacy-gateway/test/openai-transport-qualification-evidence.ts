import { createHash } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_PROCESS_STREAM_BYTES = 32 * 1024;

type CaseOutcome = "PASSED" | "BLOCKED" | "AMBIGUOUS";
type RetryDisposition =
  "NO_RETRY_NEEDED" | "SAFE_BEFORE_EXPOSURE" | "NEVER_AUTOMATIC" | "TERMINAL";

export class OpenAiTransportEvidenceError extends Error {
  public constructor() {
    super(
      "The synthetic OpenAI transport evidence is invalid, unsafe, incomplete, oversized, or ambiguous. No model was invoked.",
    );
    this.name = "OpenAiTransportEvidenceError";
  }
}

export type ResponsesAttempt = Readonly<{
  schemaVersion: 1;
  authorizationId: string;
  attemptId: string;
  providerKind: "OPENAI_RESPONSES";
  transportEvidenceDate: "2026-07-22";
  modelId: string;
  transformedRequestDigest: string;
  mappingSchemaVersion: 1 | 2;
  store: false;
  background: false;
  toolCount: 0;
}>;

type ResponsesEvent =
  | Readonly<{
      type: "response.created";
      responseId: string;
      requestId: string;
    }>
  | Readonly<{ type: "response.output_text.delta"; text: string }>
  | Readonly<{ type: "response.completed" }>
  | Readonly<{ type: "response.failed" }>
  | Readonly<{ type: "connection.lost" }>
  | Readonly<{ type: "malformed" }>;

type ResponsesSimulation = Readonly<{
  credentialAvailable: boolean;
  exposed: boolean;
  events: readonly ResponsesEvent[];
}>;

type AggregateReceipt = Readonly<{
  attemptId: string;
  requestDigest: string;
  serializedBodyDigest: string;
  responseIdDigest: string | null;
  requestIdDigest: string | null;
  outputDigest: string | null;
  exposureCount: number;
  outcome: CaseOutcome;
  retry: RetryDisposition;
  effect: "SYNTHETIC_PROTOCOL_EVIDENCE_NO_OPENAI_REQUEST";
}>;

export function validateResponsesAttempt(value: unknown): ResponsesAttempt {
  const keys = [
    "attemptId",
    "authorizationId",
    "background",
    "mappingSchemaVersion",
    "modelId",
    "providerKind",
    "schemaVersion",
    "store",
    "toolCount",
    "transformedRequestDigest",
    "transportEvidenceDate",
  ] as const;
  if (
    !record(value) ||
    !exactKeys(value, keys) ||
    value.schemaVersion !== 1 ||
    !validText(value.authorizationId) ||
    !validText(value.attemptId) ||
    value.providerKind !== "OPENAI_RESPONSES" ||
    value.transportEvidenceDate !== "2026-07-22" ||
    !validText(value.modelId) ||
    !validDigest(value.transformedRequestDigest) ||
    ![1, 2].includes(value.mappingSchemaVersion as number) ||
    value.store !== false ||
    value.background !== false ||
    value.toolCount !== 0
  )
    throw invalid();
  return Object.freeze({ ...(value as ResponsesAttempt) });
}

export function encodeResponsesAttempt(value: unknown): string {
  return `${canonicalJson(validateResponsesAttempt(value))}\n`;
}

function simulateResponsesProtocol(
  attemptValue: unknown,
  transformedRequest: string,
  simulation: ResponsesSimulation,
): AggregateReceipt {
  const attempt = validateResponsesAttempt(attemptValue);
  if (
    !simulation.credentialAvailable ||
    Buffer.byteLength(transformedRequest, "utf8") > MAX_REQUEST_BYTES ||
    sha256(transformedRequest) !== attempt.transformedRequestDigest
  )
    throw invalid();

  const body = canonicalJson({
    background: false,
    input: transformedRequest,
    model: attempt.modelId,
    store: false,
    tools: [],
  });
  const exposureCount = simulation.exposed ? 1 : 0;
  if (!simulation.exposed)
    return aggregate(
      attempt,
      body,
      null,
      null,
      null,
      0,
      "BLOCKED",
      "SAFE_BEFORE_EXPOSURE",
    );

  let responseId: string | null = null;
  let requestId: string | null = null;
  let output = "";
  let completed = false;
  let failed = false;
  let lost = false;
  for (const event of simulation.events) {
    if (event.type === "response.created") {
      if (
        responseId !== null ||
        !validText(event.responseId) ||
        !validText(event.requestId)
      )
        throw invalid();
      responseId = event.responseId;
      requestId = event.requestId;
    } else if (event.type === "response.output_text.delta") {
      output += event.text;
      if (Buffer.byteLength(output, "utf8") > MAX_PROCESS_STREAM_BYTES)
        throw invalid();
    } else if (event.type === "response.completed") completed = true;
    else if (event.type === "response.failed") failed = true;
    else if (event.type === "connection.lost" || event.type === "malformed")
      lost = true;
  }
  if (
    completed &&
    !failed &&
    !lost &&
    responseId !== null &&
    requestId !== null
  )
    return aggregate(
      attempt,
      body,
      responseId,
      requestId,
      output,
      exposureCount,
      "PASSED",
      "NO_RETRY_NEEDED",
    );
  if (failed && !completed && !lost)
    return aggregate(
      attempt,
      body,
      responseId,
      requestId,
      null,
      exposureCount,
      "BLOCKED",
      "TERMINAL",
    );
  return aggregate(
    attempt,
    body,
    responseId,
    requestId,
    null,
    exposureCount,
    "AMBIGUOUS",
    "NEVER_AUTOMATIC",
  );
}

function aggregate(
  attempt: ResponsesAttempt,
  body: string,
  responseId: string | null,
  requestId: string | null,
  output: string | null,
  exposureCount: number,
  outcome: CaseOutcome,
  retry: RetryDisposition,
): AggregateReceipt {
  return Object.freeze({
    attemptId: attempt.attemptId,
    requestDigest: attempt.transformedRequestDigest,
    serializedBodyDigest: sha256(body),
    responseIdDigest: responseId === null ? null : sha256(responseId),
    requestIdDigest: requestId === null ? null : sha256(requestId),
    outputDigest: output === null ? null : sha256(output),
    exposureCount,
    outcome,
    retry,
    effect: "SYNTHETIC_PROTOCOL_EVIDENCE_NO_OPENAI_REQUEST" as const,
  });
}

export type CodexInvocation = Readonly<{
  executable: "codex";
  args: readonly string[];
  stdin: string;
}>;

type FakeProcessObservation = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  killed: boolean;
}>;

export type FakeCodexExecutable = (
  invocation: CodexInvocation,
) => Promise<FakeProcessObservation>;

export function buildCodexInvocation(
  input: Readonly<{
    modelId: string;
    transformedRequest: string;
  }>,
): CodexInvocation {
  if (
    !validText(input.modelId) ||
    Buffer.byteLength(input.transformedRequest, "utf8") > MAX_REQUEST_BYTES
  )
    throw invalid();
  return Object.freeze({
    executable: "codex" as const,
    args: Object.freeze([
      "--ask-for-approval",
      "never",
      "exec",
      "--ephemeral",
      "--json",
      "--sandbox",
      "read-only",
      "--ignore-user-config",
      "--ignore-rules",
      "--model",
      input.modelId,
      "--output-schema",
      "synthetic-response.schema.json",
      "--cd",
      "synthetic-isolated-repository",
      "-",
    ]),
    stdin: input.transformedRequest,
  });
}

type CodexAggregateReceipt = Readonly<{
  invocationDigest: string;
  stdinDigest: string;
  finalMessageDigest: string | null;
  eventCount: number;
  toolEventCount: number;
  killed: boolean;
  outcome: CaseOutcome;
  effect: "SYNTHETIC_SUBPROCESS_EVIDENCE_NO_CODEX_INVOCATION";
}>;

export async function runCodexSubprocessHarness(
  invocation: CodexInvocation,
  executable: FakeCodexExecutable,
): Promise<CodexAggregateReceipt> {
  validateCodexInvocation(invocation);
  const observed = await executable(invocation);
  if (
    Buffer.byteLength(observed.stdout, "utf8") > MAX_PROCESS_STREAM_BYTES ||
    Buffer.byteLength(observed.stderr, "utf8") > MAX_PROCESS_STREAM_BYTES
  )
    throw invalid();
  const base = {
    invocationDigest: sha256(
      canonicalJson({
        executable: invocation.executable,
        args: invocation.args,
      }),
    ),
    stdinDigest: sha256(invocation.stdin),
    killed: observed.killed,
    effect: "SYNTHETIC_SUBPROCESS_EVIDENCE_NO_CODEX_INVOCATION" as const,
  };
  if (observed.timedOut) {
    if (!observed.killed) throw invalid();
    return Object.freeze({
      ...base,
      finalMessageDigest: null,
      eventCount: 0,
      toolEventCount: 0,
      outcome: "AMBIGUOUS" as const,
    });
  }
  if (observed.exitCode !== 0)
    return Object.freeze({
      ...base,
      finalMessageDigest: null,
      eventCount: 0,
      toolEventCount: 0,
      outcome: "BLOCKED" as const,
    });

  const lines = observed.stdout.split("\n").filter((line) => line.length > 0);
  let finalMessage: string | null = null;
  let completed = false;
  let toolEventCount = 0;
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw invalid();
    }
    if (!record(event) || !validText(event.type)) throw invalid();
    if (event.type === "turn.completed") completed = true;
    if (event.type === "item.completed") {
      if (!record(event.item) || !validText(event.item.type)) throw invalid();
      if (event.item.type === "agent_message") {
        if (!validText(event.item.text) || finalMessage !== null)
          throw invalid();
        finalMessage = event.item.text;
      } else {
        toolEventCount += 1;
      }
    }
  }
  const outcome =
    completed && finalMessage !== null && toolEventCount === 0
      ? "PASSED"
      : "BLOCKED";
  return Object.freeze({
    ...base,
    finalMessageDigest: finalMessage === null ? null : sha256(finalMessage),
    eventCount: lines.length,
    toolEventCount,
    outcome,
  });
}

function validateCodexInvocation(value: CodexInvocation): void {
  const expected = buildCodexInvocation({
    modelId: modelFromArgs(value.args),
    transformedRequest: value.stdin,
  });
  if (
    value.executable !== expected.executable ||
    canonicalJson(value.args) !== canonicalJson(expected.args)
  )
    throw invalid();
}

function modelFromArgs(args: readonly string[]): string {
  const index = args.indexOf("--model");
  const model = args[index + 1];
  if (index < 0 || index + 1 >= args.length || !validText(model))
    throw invalid();
  return model;
}

type MeasuredCase = Readonly<{
  id: string;
  expected: CaseOutcome;
  actual: CaseOutcome;
  exposureCount: number;
  matchesExpected: boolean;
}>;

export type ResponsesQualificationReport = Readonly<{
  schemaVersion: 1;
  evidenceDate: "2026-07-22";
  sourceFacts: Readonly<{
    responsesRecommendedForNewProjects: true;
    responsesStoredByDefault: true;
    storeFalseDocumented: true;
    backgroundTemporaryStorageDocumented: true;
    backgroundPollingAndCancellationDocumented: true;
    cancellationRepeatIdempotent: true;
    clientRequestIdForSupportReconciliation: true;
    createRequestIdempotencyDocumented: false;
    exactlyOnceAcceptanceDocumented: false;
  }>;
  corpusSha256: string;
  caseCount: number;
  passedCases: number;
  incorrectCases: number;
  cases: readonly MeasuredCase[];
  decision: "EVIDENCE_ONLY";
  effect: "OFFLINE_ONLY_NO_OPENAI_REQUEST_CREDENTIAL_OR_RESPONSE";
}>;

export async function measureResponsesQualificationCorpus(): Promise<ResponsesQualificationReport> {
  const base = responsesFixture(1);
  const v2 = responsesFixture(2);
  const cases: MeasuredCase[] = [];
  cases.push(
    responsesCase("01-valid-sync-v1", base, completedSimulation(), "PASSED"),
  );
  cases.push(
    responsesCase("02-valid-stream-v2", v2, streamingSimulation(), "PASSED"),
  );
  cases.push(
    responsesInvalidCase(
      "03-store-enabled",
      { ...base.attempt, store: true },
      base.request,
    ),
  );
  cases.push(
    responsesInvalidCase(
      "04-background-enabled",
      { ...base.attempt, background: true },
      base.request,
    ),
  );
  cases.push(
    responsesInvalidCase(
      "05-tools-enabled",
      { ...base.attempt, toolCount: 1 },
      base.request,
    ),
  );
  cases.push(
    responsesCase(
      "06-altered-input",
      base,
      completedSimulation(),
      "BLOCKED",
      `${base.request} altered`,
    ),
  );
  cases.push(
    responsesCase(
      "07-missing-credential",
      base,
      { ...completedSimulation(), credentialAvailable: false },
      "BLOCKED",
    ),
  );
  cases.push(
    responsesCase(
      "08-failure-before-exposure",
      base,
      { credentialAvailable: true, exposed: false, events: [] },
      "BLOCKED",
    ),
  );
  cases.push(
    responsesCase(
      "09-loss-after-exposure",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "connection.lost" }],
      },
      "AMBIGUOUS",
    ),
  );
  cases.push(
    responsesCase(
      "10-loss-after-created",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [
          {
            type: "response.created",
            responseId: "resp-synthetic",
            requestId: "request-synthetic",
          },
          { type: "connection.lost" },
        ],
      },
      "AMBIGUOUS",
    ),
  );
  cases.push(
    responsesCase(
      "11-provider-terminal-failure",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [
          {
            type: "response.created",
            responseId: "resp-synthetic",
            requestId: "request-synthetic",
          },
          { type: "response.failed" },
        ],
      },
      "BLOCKED",
    ),
  );
  cases.push(
    responsesCase(
      "12-malformed-receipt",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "malformed" }],
      },
      "AMBIGUOUS",
    ),
  );
  cases.push(
    measured("13-duplicate-create-not-idempotent", "AMBIGUOUS", "AMBIGUOUS", 1),
  );
  return responsesReport(cases);
}

export type CodexQualificationReport = Readonly<{
  schemaVersion: 1;
  evidenceDate: "2026-07-22";
  observedCliVersion: "codex-cli 0.144.6";
  sourceFacts: Readonly<{
    execStable: true;
    nonInteractive: true;
    savedAuthenticationReused: true;
    ephemeralFlag: true;
    readOnlySandboxFlag: true;
    approvalNeverFlag: true;
    jsonlFlag: true;
    outputSchemaFlag: true;
    ignoreUserConfigFlag: true;
    ignoreRulesFlag: true;
    projectInstructionDiscoveryStillApplies: true;
    agentToolsAndAdditionalContextPossible: true;
    exactReviewedInputIsolationProven: false;
  }>;
  corpusSha256: string;
  caseCount: number;
  passedCases: number;
  incorrectCases: number;
  cases: readonly MeasuredCase[];
  processHarnessPassed: true;
  decision: "SEPARATE_AGENT_BOUNDARY";
  effect: "OFFLINE_FAKE_EXECUTABLE_NO_CODEX_AUTH_OR_MODEL_INVOCATION";
}>;

export async function measureCodexHeadlessQualificationCorpus(): Promise<CodexQualificationReport> {
  const invocation = buildCodexInvocation({
    modelId: "model-reviewed",
    transformedRequest: "Review [[AW_CUSTOMER_1111111111111111]].",
  });
  const cases: MeasuredCase[] = [];
  cases.push(
    await codexCase(
      "01-valid-jsonl",
      invocation,
      fakeObservation("valid"),
      "PASSED",
    ),
  );
  cases.push(
    await codexCase(
      "02-tool-event",
      invocation,
      fakeObservation("tool"),
      "BLOCKED",
    ),
  );
  cases.push(
    await codexCase(
      "03-file-change-event",
      invocation,
      fakeObservation("file"),
      "BLOCKED",
    ),
  );
  cases.push(
    await codexCase(
      "04-nonzero-exit",
      invocation,
      fakeObservation("nonzero"),
      "BLOCKED",
    ),
  );
  cases.push(
    await codexCase(
      "05-timeout-killed",
      invocation,
      fakeObservation("timeout"),
      "AMBIGUOUS",
    ),
  );
  cases.push(
    await codexCase(
      "06-missing-completion",
      invocation,
      fakeObservation("incomplete"),
      "BLOCKED",
    ),
  );
  cases.push(
    await codexInvalidCase(
      "07-duplicate-message",
      invocation,
      fakeObservation("duplicate"),
    ),
  );
  cases.push(
    await codexInvalidCase(
      "08-malformed-jsonl",
      invocation,
      fakeObservation("malformed"),
    ),
  );
  cases.push(
    await codexInvalidCase(
      "09-oversized-stdout",
      invocation,
      fakeObservation("oversized"),
    ),
  );
  cases.push(
    await codexInvalidCase(
      "10-altered-argv",
      {
        ...invocation,
        args: invocation.args.filter((value) => value !== "--ephemeral"),
      },
      fakeObservation("valid"),
    ),
  );
  const reportCases = Object.freeze(cases);
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  if (incorrectCases > 0) throw invalid();
  return Object.freeze({
    schemaVersion: 1 as const,
    evidenceDate: "2026-07-22" as const,
    observedCliVersion: "codex-cli 0.144.6" as const,
    sourceFacts: Object.freeze({
      execStable: true as const,
      nonInteractive: true as const,
      savedAuthenticationReused: true as const,
      ephemeralFlag: true as const,
      readOnlySandboxFlag: true as const,
      approvalNeverFlag: true as const,
      jsonlFlag: true as const,
      outputSchemaFlag: true as const,
      ignoreUserConfigFlag: true as const,
      ignoreRulesFlag: true as const,
      projectInstructionDiscoveryStillApplies: true as const,
      agentToolsAndAdditionalContextPossible: true as const,
      exactReviewedInputIsolationProven: false as const,
    }),
    corpusSha256: sha256(canonicalJson(reportCases)),
    caseCount: cases.length,
    passedCases: cases.length - incorrectCases,
    incorrectCases,
    cases: reportCases,
    processHarnessPassed: true as const,
    decision: "SEPARATE_AGENT_BOUNDARY" as const,
    effect:
      "OFFLINE_FAKE_EXECUTABLE_NO_CODEX_AUTH_OR_MODEL_INVOCATION" as const,
  });
}

function responsesFixture(mappingSchemaVersion: 1 | 2): Readonly<{
  request: string;
  attempt: ResponsesAttempt;
}> {
  const request =
    mappingSchemaVersion === 1
      ? "Review [[AW_CUSTOMER_1111111111111111]]."
      : "Esamina [[AW_PROJECT_2222222222222222]].";
  return Object.freeze({
    request,
    attempt: validateResponsesAttempt({
      schemaVersion: 1,
      authorizationId: `authorization-v${mappingSchemaVersion}`,
      attemptId: `attempt-v${mappingSchemaVersion}`,
      providerKind: "OPENAI_RESPONSES",
      transportEvidenceDate: "2026-07-22",
      modelId: "model-reviewed",
      transformedRequestDigest: sha256(request),
      mappingSchemaVersion,
      store: false,
      background: false,
      toolCount: 0,
    }),
  });
}

function completedSimulation(): ResponsesSimulation {
  return Object.freeze({
    credentialAvailable: true,
    exposed: true,
    events: Object.freeze([
      Object.freeze({
        type: "response.created" as const,
        responseId: "resp-synthetic",
        requestId: "request-synthetic",
      }),
      Object.freeze({
        type: "response.output_text.delta" as const,
        text: "Synthetic output.",
      }),
      Object.freeze({ type: "response.completed" as const }),
    ]),
  });
}

function streamingSimulation(): ResponsesSimulation {
  return Object.freeze({
    credentialAvailable: true,
    exposed: true,
    events: Object.freeze([
      Object.freeze({
        type: "response.created" as const,
        responseId: "resp-stream",
        requestId: "request-stream",
      }),
      Object.freeze({
        type: "response.output_text.delta" as const,
        text: "Synthetic ",
      }),
      Object.freeze({
        type: "response.output_text.delta" as const,
        text: "stream.",
      }),
      Object.freeze({ type: "response.completed" as const }),
    ]),
  });
}

function responsesCase(
  id: string,
  fixture: ReturnType<typeof responsesFixture>,
  simulation: ResponsesSimulation,
  expected: CaseOutcome,
  request = fixture.request,
): MeasuredCase {
  let actual: CaseOutcome;
  let exposureCount = 0;
  try {
    const receipt = simulateResponsesProtocol(
      fixture.attempt,
      request,
      simulation,
    );
    actual = receipt.outcome;
    exposureCount = receipt.exposureCount;
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, expected, actual, exposureCount);
}

function responsesInvalidCase(
  id: string,
  attempt: unknown,
  request: string,
): MeasuredCase {
  let actual: CaseOutcome = "PASSED";
  try {
    simulateResponsesProtocol(attempt, request, completedSimulation());
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, 0);
}

function responsesReport(
  cases: readonly MeasuredCase[],
): ResponsesQualificationReport {
  const reportCases = Object.freeze([...cases]);
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  if (incorrectCases > 0) throw invalid();
  return Object.freeze({
    schemaVersion: 1 as const,
    evidenceDate: "2026-07-22" as const,
    sourceFacts: Object.freeze({
      responsesRecommendedForNewProjects: true as const,
      responsesStoredByDefault: true as const,
      storeFalseDocumented: true as const,
      backgroundTemporaryStorageDocumented: true as const,
      backgroundPollingAndCancellationDocumented: true as const,
      cancellationRepeatIdempotent: true as const,
      clientRequestIdForSupportReconciliation: true as const,
      createRequestIdempotencyDocumented: false as const,
      exactlyOnceAcceptanceDocumented: false as const,
    }),
    corpusSha256: sha256(canonicalJson(reportCases)),
    caseCount: cases.length,
    passedCases: cases.length - incorrectCases,
    incorrectCases,
    cases: reportCases,
    decision: "EVIDENCE_ONLY" as const,
    effect: "OFFLINE_ONLY_NO_OPENAI_REQUEST_CREDENTIAL_OR_RESPONSE" as const,
  });
}

async function codexCase(
  id: string,
  invocation: CodexInvocation,
  observation: FakeProcessObservation,
  expected: CaseOutcome,
): Promise<MeasuredCase> {
  const receipt = await runCodexSubprocessHarness(
    invocation,
    async () => observation,
  );
  return measured(id, expected, receipt.outcome, 0);
}

async function codexInvalidCase(
  id: string,
  invocation: CodexInvocation,
  observation: FakeProcessObservation,
): Promise<MeasuredCase> {
  let actual: CaseOutcome = "PASSED";
  try {
    await runCodexSubprocessHarness(invocation, async () => observation);
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, 0);
}

function fakeObservation(
  kind:
    | "valid"
    | "tool"
    | "file"
    | "nonzero"
    | "timeout"
    | "incomplete"
    | "duplicate"
    | "malformed"
    | "oversized",
): FakeProcessObservation {
  const base = [
    JSON.stringify({ type: "thread.started", thread_id: "thread-synthetic" }),
    JSON.stringify({ type: "turn.started" }),
  ];
  if (kind === "valid")
    base.push(
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "Synthetic final." },
      }),
      JSON.stringify({ type: "turn.completed" }),
    );
  if (kind === "tool")
    base.push(
      JSON.stringify({
        type: "item.completed",
        item: { type: "command_execution", command: "synthetic" },
      }),
      JSON.stringify({ type: "turn.completed" }),
    );
  if (kind === "file")
    base.push(
      JSON.stringify({
        type: "item.completed",
        item: { type: "file_change", path: "synthetic.txt" },
      }),
      JSON.stringify({ type: "turn.completed" }),
    );
  if (kind === "incomplete")
    base.push(
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "Synthetic final." },
      }),
    );
  if (kind === "duplicate")
    base.push(
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "First." },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "Second." },
      }),
      JSON.stringify({ type: "turn.completed" }),
    );
  return Object.freeze({
    stdout:
      kind === "malformed"
        ? "{not-json}\n"
        : kind === "oversized"
          ? "x".repeat(MAX_PROCESS_STREAM_BYTES + 1)
          : `${base.join("\n")}\n`,
    stderr: "",
    exitCode: kind === "nonzero" ? 1 : kind === "timeout" ? null : 0,
    timedOut: kind === "timeout",
    killed: kind === "timeout",
  });
}

function measured(
  id: string,
  expected: CaseOutcome,
  actual: CaseOutcome,
  exposureCount: number,
): MeasuredCase {
  return Object.freeze({
    id,
    expected,
    actual,
    exposureCount,
    matchesExpected: expected === actual,
  });
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (record(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 512 &&
    !/\p{Cc}/u.test(value)
  );
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function invalid(): OpenAiTransportEvidenceError {
  return new OpenAiTransportEvidenceError();
}
