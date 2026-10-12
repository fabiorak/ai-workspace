import { createLlamaServerLoopbackExecutor } from "@ai-workspace/llama-server-loopback";
import { parseLoopbackEndpoint } from "@ai-workspace/local-model-execution";

import type { HostedLocalModelExecutor } from "./execution-host.ts";

export type LocalModelEnvironment = Readonly<{
  AI_WORKSPACE_LOCAL_MODEL_ENDPOINT?: string;
}>;

/**
 * The local model is a process-level opt-in read once at start (ADR-0051).
 * Without the variable nothing is offered and nothing is contacted; a value
 * that is not a numeric loopback address with a port stops the start instead
 * of being corrected. Constructing the executor sends nothing.
 */
export function localModelExecutorFromEnvironment(
  environment: LocalModelEnvironment,
): Readonly<{ executor: HostedLocalModelExecutor; origin: string }> | null {
  const value = environment.AI_WORKSPACE_LOCAL_MODEL_ENDPOINT;
  if (value === undefined) return null;
  let origin: string;
  try {
    origin = parseLoopbackEndpoint(value).origin;
  } catch {
    throw new Error(
      "AI_WORKSPACE_LOCAL_MODEL_ENDPOINT must be http://127.0.0.1:<port> or http://[::1]:<port> when it is set.",
    );
  }
  const executor = createLlamaServerLoopbackExecutor({ endpoint: value });
  return Object.freeze({
    executor: Object.freeze({ ...executor, launch: "AVAILABLE" as const }),
    origin,
  });
}
