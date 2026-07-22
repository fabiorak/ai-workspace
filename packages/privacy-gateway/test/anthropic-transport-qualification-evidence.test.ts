import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnthropicTransportEvidenceError,
  buildClaudeInvocation,
  encodeAnthropicMessagesAttempt,
  measureAnthropicMessagesQualificationCorpus,
  measureClaudeHeadlessQualificationCorpus,
  runClaudeSubprocessHarness,
  validateAnthropicMessagesAttempt,
} from "./anthropic-transport-qualification-evidence.ts";

describe("Anthropic transport qualification evidence", () => {
  it("reproduces the Messages corpus without adopting delivery", async () => {
    const first = await measureAnthropicMessagesQualificationCorpus();
    const second = await measureAnthropicMessagesQualificationCorpus();
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 19);
    assert.equal(first.passedCases, 19);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.sourceFacts.createIdempotencyDocumented, false);
    assert.equal(
      first.sourceFacts.postTimeoutMessageRetrievalDocumented,
      false,
    );
    assert.equal(first.decision, "EVIDENCE_ONLY");
  });

  it("reproduces distinct bare and managed-login Claude decisions", async () => {
    const first = await measureClaudeHeadlessQualificationCorpus();
    const second = await measureClaudeHeadlessQualificationCorpus();
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 14);
    assert.equal(first.passedCases, 14);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.processHarnessPassed, true);
    assert.equal(first.bareDecision, "API_EQUIVALENT_NOT_FALLBACK");
    assert.equal(first.managedLoginDecision, "SEPARATE_AGENT_BOUNDARY");
  });

  it("encodes only canonical bounded Messages attempt metadata", () => {
    const attempt = validAttempt();
    const encoded = encodeAnthropicMessagesAttempt(attempt);
    const { toolCount, ...rest } = attempt;
    assert.equal(
      encodeAnthropicMessagesAttempt({ toolCount, ...rest }),
      encoded,
    );
    for (const forbidden of [
      "content",
      "prompt",
      "response",
      "credential",
      "apiKey",
      "endpoint",
    ])
      assert.equal(Object.hasOwn(attempt, forbidden), false);
  });

  it("rejects altered provider settings and does not echo canaries", () => {
    const attempt = validAttempt();
    const canary = "PRIVATE-ANTHROPIC-CANARY";
    for (const candidate of [
      { ...attempt, apiVersion: "future" },
      { ...attempt, maxTokens: 4096 },
      { ...attempt, toolCount: 1 },
      { ...attempt, extra: true },
      { ...attempt, modelId: canary, transformedRequestDigest: "bad" },
    ]) {
      try {
        validateAnthropicMessagesAttempt(candidate);
        assert.fail("expected failure");
      } catch (error) {
        assert.ok(error instanceof AnthropicTransportEvidenceError);
        assert.equal(String(error).includes(canary), false);
      }
    }
  });

  it("constructs separate bounded Claude profiles", () => {
    const input = {
      modelId: "model-reviewed",
      transformedRequest: "Synthetic [[AW_CUSTOMER_1111111111111111]].",
    };
    const bare = buildClaudeInvocation({ ...input, profile: "BARE_API_AUTH" });
    const managed = buildClaudeInvocation({
      ...input,
      profile: "MANAGED_LOGIN",
    });
    assert.equal(bare.executable, "claude");
    assert.equal(bare.stdin, input.transformedRequest);
    for (const required of [
      "--bare",
      "--safe-mode",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--max-budget-usd",
      "dontAsk",
    ])
      assert.ok(bare.args.includes(required));
    assert.equal(managed.args.includes("--bare"), false);
    assert.equal(bare.args.includes("bypassPermissions"), false);
  });

  it("returns only digests from the fake Claude executable", async () => {
    const request = "Synthetic [[AW_CUSTOMER_1111111111111111]].";
    const invocation = buildClaudeInvocation({
      profile: "BARE_API_AUTH",
      modelId: "model-reviewed",
      transformedRequest: request,
    });
    const response = "PRIVATE-SYNTHETIC-OUTPUT";
    const receipt = await runClaudeSubprocessHarness(invocation, async () => ({
      stdout: [
        JSON.stringify({
          type: "system",
          subtype: "init",
          tools: [],
          mcp_servers: [],
          plugins: [],
          hooks: [],
          skills: [],
          memory: [],
        }),
        JSON.stringify({
          type: "assistant",
          content: [{ type: "text", text: response }],
        }),
        JSON.stringify({
          type: "result",
          subtype: "success",
          result: response,
        }),
      ].join("\n"),
      stderr: "",
      exitCode: 0,
      timedOut: false,
      killed: false,
      processTreeCleaned: true,
    }));
    assert.equal(receipt.outcome, "PASSED");
    assert.equal(JSON.stringify(receipt).includes(request), false);
    assert.equal(JSON.stringify(receipt).includes(response), false);
  });
});

function validAttempt() {
  return validateAnthropicMessagesAttempt({
    schemaVersion: 1,
    authorizationId: "authorization-test",
    attemptId: "attempt-test",
    providerKind: "ANTHROPIC_MESSAGES",
    transportEvidenceDate: "2026-07-22",
    modelId: "model-reviewed",
    transformedRequestDigest: "a".repeat(64),
    systemPromptDigest: "b".repeat(64),
    mappingSchemaVersion: 1,
    apiVersion: "2023-06-01",
    maxTokens: 256,
    toolCount: 0,
  });
}
