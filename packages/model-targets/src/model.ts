export const MODEL_TARGET_CONFIGURATION_VERSION = 2 as const;
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

export type ModelExecutionClass =
  "MODEL_DELIVERY" | "AGENT_EXECUTION" | "LOCAL_MODEL";

/**
 * The closed list of target kinds (ADR-0044, ADR-0045). A kind belongs to one
 * execution class and admits only the boundaries listed here; the boundary is a
 * declaration checked by the adapter, never inferred from a name or a URL.
 */
export const MODEL_TARGET_KINDS = Object.freeze({
  OPENAI_RESPONSES: Object.freeze({
    executionClass: "MODEL_DELIVERY",
    boundaries: Object.freeze(["EXTERNAL_SERVICE"]),
  }),
  CODEX_CLI: Object.freeze({
    executionClass: "AGENT_EXECUTION",
    boundaries: Object.freeze(["EXTERNAL_SERVICE"]),
  }),
  CLAUDE_CODE: Object.freeze({
    executionClass: "AGENT_EXECUTION",
    boundaries: Object.freeze(["EXTERNAL_SERVICE"]),
  }),
  LLAMA_SERVER_LOOPBACK: Object.freeze({
    executionClass: "LOCAL_MODEL",
    boundaries: Object.freeze(["LOCAL_ONLY", "UNCLASSIFIED"]),
  }),
} as const);

export type ModelTargetKind = keyof typeof MODEL_TARGET_KINDS;

type ModelTargetFields = Readonly<{
  targetId: string;
  displayName: string;
  modelId: string;
  profileRef: string;
  policyRef: string;
  instructionRefs: readonly string[];
  maxInputBytes: number;
  maxOutputBytes: number;
  enabled: boolean;
}>;

export type ModelDeliveryTarget = ModelTargetFields &
  Readonly<{
    executionClass: "MODEL_DELIVERY";
    kind: "OPENAI_RESPONSES";
    boundary: "EXTERNAL_SERVICE";
  }>;

export type AgentExecutionTarget = ModelTargetFields &
  Readonly<{
    executionClass: "AGENT_EXECUTION";
    kind: "CODEX_CLI" | "CLAUDE_CODE";
    boundary: "EXTERNAL_SERVICE";
  }>;

export type LocalModelTarget = ModelTargetFields &
  Readonly<{
    executionClass: "LOCAL_MODEL";
    kind: "LLAMA_SERVER_LOOPBACK";
    boundary: "LOCAL_ONLY" | "UNCLASSIFIED";
  }>;

export type ClassifiedModelTarget =
  ModelDeliveryTarget | AgentExecutionTarget | LocalModelTarget;

/**
 * A v1 entry whose provider and boundary match no known combination. It keeps
 * every original field so it can be recovered, but it has no class: it can be
 * neither selected nor used until someone saves it again with a kind.
 */
export type UnclassifiedModelTarget = ModelTargetFields &
  Readonly<{
    executionClass: null;
    kind: null;
    legacyProviderKind: string;
    boundary: ModelExecutionBoundary;
  }>;

export type ModelTarget = ClassifiedModelTarget | UnclassifiedModelTarget;

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
  if (
    !record(value) ||
    value.schemaVersion !== MODEL_TARGET_CONFIGURATION_VERSION
  )
    throw new ModelTargetError("Unsupported model target configuration.");
  return validateConfigurationBody(value, (target) =>
    validateModelTarget(target, true),
  );
}

/** Shared by v1 and v2: everything except the shape of one target. */
export function validateConfigurationBody(
  value: Record<string, unknown>,
  target: (value: unknown) => ModelTarget,
): ModelTargetConfiguration {
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
  const targets = Object.freeze(value.targets.map(target));
  unique(targets.map((candidate) => candidate.targetId));
  const targetIds = new Set(targets.map((candidate) => candidate.targetId));
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
    schemaVersion: MODEL_TARGET_CONFIGURATION_VERSION,
    revision: Number(value.revision),
    targets,
    defaultTargetId,
    projectSelections,
    conversationSelections,
  });
}

/**
 * Validates one v2 target. A new target must carry a kind; only a stored
 * configuration may keep an unclassified entry preserved from v1.
 */
export function validateModelTarget(
  value: unknown,
  allowUnclassified: boolean,
): ModelTarget {
  if (!record(value)) throw new ModelTargetError();
  if (value.executionClass === null) {
    if (!allowUnclassified)
      throw new ModelTargetError(
        "Choose a target kind before saving this model target.",
      );
    exact(value, [...TARGET_KEYS, "legacyProviderKind"]);
    if (value.kind !== null) throw new ModelTargetError();
    const { targetId, displayName, ...fields } = targetFields(value);
    return Object.freeze({
      targetId,
      displayName,
      executionClass: null,
      kind: null,
      legacyProviderKind: text(
        value.legacyProviderKind,
        MODEL_TARGET_LIMITS.providerKindCharacters,
      ),
      boundary: boundary(value.boundary),
      ...fields,
    });
  }
  exact(value, TARGET_KEYS);
  const kind = value.kind;
  if (typeof kind !== "string" || !Object.hasOwn(MODEL_TARGET_KINDS, kind))
    throw new ModelTargetError("Unknown model target kind.");
  const declared = MODEL_TARGET_KINDS[kind as ModelTargetKind];
  if (value.executionClass !== declared.executionClass)
    throw new ModelTargetError(
      "The model target kind belongs to another execution class.",
    );
  const declaredBoundary = boundary(value.boundary);
  if (!(declared.boundaries as readonly string[]).includes(declaredBoundary))
    throw new ModelTargetError(
      "The execution boundary is not valid for this model target kind.",
    );
  const { targetId, displayName, ...fields } = targetFields(value);
  return Object.freeze({
    targetId,
    displayName,
    executionClass: declared.executionClass,
    kind,
    boundary: declaredBoundary,
    ...fields,
  }) as ClassifiedModelTarget;
}

const TARGET_KEYS = Object.freeze([
  "targetId",
  "displayName",
  "executionClass",
  "kind",
  "modelId",
  "boundary",
  "profileRef",
  "policyRef",
  "instructionRefs",
  "maxInputBytes",
  "maxOutputBytes",
  "enabled",
]);

/** The fields every target shares, in v1 and in v2. */
export function targetFields(value: Record<string, unknown>) {
  if (
    !Array.isArray(value.instructionRefs) ||
    value.instructionRefs.length > MODEL_TARGET_LIMITS.instructionRefs
  )
    throw new ModelTargetError();
  const instructionRefs = Object.freeze(value.instructionRefs.map(reference));
  unique(instructionRefs);
  if (typeof value.enabled !== "boolean") throw new ModelTargetError();
  return {
    targetId: id(value.targetId),
    displayName: text(
      value.displayName,
      MODEL_TARGET_LIMITS.displayNameCharacters,
    ),
    modelId: text(value.modelId, MODEL_TARGET_LIMITS.modelIdCharacters),
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
  };
}

export function boundary(value: unknown): ModelExecutionBoundary {
  if (
    value !== "LOCAL_ONLY" &&
    value !== "EXTERNAL_SERVICE" &&
    value !== "UNCLASSIFIED"
  )
    throw new ModelTargetError("Unknown model execution boundary.");
  return value;
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

export function id(value: unknown): string {
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
export function text(value: unknown, limit: number): string {
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
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new ModelTargetError();
}
