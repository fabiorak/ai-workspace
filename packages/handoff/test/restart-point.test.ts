import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { draftNextAction } from "../src/restart-point.ts";

describe("the next-action draft a composed restart point carries", () => {
  it("is the person's own text, quoted, with nothing written around it", () => {
    const draft = draftNextAction({
      objective: "Show what it would take to pick this up again",
      lastQuestion: "Compose the restart point",
    });
    assert.equal(
      draft.text,
      "Show what it would take to pick this up again\n\nCompose the restart point",
    );
    assert.deepEqual(draft.assembledFrom, [
      "WORK_ITEM_OBJECTIVE",
      "LAST_QUESTION",
    ]);
  });

  it("always says it needs review, so nothing can present it as settled", () => {
    assert.equal(
      draftNextAction({ objective: "One objective", lastQuestion: null })
        .needsReview,
      true,
    );
  });

  it("is the objective alone when nothing was asked", () => {
    const draft = draftNextAction({
      objective: "One objective",
      lastQuestion: null,
    });
    assert.equal(draft.text, "One objective");
    assert.deepEqual(draft.assembledFrom, ["WORK_ITEM_OBJECTIVE"]);
  });

  it("collapses a question's own line breaks, which are not structure here", () => {
    assert.equal(
      draftNextAction({
        objective: "One objective",
        lastQuestion: "  first line\n\n  second line  ",
      }).text,
      "One objective\n\nfirst line second line",
    );
  });

  /**
   * A question long enough to fill the field would push the objective out of
   * sight, so it is cut at a word boundary and marked as cut. A cut mid-word
   * reads as a typo rather than as a truncation.
   */
  it("cuts a long question at a word boundary and says it was cut", () => {
    const draft = draftNextAction({
      objective: "One objective",
      lastQuestion: `${"word ".repeat(200)}end`,
    });
    assert.match(draft.text, /word…$/u);
    assert.equal(draft.text.includes("end"), false);
    assert.ok(draft.text.length < 600);
  });

  /** The objective is the part nobody else can restate, so it is never the part dropped. */
  it("keeps the objective whole and leaves the question out when both will not fit", () => {
    const objective = "o".repeat(4_000);
    const draft = draftNextAction({
      objective,
      lastQuestion: "q".repeat(400),
    });
    assert.equal(draft.text, objective);
    assert.deepEqual(draft.assembledFrom, ["WORK_ITEM_OBJECTIVE"]);
  });

  it("refuses to draft without the objective instead of inventing one", () => {
    assert.throws(
      () => draftNextAction({ objective: "   ", lastQuestion: "Anything" }),
      /objective/u,
    );
  });
});
