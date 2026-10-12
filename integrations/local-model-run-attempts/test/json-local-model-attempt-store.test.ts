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
  LocalModelAttemptError,
  LocalModelAttempts,
  type LocalModelAttemptInput,
} from "@ai-workspace/local-model-execution";
import { JsonLocalModelAttemptStore } from "../src/index.ts";

const run = promisify(execFile);
const AT = "2026-09-28T10:00:00.000Z";
const homes: string[] = [];
afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((home) => rm(home, { recursive: true, force: true })),
  );
});

describe("JsonLocalModelAttemptStore", () => {
  it("persists a private hash-chained document separate from other attempts", async () => {
    const home = await temporaryHome();
    const attempts = new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    );
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
    await attempts.markUnknown("project-one", "attempt-b", "TIMED_OUT", AT);
    const directory = join(home, "local-model-run-attempts");
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
    await assert.rejects(readdir(join(home, "agent-attempts")), {
      code: "ENOENT",
    });
    assert.equal((await attempts.list("another-scope")).records.length, 0);
    await assert.rejects(
      attempts.inspect("another-scope", "attempt-a"),
      LocalModelAttemptError,
    );
  });

  it("records the protection on every record and the reason of an unknown outcome", async () => {
    const home = await temporaryHome();
    const attempts = new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    );
    await attempts.prepare(input("attempt-a"));
    await attempts.claimExecution("project-one", "attempt-a", AT);
    await attempts.markUnknown("project-one", "attempt-a", "DISCONNECTED", AT);
    const reread = await new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    ).list("project-one");
    assert.equal(reread.records.length, 3);
    for (const entry of reread.records)
      assert.equal(
        entry.protection,
        "PSEUDONYMIZATION_SKIPPED_LOCAL_MODEL_LOCAL_ONLY",
      );
    assert.deepEqual(
      reread.records.map((entry) => entry.unknownReason),
      [null, null, "DISCONNECTED"],
    );
    const last = await attempts.inspect("project-one", "attempt-a");
    assert.equal(last.state, "UNKNOWN_AFTER_EXECUTION");
    assert.equal(last.unknownReason, "DISCONNECTED");
    assert.equal(last.executionCount, 1);
    assert.equal(last.outputDigest, null);
  });

  it("refuses reused identities and transitions the state machine forbids", async () => {
    const home = await temporaryHome();
    const attempts = new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    );
    await attempts.prepare(input("attempt-a"));
    await assert.rejects(
      attempts.prepare(input("attempt-a")),
      LocalModelAttemptError,
    );
    await assert.rejects(
      attempts.prepare({
        ...input("attempt-c"),
        authorizationId: "authorization-attempt-a",
      }),
      LocalModelAttemptError,
    );
    await assert.rejects(
      attempts.complete("project-one", "attempt-a", "early", null, AT),
      LocalModelAttemptError,
    );
    await assert.rejects(
      attempts.markUnknown("project-one", "attempt-a", "UNRESOLVED", AT),
      LocalModelAttemptError,
    );
    await attempts.claimExecution("project-one", "attempt-a", AT);
    await assert.rejects(
      attempts.claimExecution("project-one", "attempt-a", AT),
      LocalModelAttemptError,
    );
    await assert.rejects(
      attempts.refuse("project-one", "attempt-a", AT),
      LocalModelAttemptError,
    );
  });

  it("fails closed on edits, unsafe permissions, temporary leftovers and foreign locks", async () => {
    const home = await temporaryHome();
    const attempts = new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    );
    await attempts.prepare(input("attempt-a"));
    const directory = join(home, "local-model-run-attempts");
    const [name] = await readdir(directory);
    const path = join(directory, name!);
    const original = await readFile(path, "utf8");

    await writeFile(
      path,
      original.replace('"llama-server-loopback-offline"', '"something-else"'),
    );
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    await writeFile(path, JSON.stringify(JSON.parse(original)));
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    await writeFile(path, original);
    await chmod(path, 0o644);
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    await chmod(path, 0o600);
    await writeFile(join(directory, `${name}.leftover.tmp`), "", {
      mode: 0o600,
    });
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    await rm(join(directory, `${name}.leftover.tmp`));

    const lock = join(directory, ".local-model-run-attempts.lock");
    await writeFile(lock, "other-owner\n", { mode: 0o600 });
    await assert.rejects(
      attempts.claimExecution("project-one", "attempt-a", AT),
      LocalModelAttemptError,
    );
    assert.equal(await readFile(lock, "utf8"), "other-owner\n");
    await assert.rejects(
      attempts.inspect("project-one", "attempt-a"),
      LocalModelAttemptError,
    );
    await rm(lock);
    assert.equal(
      (await attempts.inspect("project-one", "attempt-a")).state,
      "PREPARED",
    );
  });

  it("rejects a document whose unknownReason or protection was tampered with", async () => {
    const home = await temporaryHome();
    const attempts = new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    );
    await attempts.prepare(input("attempt-a"));
    await attempts.claimExecution("project-one", "attempt-a", AT);
    await attempts.markUnknown("project-one", "attempt-a", "TIMED_OUT", AT);
    const directory = join(home, "local-model-run-attempts");
    const [name] = await readdir(directory);
    const path = join(directory, name!);
    const original = await readFile(path, "utf8");
    assert.match(original, /"unknownReason": "TIMED_OUT"/u);

    // A reason inside the closed list, but not the recorded one: the hash fails.
    await writeFile(
      path,
      original.replace(
        '"unknownReason": "TIMED_OUT"',
        '"unknownReason": "UNRESOLVED"',
      ),
    );
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    // A reason outside the closed list.
    await writeFile(
      path,
      original.replace(
        '"unknownReason": "TIMED_OUT"',
        '"unknownReason": "BECAUSE"',
      ),
    );
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    // A reason erased from the unknown record.
    await writeFile(
      path,
      original.replace('"unknownReason": "TIMED_OUT"', '"unknownReason": null'),
    );
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    // A reason added to a record that never became unknown.
    await writeFile(
      path,
      original.replace('"unknownReason": null', '"unknownReason": "TIMED_OUT"'),
    );
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    // A changed protection.
    await writeFile(
      path,
      original.replaceAll(
        "PSEUDONYMIZATION_SKIPPED_LOCAL_MODEL_LOCAL_ONLY",
        "PSEUDONYMIZED",
      ),
    );
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
    await writeFile(path, original);
    assert.equal(
      (await attempts.inspect("project-one", "attempt-a")).unknownReason,
      "TIMED_OUT",
    );
  });

  it("lets exactly one of several processes claim the same prepared attempt", async () => {
    const home = await temporaryHome();
    await new LocalModelAttempts(new JsonLocalModelAttemptStore(home)).prepare(
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
    const snapshot = await new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    ).list("project-one");
    assert.deepEqual(
      snapshot.records.map((entry) => entry.state),
      ["PREPARED", "EXECUTION_STARTED"],
    );
  });

  it("reports a missing store as empty and never creates it on read", async () => {
    const home = await temporaryHome();
    const attempts = new LocalModelAttempts(
      new JsonLocalModelAttemptStore(home),
    );
    assert.equal((await attempts.list("project-one")).revision, 0);
    await assert.rejects(readdir(join(home, "local-model-run-attempts")), {
      code: "ENOENT",
    });
    await mkdir(join(home, "local-model-run-attempts"), { mode: 0o755 });
    await chmod(join(home, "local-model-run-attempts"), 0o755);
    await assert.rejects(attempts.list("project-one"), LocalModelAttemptError);
  });
});

function input(attemptId: string): LocalModelAttemptInput {
  return {
    schemaVersion: 1,
    scopeId: "project-one",
    authorizationId: `authorization-${attemptId}`,
    attemptId,
    executionClass: "LOCAL_MODEL",
    kind: "LLAMA_SERVER_LOOPBACK",
    targetId: "local-model",
    qualification: "llama-server-loopback-offline",
    protection: "PSEUDONYMIZATION_SKIPPED_LOCAL_MODEL_LOCAL_ONLY",
    inputDigest: "1".repeat(64),
    invocationDigest: "2".repeat(64),
    bindingDigest: "b".repeat(64),
    preflightAuditEventHash: "3".repeat(64),
    preparedAt: AT,
  };
}

async function temporaryHome() {
  const home = await mkdtemp(
    join(tmpdir(), "ai-workspace-local-model-run-attempts-"),
  );
  homes.push(home);
  return home;
}
