import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BuiltInPiiDetector,
  emptyStablePseudonymMap,
  protectWithStablePseudonyms,
  restoreStablePseudonyms,
} from "../src/index.ts";

describe("automatic stable pseudonymization", () => {
  it("detects UTF-8 spans and reuses readable typed placeholders", async () => {
    const detector = new BuiltInPiiDetector();
    const firstText = "Scrivi a anna.rossi@example.test per il progetto città.";
    const first = protectWithStablePseudonyms({
      text: firstText,
      spans: await detector.detect(firstText, "it"),
      mapping: emptyStablePseudonymMap("PROJECT:synthetic"),
    });
    assert.equal(first.text, "Scrivi a [[EMAIL_1]] per il progetto città.");
    const secondText = "Rispondi ancora ad anna.rossi@example.test.";
    const second = protectWithStablePseudonyms({
      text: secondText,
      spans: await detector.detect(secondText, "it"),
      mapping: first.mapping,
    });
    assert.equal(second.text, "Rispondi ancora ad [[EMAIL_1]].");
    assert.equal(second.mapping.revision, first.mapping.revision);
    assert.equal(
      restoreStablePseudonyms("Fatto per [[EMAIL_1]].", second.mapping),
      "Fatto per anna.rossi@example.test.",
    );
  });

  it("fails closed for overlaps, type conflicts, and unknown placeholders", async () => {
    const text = "anna@example.test";
    const detector = new BuiltInPiiDetector();
    const spans = await detector.detect(text);
    assert.throws(() =>
      protectWithStablePseudonyms({
        text,
        mapping: emptyStablePseudonymMap("GENERAL"),
        spans: [
          ...spans,
          {
            startUtf8: 0,
            endUtf8: 4,
            type: "PERSON",
            confidence: 0.5,
            detector: "SYNTHETIC",
          },
        ],
      }),
    );
    const protectedValue = protectWithStablePseudonyms({
      text,
      spans,
      mapping: emptyStablePseudonymMap("GENERAL"),
    });
    assert.throws(() =>
      restoreStablePseudonyms("[[EMAIL_999]]", protectedValue.mapping),
    );
  });
});
