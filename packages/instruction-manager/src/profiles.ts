export const AGENT_PROFILE_BUNDLE_SCHEMA_VERSION = 1;
export const AGENT_PROFILE_EFFECT =
  "DESCRIPTIVE_NOT_INSTALLED_SELECTED_ENFORCED_OR_EXECUTED" as const;

export type AgentProfileContext = Readonly<{
  include: readonly string[];
  exclude: readonly string[];
  continuityBudgetBytes: number;
  instructionBudgetBytes: number;
}>;
export type AgentProfile = Readonly<{
  id: string;
  name: string;
  description: string;
  version: string;
  instructionSourceIds: readonly string[];
  skillIds: readonly string[];
  preferredModels: readonly string[];
  allowedModels: readonly string[];
  allowedTools: readonly string[];
  forbiddenTools: readonly string[];
  context: AgentProfileContext;
  autonomy: "ADVISORY" | "SUPERVISED";
  outputFormat: string;
  confirmationRules: readonly string[];
  author: string;
  license: string;
}>;
export type SkillProfile = Readonly<{
  id: string;
  name: string;
  description: string;
  version: string;
  instructionSourceIds: readonly string[];
  requiredTools: readonly string[];
  forbiddenTools: readonly string[];
  inputs: readonly string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  destructiveActions: readonly string[];
  requiresConfirmation: readonly string[];
  outputFormat: string;
  author: string;
  license: string;
}>;
export type AgentProfileBundle = Readonly<{
  schemaVersion: 1;
  projectId: string;
  trust: "USER_CONFIGURED";
  agent: AgentProfile;
  skills: readonly SkillProfile[];
  effect: typeof AGENT_PROFILE_EFFECT;
}>;

const MAX_ID = 256;
const MAX_DESCRIPTION = 4_096;
const MAX_LIST = 100;
const MAX_BUDGET = 1_000_000;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const BUNDLE_KEYS = [
  "agent",
  "effect",
  "projectId",
  "schemaVersion",
  "skills",
  "trust",
];
const AGENT_KEYS = [
  "allowedModels",
  "allowedTools",
  "author",
  "autonomy",
  "confirmationRules",
  "context",
  "description",
  "forbiddenTools",
  "id",
  "instructionSourceIds",
  "license",
  "name",
  "outputFormat",
  "preferredModels",
  "skillIds",
  "version",
];
const CONTEXT_KEYS = [
  "continuityBudgetBytes",
  "exclude",
  "include",
  "instructionBudgetBytes",
];
const SKILL_KEYS = [
  "author",
  "description",
  "destructiveActions",
  "forbiddenTools",
  "id",
  "inputs",
  "instructionSourceIds",
  "license",
  "name",
  "outputFormat",
  "requiredTools",
  "requiresConfirmation",
  "riskLevel",
  "version",
];

export class AgentProfileError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The explicit agent profile bundle is malformed, unsupported, oversized, noncanonical, incompatible, or cross-project. Review the synthetic schema-v1 bundle and retry.",
      options,
    );
    this.name = "AgentProfileError";
  }
}

export function validateAgentProfileBundle(value: unknown): AgentProfileBundle {
  try {
    if (
      !isRecord(value) ||
      !exactKeys(value, BUNDLE_KEYS) ||
      value.schemaVersion !== AGENT_PROFILE_BUNDLE_SCHEMA_VERSION ||
      !text(value.projectId, MAX_ID) ||
      value.trust !== "USER_CONFIGURED" ||
      value.effect !== AGENT_PROFILE_EFFECT ||
      !isRecord(value.agent) ||
      !exactKeys(value.agent, AGENT_KEYS) ||
      !Array.isArray(value.skills) ||
      value.skills.length < 1 ||
      value.skills.length > MAX_LIST
    )
      throw invalid();
    const agent = validateAgent(value.agent);
    const skills = value.skills.map(validateSkill).sort(compareId);
    unique(skills.map((skill) => skill.id));
    if (
      agent.skillIds.length !== skills.length ||
      agent.skillIds.some((id, index) => id !== skills[index]!.id)
    )
      throw invalid();
    const allowedTools = new Set(agent.allowedTools);
    const forbiddenTools = new Set(agent.forbiddenTools);
    for (const skill of skills) {
      if (
        skill.requiredTools.some(
          (tool) => !allowedTools.has(tool) || forbiddenTools.has(tool),
        ) ||
        skill.requiredTools.some((tool) =>
          skill.forbiddenTools.includes(tool),
        ) ||
        skill.destructiveActions.some(
          (action) => !skill.requiresConfirmation.includes(action),
        )
      )
        throw invalid();
    }
    return Object.freeze({
      schemaVersion: 1 as const,
      projectId: value.projectId,
      trust: "USER_CONFIGURED" as const,
      agent,
      skills: Object.freeze(skills),
      effect: AGENT_PROFILE_EFFECT,
    });
  } catch (error) {
    if (error instanceof AgentProfileError) throw error;
    throw invalid(error);
  }
}

export function encodeAgentProfileBundle(value: unknown): string {
  return `${JSON.stringify(validateAgentProfileBundle(value), null, 2)}\n`;
}

function validateAgent(value: Record<string, unknown>): AgentProfile {
  if (
    !text(value.id, MAX_ID) ||
    !text(value.name, MAX_ID) ||
    !text(value.description, MAX_DESCRIPTION) ||
    !version(value.version) ||
    !isRecord(value.context) ||
    !exactKeys(value.context, CONTEXT_KEYS) ||
    (value.autonomy !== "ADVISORY" && value.autonomy !== "SUPERVISED") ||
    !text(value.outputFormat, MAX_ID) ||
    !text(value.author, MAX_ID) ||
    !text(value.license, MAX_ID)
  )
    throw invalid();
  const instructionSourceIds = stringSet(value.instructionSourceIds, true);
  const skillIds = stringSet(value.skillIds, true);
  const preferredModels = stringList(value.preferredModels, true);
  const allowedModels = stringSet(value.allowedModels, true);
  const allowedTools = stringSet(value.allowedTools, true);
  const forbiddenTools = stringSet(value.forbiddenTools, false);
  const confirmationRules = stringSet(value.confirmationRules, false);
  const include = stringSet(value.context.include, false);
  const exclude = stringSet(value.context.exclude, false);
  if (
    preferredModels.some((model) => !allowedModels.includes(model)) ||
    allowedTools.some((tool) => forbiddenTools.includes(tool)) ||
    include.some((selector) => exclude.includes(selector)) ||
    !budget(value.context.continuityBudgetBytes) ||
    !budget(value.context.instructionBudgetBytes)
  )
    throw invalid();
  return Object.freeze({
    id: value.id,
    name: value.name,
    description: value.description,
    version: value.version,
    instructionSourceIds,
    skillIds,
    preferredModels,
    allowedModels,
    allowedTools,
    forbiddenTools,
    context: Object.freeze({
      include,
      exclude,
      continuityBudgetBytes: value.context.continuityBudgetBytes as number,
      instructionBudgetBytes: value.context.instructionBudgetBytes as number,
    }),
    autonomy: value.autonomy,
    outputFormat: value.outputFormat,
    confirmationRules,
    author: value.author,
    license: value.license,
  });
}

function validateSkill(value: unknown): SkillProfile {
  if (
    !isRecord(value) ||
    !exactKeys(value, SKILL_KEYS) ||
    !text(value.id, MAX_ID) ||
    !text(value.name, MAX_ID) ||
    !text(value.description, MAX_DESCRIPTION) ||
    !version(value.version) ||
    !["LOW", "MEDIUM", "HIGH"].includes(String(value.riskLevel)) ||
    !text(value.outputFormat, MAX_ID) ||
    !text(value.author, MAX_ID) ||
    !text(value.license, MAX_ID)
  )
    throw invalid();
  return Object.freeze({
    id: value.id,
    name: value.name,
    description: value.description,
    version: value.version,
    instructionSourceIds: stringSet(value.instructionSourceIds, true),
    requiredTools: stringSet(value.requiredTools, true),
    forbiddenTools: stringSet(value.forbiddenTools, false),
    inputs: stringSet(value.inputs, false),
    riskLevel: value.riskLevel as SkillProfile["riskLevel"],
    destructiveActions: stringSet(value.destructiveActions, false),
    requiresConfirmation: stringSet(value.requiresConfirmation, false),
    outputFormat: value.outputFormat,
    author: value.author,
    license: value.license,
  });
}

function stringSet(value: unknown, required: boolean): readonly string[] {
  const result = stringList(value, required).sort(compareText);
  return Object.freeze(result);
}

function stringList(value: unknown, required: boolean): string[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_LIST ||
    (required && value.length < 1) ||
    value.some((entry) => !text(entry, MAX_ID))
  )
    throw invalid();
  const result = value as string[];
  unique(result);
  return [...result];
}

function unique(values: readonly string[]) {
  if (new Set(values).size !== values.length) throw invalid();
}

function budget(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= MAX_BUDGET
  );
}

function version(value: unknown): value is string {
  return text(value, MAX_ID) && SEMVER.test(value);
}

function text(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    ![...value].some((character) => {
      const code = character.codePointAt(0)!;
      return code <= 31 || code === 127;
    })
  );
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
) {
  const actual = Object.keys(value).sort(compareText);
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function compareId(left: SkillProfile, right: SkillProfile) {
  return compareText(left.id, right.id);
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en");
}

function invalid(cause?: unknown): AgentProfileError {
  return new AgentProfileError(cause === undefined ? undefined : { cause });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
