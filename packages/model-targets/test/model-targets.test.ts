import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyModelTargetConfiguration,
  migrateLegacyModelTargetConfiguration,
  modelTargetAvailability,
  ModelTargetConflictError,
  ModelTargetError,
  ModelTargets,
  readModelTargetConfiguration,
  validateModelTargetConfiguration,
  type ClassifiedModelTarget,
  type ModelTargetCapabilities,
  type ModelTargetStore,
} from "../src/index.ts";

const target = (
  targetId: string,
  displayName: string,
): ClassifiedModelTarget => ({
  targetId,
  displayName,
  executionClass: "LOCAL_MODEL",
  kind: "LLAMA_SERVER_LOOPBACK",
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
      targets: [
        {
          targetId: "a",
          displayName: "Model A",
          enabled: true,
          executionClass: "LOCAL_MODEL",
          availability: {
            enabled: true,
            qualifiedOffline: false,
            launch: "UNAVAILABLE",
            reason: "NOT_QUALIFIED",
          },
        },
      ],
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

const delivery = (targetId: string): ClassifiedModelTarget => ({
  ...target(targetId, `Delivery ${targetId}`),
  executionClass: "MODEL_DELIVERY",
  kind: "OPENAI_RESPONSES",
  boundary: "EXTERNAL_SERVICE",
});
const agent = (
  targetId: string,
  kind: "CODEX_CLI" | "CLAUDE_CODE",
): ClassifiedModelTarget => ({
  ...target(targetId, `Agent ${targetId}`),
  executionClass: "AGENT_EXECUTION",
  kind,
  boundary: "EXTERNAL_SERVICE",
});

const legacy = (
  targetId: string,
  providerKind: string,
  boundary: string,
  enabled = true,
) => ({
  targetId,
  displayName: `Legacy ${targetId}`,
  providerKind,
  modelId: `synthetic-${targetId}`,
  boundary,
  profileRef: `profiles/${targetId}.json`,
  policyRef: `policies/${targetId}.json`,
  instructionRefs: [`instructions/${targetId}.json`],
  maxInputBytes: 65_536,
  maxOutputBytes: 16_384,
  enabled,
});
const legacyConfiguration = () => ({
  schemaVersion: 1,
  revision: 4,
  targets: [
    legacy("api", "OPENAI_RESPONSES", "EXTERNAL_SERVICE"),
    legacy("api-local", "OPENAI_RESPONSES", "LOCAL_ONLY"),
    legacy("codex", "CODEX_CLI", "EXTERNAL_SERVICE"),
    legacy("local", "LOCAL_ADAPTER", "LOCAL_ONLY", false),
  ],
  defaultTargetId: "api",
  projectSelections: [{ projectId: "project-one", targetId: "codex" }],
  conversationSelections: [
    { conversationId: "conversation-one", projectId: null, targetId: "api" },
  ],
});

describe("model target schema v2", () => {
  it("accepts one kind per class and rejects every other combination", () => {
    const valid = [
      delivery("api"),
      agent("codex", "CODEX_CLI"),
      agent("claude", "CLAUDE_CODE"),
      target("local", "Local"),
      { ...target("local-unclassified", "Local"), boundary: "UNCLASSIFIED" },
    ];
    const configuration = {
      ...emptyModelTargetConfiguration(),
      targets: valid,
    };
    assert.equal(
      validateModelTargetConfiguration(configuration).targets.length,
      5,
    );
    const invalid: readonly unknown[] = [
      { ...delivery("x"), kind: "CODEX_CLI" },
      { ...delivery("x"), boundary: "LOCAL_ONLY" },
      { ...agent("x", "CODEX_CLI"), boundary: "LOCAL_ONLY" },
      { ...agent("x", "CLAUDE_CODE"), executionClass: "LOCAL_MODEL" },
      { ...target("x", "X"), boundary: "EXTERNAL_SERVICE" },
      { ...target("x", "X"), kind: "OLLAMA" },
      { ...target("x", "X"), executionClass: "SOMETHING_ELSE" },
      { ...delivery("x"), providerKind: "OPENAI_RESPONSES" },
      { ...delivery("x"), legacyProviderKind: "OPENAI_RESPONSES" },
      { ...delivery("x"), executionClass: null },
      {
        ...delivery("x"),
        executionClass: null,
        kind: null,
        legacyProviderKind: "OPENAI_RESPONSES",
        boundary: "NOWHERE",
      },
    ];
    for (const candidate of invalid)
      assert.throws(
        () =>
          validateModelTargetConfiguration({
            ...emptyModelTargetConfiguration(),
            targets: [candidate],
          }),
        ModelTargetError,
        JSON.stringify(candidate),
      );
    assert.throws(
      () =>
        validateModelTargetConfiguration({
          ...legacyConfiguration(),
          targets: [],
          defaultTargetId: null,
          projectSelections: [],
          conversationSelections: [],
        }),
      /Unsupported/u,
    );
  });

  it("migrates only the known v1 combination and preserves every field", () => {
    const original = legacyConfiguration();
    const frozen = JSON.stringify(original);
    const migrated = readModelTargetConfiguration(original);
    assert.equal(JSON.stringify(original), frozen);
    assert.deepEqual(migrated, migrateLegacyModelTargetConfiguration(original));
    assert.equal(migrated.schemaVersion, 2);
    assert.equal(migrated.revision, 4);
    assert.equal(migrated.defaultTargetId, "api");
    assert.deepEqual(migrated.projectSelections, original.projectSelections);
    assert.deepEqual(
      migrated.conversationSelections,
      original.conversationSelections,
    );
    assert.deepEqual(
      migrated.targets.map((entry) => [entry.executionClass, entry.kind]),
      [
        ["MODEL_DELIVERY", "OPENAI_RESPONSES"],
        [null, null],
        [null, null],
        [null, null],
      ],
    );
    for (const [index, entry] of migrated.targets.entries()) {
      const source = original.targets[index]!;
      const { executionClass, kind, ...rest } = entry;
      const recovered = {
        ...rest,
        providerKind:
          "legacyProviderKind" in entry ? entry.legacyProviderKind : kind,
      };
      delete (recovered as { legacyProviderKind?: string }).legacyProviderKind;
      assert.ok(executionClass === null || kind === "OPENAI_RESPONSES");
      assert.deepEqual(
        Object.fromEntries(Object.entries(recovered).sort()),
        Object.fromEntries(Object.entries(source).sort()),
      );
    }
    const serialized = JSON.parse(JSON.stringify(migrated));
    assert.deepEqual(validateModelTargetConfiguration(serialized), migrated);
    assert.deepEqual(readModelTargetConfiguration(serialized), migrated);
    assert.throws(
      () =>
        migrateLegacyModelTargetConfiguration({
          ...original,
          targets: [
            { ...original.targets[0], executionClass: "MODEL_DELIVERY" },
          ],
        }),
      ModelTargetError,
    );
    assert.throws(
      () =>
        migrateLegacyModelTargetConfiguration({
          ...original,
          targets: [{ ...original.targets[0], boundary: "SOMEWHERE" }],
        }),
      ModelTargetError,
    );
  });

  it("keeps unclassified entries visible but never selectable or resolvable", async () => {
    const store = memoryStore(
      readModelTargetConfiguration(legacyConfiguration()),
    );
    const targets = new ModelTargets(store);
    await assert.rejects(
      () => targets.resolve({ conversationId: "c", projectId: "project-one" }),
      /has no kind yet/u,
    );
    await assert.rejects(
      () => targets.selectConversation("c", null, "codex", 4),
      /has no kind yet/u,
    );
    await assert.rejects(
      () => targets.selectDefault("local", 4),
      /has no kind yet/u,
    );
    await assert.rejects(
      () =>
        targets.configure(
          {
            ...delivery("codex"),
            executionClass: null,
          } as unknown as ClassifiedModelTarget,
          4,
        ),
      /Choose a target kind/u,
    );
    assert.equal(
      (
        await targets.resolve({
          conversationId: "conversation-one",
          projectId: null,
        })
      )?.target.kind,
      "OPENAI_RESPONSES",
    );
    const reclassified = await targets.configure(
      agent("codex", "CODEX_CLI"),
      4,
    );
    assert.equal(
      reclassified.targets.find((entry) => entry.targetId === "codex")
        ?.executionClass,
      "AGENT_EXECUTION",
    );
    assert.equal(
      (await targets.resolve({ conversationId: "c", projectId: "project-one" }))
        ?.target.kind,
      "CODEX_CLI",
    );
  });
});

describe("model target availability", () => {
  const capabilities: ModelTargetCapabilities = {
    qualifiedOffline: ["OPENAI_RESPONSES", "CODEX_CLI", "CLAUDE_CODE"],
    launch: { OPENAI_RESPONSES: "SIMULATED" },
  };

  it("derives each state separately and never from the display name", () => {
    const unclassified = readModelTargetConfiguration(legacyConfiguration())
      .targets[3]!;
    const cases = [
      [delivery("api"), "SIMULATED", null, true],
      [
        { ...delivery("gpt-5"), displayName: "GPT-5 (real)" },
        "SIMULATED",
        null,
        true,
      ],
      [{ ...delivery("api"), enabled: false }, "UNAVAILABLE", "DISABLED", true],
      [agent("codex", "CODEX_CLI"), "UNAVAILABLE", "NOT_CONNECTED", true],
      [agent("claude", "CLAUDE_CODE"), "UNAVAILABLE", "NOT_CONNECTED", true],
      [target("local", "Local"), "UNAVAILABLE", "NOT_QUALIFIED", false],
      [unclassified, "UNAVAILABLE", "UNCLASSIFIED", false],
    ] as const;
    for (const [entry, launch, reason, qualifiedOffline] of cases)
      assert.deepEqual(
        modelTargetAvailability(entry, capabilities),
        { enabled: entry.enabled, qualifiedOffline, launch, reason },
        entry.targetId,
      );
    assert.equal(
      modelTargetAvailability(delivery("api"), {
        qualifiedOffline: ["OPENAI_RESPONSES"],
        launch: { OPENAI_RESPONSES: "AVAILABLE" },
      }).launch,
      "AVAILABLE",
    );
    assert.deepEqual(
      modelTargetAvailability(target("local", "Local"), {
        qualifiedOffline: [],
        launch: { LLAMA_SERVER_LOOPBACK: "AVAILABLE" },
      }),
      {
        enabled: true,
        qualifiedOffline: false,
        launch: "UNAVAILABLE",
        reason: "NOT_QUALIFIED",
      },
    );
  });

  it("never launches an unclassified local model, even when qualified and declared", () => {
    const declared: ModelTargetCapabilities = {
      qualifiedOffline: ["LLAMA_SERVER_LOOPBACK"],
      launch: { LLAMA_SERVER_LOOPBACK: "AVAILABLE" },
    };
    assert.deepEqual(
      modelTargetAvailability(
        // Stored configuration can hold this combination; the type forbids it.
        { ...target("local", "Local"), boundary: "UNCLASSIFIED" } as never,
        declared,
      ),
      {
        enabled: true,
        qualifiedOffline: true,
        launch: "UNAVAILABLE",
        reason: "UNCLASSIFIED",
      },
    );
    assert.deepEqual(
      modelTargetAvailability(target("local", "Local"), declared),
      {
        enabled: true,
        qualifiedOffline: true,
        launch: "AVAILABLE",
        reason: null,
      },
    );
    assert.equal(
      modelTargetAvailability(target("local", "Local"), {
        qualifiedOffline: ["LLAMA_SERVER_LOOPBACK"],
        launch: { LLAMA_SERVER_LOOPBACK: "SIMULATED" },
      }).launch,
      "SIMULATED",
    );
  });

  it("lets an unavailable agent be selected without turning it into an API fallback", async () => {
    const targets = new ModelTargets(memoryStore(), capabilities);
    let configuration = await targets.configure(delivery("api"), 0);
    configuration = await targets.configure(
      agent("codex", "CODEX_CLI"),
      configuration.revision,
    );
    configuration = await targets.selectDefault("api", configuration.revision);
    await targets.selectConversation(
      "conversation-one",
      null,
      "codex",
      configuration.revision,
    );
    const resolved = await targets.resolve({
      conversationId: "conversation-one",
      projectId: null,
    });
    assert.equal(resolved?.target.executionClass, "AGENT_EXECUTION");
    assert.equal(resolved?.selectedBy, "CONVERSATION");
    const view = await targets.view();
    assert.deepEqual(
      view.targets.map((entry) => [
        entry.targetId,
        entry.executionClass,
        entry.availability.launch,
        entry.availability.reason,
      ]),
      [
        ["api", "MODEL_DELIVERY", "SIMULATED", null],
        ["codex", "AGENT_EXECUTION", "UNAVAILABLE", "NOT_CONNECTED"],
      ],
    );
  });
});

function memoryStore(
  initial = emptyModelTargetConfiguration(),
): ModelTargetStore {
  let current = initial;
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
