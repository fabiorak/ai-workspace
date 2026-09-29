import {
  composeInstructionRules,
  type EffectiveInstructions,
} from "./composer.ts";
import {
  InstructionError,
  validateInstructionBundle,
  validateInstructionSourceDefinition,
  type InstructionSource,
} from "./model.ts";
import {
  AGENT_PROFILE_EFFECT,
  validateAgentProfileBundle,
  validateProfileDefinition,
  type AgentProfileBundle,
} from "./profiles.ts";
import {
  PROFILE_COMPOSITION_EFFECT,
  ProfileCompositionError,
  type ProfileInstructionSelection,
} from "./profile-composer.ts";

export type ConfigurationScope =
  | Readonly<{ kind: "GENERAL" }>
  | Readonly<{ kind: "PROJECT"; projectId: string }>;
export type ScopedInstructionSource = Omit<InstructionSource, "projectId"> &
  Readonly<{ ownerScope: ConfigurationScope }>;
export type ScopedInstructionBundle = Readonly<{
  schemaVersion: 2;
  ownerScope: ConfigurationScope;
  sources: readonly ScopedInstructionSource[];
}>;
export type ScopedAgentProfileBundle = Omit<
  AgentProfileBundle,
  "schemaVersion" | "projectId"
> &
  Readonly<{ schemaVersion: 2; scope: ConfigurationScope }>;
export type ScopedEffectiveInstructions = Omit<
  EffectiveInstructions,
  "schemaVersion" | "projectId"
> &
  Readonly<{ schemaVersion: 2; scope: ConfigurationScope }>;
export type ScopedProfileInstructionSelection = Omit<
  ProfileInstructionSelection,
  "schemaVersion" | "projectId"
> &
  Readonly<{ schemaVersion: 2; scope: ConfigurationScope }>;

export function validateConfigurationScope(value: unknown): ConfigurationScope {
  if (!record(value)) throw invalid();
  if (value.kind === "GENERAL" && exact(value, ["kind"]))
    return Object.freeze({ kind: "GENERAL" });
  if (
    value.kind === "PROJECT" &&
    exact(value, ["kind", "projectId"]) &&
    text(value.projectId)
  )
    return Object.freeze({ kind: "PROJECT", projectId: value.projectId });
  throw invalid();
}
export function sameConfigurationScope(
  left: ConfigurationScope,
  right: ConfigurationScope,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "GENERAL" ||
      (right.kind === "PROJECT" && left.projectId === right.projectId))
  );
}

/** Accept legacy project configuration only in its actual project. */
export function validateScopedInstructionBundle(
  value: unknown,
  expectedScope?: ConfigurationScope,
): ScopedInstructionBundle {
  if (!record(value)) throw invalid();
  if (value.schemaVersion === 1) {
    const legacy = validateInstructionBundle(value);
    const ownerScope = validateConfigurationScope({
      kind: "PROJECT",
      projectId: legacy.projectId,
    });
    checkScope(ownerScope, expectedScope);
    return Object.freeze({
      schemaVersion: 2,
      ownerScope,
      sources: Object.freeze(
        legacy.sources.map((source) =>
          Object.freeze({
            ...validateInstructionSourceDefinition({ ...source }),
            ownerScope,
          }),
        ),
      ),
    });
  }
  if (
    value.schemaVersion !== 2 ||
    !exact(value, ["schemaVersion", "ownerScope", "sources"]) ||
    !Array.isArray(value.sources) ||
    value.sources.length < 1 ||
    value.sources.length > 50
  )
    throw invalid();
  const ownerScope = validateConfigurationScope(value.ownerScope);
  checkScope(ownerScope, expectedScope);
  const ids = new Set<string>();
  const sources = value.sources.map((source) => {
    if (
      !record(source) ||
      !exact(source, [
        "id",
        "ownerScope",
        "scope",
        "target",
        "trust",
        "sourceDigest",
        "rules",
      ])
    )
      throw invalid();
    checkScope(validateConfigurationScope(source.ownerScope), ownerScope);
    const validated = validateInstructionSourceDefinition(source);
    if (
      ids.has(validated.id) ||
      (ownerScope.kind === "GENERAL" && validated.scope === "PROJECT")
    )
      throw invalid();
    ids.add(validated.id);
    return Object.freeze({ ...validated, ownerScope });
  });
  return Object.freeze({
    schemaVersion: 2,
    ownerScope,
    sources: Object.freeze(sources),
  });
}

export function validateScopedAgentProfileBundle(
  value: unknown,
  expectedScope?: ConfigurationScope,
): ScopedAgentProfileBundle {
  if (!record(value)) throw invalid();
  if (value.schemaVersion === 1) {
    const { projectId, schemaVersion, ...legacy } =
      validateAgentProfileBundle(value);
    void schemaVersion;
    const scope = validateConfigurationScope({ kind: "PROJECT", projectId });
    checkScope(scope, expectedScope);
    return Object.freeze({ schemaVersion: 2, scope, ...legacy });
  }
  if (
    value.schemaVersion !== 2 ||
    !exact(value, [
      "schemaVersion",
      "scope",
      "trust",
      "agent",
      "skills",
      "effect",
    ]) ||
    value.trust !== "USER_CONFIGURED" ||
    value.effect !== AGENT_PROFILE_EFFECT
  )
    throw invalid();
  const scope = validateConfigurationScope(value.scope);
  checkScope(scope, expectedScope);
  return Object.freeze({
    schemaVersion: 2,
    scope,
    trust: "USER_CONFIGURED",
    ...validateProfileDefinition(value),
    effect: AGENT_PROFILE_EFFECT,
  });
}

export function composeScopedProfileInstructions(
  profileValue: unknown,
  instructionValue: unknown,
  input: Readonly<{ model: string; task?: string }>,
): Readonly<{
  selection: ScopedProfileInstructionSelection;
  instructions: ScopedEffectiveInstructions;
}> {
  const profile = validateScopedAgentProfileBundle(profileValue);
  const bundle = validateScopedInstructionBundle(
    instructionValue,
    profile.scope,
  );
  if (
    !text(input.model) ||
    !profile.agent.allowedModels.includes(input.model) ||
    (input.task !== undefined && !text(input.task))
  )
    throw new ProfileCompositionError();
  const declarations = new Map<string, string[]>();
  for (const [owner, ids] of [
    [`AGENT:${profile.agent.id}`, profile.agent.instructionSourceIds],
    ...profile.skills.map(
      (skill) => [`SKILL:${skill.id}`, skill.instructionSourceIds] as const,
    ),
  ] as const)
    for (const id of ids)
      declarations.set(id, [...(declarations.get(id) ?? []), owner]);
  const actual = bundle.sources.map((source) => source.id);
  if (
    actual.length !== declarations.size ||
    actual.some((id) => !declarations.has(id))
  )
    throw new ProfileCompositionError();
  const target = Object.freeze({
    model: input.model,
    agent: profile.agent.id,
    task: input.task ?? null,
  });
  const selection: ScopedProfileInstructionSelection = Object.freeze({
    schemaVersion: 2,
    scope: profile.scope,
    profile: Object.freeze({
      id: profile.agent.id,
      version: profile.agent.version,
      trust: profile.trust,
    }),
    target,
    enabledSkillIds: Object.freeze([...profile.agent.skillIds]),
    instructionSources: Object.freeze(
      [...declarations]
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([sourceId, declaredBy]) =>
          Object.freeze({
            sourceId,
            declaredBy: Object.freeze(declaredBy.sort()),
          }),
        ),
    ),
    context: Object.freeze({
      include: profile.agent.context.include,
      exclude: profile.agent.context.exclude,
      selectorEffect: "DESCRIPTIVE_NOT_RESOLVED_AS_RETRIEVAL_OR_PERMISSION",
    }),
    budgets: Object.freeze({
      CONTINUITY: profile.agent.context.continuityBudgetBytes,
      INSTRUCTIONS: profile.agent.context.instructionBudgetBytes,
    }),
    effect: PROFILE_COMPOSITION_EFFECT,
  });
  const rules = composeInstructionRules(bundle.sources, {
    model: input.model,
    agent: profile.agent.id,
    ...(input.task === undefined ? {} : { task: input.task }),
  });
  if (rules.some((rule) => rule.reason === "FORBIDDEN_CONSTRAINT_OVERRIDE"))
    throw new ProfileCompositionError();
  return Object.freeze({
    selection,
    instructions: Object.freeze({
      schemaVersion: 2,
      scope: profile.scope,
      target,
      enforcement: "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY",
      rules,
    }),
  });
}

function checkScope(
  scope: ConfigurationScope,
  expected?: ConfigurationScope,
): void {
  if (
    expected !== undefined &&
    !sameConfigurationScope(scope, validateConfigurationScope(expected))
  )
    throw invalid();
}
function invalid() {
  return new InstructionError(
    "The configured profile or instructions are malformed, conflicting, or belong to another scope.",
  );
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
function text(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 256 &&
    !/\p{Cc}/u.test(value)
  );
}
