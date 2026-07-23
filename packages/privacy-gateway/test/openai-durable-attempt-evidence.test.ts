import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DurableAttemptEvidenceError,
  DurableFakeResponsesAdapter,
  JsonDurableAttemptEvidenceStore,
  durableAttemptDocumentPath,
  executeDurableSyntheticAttempt,
  measureDurableAttemptEvidenceCorpus,
} from "./openai-durable-attempt-evidence.ts";

const homes: string[] = [];

afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});

describe("OpenAI durable attempt evidence", () => {
  it("reproduces the frozen corpus in either execution order", async () => {
    const firstHome = await temporaryHome();
    const secondHome = await temporaryHome();
    const first = await measureDurableAttemptEvidenceCorpus(
      firstHome,
      "REFERENCE",
    );
    const second = await measureDurableAttemptEvidenceCorpus(
      secondHome,
      "REVERSED",
    );

    assert.deepEqual(first, second);
    assert.equal(first.caseCount, 29);
    assert.equal(first.passedCases, 29);
    assert.equal(first.incorrectCases, 0);
    assert.equal(first.maximumCreateCallsPerCase, 1);
    assert.equal(first.invalidPreExposureCalls, 0);
    assert.equal(first.scheduledRetries, 0);
    assert.equal(first.decision, "ADOPT_TEST_ONLY_DURABLE_ATTEMPT_EVIDENCE");
  });

  it("publishes and rereads exposure before invoking the adapter", async () => {
    const home = await temporaryHome();
    const store = new JsonDurableAttemptEvidenceStore(home);
    await store.prepare(input());
    const adapter = new DurableFakeResponsesAdapter();

    const completed = await executeDurableSyntheticAttempt({
      store,
      adapter,
      projectId: "project-synthetic",
      attemptId: "attempt-synthetic",
      mode: "COMPLETE",
    });

    assert.equal(completed.state, "COMPLETED");
    assert.equal(completed.exposureCount, 1);
    assert.equal(adapter.evidence().createCalls, 1);
    assert.equal(adapter.evidence().scheduledRetries, 0);
    const restarted = new JsonDurableAttemptEvidenceStore(home);
    assert.equal(
      (await restarted.inspect("project-synthetic", "attempt-synthetic")).state,
      "COMPLETED",
    );
  });

  it("turns a durable post-rename interruption into unknown without send", async () => {
    const home = await temporaryHome();
    await new JsonDurableAttemptEvidenceStore(home).prepare(input());
    const store = new JsonDurableAttemptEvidenceStore(home, {
      failAt: "AFTER_RENAME",
    });
    const adapter = new DurableFakeResponsesAdapter();

    await assert.rejects(
      executeDurableSyntheticAttempt({
        store,
        adapter,
        projectId: "project-synthetic",
        attemptId: "attempt-synthetic",
        mode: "COMPLETE",
      }),
      DurableAttemptEvidenceError,
    );

    assert.equal(adapter.evidence().createCalls, 0);
    const recovered = await new JsonDurableAttemptEvidenceStore(home).recover(
      "project-synthetic",
    );
    assert.equal(recovered.records.at(-1)?.state, "UNKNOWN_AFTER_EXPOSURE");
  });

  it("stores digests and exact allowlisted metadata, never bodies", async () => {
    const home = await temporaryHome();
    const store = new JsonDurableAttemptEvidenceStore(home);
    await store.prepare(input());
    await executeDurableSyntheticAttempt({
      store,
      adapter: new DurableFakeResponsesAdapter(),
      projectId: "project-synthetic",
      attemptId: "attempt-synthetic",
      mode: "COMPLETE",
    });
    const content = await readFile(
      durableAttemptDocumentPath(home, "project-synthetic"),
      "utf8",
    );

    assert.equal(content.includes("Synthetic bounded output."), false);
    assert.equal(content.includes("request-synthetic"), false);
    assert.equal(content.includes("response-synthetic"), false);
    assert.equal(content.includes("requestBody"), false);
    assert.equal(content.includes("responseBody"), false);
    assert.equal(content.includes("credential"), false);
    assert.equal(content.includes(home), false);
  });

  it("fails closed on unsafe permissions without exposing paths", async () => {
    const home = await temporaryHome();
    const store = new JsonDurableAttemptEvidenceStore(home);
    await store.prepare(input());
    await chmod(durableAttemptDocumentPath(home, "project-synthetic"), 0o644);

    await assert.rejects(
      store.inspect("project-synthetic", "attempt-synthetic"),
      (error: unknown) => {
        assert.ok(error instanceof DurableAttemptEvidenceError);
        assert.equal(error.message.includes(home), false);
        return true;
      },
    );
  });
});

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "aiw-durable-attempt-test-"));
  homes.push(home);
  return home;
}

function input() {
  return Object.freeze({
    projectId: "project-synthetic",
    authorizationId: "authorization-synthetic",
    attemptId: "attempt-synthetic",
    requestDigest: "a".repeat(64),
    authorizationDigest: "b".repeat(64),
    preflightAuditEventHash: "c".repeat(64),
  });
}
