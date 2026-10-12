import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  LocalModelPlan,
  LocalModelRunResult,
} from "@ai-workspace/local-model-execution";
import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import type { ClassifiedModelTarget } from "@ai-workspace/model-targets";

import { GuiApplication } from "../src/index.ts";
import type { HostedLocalModelExecutor } from "../src/execution-host.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";

/**
 * A synthetic local model for tests. It stands in the place of the loopback
 * adapter and opens no socket: it records the exact `plan.body` it was handed
 * and answers from a script. It declares itself SIMULATED.
 */
export type SyntheticLocalModelLog = {
  /** Every body the executor received, in order. */
  bodies: string[];
  /** What the next call answers. */
  result: LocalModelRunResult;
};

export const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

export function syntheticLocalModelLog(
  result: LocalModelRunResult = {
    kind: "ANSWER",
    text: "Risposta locale sintetica",
    reportedModel: null,
  },
): SyntheticLocalModelLog {
  return { bodies: [], result };
}

export function syntheticLocalModel(
  log: SyntheticLocalModelLog,
): HostedLocalModelExecutor {
  return {
    launch: "SIMULATED",
    qualification: "llama-server-loopback-synthetic",
    execute: async (plan: LocalModelPlan) => {
      log.bodies.push(plan.body);
      return log.result;
    },
  };
}

export const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

/** The scope the registry derives for a conversation outside any project. */
export const generalScopeId = (conversationId: string) =>
  `general-${sha256(conversationId)}`;

export async function localModelTarget(
  root: string,
  projectId: string | null,
  overrides: Partial<ClassifiedModelTarget> = {},
): Promise<ClassifiedModelTarget> {
  return {
    targetId: "local",
    displayName: "Modello locale",
    executionClass: "LOCAL_MODEL",
    kind: "LLAMA_SERVER_LOOPBACK",
    modelId: "synthetic-local-model",
    boundary: "LOCAL_ONLY",
    ...(await writeReducedTurnConfiguration(
      join(root, "local-config"),
      "synthetic-local-model",
      projectId,
    )),
    maxInputBytes: 256 * 1024,
    maxOutputBytes: 16_384,
    enabled: true,
    ...overrides,
  } as ClassifiedModelTarget;
}

export async function responsesTarget(
  root: string,
  projectId: string | null,
): Promise<ClassifiedModelTarget> {
  return {
    targetId: "external",
    displayName: "Modello esterno",
    executionClass: "MODEL_DELIVERY",
    kind: "OPENAI_RESPONSES",
    modelId: "synthetic-external-model",
    boundary: "EXTERNAL_SERVICE",
    ...(await writeReducedTurnConfiguration(
      join(root, "external-config"),
      "synthetic-external-model",
      projectId,
    )),
    maxInputBytes: 256 * 1024,
    maxOutputBytes: 16_384,
    enabled: true,
  };
}

/** A Responses transport that records the text it is asked to send. */
export function recordingTransport(sent: string[]): DeliveryTransport {
  return {
    send: async ({ text }) => {
      sent.push(text);
      return {
        kind: "COMPLETED",
        text: "Risposta esterna sintetica",
        requestId: "synthetic-request",
        responseId: "synthetic-response",
        usage: {
          inputTokens: null,
          cachedInputTokens: null,
          outputTokens: null,
        },
      };
    },
  };
}

export function localModelApplication(
  root: string,
  options: Readonly<{
    log?: SyntheticLocalModelLog;
    sent?: string[];
  }> = {},
) {
  return new GuiApplication({
    workspaceHome: join(root, "home"),
    sampleSessionPath,
    ...(options.sent
      ? { continuationTransport: recordingTransport(options.sent) }
      : {}),
    ...(options.log
      ? { localModelExecutor: syntheticLocalModel(options.log) }
      : {}),
  });
}

/** Configures the given targets and selects one for the conversation. */
export async function configureAndSelect(
  application: GuiApplication,
  targets: readonly ClassifiedModelTarget[],
  conversationId: string,
  projectId: string | null,
  selected: string,
) {
  let revision = (await application.modelTargets.inspect()).revision;
  for (const target of targets)
    revision = (await application.modelTargets.configure(target, revision))
      .revision;
  await application.modelTargets.selectConversation(
    conversationId,
    projectId,
    selected,
    revision,
  );
}
