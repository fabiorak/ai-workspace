export const MODEL_EXECUTION_BOUNDARIES = Object.freeze([
  "LOCAL_ONLY",
  "EXTERNAL",
  "UNCLASSIFIED",
] as const);

export type ModelExecutionBoundary =
  (typeof MODEL_EXECUTION_BOUNDARIES)[number];

export const MODEL_PRIVACY_PATH_EFFECT =
  "DECISION_ONLY_NOT_MODEL_AUTHORIZATION_DELIVERY_OR_EXECUTION" as const;

export type ModelPrivacyPath = Readonly<{
  boundary: ModelExecutionBoundary;
  privacyPreflight: "REQUIRED" | "BLOCKED_BEFORE_PREFLIGHT";
  contentTreatment: "ORIGINAL" | "PSEUDONYMIZED_EXACT_PREVIEW" | "NONE";
  pseudonymization: "NOT_REQUIRED" | "REQUIRED" | "BLOCKED";
  outboundConfirmation: "NOT_REQUIRED" | "REQUIRED" | "BLOCKED";
  effect: typeof MODEL_PRIVACY_PATH_EFFECT;
}>;

const LOCAL_ONLY_PATH: ModelPrivacyPath = Object.freeze({
  boundary: "LOCAL_ONLY",
  privacyPreflight: "REQUIRED",
  contentTreatment: "ORIGINAL",
  pseudonymization: "NOT_REQUIRED",
  outboundConfirmation: "NOT_REQUIRED",
  effect: MODEL_PRIVACY_PATH_EFFECT,
});

const EXTERNAL_PATH: ModelPrivacyPath = Object.freeze({
  boundary: "EXTERNAL",
  privacyPreflight: "REQUIRED",
  contentTreatment: "PSEUDONYMIZED_EXACT_PREVIEW",
  pseudonymization: "REQUIRED",
  outboundConfirmation: "REQUIRED",
  effect: MODEL_PRIVACY_PATH_EFFECT,
});

const UNCLASSIFIED_PATH: ModelPrivacyPath = Object.freeze({
  boundary: "UNCLASSIFIED",
  privacyPreflight: "BLOCKED_BEFORE_PREFLIGHT",
  contentTreatment: "NONE",
  pseudonymization: "BLOCKED",
  outboundConfirmation: "BLOCKED",
  effect: MODEL_PRIVACY_PATH_EFFECT,
});

export function planModelPrivacyPath(boundary: unknown): ModelPrivacyPath {
  if (boundary === "LOCAL_ONLY") return LOCAL_ONLY_PATH;
  if (boundary === "EXTERNAL") return EXTERNAL_PATH;
  return UNCLASSIFIED_PATH;
}
