import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelTarget } from "@ai-workspace/model-targets";
import { buildSyntheticAgentProfile } from "../../../packages/instruction-manager/test/synthetic-agent-profile.ts";

/** Reviewed synthetic General configuration with no imaginary project owner. */
export async function writeReducedTurnConfiguration(
  home: string,
  modelId = "model-b",
  projectId: string | null = null,
) {
  await mkdir(home, { recursive: true });
  const refs = reducedTurnConfigurationRefs(home);
  const scope =
    projectId === null
      ? ({ kind: "GENERAL" } as const)
      : ({ kind: "PROJECT", projectId } as const);
  const base = buildSyntheticAgentProfile();
  const { projectId: legacyProjectId, schemaVersion, ...definition } = base;
  void legacyProjectId;
  void schemaVersion;
  const profile = {
    ...definition,
    schemaVersion: 2,
    scope,
    agent: {
      ...base.agent,
      allowedModels: [modelId],
      preferredModels: [modelId],
      instructionSourceIds: ["general-rules"],
      context: {
        ...base.agent.context,
        continuityBudgetBytes: 65_536,
        instructionBudgetBytes: 16_384,
      },
    },
    skills: base.skills.map((skill) => ({
      ...skill,
      instructionSourceIds: ["general-rules"],
    })),
  };
  const policy = {
    schemaVersion: 2,
    scope,
    id: "general-policy",
    version: "1.0.0",
    modelId,
    maximumDataClass: "CONFIDENTIAL",
    assertions: [],
    attribution: "USER_CONFIGURED",
    author: "Synthetic fixtures",
    license: "Apache-2.0",
  };
  const instructions = {
    schemaVersion: 2,
    ownerScope: scope,
    source: {
      id: "general-rules",
      ownerScope: scope,
      scope: "WORKSPACE",
      target: null,
      trust: "USER_CONFIGURED",
      rules: [
        {
          id: "general.evidence",
          kind: "CONSTRAINT",
          overridable: false,
          content:
            "Use the supplied synthetic evidence and state when context is incomplete.",
          position: 0,
        },
      ],
    },
  };
  await Promise.all([
    writeFile(refs.profileRef, `${JSON.stringify(profile, null, 2)}\n`),
    writeFile(refs.policyRef, `${JSON.stringify(policy, null, 2)}\n`),
    writeFile(
      refs.instructionRefs[0]!,
      `${JSON.stringify(instructions, null, 2)}\n`,
    ),
  ]);
  return refs;
}

export function reducedTurnConfigurationRefs(
  home: string,
): Pick<ModelTarget, "profileRef" | "policyRef" | "instructionRefs"> {
  return {
    profileRef: join(home, "general-profile.json"),
    policyRef: join(home, "general-policy.json"),
    instructionRefs: [join(home, "general-instructions.json")],
  };
}
