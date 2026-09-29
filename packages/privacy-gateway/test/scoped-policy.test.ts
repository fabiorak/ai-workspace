import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  evaluateScopedPrivacyPreflight,
  validateScopedModelDataPolicy,
  type ScopedModelDataPolicy,
  type ScopedPrivacyItem,
} from "../src/index.ts";

const general = { kind: "GENERAL" } as const;
const policy: ScopedModelDataPolicy = {
  schemaVersion: 2,
  scope: general,
  id: "policy",
  version: "1.0.0",
  modelId: "synthetic-model",
  maximumDataClass: "CONFIDENTIAL",
  assertions: [],
  attribution: "USER_CONFIGURED",
  author: "Synthetic",
  license: "Apache-2.0",
};
const item = (content = "Synthetic fresh question"): ScopedPrivacyItem => ({
  id: "message",
  content,
  category: "MESSAGE",
  trust: "UNTRUSTED",
  sourceType: "USER_MESSAGE",
  sourceId: "draft",
  exactBytes: Buffer.byteLength(content),
});
const evaluate = (configured = policy, items = [item()]) =>
  evaluateScopedPrivacyPreflight({
    scope: general,
    policy: configured,
    modelId: "synthetic-model",
    items,
    omitted: [],
  });

test("configured policy blocks unclassified reduced context for General and projects", () => {
  assert.equal(
    evaluate({ ...policy, maximumDataClass: "PUBLIC" }).overallResult,
    "BLOCKED",
  );
  const scope = { kind: "PROJECT", projectId: "actual-project" } as const;
  assert.equal(
    evaluateScopedPrivacyPreflight({
      scope,
      policy: { ...policy, scope, maximumDataClass: "INTERNAL" },
      modelId: policy.modelId,
      items: [item()],
      omitted: [],
    }).overallResult,
    "BLOCKED",
  );
  const report = evaluate();
  assert.deepEqual(report.scope, general);
  assert.equal(report.accounting.defaultedItems, 1);
  assert.equal("projectId" in report, false);
  assert.equal("handoffId" in report, false);
  assert.equal(JSON.stringify(report).includes(item().content), false);
});

test("scoped policies preserve pinned assertions, restricted blocking, and reject stale scope/model", () => {
  const content = item().content;
  const asserted = {
    ...policy,
    maximumDataClass: "PUBLIC" as const,
    assertions: [
      {
        itemId: "message",
        contentSha256: createHash("sha256").update(content).digest("hex"),
        classification: "PUBLIC" as const,
      },
    ],
  };
  assert.equal(evaluate(asserted).overallResult, "REVIEWABLE_NOT_AUTHORIZED");
  assert.throws(() => evaluate(asserted, [item("Changed question")]));
  assert.equal(
    evaluate(policy, [item("-----BEGIN PRIVATE KEY-----")]).accounting
      .restrictedItems,
    1,
  );
  assert.throws(() => evaluate({ ...policy, modelId: "other-model" }));
  assert.throws(() =>
    evaluate({ ...policy, scope: { kind: "PROJECT", projectId: "other" } }),
  );
  assert.throws(() => evaluate(policy, [item(), item()]));
  assert.throws(() => evaluate(policy, [{ ...item(), exactBytes: 0 }]));
});

test("unknown omitted bytes remain explicit and counts retain aggregate omissions", () => {
  const report = evaluateScopedPrivacyPreflight({
    scope: general,
    policy,
    modelId: policy.modelId,
    items: [item()],
    omitted: [
      { id: "old-events", reason: "EVENT_LIMIT", count: 129, exactBytes: null },
      {
        id: "large-source",
        reason: "SOURCE_BYTE_LIMIT",
        count: 1,
        exactBytes: 65537,
      },
    ],
  });
  assert.equal(report.accounting.omittedItems, 130);
  assert.equal(report.accounting.omittedBytes, 65537);
  assert.equal(report.accounting.unknownByteOmissions, 129);
});

test("legacy policy remains usable only for the original project", () => {
  const { scope: _scope, ...rest } = policy;
  void _scope;
  const legacy = { ...rest, schemaVersion: 1, projectId: "actual-project" };
  assert.deepEqual(validateScopedModelDataPolicy(legacy).scope, {
    kind: "PROJECT",
    projectId: "actual-project",
  });
  assert.throws(() => validateScopedModelDataPolicy(legacy, general));
});
