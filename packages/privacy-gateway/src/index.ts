import { createHash } from "node:crypto";
import type {
  ContextCategory,
  ExpandedContextPackPreview,
} from "@ai-workspace/context-builder";

export * from "./pseudonymization.ts";
export * from "./entity-alias-suggestions.ts";

export const MODEL_DATA_POLICY_SCHEMA_VERSION = 1;
export const PRIVACY_PREFLIGHT_EFFECT =
  "READ_ONLY_REVIEW_EVIDENCE_NOT_AUTHORIZED_OR_DELIVERED" as const;
export const DATA_CLASSES = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];
export type PolicyMaximum = Exclude<DataClass, "RESTRICTED">;
export type RestrictedDetectorCategory =
  | "private-key"
  | "aws-access-key"
  | "github-token"
  | "provider-api-key"
  | "assigned-credential";

export type ModelDataPolicyAssertion = Readonly<{
  itemId: string;
  contentSha256: string;
  classification: DataClass;
}>;
export type ModelDataPolicy = Readonly<{
  schemaVersion: 1;
  id: string;
  version: string;
  projectId: string;
  modelId: string;
  maximumDataClass: PolicyMaximum;
  assertions: readonly ModelDataPolicyAssertion[];
  attribution: "USER_CONFIGURED";
  author: string;
  license: string;
}>;

export type PrivacyItemDecision = Readonly<{
  itemId: string;
  category: ContextCategory;
  trust: "MIXED" | "USER_CONFIGURED";
  sourceType: "HANDOFF_SECTION" | "INSTRUCTION_RULE";
  sourceId: string;
  exactBytes: number;
  contentSha256: string;
  effectiveClass: DataClass;
  classificationSource:
    "POLICY_ASSERTION" | "DEFAULT_CONFIDENTIAL" | "RESTRICTED_DETECTOR";
  detectorCategory: RestrictedDetectorCategory | null;
  decision:
    "ALLOWED_BY_POLICY" | "BLOCKED_BY_POLICY" | "BLOCKED_RESTRICTED_PATTERN";
  reason:
    | "EFFECTIVE_CLASS_WITHIN_POLICY_MAXIMUM"
    | "EFFECTIVE_CLASS_EXCEEDS_POLICY_MAXIMUM"
    | "HIGH_CONFIDENCE_RESTRICTED_PATTERN";
}>;
export type PrivacyOmittedItem = Readonly<{
  itemId: string;
  category: ContextCategory;
  sourceId: string;
  exactBytes: number;
  status: "NOT_EVALUATED_BUDGET_OMISSION";
}>;
export type PrivacyPreflightReport = Readonly<{
  schemaVersion: 1;
  projectId: string;
  workItemId: string;
  handoffId: string;
  modelId: string;
  policy: Readonly<{
    id: string;
    version: string;
    maximumDataClass: PolicyMaximum;
    attribution: "USER_CONFIGURED";
    author: string;
    license: string;
  }>;
  defaultClassification: "CONFIDENTIAL";
  overallResult: "REVIEWABLE_NOT_AUTHORIZED" | "BLOCKED";
  items: readonly PrivacyItemDecision[];
  omitted: readonly PrivacyOmittedItem[];
  accounting: Readonly<{
    evaluatedItems: number;
    omittedItems: number;
    allowedItems: number;
    blockedItems: number;
    defaultedItems: number;
    restrictedItems: number;
    evaluatedItemBytes: number;
    sharedSourceTableBytes: number;
    contextPackIncludedBytes: number;
    omittedBytes: number;
  }>;
  limitations: readonly [
    "HIGH_CONFIDENCE_PATTERNS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION",
    "USER_CONFIGURED_CLASSIFICATION_IS_ATTRIBUTION_NOT_VERIFIED_TRUTH_OR_PERMISSION",
  ];
  effect: typeof PRIVACY_PREFLIGHT_EFFECT;
}>;

const MAX_TEXT = 256;
const MAX_ASSERTIONS = 1_000;
const MAX_CANONICAL_BYTES = 256 * 1_024;
const DIGEST = /^[a-f0-9]{64}$/u;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const POLICY_KEYS = [
  "assertions",
  "attribution",
  "author",
  "id",
  "license",
  "maximumDataClass",
  "modelId",
  "projectId",
  "schemaVersion",
  "version",
] as const;
const ASSERTION_KEYS = ["classification", "contentSha256", "itemId"] as const;
const DETECTORS: readonly Readonly<{
  category: RestrictedDetectorCategory;
  pattern: RegExp;
}>[] = Object.freeze([
  {
    category: "private-key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  },
  { category: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  { category: "github-token", pattern: /\bgh[oprsu]_[A-Za-z0-9]{30,}\b/u },
  { category: "provider-api-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/u },
  {
    category: "assigned-credential",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/iu,
  },
]);

export class PrivacyGatewayError extends Error {
  public constructor(options?: ErrorOptions) {
    super(
      "The model data policy or Context Pack is malformed, stale, oversized, noncanonical, incompatible, or cross-scoped. Review the explicit policy, selected model, and exact item hashes, then retry.",
      options,
    );
    this.name = "PrivacyGatewayError";
  }
}

export function detectRestrictedData(
  text: string,
): RestrictedDetectorCategory | null {
  if (Buffer.byteLength(text, "utf8") > 1_000_000) throw invalid();
  for (const detector of DETECTORS)
    if (detector.pattern.test(text)) return detector.category;
  return null;
}

export function validateModelDataPolicy(value: unknown): ModelDataPolicy {
  try {
    if (
      !record(value) ||
      !exactKeys(value, POLICY_KEYS) ||
      value.schemaVersion !== MODEL_DATA_POLICY_SCHEMA_VERSION ||
      !text(value.id) ||
      typeof value.version !== "string" ||
      !SEMVER.test(value.version) ||
      !text(value.projectId) ||
      !text(value.modelId) ||
      !["PUBLIC", "INTERNAL", "CONFIDENTIAL"].includes(
        String(value.maximumDataClass),
      ) ||
      value.attribution !== "USER_CONFIGURED" ||
      !text(value.author) ||
      !text(value.license) ||
      !Array.isArray(value.assertions) ||
      value.assertions.length > MAX_ASSERTIONS
    )
      throw invalid();
    const assertions = value.assertions
      .map((entry) => {
        if (
          !record(entry) ||
          !exactKeys(entry, ASSERTION_KEYS) ||
          !text(entry.itemId) ||
          typeof entry.contentSha256 !== "string" ||
          !DIGEST.test(entry.contentSha256) ||
          !DATA_CLASSES.includes(entry.classification as DataClass)
        )
          throw invalid();
        return Object.freeze({
          itemId: entry.itemId,
          contentSha256: entry.contentSha256,
          classification: entry.classification as DataClass,
        });
      })
      .sort((left, right) => compare(left.itemId, right.itemId));
    if (
      new Set(assertions.map((entry) => entry.itemId)).size !==
      assertions.length
    )
      throw invalid();
    const policy = Object.freeze({
      schemaVersion: 1 as const,
      id: value.id,
      version: value.version,
      projectId: value.projectId,
      modelId: value.modelId,
      maximumDataClass: value.maximumDataClass as PolicyMaximum,
      assertions: Object.freeze(assertions),
      attribution: "USER_CONFIGURED" as const,
      author: value.author,
      license: value.license,
    });
    if (Buffer.byteLength(JSON.stringify(policy), "utf8") > MAX_CANONICAL_BYTES)
      throw invalid();
    return policy;
  } catch (error) {
    if (error instanceof PrivacyGatewayError) throw error;
    throw invalid(error);
  }
}

export function encodeModelDataPolicy(value: unknown): string {
  return `${JSON.stringify(validateModelDataPolicy(value), null, 2)}\n`;
}

export function evaluatePrivacyPreflight(
  input: Readonly<{
    policy: ModelDataPolicy;
    modelId: string;
    contextPack: ExpandedContextPackPreview;
  }>,
): PrivacyPreflightReport {
  try {
    const policy = validateModelDataPolicy(input.policy);
    const packet = input.contextPack;
    if (
      !text(input.modelId) ||
      policy.modelId !== input.modelId ||
      policy.projectId !== packet.projectId
    )
      throw invalid();
    const includedIds = new Set(packet.included.map((item) => item.id));
    const assertions = new Map(
      policy.assertions.map((entry) => [entry.itemId, entry]),
    );
    for (const assertion of policy.assertions)
      if (!includedIds.has(assertion.itemId)) throw invalid();
    const items = packet.included.map((item) => {
      const contentSha256 = sha256(item.content);
      const assertion = assertions.get(item.id);
      if (assertion !== undefined && assertion.contentSha256 !== contentSha256)
        throw invalid();
      const detectorCategory = detectRestrictedData(item.content);
      const effectiveClass: DataClass =
        detectorCategory === null
          ? (assertion?.classification ?? "CONFIDENTIAL")
          : "RESTRICTED";
      const decision =
        detectorCategory !== null
          ? ("BLOCKED_RESTRICTED_PATTERN" as const)
          : rank(effectiveClass) <= rank(policy.maximumDataClass)
            ? ("ALLOWED_BY_POLICY" as const)
            : ("BLOCKED_BY_POLICY" as const);
      return Object.freeze({
        itemId: item.id,
        category: item.category,
        trust: item.trust,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        exactBytes: item.exactBytes,
        contentSha256,
        effectiveClass,
        classificationSource:
          detectorCategory !== null
            ? ("RESTRICTED_DETECTOR" as const)
            : assertion === undefined
              ? ("DEFAULT_CONFIDENTIAL" as const)
              : ("POLICY_ASSERTION" as const),
        detectorCategory,
        decision,
        reason:
          detectorCategory !== null
            ? ("HIGH_CONFIDENCE_RESTRICTED_PATTERN" as const)
            : decision === "ALLOWED_BY_POLICY"
              ? ("EFFECTIVE_CLASS_WITHIN_POLICY_MAXIMUM" as const)
              : ("EFFECTIVE_CLASS_EXCEEDS_POLICY_MAXIMUM" as const),
      });
    });
    const omitted = packet.omitted.map((item) =>
      Object.freeze({
        itemId: item.id,
        category: item.category,
        sourceId: item.sourceId,
        exactBytes: item.exactBytes,
        status: "NOT_EVALUATED_BUDGET_OMISSION" as const,
      }),
    );
    const allowedItems = items.filter(
      (item) => item.decision === "ALLOWED_BY_POLICY",
    ).length;
    const restrictedItems = items.filter(
      (item) => item.decision === "BLOCKED_RESTRICTED_PATTERN",
    ).length;
    const evaluatedItemBytes = items.reduce(
      (sum, item) => sum + item.exactBytes,
      0,
    );
    const sharedSourceTableBytes =
      packet.measurement.exactIncludedBytes - evaluatedItemBytes;
    if (sharedSourceTableBytes < 0) throw invalid();
    return Object.freeze({
      schemaVersion: 1 as const,
      projectId: packet.projectId,
      workItemId: packet.workItemId,
      handoffId: packet.handoffId,
      modelId: input.modelId,
      policy: Object.freeze({
        id: policy.id,
        version: policy.version,
        maximumDataClass: policy.maximumDataClass,
        attribution: policy.attribution,
        author: policy.author,
        license: policy.license,
      }),
      defaultClassification: "CONFIDENTIAL" as const,
      overallResult:
        allowedItems === items.length
          ? ("REVIEWABLE_NOT_AUTHORIZED" as const)
          : ("BLOCKED" as const),
      items: Object.freeze(items),
      omitted: Object.freeze(omitted),
      accounting: Object.freeze({
        evaluatedItems: items.length,
        omittedItems: omitted.length,
        allowedItems,
        blockedItems: items.length - allowedItems,
        defaultedItems: items.filter(
          (item) => item.classificationSource === "DEFAULT_CONFIDENTIAL",
        ).length,
        restrictedItems,
        evaluatedItemBytes,
        sharedSourceTableBytes,
        contextPackIncludedBytes: packet.measurement.exactIncludedBytes,
        omittedBytes: omitted.reduce((sum, item) => sum + item.exactBytes, 0),
      }),
      limitations: Object.freeze([
        "HIGH_CONFIDENCE_PATTERNS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION",
        "USER_CONFIGURED_CLASSIFICATION_IS_ATTRIBUTION_NOT_VERIFIED_TRUTH_OR_PERMISSION",
      ] as const),
      effect: PRIVACY_PREFLIGHT_EFFECT,
    });
  } catch (error) {
    if (error instanceof PrivacyGatewayError) throw error;
    throw invalid(error);
  }
}

function rank(value: DataClass): number {
  return DATA_CLASSES.indexOf(value);
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function compare(left: string, right: string): number {
  return left.localeCompare(right, "en");
}
function text(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= MAX_TEXT &&
    !/\p{Cc}/u.test(value)
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compare);
  const sorted = [...expected].sort(compare);
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}
function invalid(cause?: unknown): PrivacyGatewayError {
  return new PrivacyGatewayError(cause === undefined ? undefined : { cause });
}
