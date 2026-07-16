import assert from "node:assert/strict";
import test from "node:test";
import type { ExpandedContextPackPreview } from "@ai-workspace/context-builder";
import {
  CustomerAliasSuggestionError,
  suggestCustomerAliases,
} from "../src/index.ts";

function packet(content: string): ExpandedContextPackPreview {
  const exactBytes = Buffer.byteLength(content);
  return {
    schemaVersion: 2,
    projectId: "project-1",
    workItemId: "work-1",
    handoffId: "handoff-1",
    budgets: { CONTINUITY: 10_000, INSTRUCTIONS: 1 },
    usedBytes: { CONTINUITY: exactBytes, INSTRUCTIONS: 0 },
    included: [
      {
        id: "handoff:objective",
        category: "CONTINUITY",
        sourceType: "HANDOFF_SECTION",
        sourceId: "handoff-1",
        trust: "MIXED",
        content,
        exactBytes,
      },
    ],
    omitted: [],
    measurement: {
      exactIncludedBytes: exactBytes,
      estimatedTokens: Math.ceil(exactBytes / 4),
      estimateMethod: "CEIL_EXACT_INCLUDED_BYTES_DIVIDED_BY_4",
    },
    effect: "READ_ONLY_NOT_PERSISTED_OR_EXECUTED",
    sourceTableSummary: null,
  };
}

test("suggests exact customer aliases as non-authoritative UTF-8 ranges", () => {
  const content = "Pré Asteria Demo e ASTERIA_DEMO; preASTERIA_DEMOpost.";
  const report = suggestCustomerAliases({
    modelId: "model-balanced",
    contextPack: packet(content),
    dictionary: [
      { entityType: "CUSTOMER", alias: "ASTERIA_DEMO" },
      { entityType: "CUSTOMER", alias: "Asteria Demo" },
    ],
  });
  assert.equal(report.suggestions.length, 2);
  assert.equal(report.suggestions[0]!.state, "SUGGESTED_NOT_REVIEWED");
  assert.equal(
    report.suggestions[0]!.byteStart,
    Buffer.byteLength("Pré ", "utf8"),
  );
  assert.equal(JSON.stringify(report).includes("Asteria Demo"), false);
  assert.equal(report.effect.includes("NOT_REVIEWED"), true);
});

test("is deterministic across dictionary permutations and repeated occurrences", () => {
  const contextPack = packet("Asteria Demo / ASTERIA_DEMO / Asteria Demo");
  const first = suggestCustomerAliases({
    modelId: "model-balanced",
    contextPack,
    dictionary: [
      { entityType: "CUSTOMER", alias: "Asteria Demo" },
      { entityType: "CUSTOMER", alias: "ASTERIA_DEMO" },
    ],
  });
  const second = suggestCustomerAliases({
    modelId: "model-balanced",
    contextPack,
    dictionary: [
      { entityType: "CUSTOMER", alias: "ASTERIA_DEMO" },
      { entityType: "CUSTOMER", alias: "Asteria Demo" },
    ],
  });
  assert.deepEqual(first, second);
  assert.equal(first.suggestions.length, 3);
});

test("reproduces the frozen Sprint 28 customer subset with three exact spans", () => {
  const report = suggestCustomerAliases({
    modelId: "model-balanced",
    contextPack: packet(
      "Asteria Demo ASTERIA_DEMO; preASTERIA_DEMOpost ASTERIA_DEMO.",
    ),
    dictionary: [
      { entityType: "CUSTOMER", alias: "Asteria Demo" },
      { entityType: "CUSTOMER", alias: "ASTERIA_DEMO" },
    ],
  });
  assert.equal(report.suggestions.length, 3);
  assert.equal(
    report.suggestions.every(
      (entry) =>
        entry.entityType === "CUSTOMER" &&
        entry.state === "SUGGESTED_NOT_REVIEWED",
    ),
    true,
  );
});

test("rejects project, duplicate, malformed Unicode, control, and overlaps without echo", () => {
  const canary = "PRIVATE_SYNTHETIC_ALIAS";
  const invalid = [
    [{ entityType: "PROJECT", alias: canary }],
    [
      { entityType: "CUSTOMER", alias: canary },
      { entityType: "CUSTOMER", alias: canary },
    ],
    [{ entityType: "CUSTOMER", alias: `${canary}\n` }],
    [{ entityType: "CUSTOMER", alias: `broken\ud800` }],
    [{ entityType: "CUSTOMER", alias: "x".repeat(257) }],
  ];
  for (const dictionary of invalid)
    assert.throws(
      () =>
        suggestCustomerAliases({
          modelId: "model-balanced",
          contextPack: packet(canary),
          dictionary: dictionary as never,
        }),
      (error: unknown) =>
        error instanceof CustomerAliasSuggestionError &&
        !error.message.includes(canary),
    );
  assert.throws(() =>
    suggestCustomerAliases({
      modelId: "model-balanced",
      contextPack: packet("person@example.invalid"),
      dictionary: [
        { entityType: "CUSTOMER", alias: "person@example.invalid" },
        { entityType: "CUSTOMER", alias: "person" },
      ],
    }),
  );
});
