import assert from "node:assert/strict";
import test from "node:test";

import {
  ConversationTurn,
  ConversationTurnConflictError,
  ConversationTurnError,
  type ConversationTurnClaim,
  type ConversationTurnIdempotency,
  type ConversationTurnRequest,
  type ConversationTurnResult,
} from "../src/index.ts";

const request = (
  overrides: Partial<ConversationTurnRequest> = {},
): ConversationTurnRequest => ({
  conversationId: "conversation-synthetic",
  projectId: "project-synthetic",
  targetId: "target-local-fake",
  userText: "Continue the synthetic work.",
  clientRequestId: "client-request-1",
  ...overrides,
});

const completed: ConversationTurnResult = Object.freeze({
  kind: "COMPLETED",
  assistantMessageId: "assistant-message-synthetic",
  effectiveModel: "synthetic-model",
  text: "Synthetic answer.",
  occurredAt: "2026-09-14T10:00:00.000Z",
});

test("uses authoritative server scope and rejects a claimed project mismatch", async () => {
  let executions = 0;
  const turn = new ConversationTurn({
    scopes: {
      resolve: async () => ({
        conversationId: "conversation-synthetic",
        projectId: "project-authoritative",
        workItemId: "work-authoritative",
        handoffId: "handoff-authoritative",
      }),
    },
    idempotency: memoryIdempotency(),
    executor: {
      execute: async () => {
        executions += 1;
        return completed;
      },
    },
  });
  await assert.rejects(
    () => turn.run(request()),
    (error: unknown) =>
      error instanceof ConversationTurnError &&
      /claimed project scope/u.test(error.message),
  );
  assert.equal(executions, 0);
});

test("resolves work and handoff server-side instead of accepting them as input", async () => {
  const seen: unknown[] = [];
  const turn = new ConversationTurn({
    scopes: {
      resolve: async (conversationId) => ({
        conversationId,
        projectId: "project-synthetic",
        workItemId: "work-authoritative",
        handoffId: "handoff-authoritative",
      }),
    },
    idempotency: memoryIdempotency(),
    executor: {
      execute: async (resolved) => {
        seen.push(resolved.scope);
        return completed;
      },
    },
  });
  const outcome = await turn.run(request());
  assert.equal(outcome.result.kind, "COMPLETED");
  assert.deepEqual(seen, [
    {
      conversationId: "conversation-synthetic",
      projectId: "project-synthetic",
      workItemId: "work-authoritative",
      handoffId: "handoff-authoritative",
    },
  ]);
  await assert.rejects(
    () => turn.run({ ...request(), handoffId: "browser-selected" }),
    ConversationTurnError,
  );
});

test("deduplicates one client request identity and rejects changed content", async () => {
  let executions = 0;
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const turn = new ConversationTurn({
    scopes: {
      resolve: async (conversationId) => ({
        conversationId,
        projectId: "project-synthetic",
        workItemId: null,
        handoffId: null,
      }),
    },
    idempotency: memoryIdempotency(),
    executor: {
      execute: async () => {
        executions += 1;
        await blocked;
        return completed;
      },
    },
  });
  const firstPending = turn.run(request());
  const duplicatePending = turn.run(request());
  release!();
  const [first, duplicate] = await Promise.all([
    firstPending,
    duplicatePending,
  ]);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.result, first.result);
  assert.equal(executions, 1);
  await assert.rejects(
    () => turn.run(request({ userText: "Changed synthetic question." })),
    ConversationTurnConflictError,
  );
  assert.equal(executions, 1);
});

test("allows a conversation turn when work item and handoff are absent", async () => {
  let observedHandoff: string | null | undefined;
  const turn = new ConversationTurn({
    scopes: {
      resolve: async (conversationId) => ({
        conversationId,
        projectId: null,
        workItemId: null,
        handoffId: null,
      }),
    },
    idempotency: memoryIdempotency(),
    executor: {
      execute: async ({ scope }) => {
        observedHandoff = scope.handoffId;
        return completed;
      },
    },
  });
  const outcome = await turn.run(request({ projectId: null }));
  assert.equal(outcome.result.kind, "COMPLETED");
  assert.equal(observedHandoff, null);
});

function memoryIdempotency(): ConversationTurnIdempotency {
  const values = new Map<
    string,
    Readonly<{ digest: string; result: Promise<ConversationTurnResult> }>
  >();
  return {
    execute: async (
      claim: ConversationTurnClaim,
      operation: () => Promise<ConversationTurnResult>,
    ) => {
      const existing = values.get(claim.idempotencyKey);
      if (existing) {
        if (existing.digest !== claim.requestDigest)
          throw new ConversationTurnConflictError();
        return Object.freeze({
          duplicate: true,
          result: await existing.result,
        });
      }
      const pending = operation();
      values.set(
        claim.idempotencyKey,
        Object.freeze({ digest: claim.requestDigest, result: pending }),
      );
      const result = await pending;
      return Object.freeze({ duplicate: false, result });
    },
  };
}
