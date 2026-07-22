import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OpenAiTransportEvidenceError,
  buildCodexInvocation,
  encodeResponsesAttempt,
  measureCodexHeadlessQualificationCorpus,
  measureResponsesQualificationCorpus,
  runCodexSubprocessHarness,
  validateResponsesAttempt,
} from "./openai-transport-qualification-evidence.ts";

describe("OpenAI transport qualification evidence", () => {
  it("reproduces the Responses protocol corpus without adopting delivery", async () => {
    const first = await measureResponsesQualificationCorpus();
    const second = await measureResponsesQualificationCorpus();
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 13);
    assert.equal(first.passedCases, 13);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.sourceFacts.createRequestIdempotencyDocumented, false);
    assert.equal(first.sourceFacts.exactlyOnceAcceptanceDocumented, false);
    assert.equal(first.decision, "EVIDENCE_ONLY");
  });

  it("reproduces the Codex fake-executable corpus as a separate agent boundary", async () => {
    const first = await measureCodexHeadlessQualificationCorpus();
    const second = await measureCodexHeadlessQualificationCorpus();
    assert.deepEqual(second, first);
    assert.equal(first.caseCount, 10);
    assert.equal(first.passedCases, 10);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.processHarnessPassed, true);
    assert.equal(first.sourceFacts.exactReviewedInputIsolationProven, false);
    assert.equal(first.decision, "SEPARATE_AGENT_BOUNDARY");
  });

  it("encodes only canonical bounded Responses attempt metadata", () => {
    const attempt = validAttempt();
    const encoded = encodeResponsesAttempt(attempt);
    const { toolCount, ...rest } = attempt;
    assert.equal(encodeResponsesAttempt({ toolCount, ...rest }), encoded);
    for (const forbidden of [
      "content",
      "prompt",
      "response",
      "credential",
      "authorizationHeader",
      "endpoint",
    ])
      assert.equal(Object.hasOwn(attempt, forbidden), false);
  });

  it("rejects stateful, agentic, malformed, extra, and noncanonical attempts without echo", () => {
    const attempt = validAttempt();
    const canary = "PRIVATE-TRANSPORT-CANARY";
    for (const candidate of [
      { ...attempt, store: true },
      { ...attempt, background: true },
      { ...attempt, toolCount: 1 },
      { ...attempt, extra: true },
      { ...attempt, modelId: canary, transformedRequestDigest: "bad" },
    ]) {
      try {
        validateResponsesAttempt(candidate);
        assert.fail("expected failure");
      } catch (error) {
        assert.ok(error instanceof OpenAiTransportEvidenceError);
        assert.equal(String(error).includes(canary), false);
      }
    }
  });

  it("constructs an ephemeral read-only bounded Codex invocation", () => {
    const request = "Synthetic [[AW_CUSTOMER_1111111111111111]].";
    const invocation = buildCodexInvocation({
      modelId: "model-reviewed",
      transformedRequest: request,
    });
    assert.equal(invocation.executable, "codex");
    assert.equal(invocation.stdin, request);
    for (const required of [
      "--ephemeral",
      "--json",
      "read-only",
      "never",
      "--ignore-user-config",
      "--ignore-rules",
      "--output-schema",
    ])
      assert.ok(invocation.args.includes(required));
    assert.equal(invocation.args.includes("danger-full-access"), false);
  });

  it("returns only digests from the fake Codex executable", async () => {
    const request = "Synthetic [[AW_CUSTOMER_1111111111111111]].";
    const invocation = buildCodexInvocation({
      modelId: "model-reviewed",
      transformedRequest: request,
    });
    const response = "PRIVATE-SYNTHETIC-OUTPUT";
    const receipt = await runCodexSubprocessHarness(invocation, async () => ({
      stdout: [
        JSON.stringify({ type: "thread.started", thread_id: "synthetic" }),
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: response },
        }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"),
      stderr: "",
      exitCode: 0,
      timedOut: false,
      killed: false,
    }));
    assert.equal(receipt.outcome, "PASSED");
    assert.equal(JSON.stringify(receipt).includes(request), false);
    assert.equal(JSON.stringify(receipt).includes(response), false);
  });
});

function validAttempt() {
  return validateResponsesAttempt({
    schemaVersion: 1,
    authorizationId: "authorization-test",
    attemptId: "attempt-test",
    providerKind: "OPENAI_RESPONSES",
    transportEvidenceDate: "2026-07-22",
    modelId: "model-reviewed",
    transformedRequestDigest: "a".repeat(64),
    mappingSchemaVersion: 1,
    store: false,
    background: false,
    toolCount: 0,
  });
}
