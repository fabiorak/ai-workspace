import assert from "node:assert/strict";
import { appendFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, test } from "node:test";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { conversationTurnArea } from "../src/conversation-turn-area.ts";
import { TURN_REVIEW_TTL_MS } from "../src/turn-review.ts";
import { turnReviewFixture } from "./turn-review-fixture.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});

test("ordinary send rejects a target disabled during composition before exposure", async () => {
  const f = await turnReviewFixture(roots);
  f.state.onRead = async () => {
    f.state.target = {
      ...f.state.target,
      target: { ...f.state.target.target, enabled: false },
    };
  };
  const outcome = await f.area.run(f.request);
  assert.equal(outcome.result.kind, "REFUSED_BEFORE_EXPOSURE");
  assert.equal(f.state.sent.length, 0);
});

async function prepare(f: Awaited<ReturnType<typeof turnReviewFixture>>) {
  const preview = await f.area.previewTurnPayload({
    ...f.request,
    bindReview: true,
  });
  assert.equal(preview.kind, "READY");
  if (preview.kind !== "READY" || !preview.review)
    throw new Error("Review missing");
  assert.ok(preview.protectedText);
  return {
    ...preview,
    review: preview.review,
    protectedText: preview.protectedText,
    request: { ...f.request, reviewId: preview.review.id },
  };
}

test("bound review sends the exact protected bytes, makes no preview audit/attempt, and preserves durable replay", async () => {
  const f = await turnReviewFixture(roots);
  f.request.userText = "Continue with invented@example.invalid";
  const preview = await prepare(f);
  assert.equal(f.state.sent.length, 0);
  for (const path of [
    "turn-privacy-audit",
    "model-attempts",
    "conversation-turns",
  ])
    await assert.rejects(stat(join(f.home, path)), { code: "ENOENT" });
  assert.equal(
    preview.protectedText.includes("invented@example.invalid"),
    false,
  );
  assert.equal(
    createHash("sha256").update(preview.protectedText).digest("hex"),
    preview.review.payloadDigest,
  );
  const result = await f.area.run(preview.request);
  assert.equal(result.result.kind, "COMPLETED");
  assert.deepEqual(f.state.sent, [preview.protectedText]);
  f.state.now += TURN_REVIEW_TTL_MS;
  const duplicate = await conversationTurnArea(f.dependencies).run(
    preview.request,
  );
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.result, result.result);
  assert.equal(f.state.sent.length, 1);
});

for (const changed of [
  "source",
  "policy",
  "profile",
  "instructions",
  "mapping",
  "target",
  "selection",
  "limits",
  "unreadable-policy",
] as const) {
  test(`invalidates a bound preview after ${changed} changes without exposure`, async () => {
    const f = await turnReviewFixture(roots);
    const preview = await prepare(f);
    if (changed === "source")
      await f.general.appendTurn({
        conversationId: f.request.conversationId,
        expectedEventCount: 0,
        userText: "Another invented question",
        assistantText: "Another invented answer",
        attemptId: "other-attempt",
        displayName: "Synthetic",
        model: "model-b",
        targetId: "target-b",
      });
    // Byte-only config changes must invalidate too, even with identical rules.
    if (changed === "policy") await appendFile(f.refs.policyRef, "\n");
    if (changed === "unreadable-policy") await writeFile(f.refs.policyRef, "{");
    if (changed === "profile") await appendFile(f.refs.profileRef, "\n");
    if (changed === "instructions")
      await appendFile(f.refs.instructionRefs[0]!, "\n");
    if (changed === "mapping")
      await f.area.addProtectedTerm({
        conversationId: f.request.conversationId,
        term: "Invented Name",
        type: "PERSON",
      });
    if (changed === "target")
      f.state.target = {
        ...f.state.target,
        target: { ...f.state.target.target, enabled: false },
      };
    if (changed === "selection")
      f.state.target = { ...f.state.target, selectedBy: "CONVERSATION" };
    if (changed === "limits")
      f.state.target = {
        ...f.state.target,
        target: { ...f.state.target.target, maxOutputBytes: 8192 },
      };
    const result = await f.area.run(preview.request);
    assert.deepEqual(result.result, {
      kind: "REFUSED_BEFORE_EXPOSURE",
      reason: "REVIEW_INVALID",
    });
    assert.equal(f.state.sent.length, 0);
    await assert.rejects(stat(join(f.home, "model-attempts")), {
      code: "ENOENT",
    });
  });
}

for (const invalid of [
  "expired",
  "other-conversation",
  "changed-draft",
  "restart",
  "missing",
] as const) {
  test(`rejects a ${invalid} review before any exposure`, async () => {
    const f = await turnReviewFixture(roots);
    const preview = await prepare(f);
    const request = { ...preview.request };
    if (invalid === "expired") f.state.now += TURN_REVIEW_TTL_MS;
    if (invalid === "other-conversation") request.conversationId = "review-two";
    if (invalid === "changed-draft") request.userText += " changed";
    if (invalid === "missing")
      request.reviewId = "00000000-0000-4000-8000-000000000000";
    const area =
      invalid === "restart" ? conversationTurnArea(f.dependencies) : f.area;
    const result = await area.run(request);
    assert.deepEqual(result.result, {
      kind: "REFUSED_BEFORE_EXPOSURE",
      reason: "REVIEW_INVALID",
    });
    assert.equal(f.state.sent.length, 0);
  });
}

test("one review cannot authorize two different gestures concurrently or be reused later", async () => {
  const f = await turnReviewFixture(roots);
  const preview = await prepare(f);
  const results = await Promise.all([
    f.area.run(preview.request),
    f.area.run({ ...preview.request, clientRequestId: "gesture-two" }),
  ]);
  assert.equal(
    results.filter((result) => result.result.kind === "COMPLETED").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.result.kind === "REFUSED_BEFORE_EXPOSURE")
      .length,
    1,
  );
  const reused = await f.area.run({
    ...preview.request,
    clientRequestId: "gesture-three",
  });
  assert.deepEqual(reused.result, {
    kind: "REFUSED_BEFORE_EXPOSURE",
    reason: "REVIEW_INVALID",
  });
  assert.equal(f.state.sent.length, 1);
});

test("ordinary send rereads selection and authoritative scope after composition", async () => {
  for (const changed of ["selection", "scope"] as const) {
    const f = await turnReviewFixture(roots);
    f.state.onRead = async () => {
      if (changed === "selection")
        f.state.target = { ...f.state.target, selectedBy: "CONVERSATION" };
      else f.dependencies.conversations.notes.list = async () => [];
    };
    const result = await f.area.run(f.request);
    assert.equal(result.result.kind, "REFUSED_BEFORE_EXPOSURE");
    assert.equal(f.state.sent.length, 0);
  }
});

test("rechecks review expiry, selection, scope and configuration after durable preparation, before exposure claim", async (t) => {
  for (const changed of [
    "expiry",
    "selection",
    "scope",
    "policy",
    "instructions",
    "source",
  ] as const) {
    const f = await turnReviewFixture(roots);
    const preview = await prepare(f);
    const original = JsonModelAttemptStore.prototype.prepare;
    const hook = t.mock.method(
      JsonModelAttemptStore.prototype,
      "prepare",
      async function (
        this: JsonModelAttemptStore,
        input: Parameters<typeof original>[0],
      ) {
        const result = await original.call(this, input);
        if (changed === "expiry") f.state.now += TURN_REVIEW_TTL_MS;
        if (changed === "selection")
          f.state.target = { ...f.state.target, selectedBy: "CONVERSATION" };
        if (changed === "scope")
          f.dependencies.conversations.notes.list = async () => [];
        if (changed === "policy") await appendFile(f.refs.policyRef, "\n");
        if (changed === "instructions")
          await appendFile(f.refs.instructionRefs[0]!, "\n");
        if (changed === "source")
          await f.general.appendTurn({
            conversationId: f.request.conversationId,
            expectedEventCount: 0,
            userText: "Concurrent invented question",
            assistantText: "Concurrent invented answer",
            attemptId: "concurrent-attempt",
            displayName: "Synthetic",
            model: "model-b",
            targetId: "target-b",
          });
        return result;
      },
    );
    try {
      const result = await f.area.run(preview.request);
      assert.deepEqual(result.result, {
        kind: "REFUSED_BEFORE_EXPOSURE",
        reason: "REVIEW_INVALID",
      });
      assert.equal(f.state.sent.length, 0);
      const project = `general-${createHash("sha256").update(f.request.conversationId).digest("hex")}`;
      const evidence = await new JsonModelAttemptStore(f.home).list(project);
      assert.equal(evidence.records.at(-1)?.state, "PREPARED");
      assert.equal(evidence.records.at(-1)?.exposureCount, 0);
    } finally {
      hook.mock.restore();
    }
  }
});
