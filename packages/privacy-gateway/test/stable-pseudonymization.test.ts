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

  it("numbers distinct values of one type in one text and across texts", async () => {
    const detector = new BuiltInPiiDetector();
    const firstText =
      "Scrivi a anna.rossi@example.test e a luca.bianchi@example.test.";
    const first = protectWithStablePseudonyms({
      text: firstText,
      spans: await detector.detect(firstText, "it"),
      mapping: emptyStablePseudonymMap("GENERAL"),
    });
    assert.equal(first.text, "Scrivi a [[EMAIL_1]] e a [[EMAIL_2]].");
    assert.equal(first.mapping.entries.length, 2);
    const secondText =
      "Poi anna.rossi@example.test inoltra a marta.verdi@example.test.";
    const second = protectWithStablePseudonyms({
      text: secondText,
      spans: await detector.detect(secondText, "it"),
      mapping: first.mapping,
    });
    assert.equal(second.text, "Poi [[EMAIL_1]] inoltra a [[EMAIL_3]].");
    assert.equal(second.mapping.revision, first.mapping.revision + 1);
    assert.equal(
      restoreStablePseudonyms(
        "[[EMAIL_3]] risponde a [[EMAIL_2]].",
        second.mapping,
      ),
      "marta.verdi@example.test risponde a luca.bianchi@example.test.",
    );
  });

  it("continues numbering past nine and past a second type", () => {
    let mapping = emptyStablePseudonymMap("GENERAL");
    for (let index = 1; index <= 11; index += 1) {
      const text = `u${index}@example.test`;
      const result = protectWithStablePseudonyms({
        text,
        spans: [
          {
            startUtf8: 0,
            endUtf8: Buffer.byteLength(text, "utf8"),
            type: "EMAIL",
            confidence: 1,
            detector: "TEST",
          },
        ],
        mapping,
      });
      assert.equal(result.text, `[[EMAIL_${index}]]`);
      mapping = result.mapping;
    }
    const phone = protectWithStablePseudonyms({
      text: "x",
      spans: [
        {
          startUtf8: 0,
          endUtf8: 1,
          type: "PHONE",
          confidence: 1,
          detector: "TEST",
        },
      ],
      mapping,
    });
    assert.equal(phone.text, "[[TELEFONO_1]]");
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
