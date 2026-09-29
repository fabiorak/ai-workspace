import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  CONVERSATION_TURN_EFFECT,
  type ResolvedConversationTurn,
} from "@ai-workspace/conversation-turn";
import type { GeneralConversation } from "@ai-workspace/general-conversation";
import { JsonTurnPrivacyAuditStore } from "@ai-workspace/local-privacy-audit";
import type { ResolvedModelTarget } from "@ai-workspace/model-targets";
import { AutomaticPrivacyProtection } from "../src/automatic-privacy.ts";
import { composeReducedTurnContext } from "../src/reduced-turn-context.ts";
import type { ReducedTurnEvidenceDependencies } from "../src/reduced-turn-evidence.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";

const time = "2026-09-22T10:00:00.000Z";
const general = { kind: "GENERAL" } as const;
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("General records a real scoped audit before returning a protected configured envelope", async () => {
  const fixture = await setup();
  const result = await fixture.compose(true);
  const persisted = await new JsonTurnPrivacyAuditStore(fixture.home).list(
    general,
  );
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]!.eventHash, result.auditEventHash);
  assert.equal(persisted[0]!.decision, "REVIEWABLE_NOT_AUTHORIZED");
  assert.deepEqual(persisted[0]!.scope, general);
  assert.equal(persisted[0]!.conversationId, fixture.turn.scope.conversationId);
  assert.equal("projectId" in persisted[0]!, false);
  assert.equal("handoffId" in persisted[0]!, false);
  const envelope = JSON.parse(result.text) as {
    schemaVersion: number;
    userText: string;
    instructions: {
      instructions: {
        scope: unknown;
        rules: { content: string; status: string; sourceDigest: string }[];
      };
    };
    sources: unknown[];
    readings: { text: string }[];
  };
  assert.equal(envelope.schemaVersion, 2);
  assert.deepEqual(envelope.instructions.instructions.scope, general);
  assert.ok(
    envelope.instructions.instructions.rules.some(
      (rule) =>
        rule.content ===
          "Use the supplied synthetic evidence and state when context is incomplete." &&
        rule.status === "ACTIVE" &&
        /^[a-f0-9]{64}$/u.test(rule.sourceDigest),
    ),
  );
  assert.equal(envelope.sources.length, 1);
  assert.equal(envelope.readings.length, 1);
  assert.match(envelope.userText, /\[\[EMAIL_1\]\]/u);
  assert.equal(result.text.includes("synthetic@example.invalid"), false);
  const auditText = JSON.stringify(persisted);
  assert.equal(auditText.includes("synthetic@example.invalid"), false);
  assert.equal(auditText.includes("Confirmed General evidence"), false);
  assert.equal(auditText.includes("Use the supplied"), false);
});

test("PUBLIC policy blocks the fresh confidential question and records the blocked decision", async () => {
  const fixture = await setup();
  await change(fixture.target.target.policyRef, (value) => ({
    ...value,
    maximumDataClass: "PUBLIC",
  }));
  let returned = false;
  await assert.rejects(async () => {
    await fixture.compose(true);
    returned = true;
  }, /PRIVACY_BLOCKED/u);
  assert.equal(returned, false);
  const events = await new JsonTurnPrivacyAuditStore(fixture.home).list(
    general,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.decision, "BLOCKED");
  assert.equal(events[0]!.counts.defaultedItems, 1);
});

test("missing and mismatched configured policy, profile and instruction sources fail before audit", async () => {
  for (const mismatch of [
    "policy-scope",
    "policy-model",
    "profile-scope",
    "instruction-scope",
    "missing-ref",
  ] as const) {
    const fixture = await setup();
    const foreign = { kind: "PROJECT", projectId: "foreign-project" };
    if (mismatch === "policy-scope")
      await change(fixture.target.target.policyRef, (value) => ({
        ...value,
        scope: foreign,
      }));
    if (mismatch === "policy-model")
      await change(fixture.target.target.policyRef, (value) => ({
        ...value,
        modelId: "foreign-model",
      }));
    if (mismatch === "profile-scope")
      await change(fixture.target.target.profileRef, (value) => ({
        ...value,
        scope: foreign,
      }));
    if (mismatch === "instruction-scope")
      await change(fixture.target.target.instructionRefs[0]!, (value) => ({
        ...value,
        ownerScope: foreign,
      }));
    if (mismatch === "missing-ref") await rm(fixture.target.target.policyRef);
    await assert.rejects(fixture.compose(true), mismatch);
    assert.deepEqual(
      await new JsonTurnPrivacyAuditStore(fixture.home).list(general),
      [],
    );
  }
});

test("profile instruction/continuity and target payload byte budgets are hard limits", async () => {
  for (const budget of [
    "instructionBudgetBytes",
    "continuityBudgetBytes",
    "maxInputBytes",
  ] as const) {
    const fixture = await setup();
    if (budget === "maxInputBytes")
      fixture.target = {
        ...fixture.target,
        target: { ...fixture.target.target, maxInputBytes: 1 },
      };
    else
      await change(fixture.target.target.profileRef, (value) => {
        const agent = value.agent as Record<string, unknown>;
        return {
          ...value,
          agent: {
            ...agent,
            context: {
              ...(agent.context as Record<string, unknown>),
              [budget]: 1,
            },
          },
        };
      });
    await assert.rejects(fixture.compose(true), /CONTEXT_UNAVAILABLE/u, budget);
    assert.deepEqual(
      await new JsonTurnPrivacyAuditStore(fixture.home).list(general),
      [],
    );
  }
});

test("preview applies instructions and policy without appending an audit event", async () => {
  const fixture = await setup();
  const preview = await fixture.compose(false);
  assert.match(preview.text, /Use the supplied synthetic evidence/u);
  assert.deepEqual(
    await new JsonTurnPrivacyAuditStore(fixture.home).list(general),
    [],
  );
  await change(fixture.target.target.policyRef, (value) => ({
    ...value,
    maximumDataClass: "PUBLIC",
  }));
  await assert.rejects(fixture.compose(false), /PRIVACY_BLOCKED/u);
  assert.deepEqual(
    await new JsonTurnPrivacyAuditStore(fixture.home).list(general),
    [],
  );
});

test("project conversation without a handoff uses its real config and audit scope", async () => {
  const projectId = "synthetic-project";
  const fixture = await setup(projectId);
  const scope = { kind: "PROJECT", projectId } as const;
  await change(fixture.target.target.policyRef, (value) => ({
    ...value,
    scope,
  }));
  await change(fixture.target.target.profileRef, (value) => ({
    ...value,
    scope,
  }));
  await change(fixture.target.target.instructionRefs[0]!, (value) => ({
    ...value,
    ownerScope: scope,
    source: { ...(value.source as Record<string, unknown>), ownerScope: scope },
  }));
  const result = await fixture.compose(true);
  const envelope = JSON.parse(result.text) as {
    scope: unknown;
    instructions: { instructions: { scope: unknown } };
  };
  assert.deepEqual(envelope.scope, fixture.turn.scope);
  assert.deepEqual(envelope.instructions.instructions.scope, scope);
  assert.equal(fixture.turn.scope.handoffId, null);
  const store = new JsonTurnPrivacyAuditStore(fixture.home);
  const events = await store.list(scope);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventHash, result.auditEventHash);
  assert.deepEqual(await store.list(general), []);
  assert.deepEqual(
    await store.list({ kind: "PROJECT", projectId: "foreign-project" }),
    [],
  );
});

async function setup(projectId: string | null = null) {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-reduced-context-"));
  roots.push(home);
  const refs = await writeReducedTurnConfiguration(home);
  const conversationId =
    projectId === null ? "general-conversation" : "project-session";
  const turn: ResolvedConversationTurn = {
    schemaVersion: 1,
    effect: CONVERSATION_TURN_EFFECT,
    scope: { conversationId, projectId, workItemId: null, handoffId: null },
    request: {
      conversationId,
      projectId,
      targetId: "target-b",
      userText: "Ask synthetic@example.invalid about the open question",
      clientRequestId: "synthetic-request",
    },
  };
  const dependencies: ReducedTurnEvidenceDependencies & { home: string } = {
    home,
    conversations: {
      projects: async () =>
        projectId === null
          ? []
          : [{ id: projectId, name: "Synthetic project" }],
      sessions: {
        list: async () =>
          projectId === null
            ? []
            : [
                {
                  id: conversationId,
                  projectId,
                  sourceType: "SYNTHETIC",
                  sourceSessionId: "source-session",
                  agent: "synthetic",
                  model: null,
                  startedAt: time,
                  createdAt: time,
                  lastImportedAt: time,
                  latestSourceArtifact: {
                    id: "source-artifact",
                    byteLength: 1,
                  },
                  events: [],
                },
              ],
      },
    },
    general: { show: async () => conversation(conversationId) },
    generalLinks: { list: async () => [] },
    activeMemory: { list: async () => ({ items: [], nextCursor: null }) },
  };
  const fixture = {
    home,
    turn,
    target: {
      selectedBy: "DEFAULT",
      target: {
        targetId: "target-b",
        displayName: "Synthetic",
        executionClass: "MODEL_DELIVERY",
        kind: "OPENAI_RESPONSES",
        modelId: "model-b",
        boundary: "EXTERNAL_SERVICE",
        ...refs,
        maxInputBytes: 65536,
        maxOutputBytes: 16384,
        enabled: true,
      },
    } as ResolvedModelTarget,
    compose: (audit: boolean) =>
      composeReducedTurnContext(
        dependencies,
        turn,
        fixture.target,
        new AutomaticPrivacyProtection(home),
        audit,
      ),
  };
  return fixture;
}
function conversation(id: string): GeneralConversation {
  const content = "Confirmed General evidence";
  return {
    id,
    scope: "GENERAL",
    title: "Synthetic conversation",
    createdAt: time,
    events: [
      {
        id: "general-event",
        conversationId: id,
        sequence: 0,
        scope: "GENERAL",
        type: "USER_MESSAGE",
        occurredAt: time,
        actor: "LOCAL_USER",
        origin: "USER_AUTHORED",
        verification: "UNVERIFIED",
        dataClass: "CONFIDENTIAL",
        content,
        exactBytes: Buffer.byteLength(content),
        contentSha256: createHash("sha256").update(content).digest("hex"),
        provenance: { kind: "LOCAL_GENERAL_CAPTURE", capturedAt: time },
      },
    ],
  };
}
async function change(
  path: string,
  update: (value: Record<string, unknown>) => Record<string, unknown>,
) {
  const value = JSON.parse(await readFile(path, "utf8")) as Record<
    string,
    unknown
  >;
  await writeFile(path, `${JSON.stringify(update(value), null, 2)}\n`);
}
