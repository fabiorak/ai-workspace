import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DomainValidationError, createWorkItem } from "../src/index.ts";

describe("createWorkItem", () => {
  it("creates a proposed work item with normalized values", () => {
    const now = new Date("2026-07-10T10:00:00.000Z");

    const workItem = createWorkItem({
      id: " work-item-1 ",
      objective: " Register a local repository ",
      projectId: " project-1 ",
      now,
    });

    assert.deepEqual(workItem, {
      id: "work-item-1",
      objective: "Register a local repository",
      projectId: "project-1",
      status: "PROPOSED",
      createdAt: "2026-07-10T10:00:00.000Z",
      updatedAt: "2026-07-10T10:00:00.000Z",
    });
    assert.ok(Object.isFrozen(workItem));
  });

  const emptyFieldCases = [
    ["id", { id: "" }],
    ["objective", { objective: "  " }],
    ["project id", { projectId: "" }],
  ] as const;

  for (const [field, override] of emptyFieldCases) {
    it(`rejects an empty ${field}`, () => {
      assert.throws(
        () =>
          createWorkItem({
            id: "work-item-1",
            objective: "Register a repository",
            projectId: "project-1",
            ...override,
          }),
        DomainValidationError,
      );
    });
  }
});
