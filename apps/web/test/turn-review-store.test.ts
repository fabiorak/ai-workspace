import assert from "node:assert/strict";
import { test } from "node:test";
import { TurnReviews, TURN_REVIEW_TTL_MS } from "../src/turn-review.ts";

const request = {
  conversationId: "synthetic",
  projectId: null,
  targetId: "fake",
  userText: "invented",
};
test("review preparations bound retained bytes and capacity without evicting a valid approval", () => {
  let now = 0;
  const store = new TurnReviews(() => now);
  assert.throws(
    () => store.prepare(request, "binding", "é".repeat(131073)),
    /UNAVAILABLE/u,
  );
  const reviews = Array.from({ length: 32 }, () =>
    store.prepare(request, "binding", "protected"),
  );
  assert.throws(
    () => store.prepare(request, "binding", "extra"),
    /UNAVAILABLE/u,
  );
  assert.equal(store.consume(reviews[0]!.id, request).text, "protected");
  assert.throws(() => store.consume(reviews[0]!.id, request), /INVALID/u);
  now += TURN_REVIEW_TTL_MS;
  const fresh = store.prepare(request, "binding", "fresh");
  assert.throws(() => store.consume(reviews[1]!.id, request), /INVALID/u);
  assert.equal(store.consume(fresh.id, request).text, "fresh");
});

test("failed cross-scope consumption cannot be repurposed into an approval", () => {
  const store = new TurnReviews(() => 0);
  const review = store.prepare(request, "binding", "protected");
  assert.throws(
    () => store.consume(review.id, { ...request, projectId: "other-project" }),
    /INVALID/u,
  );
  assert.throws(() => store.consume(review.id, request), /INVALID/u);
});
