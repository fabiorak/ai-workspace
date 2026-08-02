import assert from "node:assert/strict";
import test from "node:test";

import { composeRestartSummary } from "../src/restart-summary.ts";

const PROJECT = {
  projectName: "Fictional Workspace",
  branch: "main",
  headCommit: "abc1234",
  isDirty: false,
} as const;

test("carries where every claim came from", () => {
  const summary = composeRestartSummary({
    ...PROJECT,
    question: "cosa abbiamo deciso sui totali",
    decisions: [
      {
        content: "Totals are computed once and cached",
        verification: "VERIFIED",
        sourceEventId: "event-1",
      },
      {
        content: "The budget stays at 150 ms",
        verification: "UNVERIFIED",
        sourceEventId: null,
      },
    ],
    findings: [
      {
        eventId: "event-9",
        occurredAt: "2026-01-15T09:00:00.000Z",
        snippet: "…the totals were recomputed on every request…",
        why: '"totali" reached "totals"',
      },
    ],
  });

  /**
   * A summary whose lines cannot be traced back is exactly the material a
   * second assistant would restate as fact, so provenance is not optional.
   */
  assert.match(summary.text, /from event event-1/u);
  assert.match(summary.text, /authored directly/u);
  assert.match(summary.text, /event event-9/u);
  assert.match(summary.text, /matched because "totali" reached "totals"/u);
  assert.match(summary.text, /branch: main/u);
  assert.match(summary.text, /working tree: clean/u);
  assert.deepEqual(summary.omissions, []);
});

test("says what it left out instead of looking complete", () => {
  const summary = composeRestartSummary({
    ...PROJECT,
    question: null,
    decisions: Array.from({ length: 25 }, (_, index) => ({
      content: `Decision ${index}`,
      verification: "VERIFIED" as const,
      sourceEventId: null,
    })),
    findings: Array.from({ length: 14 }, (_, index) => ({
      eventId: `event-${index}`,
      occurredAt: null,
      snippet: `finding ${index}`,
      why: "exact",
    })),
  });

  assert.match(summary.text, /## Not included/u);
  assert.ok(
    summary.omissions.some((omission) => /5 further decision/u.test(omission)),
  );
  assert.ok(
    summary.omissions.some((omission) => /4 further result/u.test(omission)),
  );
});

test("stays inside its byte budget and reports the exact size", () => {
  const summary = composeRestartSummary({
    ...PROJECT,
    question: null,
    decisions: Array.from({ length: 20 }, (_, index) => ({
      content: `Decision ${index} `.repeat(60),
      verification: "VERIFIED" as const,
      sourceEventId: null,
    })),
    findings: [],
  });

  assert.ok(summary.exactBytes <= 8_000, "budget holds");
  assert.equal(summary.exactBytes, Buffer.byteLength(summary.text, "utf8"));
  assert.ok(
    summary.omissions.some((omission) => /byte budget/u.test(omission)),
    "the truncation is stated",
  );
  /** What a second assistant cannot reconstruct is the last thing dropped. */
  assert.match(summary.text, /# Restarting work on Fictional Workspace/u);
});

test("says it is a summary and not an instruction", () => {
  const summary = composeRestartSummary({
    ...PROJECT,
    question: null,
    decisions: [],
    findings: [],
  });

  assert.match(summary.text, /not an instruction to act/u);
  assert.match(summary.text, /Nothing in it was\nsent anywhere/u);
});
