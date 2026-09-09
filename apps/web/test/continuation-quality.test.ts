import assert from "node:assert/strict";
import { test } from "node:test";
import { measureContinuationQuality } from "./continuation-quality-fixture.ts";

test("offline continuity report exposes missing evidence without treating a successful API call as quality", async () => {
  const report = await measureContinuationQuality();
  assert.equal(report.scenarios.length, 6);
  assert.equal(
    report.gate,
    "PASS",
    "All six independent evidence requirements must reach the proposal",
  );
  assert.equal(report.providerCalls, 0);
  assert.ok(report.repositoryChangeDetected);
  assert.ok(report.privacyOriginalAbsent);
  for (const row of report.scenarios) {
    assert.equal(
      row.passed,
      row.missing.length === 0 && row.forbidden.length === 0,
    );
    assert.ok(row.missing.every((value) => row.required.includes(value)));
  }
  assert.equal(
    report.gate,
    report.scenarios.every((row) => row.passed) ? "PASS" : "FAIL",
  );
});
