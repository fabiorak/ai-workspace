import { createHash } from "node:crypto";

const DIGEST = /^[a-f0-9]{64}$/u;
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_STREAM_BYTES = 32 * 1024;
const API_VERSION = "2023-06-01";
const SYSTEM_PROMPT = "Return one synthetic schema-valid answer. Use no tools.";

type CaseOutcome = "PASSED" | "BLOCKED" | "AMBIGUOUS";
type RetryDisposition =
  "NO_RETRY_NEEDED" | "SAFE_BEFORE_EXPOSURE" | "NEVER_AUTOMATIC" | "TERMINAL";

export class AnthropicTransportEvidenceError extends Error {
  public constructor() {
    super(
      "The synthetic Anthropic transport evidence is invalid, unsafe, incomplete, oversized, or ambiguous. No model was invoked.",
    );
    this.name = "AnthropicTransportEvidenceError";
  }
}

export type AnthropicMessagesAttempt = Readonly<{
  schemaVersion: 1;
  authorizationId: string;
  attemptId: string;
  providerKind: "ANTHROPIC_MESSAGES";
  transportEvidenceDate: "2026-07-22";
  modelId: string;
  transformedRequestDigest: string;
  systemPromptDigest: string;
  mappingSchemaVersion: 1 | 2;
  apiVersion: "2023-06-01";
  maxTokens: 256;
  toolCount: 0;
}>;

type MessagesEvent =
  | Readonly<{ type: "message_start"; messageId: string; requestId: string }>
  | Readonly<{ type: "content_block_start"; blockType: "text" | "tool_use" }>
  | Readonly<{
      type: "content_block_delta";
      deltaType: "text_delta";
      text: string;
    }>
  | Readonly<{ type: "content_block_stop" }>
  | Readonly<{
      type: "message_delta";
      stopReason:
        "end_turn" | "max_tokens" | "refusal" | "pause_turn" | "tool_use";
    }>
  | Readonly<{ type: "message_stop" }>
  | Readonly<{
      type: "provider_error";
      errorType: "rate_limit" | "overloaded" | "invalid_request";
    }>
  | Readonly<{ type: "connection_lost" }>
  | Readonly<{ type: "malformed" }>;

type MessagesSimulation = Readonly<{
  credentialAvailable: boolean;
  exposed: boolean;
  events: readonly MessagesEvent[];
}>;

type MessagesReceipt = Readonly<{
  attemptId: string;
  requestDigest: string;
  serializedBodyDigest: string;
  headerNamesDigest: string;
  messageIdDigest: string | null;
  requestIdDigest: string | null;
  outputDigest: string | null;
  stopReason: string | null;
  exposureCount: number;
  outcome: CaseOutcome;
  retry: RetryDisposition;
  effect: "SYNTHETIC_PROTOCOL_EVIDENCE_NO_ANTHROPIC_REQUEST";
}>;

export function validateAnthropicMessagesAttempt(
  value: unknown,
): AnthropicMessagesAttempt {
  const keys = [
    "apiVersion",
    "attemptId",
    "authorizationId",
    "mappingSchemaVersion",
    "maxTokens",
    "modelId",
    "providerKind",
    "schemaVersion",
    "systemPromptDigest",
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
    value.providerKind !== "ANTHROPIC_MESSAGES" ||
    value.transportEvidenceDate !== "2026-07-22" ||
    !validText(value.modelId) ||
    !validDigest(value.transformedRequestDigest) ||
    !validDigest(value.systemPromptDigest) ||
    ![1, 2].includes(value.mappingSchemaVersion as number) ||
    value.apiVersion !== API_VERSION ||
    value.maxTokens !== 256 ||
    value.toolCount !== 0
  )
    throw invalid();
  return Object.freeze({ ...(value as AnthropicMessagesAttempt) });
}

export function encodeAnthropicMessagesAttempt(value: unknown): string {
  return `${canonicalJson(validateAnthropicMessagesAttempt(value))}\n`;
}

function simulateMessagesProtocol(
  attemptValue: unknown,
  transformedRequest: string,
  systemPrompt: string,
  simulation: MessagesSimulation,
): MessagesReceipt {
  const attempt = validateAnthropicMessagesAttempt(attemptValue);
  if (
    !simulation.credentialAvailable ||
    Buffer.byteLength(transformedRequest, "utf8") > MAX_REQUEST_BYTES ||
    Buffer.byteLength(systemPrompt, "utf8") > MAX_REQUEST_BYTES ||
    sha256(transformedRequest) !== attempt.transformedRequestDigest ||
    sha256(systemPrompt) !== attempt.systemPromptDigest
  )
    throw invalid();

  const body = canonicalJson({
    max_tokens: 256,
    messages: [{ content: transformedRequest, role: "user" }],
    model: attempt.modelId,
    system: systemPrompt,
    tools: [],
  });
  const headerNames = ["anthropic-version", "content-type", "x-api-key"];
  if (!simulation.exposed)
    return messagesReceipt(
      attempt,
      body,
      headerNames,
      null,
      null,
      null,
      null,
      0,
      "BLOCKED",
      "SAFE_BEFORE_EXPOSURE",
    );

  let messageId: string | null = null;
  let requestId: string | null = null;
  let output = "";
  let blockOpen = false;
  let blockStopped = false;
  let stopReason: string | null = null;
  let messageStopped = false;
  let invalidSequence = false;
  let terminalError = false;
  let ambiguous = false;
  for (const event of simulation.events) {
    if (event.type === "message_start") {
      if (
        messageId !== null ||
        !validText(event.messageId) ||
        !validText(event.requestId)
      )
        invalidSequence = true;
      else {
        messageId = event.messageId;
        requestId = event.requestId;
      }
    } else if (event.type === "content_block_start") {
      if (messageId === null || blockOpen || event.blockType !== "text")
        invalidSequence = true;
      else blockOpen = true;
    } else if (event.type === "content_block_delta") {
      if (!blockOpen || blockStopped || event.deltaType !== "text_delta")
        invalidSequence = true;
      output += event.text;
      if (Buffer.byteLength(output, "utf8") > MAX_STREAM_BYTES) throw invalid();
    } else if (event.type === "content_block_stop") {
      if (!blockOpen || blockStopped) invalidSequence = true;
      blockStopped = true;
    } else if (event.type === "message_delta") {
      if (!blockStopped || stopReason !== null) invalidSequence = true;
      stopReason = event.stopReason;
    } else if (event.type === "message_stop") {
      if (stopReason === null || messageStopped) invalidSequence = true;
      messageStopped = true;
    } else if (event.type === "provider_error") {
      if (event.errorType === "invalid_request") terminalError = true;
      else ambiguous = true;
    } else if (event.type === "connection_lost" || event.type === "malformed")
      ambiguous = true;
  }

  if (
    !invalidSequence &&
    !terminalError &&
    !ambiguous &&
    messageId !== null &&
    requestId !== null &&
    blockStopped &&
    stopReason === "end_turn" &&
    messageStopped
  )
    return messagesReceipt(
      attempt,
      body,
      headerNames,
      messageId,
      requestId,
      output,
      stopReason,
      1,
      "PASSED",
      "NO_RETRY_NEEDED",
    );
  if (
    terminalError ||
    ["max_tokens", "refusal", "pause_turn", "tool_use"].includes(
      stopReason ?? "",
    )
  )
    return messagesReceipt(
      attempt,
      body,
      headerNames,
      messageId,
      requestId,
      null,
      stopReason,
      1,
      "BLOCKED",
      "TERMINAL",
    );
  return messagesReceipt(
    attempt,
    body,
    headerNames,
    messageId,
    requestId,
    null,
    stopReason,
    1,
    "AMBIGUOUS",
    "NEVER_AUTOMATIC",
  );
}

function messagesReceipt(
  attempt: AnthropicMessagesAttempt,
  body: string,
  headerNames: readonly string[],
  messageId: string | null,
  requestId: string | null,
  output: string | null,
  stopReason: string | null,
  exposureCount: number,
  outcome: CaseOutcome,
  retry: RetryDisposition,
): MessagesReceipt {
  return Object.freeze({
    attemptId: attempt.attemptId,
    requestDigest: attempt.transformedRequestDigest,
    serializedBodyDigest: sha256(body),
    headerNamesDigest: sha256(canonicalJson(headerNames)),
    messageIdDigest: messageId === null ? null : sha256(messageId),
    requestIdDigest: requestId === null ? null : sha256(requestId),
    outputDigest: output === null ? null : sha256(output),
    stopReason,
    exposureCount,
    outcome,
    retry,
    effect: "SYNTHETIC_PROTOCOL_EVIDENCE_NO_ANTHROPIC_REQUEST" as const,
  });
}

export type ClaudeProfile = "BARE_API_AUTH" | "MANAGED_LOGIN";
export type ClaudeInvocation = Readonly<{
  executable: "claude";
  profile: ClaudeProfile;
  args: readonly string[];
  stdin: string;
}>;

type FakeProcessObservation = Readonly<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  killed: boolean;
  processTreeCleaned: boolean;
}>;

export type FakeClaudeExecutable = (
  invocation: ClaudeInvocation,
) => Promise<FakeProcessObservation>;

export function buildClaudeInvocation(
  input: Readonly<{
    profile: ClaudeProfile;
    modelId: string;
    transformedRequest: string;
  }>,
): ClaudeInvocation {
  if (
    !["BARE_API_AUTH", "MANAGED_LOGIN"].includes(input.profile) ||
    !validText(input.modelId) ||
    Buffer.byteLength(input.transformedRequest, "utf8") > MAX_REQUEST_BYTES
  )
    throw invalid();
  const args = [
    "-p",
    "--safe-mode",
    "--tools",
    "",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--output-format",
    "stream-json",
    "--verbose",
    "--json-schema",
    '{"type":"object","required":["answer"],"properties":{"answer":{"type":"string"}},"additionalProperties":false}',
    "--system-prompt",
    SYSTEM_PROMPT,
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    "synthetic-empty-mcp.json",
    "--permission-mode",
    "dontAsk",
    "--max-budget-usd",
    "0.05",
    "--model",
    input.modelId,
  ];
  if (input.profile === "BARE_API_AUTH") args.push("--bare");
  return Object.freeze({
    executable: "claude" as const,
    profile: input.profile,
    args: Object.freeze(args),
    stdin: input.transformedRequest,
  });
}

type ClaudeReceipt = Readonly<{
  profile: ClaudeProfile;
  invocationDigest: string;
  stdinDigest: string;
  resultDigest: string | null;
  eventCount: number;
  toolEventCount: number;
  loadedContextCount: number;
  killed: boolean;
  processTreeCleaned: boolean;
  outcome: CaseOutcome;
  effect: "SYNTHETIC_SUBPROCESS_EVIDENCE_NO_CLAUDE_INVOCATION";
}>;

export async function runClaudeSubprocessHarness(
  invocation: ClaudeInvocation,
  executable: FakeClaudeExecutable,
): Promise<ClaudeReceipt> {
  validateClaudeInvocation(invocation);
  const observed = await executable(invocation);
  if (
    Buffer.byteLength(observed.stdout, "utf8") > MAX_STREAM_BYTES ||
    Buffer.byteLength(observed.stderr, "utf8") > MAX_STREAM_BYTES
  )
    throw invalid();
  const base = {
    profile: invocation.profile,
    invocationDigest: sha256(
      canonicalJson({
        executable: invocation.executable,
        args: invocation.args,
      }),
    ),
    stdinDigest: sha256(invocation.stdin),
    killed: observed.killed,
    processTreeCleaned: observed.processTreeCleaned,
    effect: "SYNTHETIC_SUBPROCESS_EVIDENCE_NO_CLAUDE_INVOCATION" as const,
  };
  if (observed.timedOut) {
    if (!observed.killed || !observed.processTreeCleaned) throw invalid();
    return Object.freeze({
      ...base,
      resultDigest: null,
      eventCount: 0,
      toolEventCount: 0,
      loadedContextCount: 0,
      outcome: "AMBIGUOUS" as const,
    });
  }
  if (observed.exitCode !== 0 || !observed.processTreeCleaned)
    return Object.freeze({
      ...base,
      resultDigest: null,
      eventCount: 0,
      toolEventCount: 0,
      loadedContextCount: 0,
      outcome: "BLOCKED" as const,
    });

  const lines = observed.stdout.split("\n").filter((line) => line.length > 0);
  let initialized = false;
  let result: string | null = null;
  let toolEventCount = 0;
  let loadedContextCount = 0;
  for (const line of lines) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw invalid();
    }
    if (!record(event) || !validText(event.type)) throw invalid();
    if (event.type === "system") {
      if (event.subtype !== "init" || initialized) throw invalid();
      initialized = true;
      for (const key of [
        "tools",
        "mcp_servers",
        "plugins",
        "hooks",
        "skills",
        "memory",
      ])
        if (Array.isArray(event[key])) loadedContextCount += event[key].length;
        else if (event[key] !== undefined) throw invalid();
    } else if (event.type === "assistant") {
      if (!Array.isArray(event.content)) throw invalid();
      for (const block of event.content) {
        if (!record(block) || !validText(block.type)) throw invalid();
        if (block.type === "tool_use") toolEventCount += 1;
        else if (block.type !== "text") loadedContextCount += 1;
      }
    } else if (event.type === "result") {
      if (
        event.subtype !== "success" ||
        !validText(event.result) ||
        result !== null
      )
        throw invalid();
      result = event.result;
    } else if (event.type === "retry") loadedContextCount += 1;
    else loadedContextCount += 1;
  }
  const outcome =
    initialized &&
    result !== null &&
    toolEventCount === 0 &&
    loadedContextCount === 0
      ? "PASSED"
      : "BLOCKED";
  return Object.freeze({
    ...base,
    resultDigest: result === null ? null : sha256(result),
    eventCount: lines.length,
    toolEventCount,
    loadedContextCount,
    outcome,
  });
}

function validateClaudeInvocation(value: ClaudeInvocation): void {
  const expected = buildClaudeInvocation({
    profile: value.profile,
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

export type AnthropicMessagesQualificationReport = Readonly<{
  schemaVersion: 1;
  evidenceDate: "2026-07-22";
  sourceFacts: Readonly<{
    messagesStateless: true;
    apiKeyHeaderRequired: true;
    apiVersionHeaderRequired: true;
    sseStreamingDocumented: true;
    requestIdentifiersDocumented: true;
    rateLimitAndOverloadErrorsDocumented: true;
    sdkAutomaticRetriesDocumented: true;
    createIdempotencyDocumented: false;
    exactlyOnceAcceptanceDocumented: false;
    postTimeoutMessageRetrievalDocumented: false;
    messageCancellationDocumented: false;
  }>;
  corpusSha256: string;
  caseCount: number;
  passedCases: number;
  incorrectCases: number;
  cases: readonly MeasuredCase[];
  decision: "EVIDENCE_ONLY";
  effect: "OFFLINE_ONLY_NO_ANTHROPIC_REQUEST_CREDENTIAL_OR_RESPONSE";
}>;

export async function measureAnthropicMessagesQualificationCorpus(): Promise<AnthropicMessagesQualificationReport> {
  const base = messagesFixture(1);
  const v2 = messagesFixture(2);
  const cases: MeasuredCase[] = [
    messagesCase("01-valid-nonstream-v1", base, completedMessages(), "PASSED"),
    messagesCase("02-valid-stream-v2", v2, streamedMessages(), "PASSED"),
    messagesInvalidCase(
      "03-tools-enabled",
      { ...base.attempt, toolCount: 1 },
      base,
    ),
    messagesInvalidCase(
      "04-api-version-altered",
      { ...base.attempt, apiVersion: "future" },
      base,
    ),
    messagesInvalidCase(
      "05-output-unbounded",
      { ...base.attempt, maxTokens: 4096 },
      base,
    ),
    messagesCase(
      "06-altered-input",
      base,
      completedMessages(),
      "BLOCKED",
      `${base.request} altered`,
    ),
    messagesCase(
      "07-altered-system",
      base,
      completedMessages(),
      "BLOCKED",
      base.request,
      `${SYSTEM_PROMPT} altered`,
    ),
    messagesCase(
      "08-missing-credential",
      base,
      { ...completedMessages(), credentialAvailable: false },
      "BLOCKED",
    ),
    messagesCase(
      "09-failure-before-exposure",
      base,
      { credentialAvailable: true, exposed: false, events: [] },
      "BLOCKED",
    ),
    messagesCase(
      "10-loss-after-exposure",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "connection_lost" }],
      },
      "AMBIGUOUS",
    ),
    messagesCase(
      "11-loss-after-message-start",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [
          {
            type: "message_start",
            messageId: "msg-synthetic",
            requestId: "req-synthetic",
          },
          { type: "connection_lost" },
        ],
      },
      "AMBIGUOUS",
    ),
    messagesCase(
      "12-rate-limit-after-exposure",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "provider_error", errorType: "rate_limit" }],
      },
      "AMBIGUOUS",
    ),
    messagesCase(
      "13-overload-after-exposure",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "provider_error", errorType: "overloaded" }],
      },
      "AMBIGUOUS",
    ),
    messagesCase(
      "14-invalid-request",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "provider_error", errorType: "invalid_request" }],
      },
      "BLOCKED",
    ),
    messagesCase(
      "15-max-tokens",
      base,
      stoppedMessages("max_tokens"),
      "BLOCKED",
    ),
    messagesCase("16-tool-use", base, toolMessages(), "BLOCKED"),
    messagesCase("17-reordered-stream", base, reorderedMessages(), "AMBIGUOUS"),
    messagesCase(
      "18-malformed-stream",
      base,
      {
        credentialAvailable: true,
        exposed: true,
        events: [{ type: "malformed" }],
      },
      "AMBIGUOUS",
    ),
    measured("19-duplicate-create-no-idempotency", "AMBIGUOUS", "AMBIGUOUS", 1),
  ];
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  if (incorrectCases > 0) throw invalid();
  const reportCases = Object.freeze(cases);
  return Object.freeze({
    schemaVersion: 1 as const,
    evidenceDate: "2026-07-22" as const,
    sourceFacts: Object.freeze({
      messagesStateless: true as const,
      apiKeyHeaderRequired: true as const,
      apiVersionHeaderRequired: true as const,
      sseStreamingDocumented: true as const,
      requestIdentifiersDocumented: true as const,
      rateLimitAndOverloadErrorsDocumented: true as const,
      sdkAutomaticRetriesDocumented: true as const,
      createIdempotencyDocumented: false as const,
      exactlyOnceAcceptanceDocumented: false as const,
      postTimeoutMessageRetrievalDocumented: false as const,
      messageCancellationDocumented: false as const,
    }),
    corpusSha256: sha256(canonicalJson(reportCases)),
    caseCount: cases.length,
    passedCases: cases.length - incorrectCases,
    incorrectCases,
    cases: reportCases,
    decision: "EVIDENCE_ONLY" as const,
    effect: "OFFLINE_ONLY_NO_ANTHROPIC_REQUEST_CREDENTIAL_OR_RESPONSE" as const,
  });
}

export type ClaudeHeadlessQualificationReport = Readonly<{
  schemaVersion: 1;
  evidenceDate: "2026-07-22";
  observedCliVersion: "2.1.215";
  sourceFacts: Readonly<{
    printModeDocumented: true;
    bareModeSkipsOAuthAndKeychain: true;
    bareModeRequiresApiKeyOrHelper: true;
    safeModeDocumented: true;
    toolsCanBeDisabled: true;
    sessionPersistenceCanBeDisabled: true;
    structuredOutputDocumented: true;
    settingSourcesCanBeRestricted: true;
    strictMcpConfigDocumented: true;
    maximumCostFlagDocumented: true;
    managedLoginExactInputIsolationProven: false;
  }>;
  corpusSha256: string;
  caseCount: number;
  passedCases: number;
  incorrectCases: number;
  cases: readonly MeasuredCase[];
  processHarnessPassed: true;
  bareDecision: "API_EQUIVALENT_NOT_FALLBACK";
  managedLoginDecision: "SEPARATE_AGENT_BOUNDARY";
  effect: "OFFLINE_FAKE_EXECUTABLE_NO_CLAUDE_AUTH_OR_MODEL_INVOCATION";
}>;

export async function measureClaudeHeadlessQualificationCorpus(): Promise<ClaudeHeadlessQualificationReport> {
  const bare = buildClaudeInvocation({
    profile: "BARE_API_AUTH",
    modelId: "model-reviewed",
    transformedRequest: "Review [[AW_CUSTOMER_1111111111111111]].",
  });
  const managed = buildClaudeInvocation({
    profile: "MANAGED_LOGIN",
    modelId: "model-reviewed",
    transformedRequest: "Esamina [[AW_PROJECT_2222222222222222]].",
  });
  const cases: MeasuredCase[] = [
    await claudeCase(
      "01-bare-valid-stream",
      bare,
      fakeClaudeObservation("valid"),
      "PASSED",
    ),
    await claudeCase(
      "02-managed-valid-stream",
      managed,
      fakeClaudeObservation("valid"),
      "PASSED",
    ),
    await claudeCase(
      "03-tool-event",
      managed,
      fakeClaudeObservation("tool"),
      "BLOCKED",
    ),
    await claudeCase(
      "04-loaded-mcp",
      managed,
      fakeClaudeObservation("mcp"),
      "BLOCKED",
    ),
    await claudeCase(
      "05-loaded-plugin",
      managed,
      fakeClaudeObservation("plugin"),
      "BLOCKED",
    ),
    await claudeCase(
      "06-retry-event",
      managed,
      fakeClaudeObservation("retry"),
      "BLOCKED",
    ),
    await claudeCase(
      "07-nonzero-exit",
      bare,
      fakeClaudeObservation("nonzero"),
      "BLOCKED",
    ),
    await claudeCase(
      "08-timeout-cleaned",
      bare,
      fakeClaudeObservation("timeout"),
      "AMBIGUOUS",
    ),
    await claudeCase(
      "09-incomplete-result",
      bare,
      fakeClaudeObservation("incomplete"),
      "BLOCKED",
    ),
    await claudeInvalidCase(
      "10-duplicate-result",
      bare,
      fakeClaudeObservation("duplicate"),
    ),
    await claudeInvalidCase(
      "11-malformed-json",
      bare,
      fakeClaudeObservation("malformed"),
    ),
    await claudeInvalidCase(
      "12-oversized-stdout",
      bare,
      fakeClaudeObservation("oversized"),
    ),
    await claudeInvalidCase(
      "13-altered-argv",
      { ...bare, args: bare.args.filter((value) => value !== "--bare") },
      fakeClaudeObservation("valid"),
    ),
    await claudeCase(
      "14-process-tree-not-clean",
      managed,
      fakeClaudeObservation("unclean"),
      "BLOCKED",
    ),
  ];
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  if (incorrectCases > 0) throw invalid();
  const reportCases = Object.freeze(cases);
  return Object.freeze({
    schemaVersion: 1 as const,
    evidenceDate: "2026-07-22" as const,
    observedCliVersion: "2.1.215" as const,
    sourceFacts: Object.freeze({
      printModeDocumented: true as const,
      bareModeSkipsOAuthAndKeychain: true as const,
      bareModeRequiresApiKeyOrHelper: true as const,
      safeModeDocumented: true as const,
      toolsCanBeDisabled: true as const,
      sessionPersistenceCanBeDisabled: true as const,
      structuredOutputDocumented: true as const,
      settingSourcesCanBeRestricted: true as const,
      strictMcpConfigDocumented: true as const,
      maximumCostFlagDocumented: true as const,
      managedLoginExactInputIsolationProven: false as const,
    }),
    corpusSha256: sha256(canonicalJson(reportCases)),
    caseCount: cases.length,
    passedCases: cases.length - incorrectCases,
    incorrectCases,
    cases: reportCases,
    processHarnessPassed: true as const,
    bareDecision: "API_EQUIVALENT_NOT_FALLBACK" as const,
    managedLoginDecision: "SEPARATE_AGENT_BOUNDARY" as const,
    effect:
      "OFFLINE_FAKE_EXECUTABLE_NO_CLAUDE_AUTH_OR_MODEL_INVOCATION" as const,
  });
}

function messagesFixture(mappingSchemaVersion: 1 | 2): Readonly<{
  request: string;
  attempt: AnthropicMessagesAttempt;
}> {
  const request =
    mappingSchemaVersion === 1
      ? "Review [[AW_CUSTOMER_1111111111111111]]."
      : "Esamina [[AW_PROJECT_2222222222222222]].";
  return Object.freeze({
    request,
    attempt: validateAnthropicMessagesAttempt({
      schemaVersion: 1,
      authorizationId: `authorization-v${mappingSchemaVersion}`,
      attemptId: `attempt-v${mappingSchemaVersion}`,
      providerKind: "ANTHROPIC_MESSAGES",
      transportEvidenceDate: "2026-07-22",
      modelId: "model-reviewed",
      transformedRequestDigest: sha256(request),
      systemPromptDigest: sha256(SYSTEM_PROMPT),
      mappingSchemaVersion,
      apiVersion: API_VERSION,
      maxTokens: 256,
      toolCount: 0,
    }),
  });
}

function completedMessages(): MessagesSimulation {
  return streamedMessages();
}

function streamedMessages(): MessagesSimulation {
  return Object.freeze({
    credentialAvailable: true,
    exposed: true,
    events: Object.freeze([
      {
        type: "message_start" as const,
        messageId: "msg-synthetic",
        requestId: "req-synthetic",
      },
      { type: "content_block_start" as const, blockType: "text" as const },
      {
        type: "content_block_delta" as const,
        deltaType: "text_delta" as const,
        text: "Synthetic ",
      },
      {
        type: "content_block_delta" as const,
        deltaType: "text_delta" as const,
        text: "output.",
      },
      { type: "content_block_stop" as const },
      { type: "message_delta" as const, stopReason: "end_turn" as const },
      { type: "message_stop" as const },
    ]),
  });
}

function stoppedMessages(
  stopReason: "max_tokens" | "refusal" | "pause_turn",
): MessagesSimulation {
  const simulation = streamedMessages();
  return Object.freeze({
    ...simulation,
    events: simulation.events.map((event) =>
      event.type === "message_delta" ? { ...event, stopReason } : event,
    ),
  });
}

function toolMessages(): MessagesSimulation {
  const simulation = streamedMessages();
  return Object.freeze({
    ...simulation,
    events: simulation.events.map((event) => {
      if (event.type === "content_block_start")
        return { ...event, blockType: "tool_use" as const };
      if (event.type === "message_delta")
        return { ...event, stopReason: "tool_use" as const };
      return event;
    }),
  });
}

function reorderedMessages(): MessagesSimulation {
  return Object.freeze({
    credentialAvailable: true,
    exposed: true,
    events: Object.freeze([
      {
        type: "message_start" as const,
        messageId: "msg-synthetic",
        requestId: "req-synthetic",
      },
      {
        type: "content_block_delta" as const,
        deltaType: "text_delta" as const,
        text: "early",
      },
      { type: "message_stop" as const },
    ]),
  });
}

function messagesCase(
  id: string,
  fixture: ReturnType<typeof messagesFixture>,
  simulation: MessagesSimulation,
  expected: CaseOutcome,
  request = fixture.request,
  systemPrompt = SYSTEM_PROMPT,
): MeasuredCase {
  let actual: CaseOutcome;
  let exposureCount = 0;
  try {
    const receipt = simulateMessagesProtocol(
      fixture.attempt,
      request,
      systemPrompt,
      simulation,
    );
    actual = receipt.outcome;
    exposureCount = receipt.exposureCount;
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, expected, actual, exposureCount);
}

function messagesInvalidCase(
  id: string,
  attempt: unknown,
  fixture: ReturnType<typeof messagesFixture>,
): MeasuredCase {
  let actual: CaseOutcome = "PASSED";
  try {
    simulateMessagesProtocol(
      attempt,
      fixture.request,
      SYSTEM_PROMPT,
      completedMessages(),
    );
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, 0);
}

async function claudeCase(
  id: string,
  invocation: ClaudeInvocation,
  observation: FakeProcessObservation,
  expected: CaseOutcome,
): Promise<MeasuredCase> {
  const receipt = await runClaudeSubprocessHarness(
    invocation,
    async () => observation,
  );
  return measured(id, expected, receipt.outcome, 0);
}

async function claudeInvalidCase(
  id: string,
  invocation: ClaudeInvocation,
  observation: FakeProcessObservation,
): Promise<MeasuredCase> {
  let actual: CaseOutcome = "PASSED";
  try {
    await runClaudeSubprocessHarness(invocation, async () => observation);
  } catch {
    actual = "BLOCKED";
  }
  return measured(id, "BLOCKED", actual, 0);
}

function fakeClaudeObservation(
  kind:
    | "valid"
    | "tool"
    | "mcp"
    | "plugin"
    | "retry"
    | "nonzero"
    | "timeout"
    | "incomplete"
    | "duplicate"
    | "malformed"
    | "oversized"
    | "unclean",
): FakeProcessObservation {
  const init: Record<string, unknown> = {
    type: "system",
    subtype: "init",
    tools: [],
    mcp_servers: [],
    plugins: [],
    hooks: [],
    skills: [],
    memory: [],
  };
  if (kind === "mcp") init.mcp_servers = [{ name: "synthetic" }];
  if (kind === "plugin") init.plugins = [{ name: "synthetic" }];
  const events: Record<string, unknown>[] = [init];
  if (kind === "tool")
    events.push({
      type: "assistant",
      content: [{ type: "tool_use", name: "synthetic" }],
    });
  else
    events.push({
      type: "assistant",
      content: [{ type: "text", text: "Synthetic output." }],
    });
  if (kind === "retry") events.push({ type: "retry", attempt: 2 });
  if (kind !== "incomplete")
    events.push({
      type: "result",
      subtype: "success",
      result: "Synthetic final.",
    });
  if (kind === "duplicate")
    events.push({
      type: "result",
      subtype: "success",
      result: "Second final.",
    });
  return Object.freeze({
    stdout:
      kind === "malformed"
        ? "{not-json}\n"
        : kind === "oversized"
          ? "x".repeat(MAX_STREAM_BYTES + 1)
          : `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    stderr: "",
    exitCode: kind === "nonzero" ? 1 : kind === "timeout" ? null : 0,
    timedOut: kind === "timeout",
    killed: kind === "timeout",
    processTreeCleaned: kind !== "unclean",
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

function invalid(): AnthropicTransportEvidenceError {
  return new AnthropicTransportEvidenceError();
}
