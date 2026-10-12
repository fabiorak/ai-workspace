import type { AgentExecutor } from "@ai-workspace/agent-execution";
import type { LocalModelExecutor } from "@ai-workspace/local-model-execution";
import type { DeliveryTransport } from "@ai-workspace/model-delivery";

/**
 * An agent executor as the host offers it. `SIMULATED` marks a synthetic
 * executor, so a target named like a real agent stays recognisable.
 */
export type HostedAgentExecutor = AgentExecutor &
  Readonly<{ launch: "AVAILABLE" | "SIMULATED" }>;

/** The local model executor as the host offers it, marked the same way. */
export type HostedLocalModelExecutor = LocalModelExecutor &
  Readonly<{ launch: "AVAILABLE" | "SIMULATED" }>;

/** What this process can actually run, decided at start and never by config. */
export type ExecutionHost = Readonly<{
  transport?: DeliveryTransport;
  agentExecutors?: readonly HostedAgentExecutor[];
  localModelExecutor?: HostedLocalModelExecutor;
}>;

export function executionHost(
  dependencies: Readonly<{
    continuationTransport?: DeliveryTransport;
    agentExecutors?: readonly HostedAgentExecutor[];
    localModelExecutor?: HostedLocalModelExecutor;
  }>,
): ExecutionHost {
  return Object.freeze({
    ...(dependencies.continuationTransport
      ? { transport: dependencies.continuationTransport }
      : {}),
    ...(dependencies.agentExecutors?.length
      ? { agentExecutors: Object.freeze([...dependencies.agentExecutors]) }
      : {}),
    ...(dependencies.localModelExecutor
      ? { localModelExecutor: dependencies.localModelExecutor }
      : {}),
  });
}
