import {
  evaluatePrivacyItemClassification,
  PrivacyGatewayError,
  PRIVACY_PREFLIGHT_EFFECT,
  validateModelDataPolicy,
  validateModelDataPolicyDefinition,
  type ModelDataPolicy,
} from "./index.ts";

export type PrivacyPolicyScope =
  | Readonly<{ kind: "GENERAL" }>
  | Readonly<{ kind: "PROJECT"; projectId: string }>;
export type ScopedModelDataPolicy = Omit<
  ModelDataPolicy,
  "schemaVersion" | "projectId"
> &
  Readonly<{ schemaVersion: 2; scope: PrivacyPolicyScope }>;
export type ScopedPrivacyItem = Readonly<{
  id: string;
  content: string;
  category: string;
  trust: string;
  sourceType: string;
  sourceId: string;
  exactBytes: number;
}>;
export type ScopedPrivacyOmission = Readonly<{
  id: string;
  reason: string;
  count: number;
  exactBytes: number | null;
}>;

export function validatePrivacyPolicyScope(value: unknown): PrivacyPolicyScope {
  if (!record(value)) throw new PrivacyGatewayError();
  if (value.kind === "GENERAL" && exact(value, ["kind"]))
    return Object.freeze({ kind: "GENERAL" });
  if (
    value.kind === "PROJECT" &&
    exact(value, ["kind", "projectId"]) &&
    text(value.projectId)
  )
    return Object.freeze({ kind: "PROJECT", projectId: value.projectId });
  throw new PrivacyGatewayError();
}
export function samePrivacyPolicyScope(
  left: PrivacyPolicyScope,
  right: PrivacyPolicyScope,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "GENERAL" ||
      (right.kind === "PROJECT" && left.projectId === right.projectId))
  );
}
export function validateScopedModelDataPolicy(
  value: unknown,
  expectedScope?: PrivacyPolicyScope,
): ScopedModelDataPolicy {
  if (!record(value)) throw new PrivacyGatewayError();
  let result: ScopedModelDataPolicy;
  if (value.schemaVersion === 1) {
    const { projectId, schemaVersion, ...policy } =
      validateModelDataPolicy(value);
    void schemaVersion;
    result = Object.freeze({
      schemaVersion: 2,
      scope: Object.freeze({ kind: "PROJECT", projectId }),
      ...policy,
    });
  } else {
    if (
      value.schemaVersion !== 2 ||
      !exact(value, [
        "schemaVersion",
        "scope",
        "id",
        "version",
        "modelId",
        "maximumDataClass",
        "assertions",
        "attribution",
        "author",
        "license",
      ])
    )
      throw new PrivacyGatewayError();
    result = Object.freeze({
      schemaVersion: 2,
      scope: validatePrivacyPolicyScope(value.scope),
      ...validateModelDataPolicyDefinition(value),
    });
  }
  if (
    expectedScope !== undefined &&
    !samePrivacyPolicyScope(
      result.scope,
      validatePrivacyPolicyScope(expectedScope),
    )
  )
    throw new PrivacyGatewayError();
  return result;
}

export function evaluateScopedPrivacyPreflight(
  input: Readonly<{
    scope: PrivacyPolicyScope;
    policy: ScopedModelDataPolicy | ModelDataPolicy;
    modelId: string;
    items: readonly ScopedPrivacyItem[];
    omitted: readonly ScopedPrivacyOmission[];
    sharedSourceTableBytes?: number;
  }>,
) {
  const scope = validatePrivacyPolicyScope(input.scope);
  const policy = validateScopedModelDataPolicy(input.policy, scope);
  const sharedSourceTableBytes = input.sharedSourceTableBytes ?? 0;
  if (
    !text(input.modelId) ||
    input.modelId !== policy.modelId ||
    !nonnegative(sharedSourceTableBytes) ||
    input.items.length > 1_000 ||
    input.omitted.length > 1_000
  )
    throw new PrivacyGatewayError();
  const ids = new Set<string>();
  const assertions = new Map(
    policy.assertions.map((assertion) => [assertion.itemId, assertion]),
  );
  let totalBytes = 0;
  const items = input.items.map((item) => {
    if (
      !text(item.id) ||
      ids.has(item.id) ||
      !text(item.category) ||
      !text(item.trust) ||
      !text(item.sourceType) ||
      !text(item.sourceId) ||
      typeof item.content !== "string" ||
      !nonnegative(item.exactBytes) ||
      item.exactBytes !== Buffer.byteLength(item.content, "utf8")
    )
      throw new PrivacyGatewayError();
    ids.add(item.id);
    totalBytes += item.exactBytes;
    if (totalBytes + sharedSourceTableBytes > 1_000_000)
      throw new PrivacyGatewayError();
    return Object.freeze({
      itemId: item.id,
      category: item.category,
      trust: item.trust,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      exactBytes: item.exactBytes,
      ...evaluatePrivacyItemClassification(
        item.content,
        policy.maximumDataClass,
        assertions.get(item.id),
      ),
    });
  });
  for (const assertion of policy.assertions)
    if (!ids.has(assertion.itemId)) throw new PrivacyGatewayError();
  const omittedIds = new Set<string>();
  const omitted = input.omitted.map((item) => {
    if (
      !text(item.id) ||
      ids.has(item.id) ||
      omittedIds.has(item.id) ||
      !text(item.reason) ||
      !nonnegative(item.count) ||
      item.count < 1 ||
      (item.exactBytes !== null && !nonnegative(item.exactBytes))
    )
      throw new PrivacyGatewayError();
    omittedIds.add(item.id);
    return Object.freeze({
      ...item,
      status: "NOT_EVALUATED_OMISSION" as const,
    });
  });
  const allowedItems = items.filter(
    (item) => item.decision === "ALLOWED_BY_POLICY",
  ).length;
  const accounting = Object.freeze({
    evaluatedItems: items.length,
    omittedItems: omitted.reduce((sum, item) => sum + item.count, 0),
    allowedItems,
    blockedItems: items.length - allowedItems,
    defaultedItems: items.filter(
      (item) => item.classificationSource === "DEFAULT_CONFIDENTIAL",
    ).length,
    restrictedItems: items.filter(
      (item) => item.decision === "BLOCKED_RESTRICTED_PATTERN",
    ).length,
    evaluatedItemBytes: totalBytes,
    sharedSourceTableBytes,
    contextPackIncludedBytes: totalBytes + sharedSourceTableBytes,
    omittedBytes: omitted.reduce(
      (sum, item) => sum + (item.exactBytes ?? 0),
      0,
    ),
    unknownByteOmissions: omitted
      .filter((item) => item.exactBytes === null)
      .reduce((sum, item) => sum + item.count, 0),
  });
  if (Object.values(accounting).some((value) => !nonnegative(value)))
    throw new PrivacyGatewayError();
  return Object.freeze({
    schemaVersion: 2 as const,
    scope,
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
    accounting,
    limitations: Object.freeze([
      "HIGH_CONFIDENCE_PATTERNS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION",
      "USER_CONFIGURED_CLASSIFICATION_IS_ATTRIBUTION_NOT_VERIFIED_TRUTH_OR_PERMISSION",
    ] as const),
    effect: PRIVACY_PREFLIGHT_EFFECT,
  });
}
export type ScopedPrivacyPreflightReport = ReturnType<
  typeof evaluateScopedPrivacyPreflight
>;

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
function nonnegative(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}
