import {
  boundary,
  exact,
  MODEL_TARGET_LIMITS,
  ModelTargetError,
  record,
  targetFields,
  text,
  validateConfigurationBody,
  validateModelTargetConfiguration,
  type ModelTarget,
  type ModelTargetConfiguration,
} from "./model.ts";

export const LEGACY_MODEL_TARGET_CONFIGURATION_VERSION = 1 as const;

/**
 * Reads a stored configuration in either schema and always returns v2. A v1
 * document is interpreted in memory only: this function never writes, so
 * opening Settings cannot migrate anything as a side effect.
 */
export function readModelTargetConfiguration(
  value: unknown,
): ModelTargetConfiguration {
  if (
    record(value) &&
    value.schemaVersion === LEGACY_MODEL_TARGET_CONFIGURATION_VERSION
  )
    return migrateLegacyModelTargetConfiguration(value);
  return validateModelTargetConfiguration(value);
}

/**
 * Validates a v1 document as strictly as v1 did and maps it additively. Only
 * the one combination v1 could actually deliver becomes a class; any other
 * entry keeps its provider and boundary and stays unclassified, so an unknown
 * name never becomes an executable agent and a v1 `LOCAL_ONLY` entry never
 * becomes an operational local endpoint.
 */
export function migrateLegacyModelTargetConfiguration(
  value: unknown,
): ModelTargetConfiguration {
  if (
    !record(value) ||
    value.schemaVersion !== LEGACY_MODEL_TARGET_CONFIGURATION_VERSION
  )
    throw new ModelTargetError("Unsupported model target configuration.");
  return validateConfigurationBody(value, legacyTarget);
}

function legacyTarget(value: unknown): ModelTarget {
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
  const { targetId, displayName, ...fields } = targetFields(value);
  const providerKind = text(
    value.providerKind,
    MODEL_TARGET_LIMITS.providerKindCharacters,
  );
  const declared = boundary(value.boundary);
  if (providerKind === "OPENAI_RESPONSES" && declared === "EXTERNAL_SERVICE")
    return Object.freeze({
      targetId,
      displayName,
      executionClass: "MODEL_DELIVERY",
      kind: "OPENAI_RESPONSES",
      boundary: "EXTERNAL_SERVICE",
      ...fields,
    });
  return Object.freeze({
    targetId,
    displayName,
    executionClass: null,
    kind: null,
    legacyProviderKind: providerKind,
    boundary: declared,
    ...fields,
  });
}
