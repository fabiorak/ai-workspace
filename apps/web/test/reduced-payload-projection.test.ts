import assert from "node:assert/strict";
import { test } from "node:test";
import { projectTurnPayload } from "../src/turn-payload-preview.ts";

test("reduced preview retains instructions, omissions, provenance and additional metadata", () => {
  const result = projectTurnPayload(
    JSON.stringify({
      schemaVersion: 2,
      effect: "BOUNDED_REDUCED_CONVERSATION_CONTEXT",
      scope: { projectId: null },
      target: { modelId: "model" },
      instructions: { rule: "Keep provenance" },
      sources: [{ id: "source-id" }],
      omissions: [{ reason: "SOURCE_TEXT_LIMIT", count: 1, bytes: 17000 }],
      accounting: { unknownByteOmissions: 1 },
      extra: "future-field",
      readings: [{ text: "reading", eventId: "event-id", trust: "UNVERIFIED" }],
      linkedProjectMemory: [
        { content: "memory", provenance: [{ sourceId: "memory-source" }] },
      ],
      userText: "question",
    }),
  );
  const visible = result.sections.map((section) => section.text).join("\n");
  for (const value of [
    "Keep provenance",
    "source-id",
    "SOURCE_TEXT_LIMIT",
    "17000",
    "unknownByteOmissions",
    "future-field",
    "event-id",
    "UNVERIFIED",
    "memory-source",
    "question",
  ])
    assert.ok(visible.includes(value), value);
});

test("malformed reduced payload falls back to raw text instead of dropping fields", () => {
  const raw = JSON.stringify({
    effect: "BOUNDED_REDUCED_CONVERSATION_CONTEXT",
    readings: "retained",
    linkedProjectMemory: 42,
    userText: false,
  });
  const result = projectTurnPayload(raw);
  assert.equal(result.sections[0]?.text, raw);
});
