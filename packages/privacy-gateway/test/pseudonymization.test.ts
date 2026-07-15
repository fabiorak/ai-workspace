import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import {
  pseudonymizeContextPack,
  restorePseudonymizedItems,
  validatePseudonymReview,
} from "../src/index.ts";

const key = Buffer.alloc(32, 7);
const first = "Customer Acme needs résumé Δ reviewed.";
const second = "Notify Acme after the synthetic check.";
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function byteRange(value: string, selected: string, occurrence = 0) {
  let characterStart = -1;
  let cursor = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = value.indexOf(selected, cursor);
    cursor = characterStart + selected.length;
  }
  const byteStart = Buffer.byteLength(value.slice(0, characterStart), "utf8");
  return {
    byteStart,
    byteEnd: byteStart + Buffer.byteLength(selected, "utf8"),
  };
}

function packet(): ExpandedContextPackPreview {
  const included = [
    {
      id: "handoff:objective",
      category: "CONTINUITY" as const,
      sourceType: "HANDOFF_SECTION" as const,
      sourceId: "handoff-1",
      trust: "MIXED" as const,
      content: first,
      exactBytes: Buffer.byteLength(first),
    },
    {
      id: "instruction:notify",
      category: "INSTRUCTIONS" as const,
      sourceType: "INSTRUCTION_RULE" as const,
      sourceId: "bundle-1",
      trust: "USER_CONFIGURED" as const,
      content: second,
      exactBytes: Buffer.byteLength(second),
    },
  ];
  const exactIncludedBytes = included.reduce(
    (sum, item) => sum + item.exactBytes,
    0,
  );
  return {
    schemaVersion: 2,
    projectId: "project-1",
    workItemId: "work-1",
    handoffId: "handoff-1",
    budgets: { CONTINUITY: 4_096, INSTRUCTIONS: 4_096 },
    usedBytes: {
      CONTINUITY: included[0]!.exactBytes,
      INSTRUCTIONS: included[1]!.exactBytes,
    },
    included,
    omitted: [],
    measurement: {
      exactIncludedBytes,
      estimatedTokens: Math.ceil(exactIncludedBytes / 4),
      estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4",
    },
    effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED",
    sourceTableSummary: null,
  };
}

function review() {
  const acme1 = byteRange(first, "Acme", 0);
  const unicode = byteRange(first, "résumé Δ");
  const acme2 = byteRange(second, "Acme");
  return validatePseudonymReview({
    schemaVersion: 1,
    mappingSetId: "mapping-1",
    projectId: "project-1",
    workItemId: "work-1",
    handoffId: "handoff-1",
    modelId: "model-balanced",
    attribution: "USER_REVIEWED",
    selections: [
      {
        itemId: "handoff:objective",
        contentSha256: digest(first),
        ...unicode,
        entityType: "OTHER",
      },
      {
        itemId: "instruction:notify",
        contentSha256: digest(second),
        ...acme2,
        entityType: "CUSTOMER",
      },
      {
        itemId: "handoff:objective",
        contentSha256: digest(first),
        ...acme1,
        entityType: "CUSTOMER",
      },
    ],
  });
}

test("pseudonymizes reviewed UTF-8 spans deterministically and restores exact content", () => {
  const result = pseudonymizeContextPack({
    review: review(),
    contextPack: packet(),
    key,
  });
  assert.equal(result.preview.accounting.reviewedSelections, 3);
  const customerAliases = result.preview.selections
    .filter((entry) => entry.entityType === "CUSTOMER")
    .map((entry) => entry.pseudonym);
  assert.equal(new Set(customerAliases).size, 1);
  assert.equal(JSON.stringify(result.preview).includes("Acme"), false);
  assert.equal(JSON.stringify(result.preview).includes("résumé"), false);
  const restored = restorePseudonymizedItems({
    mapping: result.mapping,
    items: result.preview.items,
  });
  assert.deepEqual(
    restored.map((entry) => entry.content),
    [first, second],
  );
});

test("rejects stale, overlapping, split-code-point, dangling, and bad-key input without echo", () => {
  const base = review();
  const unicodeSelection = base.selections.find(
    (entry) => entry.entityType === "OTHER",
  )!;
  const invalid = [
    {
      ...base,
      selections: [
        { ...base.selections[0], contentSha256: digest("hidden-canary") },
      ],
    },
    {
      ...base,
      selections: [
        base.selections[0],
        { ...base.selections[0], byteStart: base.selections[0]!.byteStart + 1 },
      ],
    },
    {
      ...base,
      selections: [
        { ...unicodeSelection, byteStart: unicodeSelection.byteStart + 2 },
      ],
    },
    { ...base, selections: [{ ...base.selections[0], itemId: "missing" }] },
  ];
  for (const value of invalid)
    assert.throws(
      () =>
        pseudonymizeContextPack({
          review: value as never,
          contextPack: packet(),
          key,
        }),
      (error: unknown) =>
        error instanceof Error && !error.message.includes("hidden-canary"),
    );
  assert.throws(() =>
    pseudonymizeContextPack({
      review: base,
      contextPack: packet(),
      key: Buffer.alloc(31),
    }),
  );
});

test("detects transformed-content tampering before restoration", () => {
  const result = pseudonymizeContextPack({
    review: review(),
    contextPack: packet(),
    key,
  });
  const items = result.preview.items.map((item, index) =>
    index === 0
      ? { ...item, transformedContent: `${item.transformedContent}x` }
      : item,
  );
  assert.throws(() =>
    restorePseudonymizedItems({ mapping: result.mapping, items }),
  );
});
