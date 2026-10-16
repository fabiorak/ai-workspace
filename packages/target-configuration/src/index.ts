import { createHash } from "node:crypto";

import {
  AGENT_PROFILE_EFFECT,
  composeScopedProfileInstructions,
  validateConfigurationScope,
  validateScopedAgentProfileBundle,
  validateScopedInstructionBundle,
  type ConfigurationScope,
} from "@ai-workspace/instruction-manager";
import {
  detectRestrictedData,
  validateScopedModelDataPolicy,
} from "@ai-workspace/privacy-gateway";

/** The few fields a person chooses; everything else is fixed (ADR-0052). */
export type GuidedTargetConfigurationInput = Readonly<{
  scope: ConfigurationScope;
  modelId: string;
  rules: readonly string[];
  continuityBudgetBytes: number;
  instructionBudgetBytes: number;
}>;

export type GuidedTargetConfigurationFiles = Readonly<{
  profile: string;
  policy: string;
  instructions: string;
}>;

export type GuidedTargetConfiguration = Readonly<{
  input: GuidedTargetConfigurationInput;
  /** SHA-256 of the three canonical file texts together. */
  digest: string;
  files: GuidedTargetConfigurationFiles;
}>;

export const GUIDED_TARGET_CONFIGURATION_LIMITS = Object.freeze({
  rules: 100,
  ruleCharacters: 8_192,
  modelCharacters: 256,
  budgetBytes: 1_000_000,
  fileBytes: 256 * 1_024,
});

/** Defaults offered by the form; the same values the reviewed fixtures use. */
export const GUIDED_TARGET_CONFIGURATION_DEFAULTS = Object.freeze({
  continuityBudgetBytes: 65_536,
  instructionBudgetBytes: 16_384,
});

export class TargetConfigurationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TargetConfigurationError";
  }
}

const AUTHOR = "AI Workspace Settings";
const LICENSE = "NOASSERTION";
const VERSION = "1.0.0";
const AGENT_ID = "settings-agent";
const SKILL_ID = "conversation";
const TOOL = "read_context";
const SOURCE_ID = "settings-rules";
const POLICY_ID = "settings-policy";

/**
 * Builds the profile, policy and instruction files of a guided configuration,
 * validates each with the scoped validators the turn uses, and composes them
 * once, so a configuration that cannot compose is never returned.
 */
export function buildGuidedTargetConfiguration(
  value: unknown,
): GuidedTargetConfiguration {
  const input = validateInput(value);
  const profile = {
    schemaVersion: 2,
    scope: input.scope,
    trust: "USER_CONFIGURED",
    agent: {
      id: AGENT_ID,
      name: "Settings agent",
      description: "Answers within the supplied conversation context.",
      version: VERSION,
      instructionSourceIds: [SOURCE_ID],
      skillIds: [SKILL_ID],
      preferredModels: [input.modelId],
      allowedModels: [input.modelId],
      allowedTools: [TOOL],
      forbiddenTools: [],
      context: {
        include: [],
        exclude: [],
        continuityBudgetBytes: input.continuityBudgetBytes,
        instructionBudgetBytes: input.instructionBudgetBytes,
      },
      autonomy: "ADVISORY",
      outputFormat: "text",
      confirmationRules: [],
      author: AUTHOR,
      license: LICENSE,
    },
    skills: [
      {
        id: SKILL_ID,
        name: "Conversation",
        description: "Answers within the supplied conversation context.",
        version: VERSION,
        instructionSourceIds: [SOURCE_ID],
        requiredTools: [TOOL],
        forbiddenTools: [],
        inputs: ["conversation"],
        riskLevel: "LOW",
        destructiveActions: [],
        requiresConfirmation: [],
        outputFormat: "text",
        author: AUTHOR,
        license: LICENSE,
      },
    ],
    effect: AGENT_PROFILE_EFFECT,
  };
  // A lower ceiling blocks every reduced turn: the envelope is one item that
  // defaults to CONFIDENTIAL and no assertion can name its digest in advance.
  const policy = {
    schemaVersion: 2,
    scope: input.scope,
    id: POLICY_ID,
    version: VERSION,
    modelId: input.modelId,
    maximumDataClass: "CONFIDENTIAL",
    assertions: [],
    attribution: "USER_CONFIGURED",
    author: AUTHOR,
    license: LICENSE,
  };
  const source = {
    id: SOURCE_ID,
    ownerScope: input.scope,
    scope: input.scope.kind === "GENERAL" ? "WORKSPACE" : "PROJECT",
    target: null,
    trust: "USER_CONFIGURED",
    rules: input.rules.map((content, position) => ({
      id: `settings.rule.${position + 1}`,
      kind: "CONSTRAINT",
      overridable: false,
      content,
      position,
    })),
  };
  const files = Object.freeze({
    profile: encode(profile),
    policy: encode(policy),
    instructions: encode({
      schemaVersion: 2,
      ownerScope: input.scope,
      source,
    }),
  });
  for (const text of Object.values(files))
    if (
      Buffer.byteLength(text, "utf8") >
      GUIDED_TARGET_CONFIGURATION_LIMITS.fileBytes
    )
      throw new TargetConfigurationError(
        "The instruction rules are too long for one configuration file. Shorten them and retry.",
      );
  try {
    const scopedProfile = validateScopedAgentProfileBundle(
      profile,
      input.scope,
    );
    validateScopedModelDataPolicy(policy, input.scope);
    const bundle = validateScopedInstructionBundle(
      {
        schemaVersion: 2,
        ownerScope: input.scope,
        sources: [{ ...source, sourceDigest: sha256(files.instructions) }],
      },
      input.scope,
    );
    const composed = composeScopedProfileInstructions(scopedProfile, bundle, {
      model: input.modelId,
    });
    if (
      Buffer.byteLength(JSON.stringify(composed), "utf8") >
      input.instructionBudgetBytes
    )
      throw new TargetConfigurationError(
        "The instruction rules do not fit the instruction budget. Shorten them or raise the budget, then retry.",
      );
  } catch (error) {
    if (error instanceof TargetConfigurationError) throw error;
    throw new TargetConfigurationError(
      "The guided configuration could not be composed. Review the model and rules, then retry.",
      { cause: error },
    );
  }
  return Object.freeze({
    input,
    digest: guidedTargetConfigurationDigest(files),
    files,
  });
}

export function guidedTargetConfigurationDigest(
  files: GuidedTargetConfigurationFiles,
): string {
  return sha256(
    JSON.stringify([files.profile, files.policy, files.instructions]),
  );
}

/**
 * Returns the guided fields only when the three texts are exactly what the
 * builder produces from them; anything else, a hand edit included, is not a
 * guided configuration.
 */
export function recognizeGuidedTargetConfiguration(
  files: GuidedTargetConfigurationFiles,
): GuidedTargetConfigurationInput | null {
  try {
    const profile = JSON.parse(files.profile) as {
      scope: unknown;
      agent: {
        allowedModels: string[];
        context: {
          continuityBudgetBytes: number;
          instructionBudgetBytes: number;
        };
      };
    };
    const instructions = JSON.parse(files.instructions) as {
      source: { rules: { content: string; position: number }[] };
    };
    const rebuilt = buildGuidedTargetConfiguration({
      scope: profile.scope,
      modelId: profile.agent.allowedModels[0],
      rules: [...instructions.source.rules]
        .sort((left, right) => left.position - right.position)
        .map((rule) => rule.content),
      continuityBudgetBytes: profile.agent.context.continuityBudgetBytes,
      instructionBudgetBytes: profile.agent.context.instructionBudgetBytes,
    });
    return rebuilt.files.profile === files.profile &&
      rebuilt.files.policy === files.policy &&
      rebuilt.files.instructions === files.instructions
      ? rebuilt.input
      : null;
  } catch {
    return null;
  }
}

function validateInput(value: unknown): GuidedTargetConfigurationInput {
  if (
    !record(value) ||
    !exact(value, [
      "scope",
      "modelId",
      "rules",
      "continuityBudgetBytes",
      "instructionBudgetBytes",
    ])
  )
    throw new TargetConfigurationError(
      "Complete the guided configuration and retry.",
    );
  let scope: ConfigurationScope;
  try {
    scope = validateConfigurationScope(value.scope);
  } catch (error) {
    throw new TargetConfigurationError(
      "Choose General or one registered project as the configuration scope.",
      { cause: error },
    );
  }
  if (!text(value.modelId, GUIDED_TARGET_CONFIGURATION_LIMITS.modelCharacters))
    throw new TargetConfigurationError(
      "Enter the model identifier before saving the configuration.",
    );
  if (
    !Array.isArray(value.rules) ||
    value.rules.length < 1 ||
    value.rules.length > GUIDED_TARGET_CONFIGURATION_LIMITS.rules
  )
    throw new TargetConfigurationError(
      "Write between 1 and 100 instruction rules, one per line.",
    );
  const rules = value.rules.map((rule: unknown) => {
    if (!text(rule, GUIDED_TARGET_CONFIGURATION_LIMITS.ruleCharacters))
      throw new TargetConfigurationError(
        "Each instruction rule must be one line of text of at most 8192 characters.",
      );
    if (detectRestrictedData(rule) !== null)
      throw new TargetConfigurationError(
        "An instruction rule looks like a credential or private key. Remove it and retry.",
      );
    return rule;
  });
  for (const budget of [
    value.continuityBudgetBytes,
    value.instructionBudgetBytes,
  ])
    if (
      !Number.isSafeInteger(budget) ||
      Number(budget) < 1 ||
      Number(budget) > GUIDED_TARGET_CONFIGURATION_LIMITS.budgetBytes
    )
      throw new TargetConfigurationError(
        "Each context budget must be a whole number of bytes from 1 to 1000000.",
      );
  return Object.freeze({
    scope,
    modelId: value.modelId,
    rules: Object.freeze(rules),
    continuityBudgetBytes: value.continuityBudgetBytes as number,
    instructionBudgetBytes: value.instructionBudgetBytes as number,
  });
}

function encode(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
/** Trimmed, non-empty, bounded, and free of control characters. */
function text(value: unknown, limit: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= limit &&
    value === value.trim() &&
    !/\p{Cc}/u.test(value)
  );
}
