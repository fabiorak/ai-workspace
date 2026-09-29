import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import type {
  GeneralConversation,
  GeneralEvent,
} from "@ai-workspace/general-conversation";
import { JsonTurnPrivacyAuditStore } from "@ai-workspace/local-privacy-audit";
import type { ResolvedModelTarget } from "@ai-workspace/model-targets";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("revalidates changed reduced-turn policy, profile, and instructions before exposure", async () => {
  for (const changed of ["policy", "profile", "instructions"] as const) {
    const home = await mkdtemp(join(tmpdir(), "ai-workspace-revalidation-"));
    roots.push(home);
    const refs = await writeReducedTurnConfiguration(home);
    let exposures = 0;
    let ids = 0;
    const area = areaFor({
      home,
      refs,
      ids: () => {
        ids += 1;
        if (ids === 1) mutateConfiguration(refs, changed);
        return `synthetic-id-${ids}`;
      },
      send: async () => {
        exposures += 1;
        return completed();
      },
    });

    const outcome = await area.run(request(`changed-${changed}`));
    assert.equal(outcome.result.kind, "REFUSED_BEFORE_EXPOSURE", changed);
    assert.equal(exposures, 0, changed);
  }
});

test("refuses before exposure when the scoped audit directory has unsafe permissions", async () => {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-audit-permissions-"));
  roots.push(home);
  const refs = await writeReducedTurnConfiguration(home);
  await mkdir(join(home, "turn-privacy-audit"), { mode: 0o700 });
  await chmod(join(home, "turn-privacy-audit"), 0o500);
  let exposures = 0;
  const area = areaFor({
    home,
    refs,
    ids: () => "synthetic-audit-id",
    send: async () => {
      exposures += 1;
      return completed();
    },
  });

  const outcome = await area.run(request("audit-permissions"));
  assert.equal(outcome.result.kind, "REFUSED_BEFORE_EXPOSURE");
  assert.equal(exposures, 0);
});

test("screens raw quoted credentials in the question and configured instructions before audit", async () => {
  for (const location of ["question", "instruction"] as const) {
    const home = await mkdtemp(join(tmpdir(), "ai-workspace-raw-secret-"));
    roots.push(home);
    const refs = await writeReducedTurnConfiguration(home);
    if (location === "instruction") setInstructionCredential(refs);
    let exposures = 0;
    const area = areaFor({
      home,
      refs,
      ids: () => "unreachable-audit-id",
      send: async () => {
        exposures += 1;
        return completed();
      },
    });

    const outcome = await area.run(
      request(
        `raw-secret-${location}`,
        location === "question"
          ? 'Continue with password="abcdefghijkl".'
          : "Continue the synthetic conversation.",
      ),
    );
    assert.equal(outcome.result.kind, "REFUSED_BEFORE_EXPOSURE", location);
    assert.equal(
      outcome.result.kind === "REFUSED_BEFORE_EXPOSURE"
        ? outcome.result.reason
        : null,
      "PRIVACY_BLOCKED",
      location,
    );
    assert.equal(exposures, 0, location);
    assert.deepEqual(
      await new JsonTurnPrivacyAuditStore(home).list({ kind: "GENERAL" }),
      [],
      location,
    );
  }
});

function areaFor(
  input: Readonly<{
    home: string;
    refs: Pick<
      ResolvedModelTarget["target"],
      "profileRef" | "policyRef" | "instructionRefs"
    >;
    ids: () => string;
    send: () => Promise<ReturnType<typeof completed>>;
  }>,
) {
  return conversationTurnArea({
    home: input.home,
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: async () => [conversation()] },
      workItems: { list: async () => [] },
    },
    general: {
      show: async () => conversation(),
      appendTurn: async () => {
        throw new Error("A refused turn must not append a General response.");
      },
    },
    generalLinks: { list: async () => [] },
    memory: { list: async () => ({ items: [], nextCursor: null }) },
    handoffs: {
      list: async () => [],
      show: async () => {
        throw new Error("General has no handoff.");
      },
      validateRepository: async () => {
        throw new Error("General has no repository.");
      },
    },
    targets: {
      resolve: async () => ({
        ...target,
        target: { ...target.target, ...input.refs },
      }),
    },
    audit: {
      record: async () => {
        throw new Error("Reduced turns use their scoped audit.");
      },
    },
    writer: {
      storeTurn: async () => {
        throw new Error("General does not use the project writer.");
      },
    },
    transport: { send: input.send },
    ids: input.ids,
    clock: () => new Date("2026-09-22T10:00:00.000Z"),
  });
}

function mutateConfiguration(
  refs: Readonly<{
    profileRef: string;
    policyRef: string;
    instructionRefs: readonly string[];
  }>,
  changed: "policy" | "profile" | "instructions",
): void {
  const path =
    changed === "policy"
      ? refs.policyRef
      : changed === "profile"
        ? refs.profileRef
        : refs.instructionRefs[0]!;
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  if (changed === "policy") value.version = "1.0.1";
  if (changed === "profile") {
    const agent = value.agent as Record<string, unknown>;
    const context = agent.context as Record<string, unknown>;
    context.continuityBudgetBytes = 65_535;
  }
  if (changed === "instructions") {
    const source = value.source as Record<string, unknown>;
    const rules = source.rules as Record<string, unknown>[];
    rules[0]!.content =
      "Use supplied synthetic evidence and name any incomplete context.";
  }
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function setInstructionCredential(
  refs: Readonly<{ instructionRefs: readonly string[] }>,
): void {
  const path = refs.instructionRefs[0]!;
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  const source = value.source as Record<string, unknown>;
  const rules = source.rules as Record<string, unknown>[];
  rules[0]!.content = 'Do not expose password="abcdefghijkl".';
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const target: ResolvedModelTarget = {
  selectedBy: "DEFAULT",
  target: {
    targetId: "target-b",
    displayName: "Target B",
    executionClass: "MODEL_DELIVERY",
    kind: "OPENAI_RESPONSES",
    modelId: "model-b",
    boundary: "EXTERNAL_SERVICE",
    profileRef: "unused-profile.json",
    policyRef: "unused-policy.json",
    instructionRefs: ["unused-instructions.json"],
    maxInputBytes: 65_536,
    maxOutputBytes: 16_384,
    enabled: true,
  },
};

function request(
  clientRequestId: string,
  userText = "Continue the synthetic conversation",
) {
  return {
    conversationId: "general-revalidation",
    projectId: null,
    targetId: target.target.targetId,
    userText,
    clientRequestId,
  };
}

function conversation(): GeneralConversation {
  const content = "Confirmed synthetic General evidence";
  const event: GeneralEvent = {
    id: "general-event",
    conversationId: "general-revalidation",
    sequence: 0,
    scope: "GENERAL",
    type: "USER_MESSAGE",
    occurredAt: "2026-09-22T09:00:00.000Z",
    actor: "LOCAL_USER",
    origin: "USER_AUTHORED",
    verification: "UNVERIFIED",
    dataClass: "CONFIDENTIAL",
    content,
    exactBytes: Buffer.byteLength(content, "utf8"),
    contentSha256: createHash("sha256").update(content, "utf8").digest("hex"),
    provenance: {
      kind: "LOCAL_GENERAL_CAPTURE",
      capturedAt: "2026-09-22T09:00:00.000Z",
    },
  };
  return {
    id: "general-revalidation",
    scope: "GENERAL",
    title: "Synthetic revalidation",
    createdAt: "2026-09-22T09:00:00.000Z",
    events: [event],
  };
}

function completed() {
  return {
    kind: "COMPLETED" as const,
    text: "Synthetic answer",
    requestId: "request-id",
    responseId: "response-id",
    usage: {
      inputTokens: null,
      cachedInputTokens: null,
      outputTokens: null,
    },
  };
}
