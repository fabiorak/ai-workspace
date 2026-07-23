import assert from "node:assert/strict";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { ModelAttemptError, ModelAttempts } from "@ai-workspace/model-attempts";

import { JsonModelAttemptStore } from "../src/index.ts";

const homes: string[] = [];

afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});

describe("JsonModelAttemptStore", () => {
  it("persists the durable lifecycle and recovers uncertainty", async () => {
    const home = await temporaryHome();
    const attempts = new ModelAttempts(new JsonModelAttemptStore(home));
    await attempts.prepare(input());
    await attempts.claimExposure("project-synthetic", "attempt-synthetic");

    const restarted = new ModelAttempts(new JsonModelAttemptStore(home));
    const recovered = await restarted.recover("project-synthetic");

    assert.equal(recovered.records.at(-1)?.state, "UNKNOWN_AFTER_EXPOSURE");
    assert.equal(recovered.records.at(-1)?.automaticRetryScheduled, false);
  });

  it("allows one concurrent claim and fails the other closed", async () => {
    const home = await temporaryHome();
    await new ModelAttempts(new JsonModelAttemptStore(home)).prepare(input());
    const results = await Promise.allSettled([
      new ModelAttempts(new JsonModelAttemptStore(home)).claimExposure(
        "project-synthetic",
        "attempt-synthetic",
      ),
      new ModelAttempts(new JsonModelAttemptStore(home)).claimExposure(
        "project-synthetic",
        "attempt-synthetic",
      ),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
  });

  it("fails closed on unsafe permissions without path disclosure", async () => {
    const home = await temporaryHome();
    const attempts = new ModelAttempts(new JsonModelAttemptStore(home));
    await attempts.prepare(input());
    const directory = join(home, "model-attempts");
    await chmod(directory, 0o755);

    await assert.rejects(
      attempts.list("project-synthetic"),
      (error: unknown) => {
        assert.ok(error instanceof ModelAttemptError);
        assert.equal(error.message.includes(home), false);
        return true;
      },
    );
  });
});

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "aiw-model-attempt-store-"));
  homes.push(home);
  return home;
}

function input() {
  return Object.freeze({
    schemaVersion: 1 as const,
    projectId: "project-synthetic",
    authorizationId: "authorization-synthetic",
    attemptId: "attempt-synthetic",
    providerKind: "OPENAI_RESPONSES" as const,
    requestDigest: "a".repeat(64),
    authorizationDigest: "b".repeat(64),
    preflightAuditEventHash: "c".repeat(64),
  });
}
