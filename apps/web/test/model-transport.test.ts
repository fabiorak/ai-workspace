import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OpenAIResponsesError,
  OpenAIResponsesTransport,
} from "@ai-workspace/openai-responses";

import { modelTransportFromEnvironment } from "../src/model-transport.ts";

describe("model transport activation", () => {
  it("keeps the ordinary GUI on its local simulation without reading a key", () => {
    assert.equal(modelTransportFromEnvironment({}), undefined);
  });

  it("requires one exact opt-in mode", () => {
    for (const mode of ["", "openai", "OPENAI_RESPONSES "])
      assert.throws(
        () =>
          modelTransportFromEnvironment({
            AI_WORKSPACE_MODEL_TRANSPORT: mode,
            OPENAI_API_KEY: "synthetic-secret",
          }),
        /must be OPENAI_RESPONSES/u,
      );
  });

  it("constructs the fixed-endpoint adapter only with an explicit process key", () => {
    assert.ok(
      modelTransportFromEnvironment({
        AI_WORKSPACE_MODEL_TRANSPORT: "OPENAI_RESPONSES",
        OPENAI_API_KEY: "synthetic-secret",
      }) instanceof OpenAIResponsesTransport,
    );
    assert.throws(
      () =>
        modelTransportFromEnvironment({
          AI_WORKSPACE_MODEL_TRANSPORT: "OPENAI_RESPONSES",
        }),
      OpenAIResponsesError,
    );
  });
});
