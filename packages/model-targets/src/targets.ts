import {
  modelTargetAvailability,
  NO_MODEL_TARGET_CAPABILITIES,
  type ModelTargetAvailability,
  type ModelTargetCapabilities,
} from "./availability.ts";
import {
  id,
  ModelTargetConflictError,
  ModelTargetError,
  validateModelTarget,
  validateModelTargetConfiguration,
  type ClassifiedModelTarget,
  type ModelExecutionClass,
  type ModelTargetConfiguration,
} from "./model.ts";

export type ModelTargetStore = Readonly<{
  load(): Promise<ModelTargetConfiguration>;
  replace(
    expectedRevision: number,
    configuration: ModelTargetConfiguration,
  ): Promise<ModelTargetConfiguration>;
}>;

export type ModelTargetSummary = Readonly<{
  targetId: string;
  displayName: string;
  enabled: boolean;
  executionClass: ModelExecutionClass | null;
  availability: ModelTargetAvailability;
}>;

export type ModelTargetView = Readonly<{
  revision: number;
  targets: readonly ModelTargetSummary[];
  defaultTargetId: string | null;
}>;

export type ResolvedModelTarget = Readonly<{
  target: ClassifiedModelTarget;
  selectedBy: "CONVERSATION" | "PROJECT" | "DEFAULT";
}>;

export class ModelTargets {
  readonly #store: ModelTargetStore;
  readonly #capabilities: ModelTargetCapabilities;
  public constructor(
    store: ModelTargetStore,
    capabilities: ModelTargetCapabilities = NO_MODEL_TARGET_CAPABILITIES,
  ) {
    this.#store = store;
    this.#capabilities = capabilities;
  }

  public async inspect(): Promise<ModelTargetConfiguration> {
    return validateModelTargetConfiguration(await this.#store.load());
  }

  public async view(): Promise<ModelTargetView> {
    const configuration = await this.inspect();
    return Object.freeze({
      revision: configuration.revision,
      targets: Object.freeze(
        configuration.targets.map((target) =>
          Object.freeze({
            targetId: target.targetId,
            displayName: target.displayName,
            enabled: target.enabled,
            executionClass: target.executionClass,
            availability: modelTargetAvailability(target, this.#capabilities),
          }),
        ),
      ),
      defaultTargetId: configuration.defaultTargetId,
    });
  }

  public async configure(
    target: ClassifiedModelTarget,
    expectedRevision: number,
  ): Promise<ModelTargetConfiguration> {
    const validated = validateModelTarget(target, false);
    return this.#change(expectedRevision, (configuration) => ({
      ...configuration,
      targets: Object.freeze(
        [
          ...configuration.targets.filter(
            (candidate) => candidate.targetId !== validated.targetId,
          ),
          validated,
        ].sort((left, right) => left.targetId.localeCompare(right.targetId)),
      ),
    }));
  }

  public async selectDefault(
    targetId: string | null,
    expectedRevision: number,
  ): Promise<ModelTargetConfiguration> {
    return this.#change(expectedRevision, (configuration) => {
      available(configuration, targetId);
      return { ...configuration, defaultTargetId: targetId };
    });
  }

  public async selectProject(
    projectId: string,
    targetId: string,
    expectedRevision: number,
  ): Promise<ModelTargetConfiguration> {
    const selectedProject = id(projectId);
    return this.#change(expectedRevision, (configuration) => {
      available(configuration, targetId);
      return {
        ...configuration,
        projectSelections: replaceSelection(
          configuration.projectSelections,
          "projectId",
          selectedProject,
          targetId,
        ),
      };
    });
  }

  public async selectConversation(
    conversationId: string,
    projectId: string | null,
    targetId: string,
    expectedRevision: number,
  ): Promise<ModelTargetConfiguration> {
    const selectedConversation = id(conversationId);
    const selectedProject = projectId === null ? null : id(projectId);
    return this.#change(expectedRevision, (configuration) => {
      available(configuration, targetId);
      const kept = configuration.conversationSelections.filter(
        (selection) => selection.conversationId !== selectedConversation,
      );
      return {
        ...configuration,
        conversationSelections: Object.freeze(
          [
            ...kept,
            Object.freeze({
              conversationId: selectedConversation,
              projectId: selectedProject,
              targetId,
            }),
          ].sort((left, right) =>
            left.conversationId.localeCompare(right.conversationId),
          ),
        ),
      };
    });
  }

  public async resolve(
    input: Readonly<{
      conversationId: string;
      projectId: string | null;
    }>,
  ): Promise<ResolvedModelTarget | null> {
    const configuration = await this.inspect();
    const conversationId = id(input.conversationId);
    const projectId = input.projectId === null ? null : id(input.projectId);
    const conversation = configuration.conversationSelections.find(
      (selection) => selection.conversationId === conversationId,
    );
    if (conversation && conversation.projectId !== projectId)
      throw new ModelTargetError(
        "The conversation model selection belongs to another scope.",
      );
    const project =
      projectId === null
        ? undefined
        : configuration.projectSelections.find(
            (selection) => selection.projectId === projectId,
          );
    const selected =
      conversation?.targetId ??
      project?.targetId ??
      configuration.defaultTargetId;
    if (selected === null) return null;
    return Object.freeze({
      target: selectable(configuration, selected),
      selectedBy: conversation
        ? "CONVERSATION"
        : project
          ? "PROJECT"
          : "DEFAULT",
    });
  }

  async #change(
    expectedRevision: number,
    change: (
      configuration: ModelTargetConfiguration,
    ) => Omit<ModelTargetConfiguration, "revision">,
  ) {
    const current = await this.inspect();
    if (current.revision !== expectedRevision)
      throw new ModelTargetConflictError();
    const next = validateModelTargetConfiguration({
      ...change(current),
      revision: current.revision + 1,
    });
    return this.#store.replace(expectedRevision, next);
  }
}

function replaceSelection<
  T extends Readonly<{ targetId: string }>,
  K extends keyof T,
>(
  values: readonly T[],
  key: K,
  identity: T[K],
  targetId: string,
): readonly T[] {
  return Object.freeze(
    [
      ...values.filter((value) => value[key] !== identity),
      Object.freeze({ [key]: identity, targetId }) as T,
    ].sort((left, right) =>
      String(left[key]).localeCompare(String(right[key])),
    ),
  );
}

function available(
  configuration: ModelTargetConfiguration,
  targetId: string | null,
) {
  if (targetId !== null) selectable(configuration, id(targetId));
}

/** Selection needs an enabled target with a class; launch is checked later. */
function selectable(
  configuration: ModelTargetConfiguration,
  targetId: string,
): ClassifiedModelTarget {
  const target = configuration.targets.find(
    (candidate) => candidate.targetId === targetId,
  );
  if (target?.executionClass === null)
    throw new ModelTargetError(
      "The selected model target has no kind yet. Save it again with a kind.",
    );
  if (!target?.enabled)
    throw new ModelTargetError(
      "The selected model target is unavailable or disabled.",
    );
  return target;
}
