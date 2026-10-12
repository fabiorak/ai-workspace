import { Agent, request, type IncomingMessage } from "node:http";

import {
  LOCAL_MODEL_LIMITS,
  parseLoopbackEndpoint,
  readChatAnswer,
  type LocalModelExecutor,
  type LocalModelPlan,
  type LocalModelRunResult,
  type LocalModelUnknownReason,
} from "@ai-workspace/local-model-execution";

export const LLAMA_SERVER_LOOPBACK_QUALIFICATION =
  "llama-server-loopback-offline-synthetic";

const PATH = "/v1/chat/completions";

const unknown = (reason: LocalModelUnknownReason): LocalModelRunResult =>
  Object.freeze({ kind: "UNKNOWN", reason });

/**
 * ADR-0051. One `POST /v1/chat/completions` to the numeric loopback address
 * the user declared, without streaming. It uses its own agent and an explicit
 * host and port, so proxy variables of the environment, name resolution and
 * keep-alive reuse never apply; it follows no redirect and has no fallback.
 * Qualified offline against a synthetic server only.
 */
export function createLlamaServerLoopbackExecutor(
  options: Readonly<{ endpoint: string; timeoutMs?: number }>,
): LocalModelExecutor {
  // Refused at construction, so a bad address never reaches the network.
  const endpoint = parseLoopbackEndpoint(options.endpoint);
  const timeoutMs = options.timeoutMs ?? LOCAL_MODEL_LIMITS.timeoutMs;
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > LOCAL_MODEL_LIMITS.timeoutMs
  )
    throw new Error("INVALID_LOCAL_MODEL_TIMEOUT");
  return Object.freeze({
    qualification: LLAMA_SERVER_LOOPBACK_QUALIFICATION,
    execute: (plan: LocalModelPlan) =>
      send(endpoint.host, endpoint.port, timeoutMs, plan),
  });
}

function send(
  host: string,
  port: number,
  timeoutMs: number,
  plan: LocalModelPlan,
): Promise<LocalModelRunResult> {
  const body = Buffer.from(plan.body, "utf8");
  return new Promise((resolve) => {
    let settled = false;
    const chunks: Buffer[] = [];
    let received = 0;
    const agent = new Agent({ keepAlive: false, maxSockets: 1 });
    const finish = (result: LocalModelRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      agent.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish(unknown("TIMED_OUT")), timeoutMs);
    const req = request(
      {
        agent,
        host,
        port,
        method: "POST",
        path: PATH,
        headers: {
          "content-type": "application/json",
          "content-length": body.byteLength,
          accept: "application/json",
        },
      },
      (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) return finish(unknown("REDIRECTED"));
        if (status !== 200) return finish(unknown("TRANSPORT_FAILED"));
        const declared = Number(response.headers["content-length"]);
        if (declared > LOCAL_MODEL_LIMITS.responseBytes)
          return finish(unknown("RESPONSE_TOO_LARGE"));
        response.on("data", (chunk: Buffer) => {
          received += chunk.byteLength;
          if (received > LOCAL_MODEL_LIMITS.responseBytes)
            return finish(unknown("RESPONSE_TOO_LARGE"));
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (!response.complete) return finish(unknown("DISCONNECTED"));
          const answer = readChatAnswer(Buffer.concat(chunks));
          finish(
            answer.kind === "ANSWER"
              ? Object.freeze({
                  kind: "ANSWER",
                  text: answer.text,
                  reportedModel: answer.reportedModel,
                })
              : unknown(answer.reason),
          );
        });
        response.on("aborted", () => finish(unknown("DISCONNECTED")));
        response.on("error", () => finish(unknown("DISCONNECTED")));
        response.on("close", () => {
          if (!response.complete) finish(unknown("DISCONNECTED"));
        });
      },
    );
    req.on("error", () => finish(unknown("TRANSPORT_FAILED")));
    req.end(body);
  });
}
