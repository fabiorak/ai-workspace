import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OpenAIResponsesError,
  OpenAIResponsesTransport,
  type FetchLike,
} from "../src/index.ts";
const response = (
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const input = {
  model: "synthetic-model",
  text: "Synthetic question",
  maxOutputTokens: 100,
  timeoutMs: 1000,
};
test("Responses transport sends one bounded non-streaming request and normalizes output", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const transport = new OpenAIResponsesTransport({
    apiKey: "synthetic-secret",
    fetch: (async (url, init) => {
      seen = { url, init };
      return response(
        200,
        {
          id: "resp_123",
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Synthetic answer" }],
            },
          ],
          usage: {
            input_tokens: 9,
            input_tokens_details: { cached_tokens: 2 },
            output_tokens: 4,
          },
        },
        { "x-request-id": "req_123" },
      );
    }) as FetchLike,
  });
  const result = await transport.send(input);
  assert.equal(result.kind, "COMPLETED");
  if (result.kind === "COMPLETED")
    assert.deepEqual(result.usage, {
      inputTokens: 9,
      cachedInputTokens: 2,
      outputTokens: 4,
    });
  const recorded = seen as unknown as { url: string; init: RequestInit };
  assert.equal(recorded.url, "https://api.openai.com/v1/responses");
  assert.equal(recorded.init.method, "POST");
  assert.equal(recorded.init.redirect, "error");
  assert.equal(
    (recorded.init.headers as Record<string, string>).Authorization,
    "Bearer synthetic-secret",
  );
  assert.deepEqual(JSON.parse(String(recorded.init.body)), {
    model: input.model,
    input: input.text,
    max_output_tokens: 100,
    stream: false,
  });
});
test("transport never retries, exposes no error body and classifies bounded failures", async () => {
  let calls = 0;
  const transport = new OpenAIResponsesTransport({
    apiKey: "synthetic-secret",
    fetch: (async () => {
      calls++;
      return response(500, { error: { message: "private provider detail" } });
    }) as FetchLike,
  });
  assert.deepEqual(await transport.send(input), { kind: "UNKNOWN" });
  assert.equal(calls, 1);
  const rejected = new OpenAIResponsesTransport({
    apiKey: "synthetic-secret",
    fetch: (async () =>
      response(401, { error: { message: "secret" } })) as FetchLike,
  });
  assert.deepEqual(await rejected.send(input), { kind: "REJECTED" });
  assert.throws(
    () => new OpenAIResponsesTransport({ apiKey: "" }),
    OpenAIResponsesError,
  );
  await assert.rejects(
    () => transport.send({ ...input, text: "x".repeat(262145) }),
    OpenAIResponsesError,
  );
});
test("malformed, oversized, incomplete and timed out responses never become completed", async () => {
  for (const fetcher of [
    async () => response(200, {}),
    async () =>
      response(
        200,
        {
          id: "resp",
          status: "completed",
          output: [
            {
              content: [
                { type: "output_text", text: "x".repeat(1024 * 1024 + 1) },
              ],
            },
          ],
        },
        { "x-request-id": "req" },
      ),
    async () =>
      response(200, {
        id: "resp",
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "answer" }] }],
      }),
    async () =>
      response(
        200,
        {
          id: "resp",
          status: "incomplete",
          output: [{ content: [{ type: "output_text", text: "partial" }] }],
        },
        { "x-request-id": "req" },
      ),
  ]) {
    const transport = new OpenAIResponsesTransport({
      apiKey: "synthetic-secret",
      fetch: fetcher as FetchLike,
    });
    assert.deepEqual(await transport.send(input), { kind: "UNKNOWN" });
  }
  const oversizedBody = new OpenAIResponsesTransport({
    apiKey: "synthetic-secret",
    fetch: (async () =>
      new Response('{"id":"resp","status":"completed","output":[]}', {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": String(2 * 1024 * 1024 + 1),
          "x-request-id": "req",
        },
      })) as FetchLike,
  });
  assert.deepEqual(await oversizedBody.send(input), { kind: "UNKNOWN" });
  const timeout = new OpenAIResponsesTransport({
    apiKey: "synthetic-secret",
    fetch: (() =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(response(200, {})), 20),
      )) as FetchLike,
  });
  assert.deepEqual(await timeout.send({ ...input, timeoutMs: 1 }), {
    kind: "UNKNOWN",
  });
});
