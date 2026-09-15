import assert from "node:assert/strict";
import test from "node:test";

import { BuiltInPiiDetector } from "../src/index.ts";
import { buildRizzoPiiEvaluationCorpus } from "../../../scripts/rizzo-pii-evaluation-corpus.ts";
import {
  createRizzoPiiSpikeDetector,
  evaluateRizzoPii,
  RizzoPiiSpikeError,
  spansFromRizzoSegments,
} from "../../../scripts/rizzo-pii-evaluation.ts";

test("builds a bounded entirely synthetic bilingual corpus with exact UTF-8 truth", () => {
  const corpus = buildRizzoPiiEvaluationCorpus();
  assert.equal(corpus.length, 140);
  assert.deepEqual(
    new Set(corpus.map((fixture) => fixture.language)),
    new Set(["it", "en"]),
  );
  assert.equal(
    new Set(corpus.map((fixture) => fixture.id)).size,
    corpus.length,
  );
  assert.equal(
    corpus.filter((fixture) => fixture.expected.length === 0).length,
    30,
  );
  for (const fixture of corpus) {
    assert.ok(Buffer.byteLength(fixture.text, "utf8") < 1_024);
    for (const truth of fixture.expected) {
      const selected = Buffer.from(fixture.text, "utf8")
        .subarray(truth.startUtf8, truth.endUtf8)
        .toString("utf8");
      assert.ok(selected.length > 0);
      assert.ok(selected.isWellFormed());
      assert.equal(
        Buffer.byteLength(selected, "utf8"),
        truth.endUtf8 - truth.startUtf8,
      );
    }
  }
});

test("reconstructs Rizzo ordered segments as provider-neutral UTF-8 spans", () => {
  const spans = spansFromRizzoSegments([
    { t: "Prè " },
    { t: "Alma Virelli", label: "FULLNAME", validated: false },
    { t: ", " },
    { t: "IT02X0000000000000000000000", label: "IBAN", validated: true },
  ]);
  assert.deepEqual(spans, [
    {
      startUtf8: Buffer.byteLength("Prè ", "utf8"),
      endUtf8: Buffer.byteLength("Prè Alma Virelli", "utf8"),
      type: "PERSON",
      confidence: 0,
      detector: "RIZZO_PII_2.0.0_MODEL_1.5.0",
    },
    {
      startUtf8: Buffer.byteLength("Prè Alma Virelli, ", "utf8"),
      endUtf8: Buffer.byteLength(
        "Prè Alma Virelli, IT02X0000000000000000000000",
        "utf8",
      ),
      type: "IBAN",
      confidence: 1,
      detector: "RIZZO_PII_2.0.0_MODEL_1.5.0",
    },
  ]);
});

test("fails closed on unknown labels, missing source text and non-loopback endpoints", () => {
  assert.throws(
    () =>
      spansFromRizzoSegments([
        { t: "value", label: "NEW_TAG", validated: false },
      ]),
    RizzoPiiSpikeError,
  );
  assert.throws(
    () => spansFromRizzoSegments([{ label: "FULLNAME", validated: false }]),
    RizzoPiiSpikeError,
  );
  for (const endpoint of [
    "https://127.0.0.1:5005",
    "http://localhost:5005",
    "http://192.0.2.1:5005",
    "http://127.0.0.1:5005/analyze",
  ])
    assert.throws(
      () => createRizzoPiiSpikeDetector(endpoint),
      RizzoPiiSpikeError,
    );
});

test("records a built-in baseline while leaving Rizzo and the production default unchanged", async () => {
  const before = await new BuiltInPiiDetector().detect(
    "mail test@example.invalid",
  );
  const report = await evaluateRizzoPii({
    now: new Date("2026-09-15T00:00:00.000Z"),
  });
  const after = await new BuiltInPiiDetector().detect(
    "mail test@example.invalid",
  );
  assert.deepEqual(after, before);
  assert.equal(report.corpus.fixtures, 140);
  assert.equal(report.builtIn.status, "MEASURED");
  assert.deepEqual(report.rizzo, {
    status: "NOT_RUN",
    reason: "NO_ENDPOINT_REQUESTED",
  });
  assert.equal(report.decision, "RIZZO_NOT_RUN_DEFAULT_UNCHANGED");
  assert.equal(
    report.effect,
    "DEVELOPMENT_ONLY_DEFAULT_DETECTOR_UNCHANGED_NO_PROVIDER_OR_PRODUCTION_SIDE_CAR",
  );
  const encoded = JSON.stringify(report);
  for (const secret of ["Alma Virelli", "utente0@", "/srv/synthetic"])
    assert.equal(encoded.includes(secret), false);
});

test("keeps the international prefix inside built-in telephone UTF-8 spans", async () => {
  const prefix = "Chiamare ";
  const telephone = "+39 333 5551000";
  const [span] = await new BuiltInPiiDetector().detect(
    `${prefix}${telephone}.`,
  );
  assert.ok(span);
  assert.deepEqual(span, {
    startUtf8: Buffer.byteLength(prefix, "utf8"),
    endUtf8: Buffer.byteLength(`${prefix}${telephone}`, "utf8"),
    type: "PHONE",
    confidence: 0.93,
    detector: "BUILT_IN_DETERMINISTIC_V1",
  });
});
