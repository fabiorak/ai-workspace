import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";

import {
  LOCAL_MODEL_LIMITS,
  planChatRequest,
  type LocalModelRunResult,
} from "@ai-workspace/local-model-execution";

import {
  LLAMA_SERVER_LOOPBACK_QUALIFICATION,
  createLlamaServerLoopbackExecutor,
} from "../src/index.ts";

type Handler = (request: IncomingMessage, response: ServerResponse) => void;
type Seen = {
  method?: string | undefined;
  url?: string | undefined;
  body: string;
  headers: object;
};

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});

async function listen(handler: Handler, host = "127.0.0.1") {
  const seen: Seen[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      seen.push({
        method: request.method,
        url: request.url,
        body: Buffer.concat(chunks).toString("utf8"),
        headers: request.headers,
      });
      handler(request, response);
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, host, done));
  return { seen, port: (server.address() as AddressInfo).port };
}

const plan = planChatRequest({ model: "modello-finto", text: "Domanda" });
const json = (response: ServerResponse, value: unknown, status = 200) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(typeof value === "string" ? value : JSON.stringify(value));
};
const good = (content = "Risposta.", finish: unknown = "stop") => ({
  model: "modello-finto",
  choices: [{ finish_reason: finish, message: { content } }],
});
const run = (port: number, timeoutMs?: number): Promise<LocalModelRunResult> =>
  createLlamaServerLoopbackExecutor({
    endpoint: `http://127.0.0.1:${port}`,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  }).execute(plan);
const unknown = (reason: string) => ({ kind: "UNKNOWN", reason });

describe("llama-server loopback adapter", () => {
  it("sends exactly the planned body once and returns the answer", async () => {
    const { seen, port } = await listen((_, r) => json(r, good()));
    assert.deepEqual(await run(port), {
      kind: "ANSWER",
      text: "Risposta.",
      reportedModel: "modello-finto",
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.method, "POST");
    assert.equal(seen[0]?.url, "/v1/chat/completions");
    assert.equal(seen[0]?.body, plan.body);
    assert.ok(!("authorization" in (seen[0]?.headers ?? {})));
    assert.equal(
      createLlamaServerLoopbackExecutor({ endpoint: "http://[::1]:1" })
        .qualification,
      LLAMA_SERVER_LOOPBACK_QUALIFICATION,
    );
  });

  it("reaches an IPv6 loopback server when the machine has one", async (t) => {
    let server: { port: number } | undefined;
    try {
      server = await listen((_, r) => json(r, good()), "::1");
    } catch {
      return t.skip("no IPv6 loopback");
    }
    const result = await createLlamaServerLoopbackExecutor({
      endpoint: `http://[::1]:${server.port}`,
    }).execute(plan);
    assert.equal(result.kind, "ANSWER");
  });

  it("leaves a cut, malformed or reasoning-only answer unknown", async () => {
    const cases: Array<[unknown, string, number?]> = [
      [good("tagliata", "length"), "FINISH_REASON_NOT_STOP"],
      ['{"choices":[', "MALFORMED_RESPONSE"],
      [
        {
          choices: [
            {
              finish_reason: "stop",
              message: { content: "", reasoning_content: "solo ragionamento" },
            },
          ],
        },
        "EMPTY_CONTENT",
      ],
      [{ choices: [] }, "NOT_ONE_CHOICE"],
      [good("x"), "TRANSPORT_FAILED", 500],
    ];
    for (const [value, reason, status] of cases) {
      const { seen, port } = await listen((_, r) => json(r, value, status));
      assert.deepEqual(await run(port), unknown(reason));
      assert.equal(seen.length, 1, "never sent twice");
    }
  });

  it("refuses a body over the limit, declared or streamed", async () => {
    const declared = await listen((_, r) => {
      r.writeHead(200, {
        "content-length": LOCAL_MODEL_LIMITS.responseBytes + 1,
      });
      r.end();
    });
    assert.deepEqual(await run(declared.port), unknown("RESPONSE_TOO_LARGE"));
    const streamed = await listen((_, r) => {
      r.writeHead(200);
      const piece = Buffer.alloc(64 * 1024, 0x61);
      const timer = setInterval(() => r.write(piece), 1);
      r.on("close", () => clearInterval(timer));
    });
    assert.deepEqual(await run(streamed.port), unknown("RESPONSE_TOO_LARGE"));
  });

  it("reports a disconnection before the body is complete", async () => {
    const cut = await listen((_, r) => {
      r.writeHead(200, { "content-length": 1000 });
      r.write('{"choices":');
      setTimeout(() => r.socket?.destroy(), 10);
    });
    assert.deepEqual(await run(cut.port), unknown("DISCONNECTED"));
    const early = await listen((request) => request.socket.destroy());
    assert.deepEqual(await run(early.port), unknown("TRANSPORT_FAILED"));
  });

  it("follows no redirect, not even to another loopback server", async () => {
    const target = await listen((_, r) => json(r, good("altrove")));
    const first = await listen((_, r) => {
      r.writeHead(307, {
        location: `http://127.0.0.1:${target.port}/v1/chat/completions`,
      });
      r.end();
    });
    assert.deepEqual(await run(first.port), unknown("REDIRECTED"));
    assert.equal(first.seen.length, 1);
    assert.equal(target.seen.length, 0);
  });

  it("ignores proxy variables of the environment", async () => {
    const proxy = await listen((_, r) => json(r, good("dal proxy")));
    const target = await listen((_, r) => json(r, good()));
    const saved = { ...process.env };
    Object.assign(process.env, {
      HTTP_PROXY: `http://127.0.0.1:${proxy.port}`,
      http_proxy: `http://127.0.0.1:${proxy.port}`,
      ALL_PROXY: `http://127.0.0.1:${proxy.port}`,
      NODE_USE_ENV_PROXY: "1",
    });
    delete process.env["NO_PROXY"];
    delete process.env["no_proxy"];
    try {
      assert.equal((await run(target.port)).kind, "ANSWER");
    } finally {
      for (const key of Object.keys(process.env))
        if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
    assert.equal(proxy.seen.length, 0);
    assert.equal(target.seen.length, 1);
  });

  it("times out and reports a refused connection", async () => {
    const slow = await listen(() => undefined);
    assert.deepEqual(await run(slow.port, 50), unknown("TIMED_OUT"));
    const closed = await listen((_, r) => json(r, good()));
    const port = closed.port;
    await new Promise((done) => servers.pop()?.close(done));
    assert.deepEqual(await run(port), unknown("TRANSPORT_FAILED"));
  });

  it("refuses addresses and timeouts that break the boundary", () => {
    for (const endpoint of [
      "http://localhost:8080",
      "http://192.168.1.10:8080",
      "http://127.0.0.1",
      "https://127.0.0.1:8080",
    ])
      assert.throws(() => createLlamaServerLoopbackExecutor({ endpoint }));
    for (const timeoutMs of [0, 1.5, LOCAL_MODEL_LIMITS.timeoutMs + 1])
      assert.throws(() =>
        createLlamaServerLoopbackExecutor({
          endpoint: "http://127.0.0.1:8080",
          timeoutMs,
        }),
      );
  });
});
