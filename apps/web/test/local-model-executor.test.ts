import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { localModelExecutorFromEnvironment } from "../src/local-model-executor.ts";

const VARIABLE = "AI_WORKSPACE_LOCAL_MODEL_ENDPOINT";
const environment = (value?: string) =>
  value === undefined ? {} : { [VARIABLE]: value };

describe("local model executor from the environment (ADR-0051)", () => {
  it("offers nothing without the variable", () => {
    assert.equal(localModelExecutorFromEnvironment({}), null);
    assert.equal(localModelExecutorFromEnvironment(environment()), null);
  });

  for (const [value, origin] of [
    ["http://127.0.0.1:8080", "http://127.0.0.1:8080"],
    ["http://[::1]:8080", "http://[::1]:8080"],
    ["http://127.0.0.1:8080/", "http://127.0.0.1:8080"],
  ] as const)
    it(`accepts ${value} and offers it as available`, () => {
      const offered = localModelExecutorFromEnvironment(environment(value));
      assert.ok(offered);
      assert.equal(offered.origin, origin);
      assert.equal(offered.executor.launch, "AVAILABLE");
      assert.equal(typeof offered.executor.execute, "function");
      assert.equal(typeof offered.executor.qualification, "string");
    });

  for (const value of [
    "http://localhost:8080",
    "http://0.0.0.0:8080",
    "http://example.test:8080",
    "https://127.0.0.1:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:8080/v1",
    "http://user:secret@127.0.0.1:8080",
    "http://127.0.0.1:8080?x=1",
    "http://127.0.0.1:0",
    "http://127.0.0.1:99999",
    "",
  ])
    it(`stops the start for ${JSON.stringify(value)}, naming the variable`, () => {
      assert.throws(
        () => localModelExecutorFromEnvironment(environment(value)),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes(VARIABLE) &&
          !error.message.includes("secret"),
      );
    });
});
