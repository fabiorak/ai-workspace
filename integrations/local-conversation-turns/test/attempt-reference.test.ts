import assert from "node:assert/strict";
import { test } from "node:test";

import { attempt } from "../src/record.ts";

const reference = {
  projectId: "project-one",
  authorizationId: "authorization-one",
  attemptId: "attempt-one",
};

test("keeps pre-agent references valid and names the store only additively", () => {
  assert.deepEqual(attempt(reference), reference);
  for (const executionClass of [
    "MODEL_DELIVERY",
    "AGENT_EXECUTION",
    "LOCAL_MODEL",
  ])
    assert.deepEqual(attempt({ ...reference, executionClass }), {
      ...reference,
      executionClass,
    });
  for (const value of [
    { ...reference, executionClass: "LOCAL_MODEL_X" },
    { ...reference, executionClass: null },
    { ...reference, executionClass: "AGENT_EXECUTION", extra: true },
    { ...reference, attemptId: " attempt-one" },
    { projectId: "project-one", attemptId: "attempt-one" },
  ])
    assert.throws(() => attempt(value), JSON.stringify(value));
});
