import { JsonModelTargetStore } from "@ai-workspace/local-model-targets";
import { ModelTargets } from "@ai-workspace/model-targets";

import type { ExecutionHost } from "./execution-host.ts";

export { executionHost } from "./execution-host.ts";

/**
 * The host, not the configuration, says what can run. Responses is simulated
 * unless the process received the explicit transport opt-in. An agent kind is
 * launchable only when an executor for it was injected, and says whether that
 * executor is synthetic. The local model is offered only when the process
 * received its loopback address at start (ADR-0051).
 */
export function modelTargetArea(workspaceHome: string, host: ExecutionHost) {
  const agents = Object.fromEntries(
    (host.agentExecutors ?? []).map((executor) => [
      executor.kind,
      executor.launch,
    ]),
  );
  return new ModelTargets(new JsonModelTargetStore(workspaceHome), {
    qualifiedOffline: [
      "OPENAI_RESPONSES",
      "CODEX_CLI",
      "CLAUDE_CODE",
      "LLAMA_SERVER_LOOPBACK",
    ],
    launch: {
      OPENAI_RESPONSES: host.transport ? "AVAILABLE" : "SIMULATED",
      ...agents,
      ...(host.localModelExecutor
        ? { LLAMA_SERVER_LOOPBACK: host.localModelExecutor.launch }
        : {}),
    },
  });
}
