import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, it } from "node:test";

import {
  AgentAttemptError,
  AgentAttempts,
  type AgentAttemptInput,
} from "@ai-workspace/agent-execution";
import { JsonAgentAttemptStore } from "../src/index.ts";

const run = promisify(execFile);
const AT = "2026-09-28T10:00:00.000Z";
const homes: string[] = [];
afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});

describe("JsonAgentAttemptStore", () => {
  it("persists a private hash-chained document separate from model attempts", async () => {
    const home = await temporaryHome();
    const attempts = new AgentAttempts(new JsonAgentAttemptStore(home));
    await attempts.prepare(input("attempt-a"));
    await attempts.prepare(input("attempt-b"));
    await attempts.claimExecution("project-one", "attempt-a", AT);
    await attempts.complete(
      "project-one",
      "attempt-a",
      "Synthetic answer",
      null,
      AT,
    );
    await attempts.claimExecution("project-one", "attempt-b", AT);
    await attempts.markUnknown("project-one", "attempt-b", AT);
    const directory = join(home, "agent-attempts");
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    const [name] = await readdir(directory);
    assert.match(name!, /^scope_[a-f0-9]{64}\.json$/u);
    const path = join(directory, name!);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    const content = await readFile(path, "utf8");
    assert.doesNotMatch(
      content,
      /Synthetic answer|project-one\/|stdin|stdout/u,
    );
    const snapshot = await attempts.list("project-one");
    assert.equal(snapshot.revision, 6);
    assert.deepEqual(
      snapshot.records.map((entry) => [entry.attemptId, entry.state]),
      [
        ["attempt-a", "PREPARED"],
        ["attempt-b", "PREPARED"],
        ["attempt-a", "EXECUTION_STARTED"],
        ["attempt-a", "COMPLETED"],
        ["attempt-b", "EXECUTION_STARTED"],
        ["attempt-b", "UNKNOWN_AFTER_EXECUTION"],
      ],
    );
    await assert.rejects(readdir(join(home, "model-attempts")), {
      code: "ENOENT",
    });
    assert.equal((await attempts.list("another-scope")).records.length, 0);
    await assert.rejects(
      attempts.inspect("another-scope", "attempt-a"),
      AgentAttemptError,
    );
  });

  it("refuses reused identities and transitions the state machine forbids", async () => {
    const home = await temporaryHome();
    const attempts = new AgentAttempts(new JsonAgentAttemptStore(home));
    await attempts.prepare(input("attempt-a"));
    await assert.rejects(
      attempts.prepare(input("attempt-a")),
      AgentAttemptError,
    );
    await assert.rejects(
      attempts.prepare({
        ...input("attempt-c"),
        authorizationId: "authorization-attempt-a",
      }),
      AgentAttemptError,
    );
    await assert.rejects(
      attempts.complete("project-one", "attempt-a", "early", null, AT),
      AgentAttemptError,
    );
    await attempts.claimExecution("project-one", "attempt-a", AT);
    await assert.rejects(
      attempts.claimExecution("project-one", "attempt-a", AT),
      AgentAttemptError,
    );
    await assert.rejects(
      attempts.refuse("project-one", "attempt-a", AT),
      AgentAttemptError,
    );
  });

  it("fails closed on edits, unsafe permissions, temporary leftovers and foreign locks", async () => {
    const home = await temporaryHome();
    const attempts = new AgentAttempts(new JsonAgentAttemptStore(home));
    await attempts.prepare(input("attempt-a"));
    const directory = join(home, "agent-attempts");
    const [name] = await readdir(directory);
    const path = join(directory, name!);
    const original = await readFile(path, "utf8");

    await writeFile(path, original.replace('"CODEX_CLI"', '"CLAUDE_CODE"'));
    await assert.rejects(attempts.list("project-one"), AgentAttemptError);
    await writeFile(path, JSON.stringify(JSON.parse(original)));
    await assert.rejects(attempts.list("project-one"), AgentAttemptError);
    await writeFile(path, original);
    await chmod(path, 0o644);
    await assert.rejects(attempts.list("project-one"), AgentAttemptError);
    await chmod(path, 0o600);
    await writeFile(join(directory, `${name}.leftover.tmp`), "", {
      mode: 0o600,
    });
    await assert.rejects(attempts.list("project-one"), AgentAttemptError);
    await rm(join(directory, `${name}.leftover.tmp`));

    const lock = join(directory, ".agent-attempts.lock");
    await writeFile(lock, "other-owner\n", { mode: 0o600 });
    await assert.rejects(
      attempts.claimExecution("project-one", "attempt-a", AT),
      AgentAttemptError,
    );
    assert.equal(await readFile(lock, "utf8"), "other-owner\n");
    await assert.rejects(
      attempts.inspect("project-one", "attempt-a"),
      AgentAttemptError,
    );
    await rm(lock);
    assert.equal(
      (await attempts.inspect("project-one", "attempt-a")).state,
      "PREPARED",
    );
  });

  it("lets exactly one of several processes claim the same prepared attempt", async () => {
    const home = await temporaryHome();
    await new AgentAttempts(new JsonAgentAttemptStore(home)).prepare(
      input("attempt-a"),
    );
    const child = fileURLToPath(new URL("./claim-child.ts", import.meta.url));
    const outputs = await Promise.all(
      Array.from({ length: 6 }, () =>
        run(process.execPath, [child, home, "project-one", "attempt-a"]).then(
          (result) => result.stdout.trim(),
        ),
      ),
    );
    assert.equal(
      outputs.filter((line) => line === "CLAIMED EXECUTION_STARTED").length,
      1,
      outputs.join(","),
    );
    assert.equal(outputs.filter((line) => line === "REFUSED").length, 5);
    const snapshot = await new AgentAttempts(
      new JsonAgentAttemptStore(home),
    ).list("project-one");
    assert.deepEqual(
      snapshot.records.map((entry) => entry.state),
      ["PREPARED", "EXECUTION_STARTED"],
    );
  });

  it("reports a missing store as empty and never creates it on read", async () => {
    const home = await temporaryHome();
    const attempts = new AgentAttempts(new JsonAgentAttemptStore(home));
    assert.equal((await attempts.list("project-one")).revision, 0);
    await assert.rejects(readdir(join(home, "agent-attempts")), {
      code: "ENOENT",
    });
    await mkdir(join(home, "agent-attempts"), { mode: 0o755 });
    await chmod(join(home, "agent-attempts"), 0o755);
    await assert.rejects(attempts.list("project-one"), AgentAttemptError);
  });
});

function input(attemptId: string): AgentAttemptInput {
  return {
    schemaVersion: 1,
    scopeId: "project-one",
    authorizationId: `authorization-${attemptId}`,
    attemptId,
    executionClass: "AGENT_EXECUTION",
    kind: "CODEX_CLI",
    targetId: "codex",
    qualification: "codex-cli-offline-synthetic",
    inputDigest: "1".repeat(64),
    invocationDigest: "2".repeat(64),
    bindingDigest: "b".repeat(64),
    preflightAuditEventHash: "3".repeat(64),
    preparedAt: AT,
  };
}

async function temporaryHome() {
  const home = await mkdtemp(join(tmpdir(), "ai-workspace-agent-attempts-"));
  homes.push(home);
  return home;
}
