import assert from "node:assert/strict";
import { appendFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { continuationFixture } from "./continuation-fixture.ts";

for (const change of [
  "none",
  "repository",
  "instructions",
  "handoff",
] as const) {
  test(`reviewed project turn with handoff: ${change}`, async () => {
    const sent: string[] = [];
    const f = await continuationFixture({
      send: async (input) => {
        sent.push(input.text);
        return {
          kind: "COMPLETED",
          text: "Synthetic project answer",
          requestId: "synthetic-request",
          responseId: "synthetic-response",
          usage: {
            inputTokens: null,
            cachedInputTokens: null,
            outputTokens: null,
          },
        };
      },
    });
    try {
      const config = await f.app.modelTargets.configure(
        {
          targetId: "review-target",
          displayName: "Synthetic project model",
          executionClass: "MODEL_DELIVERY",
          kind: "OPENAI_RESPONSES",
          modelId: f.target.model,
          boundary: "EXTERNAL_SERVICE",
          profileRef: f.target.profile.path,
          policyRef: f.target.policy.path,
          instructionRefs: f.target.bundles.map((bundle) => bundle.path),
          maxInputBytes: 262144,
          maxOutputBytes: 16384,
          enabled: true,
        },
        0,
      );
      await f.app.modelTargets.selectDefault("review-target", config.revision);
      const request = {
        ...f.query,
        targetId: "review-target",
        userText: "Continue the synthetic project",
        clientRequestId: "project-review",
      };
      const preview = await f.app.conversationTurns.previewTurnPayload({
        ...request,
        bindReview: true,
      });
      assert.equal(preview.kind, "READY");
      if (preview.kind !== "READY" || !preview.review)
        throw new Error("Missing project review");
      assert.equal(sent.length, 0);
      if (change === "repository")
        await appendFile(join(f.repository, "README.md"), "Changed source\n");
      if (change === "instructions")
        await appendFile(f.target.bundles[0]!.path, "\n");
      if (change === "handoff")
        await f.app.createHandoff({
          projectId: f.project.id,
          workItemId: f.work.id,
          sourceEventIds: [f.event.eventId],
          memoryIds: [],
          nextAction: "A new synthetic next step",
        });
      const result = await f.app.conversationTurns.run({
        ...request,
        reviewId: preview.review.id,
      });
      if (change === "none") {
        assert.equal(result.result.kind, "COMPLETED");
        assert.deepEqual(sent, [preview.protectedText]);
      } else {
        assert.deepEqual(result.result, {
          kind: "REFUSED_BEFORE_EXPOSURE",
          reason: "REVIEW_INVALID",
        });
        assert.equal(sent.length, 0);
      }
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
}
