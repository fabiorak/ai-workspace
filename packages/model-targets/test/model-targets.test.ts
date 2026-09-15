import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyModelTargetConfiguration,
  ModelTargetConflictError,
  ModelTargetError,
  ModelTargets,
  validateModelTargetConfiguration,
  type ModelTarget,
  type ModelTargetStore,
} from "../src/index.ts";

const target = (targetId: string, displayName: string): ModelTarget => ({
  targetId,
  displayName,
  providerKind: "LOCAL_ADAPTER",
  modelId: `synthetic-${targetId}`,
  boundary: "LOCAL_ONLY",
  profileRef: `profiles/${targetId}.json`,
  policyRef: `policies/${targetId}.json`,
  instructionRefs: [`instructions/${targetId}.json`],
  maxInputBytes: 65_536,
  maxOutputBytes: 16_384,
  enabled: true,
});

describe("model target configuration", () => {
  it("resolves conversation, project, then default without exposing a fallback", async () => {
    const store = memoryStore();
    const targets = new ModelTargets(store);
    let configuration = await targets.configure(target("a", "Model A"), 0);
    configuration = await targets.configure(
      target("b", "Model B"),
      configuration.revision,
    );
    configuration = await targets.selectDefault("a", configuration.revision);
    configuration = await targets.selectProject(
      "project-one",
      "b",
      configuration.revision,
    );
    await targets.selectConversation(
      "conversation-one",
      "project-one",
      "a",
      configuration.revision,
    );

    assert.equal(
      (
        await targets.resolve({
          conversationId: "conversation-one",
          projectId: "project-one",
        })
      )?.target.targetId,
      "a",
    );
    assert.equal(
      (
        await targets.resolve({
          conversationId: "conversation-two",
          projectId: "project-one",
        })
      )?.target.targetId,
      "b",
    );
    assert.equal(
      (
        await targets.resolve({
          conversationId: "conversation-three",
          projectId: null,
        })
      )?.target.targetId,
      "a",
    );
  });

  it("returns only safe names to the ordinary conversation surface", async () => {
    const targets = new ModelTargets(memoryStore());
    await targets.configure(target("a", "Model A"), 0);
    assert.deepEqual(await targets.view(), {
      revision: 1,
      targets: [{ targetId: "a", displayName: "Model A", enabled: true }],
      defaultTargetId: null,
    });
  });

  it("fails closed for stale writes, disabled selections, extra fields, and cross-scope reuse", async () => {
    const targets = new ModelTargets(memoryStore());
    let configuration = await targets.configure(target("a", "Model A"), 0);
    await assert.rejects(
      () => targets.configure(target("b", "Model B"), 0),
      ModelTargetConflictError,
    );
    configuration = await targets.selectConversation(
      "conversation-one",
      null,
      "a",
      configuration.revision,
    );
    await assert.rejects(
      () =>
        targets.resolve({
          conversationId: "conversation-one",
          projectId: "project-one",
        }),
      ModelTargetError,
    );
    assert.throws(
      () =>
        validateModelTargetConfiguration({
          ...configuration,
          credential: "never",
        }),
      ModelTargetError,
    );
    await assert.rejects(
      () =>
        targets
          .configure(
            { ...target("a", "Model A"), enabled: false },
            configuration.revision,
          )
          .then((next) => targets.selectDefault("a", next.revision)),
      ModelTargetError,
    );
  });
});

function memoryStore(): ModelTargetStore {
  let current = emptyModelTargetConfiguration();
  return {
    load: async () => current,
    replace: async (expectedRevision, configuration) => {
      if (current.revision !== expectedRevision)
        throw new ModelTargetConflictError();
      current = configuration;
      return current;
    },
  };
}
