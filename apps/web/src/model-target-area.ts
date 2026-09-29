import { JsonModelTargetStore } from "@ai-workspace/local-model-targets";
import { ModelTargets } from "@ai-workspace/model-targets";

import type { ExecutionHost } from "./execution-host.ts";

export { executionHost } from "./execution-host.ts";

/**
 * The host, not the configuration, says what can run. Responses is simulated
 * unless the process received the explicit transport opt-in. An agent kind is
 * launchable only when an executor for it was injected, and says whether that
 * executor is synthetic; no local-model adapter is qualified yet.
 */
export function modelTargetArea(workspaceHome: string, host: ExecutionHost) {
  const agents = Object.fromEntries(
    (host.agentExecutors ?? []).map((executor) => [
      executor.kind,
      executor.launch,
    ]),
  );
  return new ModelTargets(new JsonModelTargetStore(workspaceHome), {
    qualifiedOffline: ["OPENAI_RESPONSES", "CODEX_CLI", "CLAUDE_CODE"],
    launch: {
      OPENAI_RESPONSES: host.transport ? "AVAILABLE" : "SIMULATED",
      ...agents,
    },
  });
}
