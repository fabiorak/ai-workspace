import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InstructionError, validateInstructionBundle } from "../src/index.ts";

const valid = {
  schemaVersion: 1,
  projectId: "project",
  sources: [
    {
      id: "global-source",
      projectId: "project",
      scope: "GLOBAL",
      target: null,
      trust: "USER_CONFIGURED",
      sourceDigest: "a".repeat(64),
      rules: [
        {
          id: "security.no-secrets",
          kind: "CONSTRAINT",
          overridable: false,
          content: "Never disclose configured secrets.",
          position: 0,
        },
      ],
    },
  ],
};

describe("instruction contracts", () => {
  it("validates and freezes a bounded provider-neutral bundle", () => {
    const bundle = validateInstructionBundle(valid);
    assert.equal(bundle.sources[0]?.scope, "GLOBAL");
    assert.ok(Object.isFrozen(bundle));
    assert.ok(Object.isFrozen(bundle.sources[0]?.rules));
  });

  it("rejects cross-project sources and unsupported schema versions", () => {
    assert.throws(
      () =>
        validateInstructionBundle({
          ...valid,
          sources: [{ ...valid.sources[0], projectId: "foreign" }],
        }),
      InstructionError,
    );
    assert.throws(
      () => validateInstructionBundle({ ...valid, schemaVersion: 2 }),
      InstructionError,
    );
  });

  it("rejects invalid rule semantics, duplicates, targets, and bounds", () => {
    for (const source of [
      { ...valid.sources[0], rules: [] },
      {
        ...valid.sources[0],
        scope: "MODEL",
        target: null,
      },
      {
        ...valid.sources[0],
        rules: [
          {
            ...valid.sources[0]!.rules[0],
            kind: "PREFERENCE",
            overridable: false,
          },
        ],
      },
      {
        ...valid.sources[0],
        rules: [valid.sources[0]!.rules[0], { ...valid.sources[0]!.rules[0] }],
      },
    ])
      assert.throws(
        () => validateInstructionBundle({ ...valid, sources: [source] }),
        InstructionError,
      );
  });
});
