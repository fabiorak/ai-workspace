import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import {
  detectRestrictedData,
  encodeModelDataPolicy,
  evaluatePrivacyPreflight,
  type ModelDataPolicy,
  validateModelDataPolicy,
} from "../src/index.ts";

const content = {
  public: JSON.stringify({ value: "Published synthetic release note." }),
  unknown: JSON.stringify({ value: "Private synthetic résumé Δ." }),
  restricted: JSON.stringify({ value: "password=fictional_canary_12345" }),
};
const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function packet(): ExpandedContextPackPreview {
  const included = [
    {
      id: "handoff:objective",
      category: "CONTINUITY" as const,
      sourceType: "HANDOFF_SECTION" as const,
      sourceId: "handoff-1",
      trust: "MIXED" as const,
      content: content.public,
      exactBytes: Buffer.byteLength(content.public),
    },
    {
      id: "instruction:unknown",
      category: "INSTRUCTIONS" as const,
      sourceType: "INSTRUCTION_RULE" as const,
      sourceId: "rules@sha256:synthetic",
      trust: "USER_CONFIGURED" as const,
      content: content.unknown,
      exactBytes: Buffer.byteLength(content.unknown),
    },
    {
      id: "instruction:restricted",
      category: "INSTRUCTIONS" as const,
      sourceType: "INSTRUCTION_RULE" as const,
      sourceId: "rules@sha256:synthetic",
      trust: "USER_CONFIGURED" as const,
      content: content.restricted,
      exactBytes: Buffer.byteLength(content.restricted),
    },
  ];
  const exact = included.reduce((sum, item) => sum + item.exactBytes, 0);
  return Object.freeze({
    schemaVersion: 2 as const,
    projectId: "project-1",
    workItemId: "work-1",
    handoffId: "handoff-1",
    budgets: { CONTINUITY: 10_000, INSTRUCTIONS: 10_000 },
    usedBytes: {
      CONTINUITY: included[0]!.exactBytes,
      INSTRUCTIONS: included[1]!.exactBytes + included[2]!.exactBytes,
    },
    included,
    omitted: [
      {
        id: "handoff:testState",
        category: "CONTINUITY" as const,
        sourceId: "handoff-1",
        exactBytes: 55,
        reason: "BUDGET_EXCEEDED" as const,
      },
    ],
    measurement: {
      exactIncludedBytes: exact,
      estimatedTokens: Math.ceil(exact / 4),
      estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4" as const,
    },
    effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED",
    sourceTableSummary: null,
  });
}

function policy(overrides: Partial<ModelDataPolicy> = {}): ModelDataPolicy {
  return validateModelDataPolicy({
    schemaVersion: 1,
    id: "synthetic-model-policy",
    version: "1.0.0",
    projectId: "project-1",
    modelId: "model-balanced",
    maximumDataClass: "CONFIDENTIAL",
    attribution: "USER_CONFIGURED",
    author: "AI Workspace contributors",
    license: "Apache-2.0",
    assertions: [
      {
        itemId: "handoff:objective",
        contentSha256: hash(content.public),
        classification: "PUBLIC",
      },
    ],
    ...overrides,
  });
}

test("classifies items, defaults unknown content, and lets restricted detection win", () => {
  const report = evaluatePrivacyPreflight({
    policy: policy(),
    modelId: "model-balanced",
    contextPack: packet(),
  });
  assert.equal(report.overallResult, "BLOCKED");
  assert.deepEqual(
    report.items.map((item) => [
      item.itemId,
      item.effectiveClass,
      item.classificationSource,
      item.decision,
    ]),
    [
      ["handoff:objective", "PUBLIC", "POLICY_ASSERTION", "ALLOWED_BY_POLICY"],
      [
        "instruction:unknown",
        "CONFIDENTIAL",
        "DEFAULT_CONFIDENTIAL",
        "ALLOWED_BY_POLICY",
      ],
      [
        "instruction:restricted",
        "RESTRICTED",
        "RESTRICTED_DETECTOR",
        "BLOCKED_RESTRICTED_PATTERN",
      ],
    ],
  );
  assert.equal(report.accounting.allowedItems, 2);
  assert.equal(report.accounting.blockedItems, 1);
  assert.equal(report.accounting.defaultedItems, 1);
  assert.equal(report.accounting.omittedBytes, 55);
  assert.equal(
    JSON.stringify(report).includes("fictional_canary_12345"),
    false,
  );
});

test("enforces maximum class and never turns reviewable into authorization", () => {
  const base = packet();
  const included = base.included.slice(0, 2);
  const exact = included.reduce((sum, item) => sum + item.exactBytes, 0);
  const cleanPacket = {
    ...base,
    included,
    omitted: [],
    measurement: { ...base.measurement, exactIncludedBytes: exact },
  } as ExpandedContextPackPreview;
  assert.equal(
    evaluatePrivacyPreflight({
      policy: policy({ maximumDataClass: "INTERNAL" }),
      modelId: "model-balanced",
      contextPack: cleanPacket,
    }).items[1]!.decision,
    "BLOCKED_BY_POLICY",
  );
  const reviewable = evaluatePrivacyPreflight({
    policy: policy(),
    modelId: "model-balanced",
    contextPack: cleanPacket,
  });
  assert.equal(reviewable.overallResult, "REVIEWABLE_NOT_AUTHORIZED");
  assert.match(reviewable.effect, /NOT_AUTHORIZED/u);
});

test("rejects stale, dangling, duplicate, noncanonical, restricted-maximum, model, and scope inputs without echo", () => {
  const secret = "fictional_hidden_value_54321";
  const invalidValues = [
    {
      ...policy(),
      assertions: [
        {
          itemId: "handoff:objective",
          contentSha256: hash(secret),
          classification: "PUBLIC",
        },
      ],
    },
    {
      ...policy(),
      assertions: [
        {
          itemId: "missing-item",
          contentSha256: hash(secret),
          classification: "PUBLIC",
        },
      ],
    },
    {
      ...policy(),
      assertions: [policy().assertions[0], policy().assertions[0]],
    },
    { ...policy(), assertions: [], maximumDataClass: "RESTRICTED" },
    { ...policy(), assertions: [], unexpected: secret },
  ];
  for (const value of invalidValues)
    assert.throws(
      () => {
        const validated = validateModelDataPolicy(value);
        evaluatePrivacyPreflight({
          policy: validated,
          modelId: "model-balanced",
          contextPack: packet(),
        });
      },
      (error: unknown) =>
        error instanceof Error && !error.message.includes(secret),
    );
  assert.throws(() =>
    evaluatePrivacyPreflight({
      policy: policy(),
      modelId: "different-model",
      contextPack: packet(),
    }),
  );
  assert.throws(() =>
    evaluatePrivacyPreflight({
      policy: policy({ projectId: "other" }),
      modelId: "model-balanced",
      contextPack: packet(),
    }),
  );
});

test("canonical encoding is deterministic under assertion permutations and binds Unicode bytes", () => {
  const assertions = [
    {
      itemId: "instruction:unknown",
      contentSha256: hash(content.unknown),
      classification: "CONFIDENTIAL" as const,
    },
    {
      itemId: "handoff:objective",
      contentSha256: hash(content.public),
      classification: "PUBLIC" as const,
    },
  ];
  assert.equal(
    encodeModelDataPolicy({ ...policy(), assertions }),
    encodeModelDataPolicy({
      ...policy(),
      assertions: [...assertions].reverse(),
    }),
  );
  assert.equal(hash(content.unknown).length, 64);
});

test("detector preserves all legacy high-confidence categories", () => {
  assert.equal(
    detectRestrictedData("-----BEGIN PRIVATE KEY-----"),
    "private-key",
  );
  assert.equal(detectRestrictedData("AKIAABCDEFGHIJKLMNOP"), "aws-access-key");
  assert.equal(detectRestrictedData(`ghp_${"A".repeat(30)}`), "github-token");
  assert.equal(
    detectRestrictedData(`sk-${"a".repeat(20)}`),
    "provider-api-key",
  );
  assert.equal(
    detectRestrictedData("api_key=fictional_value_1234"),
    "assigned-credential",
  );
  assert.equal(detectRestrictedData("ordinary synthetic text"), null);
});
