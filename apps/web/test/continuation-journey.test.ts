import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { test } from "node:test";
import { ModelAttempts } from "@ai-workspace/model-attempts";
import { JsonModelAttemptStore } from "../../../integrations/local-model-attempts/src/index.ts";
import {
  ModelDelivery,
  type DeliveryInput,
} from "../../../packages/model-delivery/src/index.ts";
import { continuationFixture } from "./continuation-fixture.ts";

test("A6 fake journey prepares, protects, delivers once, stores the response and resumes", async () => {
  const fixture = await continuationFixture();
  try {
    const configured = await fixture.app.continuations.configure(
      fixture.query,
      fixture.target,
    );
    assert.equal(configured.ready, true);
    const initial = await fixture.app.continuations.open(fixture.query);
    assert.equal(initial.ready, true);
    const proposal = await fixture.app.continuations.propose(
      fixture.query,
      "What is the verified next check?",
      [{ entityType: "CUSTOMER", alias: "Synthetic Customer" }],
    );
    assert.equal(proposal.ready, true);
    if (!proposal.ready) return;
    const protectedText = await fixture.app.continuations.protect(
      fixture.query,
      { proposal: proposal.proposal, selected: [], manual: [], passphrase: "" },
    );
    assert.equal(protectedText.ready, true);
    if (!protectedText.ready) return;
    const audit = await fixture.app.listPrivacyAudit(fixture.project.id);
    const auditHash = audit.events.at(-1)?.eventHash;
    assert.ok(auditHash);
    const deliveryInput: DeliveryInput = {
      projectId: fixture.project.id,
      workItemId: fixture.work.id,
      handoffId: fixture.handoff.id,
      model: fixture.target.model,
      text: protectedText.text,
      bindingDigest: "a".repeat(64),
      preflightAuditEventHash: auditHash,
      providerKind: "OPENAI_RESPONSES",
      destination: "EXTERNAL",
      maxOutputTokens: 200,
      timeoutMs: 1000,
    };
    let calls = 0;
    const attempts = new ModelAttempts(new JsonModelAttemptStore(fixture.home));
    const delivery = new ModelDelivery({
      attempts,
      transport: {
        send: async (request) => {
          calls++;
          assert.equal(request.text, protectedText.text);
          return {
            kind: "COMPLETED",
            text: "The next check is to inspect the recorded failure.",
            requestId: "synthetic-request",
            responseId: "synthetic-response",
            usage: { inputTokens: 20, cachedInputTokens: 0, outputTokens: 9 },
          };
        },
      },
    });
    const authorization = delivery.prepare(deliveryInput);
    const delivered = await delivery.confirm(
      authorization.authorizationId,
      deliveryInput,
      async () => deliveryInput.bindingDigest,
    );
    assert.equal(delivered.kind, "COMPLETED");
    if (delivered.kind !== "COMPLETED") return;
    const stored = await fixture.app.continuations.recordResponse(
      fixture.query,
      {
        attemptId: delivered.attemptId,
        model: fixture.target.model,
        text: delivered.text,
        occurredAt: new Date().toISOString(),
      },
    );
    assert.equal(stored.ready, true);
    assert.equal(calls, 1);
    const conversation = await fixture.app.conversations.open({
      id: fixture.query.conversationId,
      projectId: fixture.project.id,
    });
    assert.equal(conversation?.moments.at(-1)?.type, "AGENT_MESSAGE");
    const secondPreparation = await fixture.app.continuations.propose(
      fixture.query,
      "Now continue from that answer.",
      [{ entityType: "CUSTOMER", alias: "Synthetic Customer" }],
    );
    assert.equal(secondPreparation.ready, true);
    const replay = await fixture.app.continuations.recordResponse(
      fixture.query,
      {
        attemptId: delivered.attemptId,
        model: fixture.target.model,
        text: delivered.text,
        occurredAt: new Date().toISOString(),
      },
    );
    assert.equal(replay.ready, true);
    if (replay.ready) assert.equal(replay.duplicate, true);
    assert.equal(calls, 1);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
