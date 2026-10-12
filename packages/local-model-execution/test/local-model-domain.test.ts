import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LOCAL_MODEL_LIMITS,
  LocalModelError,
  parseLoopbackEndpoint,
  planChatRequest,
  readChatAnswer,
} from "../src/index.ts";

const bytes = (value: unknown) =>
  new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );

const answer = (overrides: Record<string, unknown> = {}) => ({
  model: "modello-finto",
  choices: [
    {
      finish_reason: "stop",
      message: { role: "assistant", content: "Risposta." },
    },
  ],
  ...overrides,
});

describe("local model limits", () => {
  it("are the fixed values of the decision and cannot be changed", () => {
    assert.deepEqual(LOCAL_MODEL_LIMITS, {
      timeoutMs: 900_000,
      requestBytes: 1_048_576,
      responseBytes: 1_048_576,
      answerBytes: 131_072,
      maxTokens: 8192,
    });
    assert.ok(Object.isFrozen(LOCAL_MODEL_LIMITS));
  });
});

describe("loopback endpoint", () => {
  it("accepts only numeric loopback addresses with an explicit port", () => {
    assert.deepEqual(parseLoopbackEndpoint("http://127.0.0.1:8080"), {
      host: "127.0.0.1",
      port: 8080,
      origin: "http://127.0.0.1:8080",
    });
    assert.deepEqual(parseLoopbackEndpoint("http://[::1]:65535/"), {
      host: "::1",
      port: 65535,
      origin: "http://[::1]:65535",
    });
  });

  it("refuses names, short forms, other addresses and extras", () => {
    for (const value of [
      "http://localhost:8080",
      "http://127.1:8080",
      "http://127.0.0.2:8080",
      "http://0.0.0.0:8080",
      "http://0:8080",
      "http://[::ffff:127.0.0.1]:8080",
      "http://[0:0:0:0:0:0:0:1]:8080",
      "https://127.0.0.1:8080",
      "http://127.0.0.1",
      "http://127.0.0.1:0",
      "http://127.0.0.1:08080",
      "http://127.0.0.1:65536",
      "http://user@127.0.0.1:8080",
      "http://127.0.0.1:8080/v1",
      "http://127.0.0.1:8080/?a=1",
      "http://127.0.0.1:8080#x",
      " http://127.0.0.1:8080",
      "",
      undefined,
      8080,
    ])
      assert.throws(
        () => parseLoopbackEndpoint(value),
        (error) =>
          error instanceof LocalModelError && error.code === "INVALID_ENDPOINT",
        String(value),
      );
  });
});

describe("chat request plan", () => {
  it("builds one non-streaming message with the fixed token limit", () => {
    const plan = planChatRequest({ model: "m", text: "Ciao" });
    assert.deepEqual(JSON.parse(plan.body), {
      model: "m",
      messages: [{ role: "user", content: "Ciao" }],
      stream: false,
      max_tokens: 8192,
    });
    assert.match(plan.inputDigest, /^[0-9a-f]{64}$/);
    assert.match(plan.invocationDigest, /^[0-9a-f]{64}$/);
    assert.notEqual(plan.inputDigest, plan.invocationDigest);
    assert.deepEqual(plan, planChatRequest({ model: "m", text: "Ciao" }));
  });

  it("refuses an oversized or malformed request instead of truncating", () => {
    const refuse = (request: { model: string; text: string }, code: string) =>
      assert.throws(
        () => planChatRequest(request),
        (error) => error instanceof LocalModelError && error.code === code,
      );
    refuse(
      { model: "m", text: "a".repeat(LOCAL_MODEL_LIMITS.requestBytes) },
      "LOCAL_MODEL_REQUEST_TOO_LARGE",
    );
    refuse({ model: "m", text: "  " }, "INVALID_LOCAL_MODEL_REQUEST");
    refuse({ model: "", text: "x" }, "INVALID_LOCAL_MODEL_REQUEST");
    refuse({ model: "m", text: "\ud800" }, "INVALID_LOCAL_MODEL_REQUEST");
  });
});

describe("chat answer", () => {
  it("accepts one complete choice that stopped with content", () => {
    assert.deepEqual(readChatAnswer(bytes(answer())), {
      kind: "ANSWER",
      text: "Risposta.",
      reportedModel: "modello-finto",
    });
  });

  it("never returns or keeps the reasoning text", () => {
    const result = readChatAnswer(
      bytes(
        answer({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: "Risposta.",
                reasoning_content: "ragionamento-riservato",
              },
            },
          ],
        }),
      ),
    );
    assert.equal(result.kind, "ANSWER");
    assert.ok(!JSON.stringify(result).includes("ragionamento-riservato"));
  });

  it("leaves the answer unknown for every other shape", () => {
    const unknown = (value: Uint8Array, reason: string) =>
      assert.deepEqual(readChatAnswer(value), { kind: "UNKNOWN", reason });
    const choice = (finish: unknown, message: unknown) =>
      bytes(answer({ choices: [{ finish_reason: finish, message }] }));

    unknown(
      choice("length", { content: "tagliata" }),
      "FINISH_REASON_NOT_STOP",
    );
    unknown(choice(null, { content: "x" }), "FINISH_REASON_NOT_STOP");
    unknown(choice("stop", { content: "" }), "EMPTY_CONTENT");
    unknown(choice("stop", { content: "  " }), "EMPTY_CONTENT");
    unknown(
      choice("stop", { content: "", reasoning_content: "solo ragionamento" }),
      "EMPTY_CONTENT",
    );
    unknown(choice("stop", { content: ["x"] }), "EMPTY_CONTENT");
    unknown(choice("stop", undefined), "EMPTY_CONTENT");
    unknown(bytes(answer({ choices: [] })), "NOT_ONE_CHOICE");
    unknown(bytes(answer({ choices: undefined })), "NOT_ONE_CHOICE");
    unknown(
      bytes(
        answer({
          choices: [
            { finish_reason: "stop", message: { content: "a" } },
            { finish_reason: "stop", message: { content: "b" } },
          ],
        }),
      ),
      "NOT_ONE_CHOICE",
    );
    unknown(bytes(answer({ choices: ["x"] })), "MALFORMED_RESPONSE");
    unknown(bytes('{"choices":['), "MALFORMED_RESPONSE");
    unknown(bytes(""), "MALFORMED_RESPONSE");
    unknown(bytes("[]"), "MALFORMED_RESPONSE");
    unknown(Uint8Array.of(0xff, 0xfe), "MALFORMED_RESPONSE");
    unknown(bytes(`${JSON.stringify(answer())} x`), "MALFORMED_RESPONSE");
  });

  it("refuses oversized bodies and answers without truncating", () => {
    assert.deepEqual(
      readChatAnswer(new Uint8Array(LOCAL_MODEL_LIMITS.responseBytes + 1)),
      { kind: "UNKNOWN", reason: "RESPONSE_TOO_LARGE" },
    );
    const limit = LOCAL_MODEL_LIMITS.answerBytes;
    const at = (size: number) =>
      readChatAnswer(
        bytes(
          answer({
            choices: [
              {
                finish_reason: "stop",
                message: { content: "a".repeat(size) },
              },
            ],
          }),
        ),
      );
    assert.equal(at(limit).kind, "ANSWER");
    assert.deepEqual(at(limit + 1), {
      kind: "UNKNOWN",
      reason: "ANSWER_TOO_LARGE",
    });
  });

  it("reports no model when the server names none", () => {
    assert.deepEqual(readChatAnswer(bytes(answer({ model: 7 }))), {
      kind: "ANSWER",
      text: "Risposta.",
      reportedModel: null,
    });
  });
});
