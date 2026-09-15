export const MODEL_TARGET_CONFIGURATION_VERSION = 1 as const;
export const MODEL_TARGET_LIMITS = Object.freeze({
  targets: 32,
  selections: 10_000,
  identifierCharacters: 128,
  displayNameCharacters: 120,
  providerKindCharacters: 64,
  modelIdCharacters: 256,
  referenceCharacters: 2_048,
  instructionRefs: 32,
  maxInputBytes: 1024 * 1024,
  maxOutputBytes: 1024 * 1024,
});

export type ModelExecutionBoundary =
  "LOCAL_ONLY" | "EXTERNAL_SERVICE" | "UNCLASSIFIED";

export type ModelTarget = Readonly<{
  targetId: string;
  displayName: string;
  providerKind: string;
  modelId: string;
  boundary: ModelExecutionBoundary;
  profileRef: string;
  policyRef: string;
  instructionRefs: readonly string[];
  maxInputBytes: number;
  maxOutputBytes: number;
  enabled: boolean;
}>;

export type ProjectTargetSelection = Readonly<{
  projectId: string;
  targetId: string;
}>;

export type ConversationTargetSelection = Readonly<{
  conversationId: string;
  projectId: string | null;
  targetId: string;
}>;

export type ModelTargetConfiguration = Readonly<{
  schemaVersion: typeof MODEL_TARGET_CONFIGURATION_VERSION;
  revision: number;
  targets: readonly ModelTarget[];
  defaultTargetId: string | null;
  projectSelections: readonly ProjectTargetSelection[];
  conversationSelections: readonly ConversationTargetSelection[];
}>;

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
}>;

export type ModelTargetView = Readonly<{
  revision: number;
  targets: readonly ModelTargetSummary[];
  defaultTargetId: string | null;
}>;

export type ResolvedModelTarget = Readonly<{
  target: ModelTarget;
  selectedBy: "CONVERSATION" | "PROJECT" | "DEFAULT";
}>;

export class ModelTargetError extends Error {
  public constructor(message = "Model target configuration is invalid.") {
    super(message);
    this.name = "ModelTargetError";
  }
}

export class ModelTargetConflictError extends ModelTargetError {
  public constructor() {
    super("Model target configuration changed. Reload it and retry.");
    this.name = "ModelTargetConflictError";
  }
}

export function emptyModelTargetConfiguration(): ModelTargetConfiguration {
  return Object.freeze({
    schemaVersion: MODEL_TARGET_CONFIGURATION_VERSION,
    revision: 0,
    targets: Object.freeze([]),
    defaultTargetId: null,
    projectSelections: Object.freeze([]),
    conversationSelections: Object.freeze([]),
  });
}

export function validateModelTargetConfiguration(
  value: unknown,
): ModelTargetConfiguration {
  if (!record(value) || value.schemaVersion !== 1)
    throw new ModelTargetError("Unsupported model target configuration.");
  exact(value, [
    "schemaVersion",
    "revision",
    "targets",
    "defaultTargetId",
    "projectSelections",
    "conversationSelections",
  ]);
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0)
    throw new ModelTargetError();
  if (
    !Array.isArray(value.targets) ||
    value.targets.length > MODEL_TARGET_LIMITS.targets
  )
    throw new ModelTargetError();
  const targets = Object.freeze(value.targets.map(validateTarget));
  unique(targets.map((target) => target.targetId));
  const targetIds = new Set(targets.map((target) => target.targetId));
  const defaultTargetId = nullableId(value.defaultTargetId);
  if (defaultTargetId !== null && !targetIds.has(defaultTargetId))
    throw new ModelTargetError("The default model target does not exist.");
  const projectSelections = validateSelections(
    value.projectSelections,
    "projectId",
    targetIds,
  ) as readonly ProjectTargetSelection[];
  const conversationSelections = validateConversationSelections(
    value.conversationSelections,
    targetIds,
  );
  return Object.freeze({
    schemaVersion: 1,
    revision: Number(value.revision),
    targets,
    defaultTargetId,
    projectSelections,
    conversationSelections,
  });
}

export class ModelTargets {
  readonly #store: ModelTargetStore;
  public constructor(store: ModelTargetStore) {
    this.#store = store;
  }

  public async inspect(): Promise<ModelTargetConfiguration> {
    return validateModelTargetConfiguration(await this.#store.load());
  }

  public async view(): Promise<ModelTargetView> {
    const configuration = await this.inspect();
    return Object.freeze({
      revision: configuration.revision,
      targets: Object.freeze(
        configuration.targets.map(({ targetId, displayName, enabled }) =>
          Object.freeze({ targetId, displayName, enabled }),
        ),
      ),
      defaultTargetId: configuration.defaultTargetId,
    });
  }

  public async configure(
    target: ModelTarget,
    expectedRevision: number,
  ): Promise<ModelTargetConfiguration> {
    const validated = validateTarget(target);
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
    const target = configuration.targets.find(
      (candidate) => candidate.targetId === selected,
    );
    if (!target?.enabled)
      throw new ModelTargetError(
        "The selected model target is unavailable or disabled.",
      );
    return Object.freeze({
      target,
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

function validateTarget(value: unknown): ModelTarget {
  if (!record(value)) throw new ModelTargetError();
  exact(value, [
    "targetId",
    "displayName",
    "providerKind",
    "modelId",
    "boundary",
    "profileRef",
    "policyRef",
    "instructionRefs",
    "maxInputBytes",
    "maxOutputBytes",
    "enabled",
  ]);
  const boundary = value.boundary;
  if (
    boundary !== "LOCAL_ONLY" &&
    boundary !== "EXTERNAL_SERVICE" &&
    boundary !== "UNCLASSIFIED"
  )
    throw new ModelTargetError("Unknown model execution boundary.");
  if (
    !Array.isArray(value.instructionRefs) ||
    value.instructionRefs.length > MODEL_TARGET_LIMITS.instructionRefs
  )
    throw new ModelTargetError();
  const instructionRefs = Object.freeze(value.instructionRefs.map(reference));
  unique(instructionRefs);
  if (typeof value.enabled !== "boolean") throw new ModelTargetError();
  return Object.freeze({
    targetId: id(value.targetId),
    displayName: text(
      value.displayName,
      MODEL_TARGET_LIMITS.displayNameCharacters,
    ),
    providerKind: text(
      value.providerKind,
      MODEL_TARGET_LIMITS.providerKindCharacters,
    ),
    modelId: text(value.modelId, MODEL_TARGET_LIMITS.modelIdCharacters),
    boundary,
    profileRef: reference(value.profileRef),
    policyRef: reference(value.policyRef),
    instructionRefs,
    maxInputBytes: positiveBound(
      value.maxInputBytes,
      MODEL_TARGET_LIMITS.maxInputBytes,
    ),
    maxOutputBytes: positiveBound(
      value.maxOutputBytes,
      MODEL_TARGET_LIMITS.maxOutputBytes,
    ),
    enabled: value.enabled,
  });
}

function validateSelections(
  value: unknown,
  key: "projectId",
  targets: ReadonlySet<string>,
) {
  if (!Array.isArray(value) || value.length > MODEL_TARGET_LIMITS.selections)
    throw new ModelTargetError();
  const selections = value.map((selection) => {
    if (!record(selection)) throw new ModelTargetError();
    exact(selection, [key, "targetId"]);
    const targetId = id(selection.targetId);
    if (!targets.has(targetId)) throw new ModelTargetError();
    return Object.freeze({ [key]: id(selection[key]), targetId });
  });
  unique(selections.map((selection) => selection[key]));
  return Object.freeze(selections);
}

function validateConversationSelections(
  value: unknown,
  targets: ReadonlySet<string>,
): readonly ConversationTargetSelection[] {
  if (!Array.isArray(value) || value.length > MODEL_TARGET_LIMITS.selections)
    throw new ModelTargetError();
  const selections = value.map((selection) => {
    if (!record(selection)) throw new ModelTargetError();
    exact(selection, ["conversationId", "projectId", "targetId"]);
    const targetId = id(selection.targetId);
    if (!targets.has(targetId)) throw new ModelTargetError();
    return Object.freeze({
      conversationId: id(selection.conversationId),
      projectId: selection.projectId === null ? null : id(selection.projectId),
      targetId,
    });
  });
  unique(selections.map((selection) => selection.conversationId));
  return Object.freeze(selections);
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
  if (targetId === null) return;
  const target = configuration.targets.find(
    (candidate) => candidate.targetId === id(targetId),
  );
  if (!target?.enabled)
    throw new ModelTargetError(
      "The selected model target is unavailable or disabled.",
    );
}

function id(value: unknown): string {
  const result = text(value, MODEL_TARGET_LIMITS.identifierCharacters);
  if (!/^[a-z0-9][a-z0-9._-]*$/iu.test(result)) throw new ModelTargetError();
  return result;
}
function nullableId(value: unknown): string | null {
  return value === null ? null : id(value);
}
function reference(value: unknown): string {
  return text(value, MODEL_TARGET_LIMITS.referenceCharacters);
}
function text(value: unknown, limit: number): string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length === 0 ||
    value.length > limit ||
    [...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || (code >= 127 && code <= 159);
    })
  )
    throw new ModelTargetError();
  return value;
}
function positiveBound(value: unknown, maximum: number): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 1 ||
    Number(value) > maximum
  )
    throw new ModelTargetError();
  return Number(value);
}
function unique(values: readonly string[]) {
  if (new Set(values).size !== values.length)
    throw new ModelTargetError(
      "Model target configuration contains duplicates.",
    );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new ModelTargetError();
}
