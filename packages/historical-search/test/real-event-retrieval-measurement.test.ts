import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PROBE_FAMILIES,
  RECORD_SHAPES,
  RECORD_UNITS,
  REAL_EVENT_CORPUS_ID,
  SHAPE_VERDICTS,
  TOKENIZATIONS,
  TOKENIZATION_VERDICTS,
  UNIT_VERDICTS,
  buildUnitRecords,
  extractText,
  fingerprintDigest,
  measureRealEventRetrieval,
  readCanonicalEvents,
  readsAsCode,
  resolveWorkspaceHome,
  splitBlocks,
  withoutElapsed,
} from "../../../scripts/real-event-retrieval-measurement.ts";

/**
 * The harness reads a private local store, so these tests never read one. Every
 * assertion runs against a synthetic home built in a temporary directory, and
 * the absent-home path is asserted explicitly, so the suite passes on a machine
 * that has never run this product.
 */

/** A string placed in synthetic content, asserted never to reach the report. */
const CANARY = "canarino-che-non-deve-uscire-dal-processo";

test("reports an unreadable home instead of failing the run", async () => {
  await withHome(async (home) => {
    const report = await measureRealEventRetrieval(join(home, "absent"));
    assert.equal(report.corpusId, REAL_EVENT_CORPUS_ID);
    assert.equal(
      report.declaredConsumer,
      "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER",
    );
    assert.equal(report.homeReadable, false);
    assert.equal(report.fingerprint.canonicalEvents, 0);
    assert.deepEqual(report.cells, []);
    assert.equal(report.shape.verdict, "UNDECIDED_CORPUS_TOO_SMALL");
    assert.equal(report.unit.verdict, "UNDECIDED_CORPUS_TOO_SMALL");
    assert.equal(report.tokenization.verdict, "UNDECIDED_CORPUS_TOO_SMALL");
  });
});

test("withholds a verdict on a home too small to carry one", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 12);
    const report = await measureRealEventRetrieval(home);
    assert.equal(report.homeReadable, true);
    assert.equal(report.fingerprint.canonicalEvents, 12);
    assert.deepEqual(report.cells, []);
    for (const verdict of [
      report.shape.verdict,
      report.unit.verdict,
      report.tokenization.verdict,
    ])
      assert.equal(verdict, "UNDECIDED_CORPUS_TOO_SMALL");
    assert.equal(report.shape.indicativeOnly, true);
  });
});

test("measures every shape, unit and tokenization once", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 40);
    const report = await measureRealEventRetrieval(home);
    assert.equal(report.fingerprint.canonicalEvents, 40);
    assert.equal(
      report.cells.length,
      RECORD_SHAPES.length * RECORD_UNITS.length * TOKENIZATIONS.length,
    );
    const seen = new Set(
      report.cells.map(
        (cell) => `${cell.shape}/${cell.unit}/${cell.tokenization}`,
      ),
    );
    assert.equal(seen.size, report.cells.length);
    for (const cell of report.cells) {
      assert.ok(cell.records > 0);
      assert.ok(cell.distinctTerms > 0);
      assert.ok(cell.probes > 0);
      assert.ok(cell.families.length > 0);
      for (const family of cell.families)
        assert.ok(PROBE_FAMILIES.includes(family.family));
    }
    assert.ok(SHAPE_VERDICTS.includes(report.shape.verdict));
    assert.ok(UNIT_VERDICTS.includes(report.unit.verdict));
    assert.ok(TOKENIZATION_VERDICTS.includes(report.tokenization.verdict));
    assert.notEqual(report.shape.verdict, "UNDECIDED_CORPUS_TOO_SMALL");
  });
});

test("records that a serialized payload has no blocks to split on", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 40);
    const report = await measureRealEventRetrieval(home);
    const raw = report.fingerprint.shapes.find(
      (shape) => shape.shape === "RAW_PAYLOAD",
    );
    const extracted = report.fingerprint.shapes.find(
      (shape) => shape.shape === "EXTRACTED_TEXT",
    );
    assert.ok(raw !== undefined && extracted !== undefined);
    assert.equal(report.fingerprint.eventsParsedAsJson, 40);
    assert.equal(report.shape.payloadsParsedAsJsonPercent, 100);
    assert.equal(
      raw.multiBlockEvents,
      0,
      "a payload that is serialized JSON contains no blank line",
    );
    assert.ok(extracted.multiBlockEvents > 0);
    assert.ok(raw.bytesTotal > extracted.bytesTotal);
    assert.ok(
      raw.distinctProseTerms > extracted.distinctProseTerms,
      "provenance fields spend vocabulary the content does not need",
    );
    assert.equal(
      report.shape.verdict,
      "TEXT_EXTRACTION_REQUIRED_BEFORE_INDEXING",
    );
    /** Under the raw shape the unit axis collapses: nothing splits. */
    for (const unit of RECORD_UNITS) {
      const cell = report.cells.find(
        (entry) =>
          entry.shape === "RAW_PAYLOAD" &&
          entry.unit === unit &&
          entry.tokenization === "MODE_PER_QUERY",
      );
      assert.equal(cell?.records, 40);
    }
  });
});

test("keeps content, paths and identities out of the report", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 40);
    const report = await measureRealEventRetrieval(home);
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes(CANARY), "content reached the report");
    assert.ok(!serialized.includes(home), "a local path reached the report");
    assert.ok(!serialized.includes("event-"), "an event identifier reached it");
    assert.ok(!serialized.includes("session_"), "a session name reached it");
    assert.match(fingerprintDigest(report.fingerprint), /^[a-f0-9]{8}$/u);
  });
});

test("returns the same report twice for the same home", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 40);
    const first = await measureRealEventRetrieval(home);
    const second = await measureRealEventRetrieval(home);
    assert.deepEqual(withoutElapsed(first), withoutElapsed(second));
  });
});

test("resolves an artifact payload rather than skipping the long events", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 12, { withArtifact: true });
    const read = await readCanonicalEvents(home);
    assert.equal(read.events.length, 12);
    const fromArtifact = read.events.filter((event) => event.fromArtifact);
    assert.equal(fromArtifact.length, 1);
    assert.ok((fromArtifact[0]?.extracted.length ?? 0) > 0);
  });
});

test("reduces a payload to its content and keeps an unknown field", () => {
  const payload = JSON.stringify({
    recordUuid: "00000000-0000-4000-8000-000000000000",
    recordType: "assistant",
    isSidechain: false,
    isMeta: false,
    blockIndex: 0,
    blockType: "text",
    text: "prima riga\n\nseconda riga",
  });
  const reduced = extractText(payload);
  assert.equal(reduced.parsed, true);
  assert.equal(reduced.text, "prima riga\n\nseconda riga");
  assert.ok(!reduced.text.includes("recordUuid"));
  assert.deepEqual(splitBlocks(reduced.text), ["prima riga", "seconda riga"]);

  const future = extractText(
    JSON.stringify({ recordUuid: "u", nuovo: "testo" }),
  );
  assert.equal(future.parsed, true);
  assert.ok(
    future.text.includes("testo"),
    "an unexpected field is content until proven otherwise",
  );
});

test("degrades to the raw payload when it is not the expected object", () => {
  for (const payload of ["testo semplice", "[1,2,3]", "null", "12"]) {
    const reduced = extractText(payload);
    assert.equal(reduced.parsed, false);
    assert.equal(reduced.text, payload);
  }
});

test("never returns an empty block list", () => {
  assert.deepEqual(splitBlocks(""), [""]);
  assert.deepEqual(splitBlocks("\n\n\n"), [""]);
  assert.deepEqual(splitBlocks("  uno  "), ["uno"]);
});

test("reads a fenced or symbol-dense block as code", () => {
  assert.equal(readsAsCode("```ts\nconst a = 1;\n```"), true);
  assert.equal(readsAsCode("session.events.map((event) => event.id)"), true);
  assert.equal(
    readsAsCode(
      "questa frase parla di misure senza nominare nessun simbolo di codice",
    ),
    false,
  );
});

test("attributes every record to the event that owns it", async () => {
  await withHome(async (home) => {
    await writeSyntheticHome(home, 12);
    const read = await readCanonicalEvents(home);
    const owners = new Set(read.events.map((event) => event.id));
    for (const shape of RECORD_SHAPES)
      for (const unit of RECORD_UNITS) {
        const records = buildUnitRecords(read.events, unit, shape);
        assert.ok(records.length >= read.events.length);
        for (const record of records) {
          assert.ok(owners.has(record.path));
          assert.ok(record.body.length > 0);
        }
      }
  });
});

test("prefers an explicit home to the ambient one", () => {
  assert.equal(resolveWorkspaceHome("/somewhere/else"), "/somewhere/else");
  assert.ok(resolveWorkspaceHome().length > 0);
});

async function withHome(run: (home: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-real-event-"));
  try {
    await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

/**
 * A home shaped like the real one: a project registry, one session document
 * holding canonical events, and an optional artifact payload. Content is
 * generated so that every event owns terms no other event has, which is what
 * makes a generated known-item probe have one answer.
 */
async function writeSyntheticHome(
  home: string,
  events: number,
  options: Readonly<{ withArtifact?: boolean }> = {},
): Promise<void> {
  await mkdir(join(home, "sessions"), { recursive: true });
  await writeFile(
    join(home, "projects.json"),
    JSON.stringify({ projects: [{ id: "project-1" }] }),
    "utf8",
  );

  const types = ["USER_MESSAGE", "AGENT_MESSAGE", "TOOL_CALL", "TOOL_RESULT"];
  const list: unknown[] = [];

  for (let index = 0; index < events; index += 1) {
    const text = syntheticText(index);
    const payload = JSON.stringify({
      recordUuid: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      recordType: "assistant",
      isSidechain: false,
      isMeta: false,
      blockIndex: 0,
      blockType: "text",
      text,
    });

    let stored: unknown = { kind: "INLINE_TEXT", text: payload };
    if (options.withArtifact === true && index === 0) {
      const digest = createHash("sha256").update(payload, "utf8").digest("hex");
      await mkdir(join(home, "artifacts", "sha256", digest.slice(0, 2)), {
        recursive: true,
      });
      await writeFile(
        join(home, "artifacts", "sha256", digest.slice(0, 2), digest),
        payload,
        "utf8",
      );
      stored = {
        kind: "ARTIFACT",
        artifact: { id: `artifact://sha256/${digest}` },
        mediaType: "application/json",
      };
    }

    list.push({
      id: `event-${index}`,
      sessionId: "session-1",
      sequence: index,
      type: types[index % types.length],
      occurredAt: `2026-07-26T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
      trust: "UNTRUSTED",
      payload: stored,
      source: { adapter: "synthetic" },
    });
  }

  const name = `session_${"a".repeat(64)}.json`;
  await writeFile(
    join(home, "sessions", name),
    JSON.stringify({
      schemaVersion: 1,
      session: { id: "session-1", events: list },
    }),
    "utf8",
  );
}

/**
 * Three paragraphs, so the extracted shape has blocks while the serialized
 * payload has none. Two invented words and one identifier per event are unique
 * by construction; the rest is filler shared by every event.
 */
function syntheticText(index: number): string {
  const tag = String(index).padStart(3, "0");
  const first = [
    `Questa misura osserva il termine zaltrone${tag} in un solo evento.`,
    "Il resto della frase è riempitivo condiviso da tutti gli eventi.",
  ].join(" ");
  const second = [
    "```ts",
    `const resultOf${tag} = buildIndex(records, "PROSE");`,
    "```",
    index === 0 ? CANARY : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
  const third = [
    `La conclusione nomina di nuovo brenzatura${tag} una volta sola.`,
    "Anche qui il contorno è comune a ogni record del corpus sintetico.",
  ].join(" ");
  return [first, second, third].join("\n\n");
}
