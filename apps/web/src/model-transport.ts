import { OpenAIResponsesTransport } from "@ai-workspace/openai-responses";
import type { DeliveryTransport } from "@ai-workspace/model-delivery";

export type ModelTransportEnvironment = Readonly<{
  AI_WORKSPACE_MODEL_TRANSPORT?: string;
  OPENAI_API_KEY?: string;
}>;

/**
 * External delivery is an exact, process-level opt-in. The ordinary GUI start
 * keeps its local simulation and never reads a credential. An explicit mode
 * constructs the fixed-endpoint adapter, which validates the process-only key.
 */
export function modelTransportFromEnvironment(
  environment: ModelTransportEnvironment,
): DeliveryTransport | undefined {
  const mode = environment.AI_WORKSPACE_MODEL_TRANSPORT;
  if (mode === undefined) return undefined;
  if (mode !== "OPENAI_RESPONSES")
    throw new Error(
      "AI_WORKSPACE_MODEL_TRANSPORT must be OPENAI_RESPONSES when it is set.",
    );
  return new OpenAIResponsesTransport({
    apiKey: environment.OPENAI_API_KEY ?? "",
  });
}
