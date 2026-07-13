import { composeInstructions, type EffectiveInstructions } from "./composer.ts";
import { type InstructionBundle, validateInstructionBundle } from "./model.ts";
import {
  type AgentProfileBundle,
  validateAgentProfileBundle,
} from "./profiles.ts";

export const PROFILE_COMPOSITION_EFFECT =
  "READ_ONLY_PROFILE_SELECTION_NOT_INSTALLED_DELIVERED_OR_EXECUTED" as const;

export type ProfileSourceDeclaration = Readonly<{
  sourceId: string;
  declaredBy: readonly string[];
}>;
export type ProfileInstructionSelection = Readonly<{
  schemaVersion: 1;
  projectId: string;
  profile: Readonly<{
    id: string;
    version: string;
    trust: "USER_CONFIGURED";
  }>;
  target: Readonly<{
    model: string;
    agent: string;
    task: string | null;
  }>;
  enabledSkillIds: readonly string[];
  instructionSources: readonly ProfileSourceDeclaration[];
  context: Readonly<{
    include: readonly string[];
    exclude: readonly string[];
    selectorEffect: "DESCRIPTIVE_NOT_RESOLVED_AS_RETRIEVAL_OR_PERMISSION";
  }>;
  budgets: Readonly<{
    CONTINUITY: number;
    INSTRUCTIONS: number;
  }>;
  effect: typeof PROFILE_COMPOSITION_EFFECT;
}>;
export type ProfileInstructionComposition = Readonly<{
  selection: ProfileInstructionSelection;
  instructions: EffectiveInstructions;
}>;
export type ComposeProfileInstructionsInput = Readonly<{
  model: string;
  task?: string;
}>;

export function composeProfileInstructions(
  profileValue: unknown,
  instructionValue: unknown,
  input: ComposeProfileInstructionsInput,
): ProfileInstructionComposition {
  try {
    const profile = validateAgentProfileBundle(profileValue);
    const bundle = validateInstructionBundle(instructionValue);
    validateSelection(profile, bundle, input);
    const instructionSources = declarations(profile);
    const selection: ProfileInstructionSelection = Object.freeze({
      schemaVersion: 1 as const,
      projectId: profile.projectId,
      profile: Object.freeze({
        id: profile.agent.id,
        version: profile.agent.version,
        trust: profile.trust,
      }),
      target: Object.freeze({
        model: input.model,
        agent: profile.agent.id,
        task: input.task ?? null,
      }),
      enabledSkillIds: Object.freeze([...profile.agent.skillIds]),
      instructionSources,
      context: Object.freeze({
        include: profile.agent.context.include,
        exclude: profile.agent.context.exclude,
        selectorEffect:
          "DESCRIPTIVE_NOT_RESOLVED_AS_RETRIEVAL_OR_PERMISSION" as const,
      }),
      budgets: Object.freeze({
        CONTINUITY: profile.agent.context.continuityBudgetBytes,
        INSTRUCTIONS: profile.agent.context.instructionBudgetBytes,
      }),
      effect: PROFILE_COMPOSITION_EFFECT,
    });
    const instructions = composeInstructions(bundle, {
      projectId: profile.projectId,
      model: input.model,
      agent: profile.agent.id,
      ...(input.task === undefined ? {} : { task: input.task }),
    });
    return Object.freeze({ selection, instructions });
  } catch (error) {
    if (error instanceof ProfileCompositionError) throw error;
    throw new ProfileCompositionError({ cause: error });
  }
}

export class ProfileCompositionError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The explicit profile composition is incompatible, incomplete, oversized, or cross-project. Review the profile, selected model, and exact instruction-source set, then retry.",
      options,
    );
    this.name = "ProfileCompositionError";
  }
}

function validateSelection(
  profile: AgentProfileBundle,
  bundle: InstructionBundle,
  input: ComposeProfileInstructionsInput,
) {
  if (
    bundle.projectId !== profile.projectId ||
    !bounded(input.model) ||
    !profile.agent.allowedModels.includes(input.model) ||
    (input.task !== undefined && !bounded(input.task))
  )
    throw new ProfileCompositionError();
  const declared = declarations(profile).map((value) => value.sourceId);
  const actual = bundle.sources.map((source) => source.id).sort(compareText);
  if (
    declared.length !== actual.length ||
    declared.some((id, index) => id !== actual[index])
  )
    throw new ProfileCompositionError();
}

function declarations(
  profile: AgentProfileBundle,
): readonly ProfileSourceDeclaration[] {
  const values = new Map<string, string[]>();
  addDeclarations(
    values,
    profile.agent.instructionSourceIds,
    `AGENT:${profile.agent.id}`,
  );
  for (const skill of profile.skills)
    addDeclarations(values, skill.instructionSourceIds, `SKILL:${skill.id}`);
  return Object.freeze(
    [...values]
      .sort(([left], [right]) => compareText(left, right))
      .map(([sourceId, declaredBy]) =>
        Object.freeze({
          sourceId,
          declaredBy: Object.freeze(declaredBy.sort(compareText)),
        }),
      ),
  );
}

function addDeclarations(
  values: Map<string, string[]>,
  sourceIds: readonly string[],
  owner: string,
) {
  for (const sourceId of sourceIds)
    values.set(sourceId, [...(values.get(sourceId) ?? []), owner]);
}

function bounded(value: string) {
  return value.length >= 1 && value.length <= 256 && !/\p{Cc}/u.test(value);
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en");
}
