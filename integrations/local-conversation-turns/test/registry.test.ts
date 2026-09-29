import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  ConversationTurnConflictError,
  conversationTurnClaim,
  type ConversationTurnResult,
} from "@ai-workspace/conversation-turn";
import {
  JsonConversationTurnRegistry,
  type TurnRecovery,
} from "../src/index.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const request = {
  conversationId: "synthetic-conversation",
  projectId: null,
  targetId: "synthetic-target",
  clientRequestId: "one",
  userText: "Synthetic original must not be persisted",
};
const scope = {
  conversationId: request.conversationId,
  projectId: null,
  workItemId: null,
  handoffId: null,
};
const claim = conversationTurnClaim(request, scope);
const reference = {
  projectId: "synthetic-attempt-namespace",
  attemptId: "synthetic-attempt",
  authorizationId: "synthetic-authorization",
};
const unknown = {
  kind: "UNKNOWN_AFTER_EXPOSURE",
  attemptId: reference.attemptId,
} as const;
const refused = {
  kind: "REFUSED_BEFORE_EXPOSURE",
  reason: "LOCAL_EVIDENCE_UNAVAILABLE",
} as const;
const recover: TurnRecovery = async (_claim, reference, result) =>
  result?.kind === "REFUSED_BEFORE_EXPOSURE"
    ? result
    : reference
      ? unknown
      : refused;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aiw-turn-registry-"));
  roots.push(root);
  return root;
}
const create = (root: string) =>
  new JsonConversationTurnRegistry(root, recover);

test("two instances atomically reserve one identity, retain private metadata, reject changed bytes", async () => {
  const root = await fixture();
  let executions = 0;
  const operation = async (
    execution: Parameters<
      Parameters<JsonConversationTurnRegistry["execute"]>[1]
    >[0],
  ) => {
    executions += 1;
    await execution.bindAttempt(reference);
    return unknown;
  };
  const results = await Promise.all([
    create(root).execute(claim, operation),
    create(root).execute(claim, operation),
  ]);
  assert.equal(executions, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 1);
  assert.deepEqual(
    results.map((result) => result.result),
    [unknown, unknown],
  );
  await assert.rejects(
    create(root).execute(
      conversationTurnClaim(
        { ...request, userText: `${request.userText} ` },
        scope,
      ),
      operation,
    ),
    ConversationTurnConflictError,
  );
  const path = join(root, "conversation-turns", claim.idempotencyKey);
  assert.equal((await stat(path)).mode & 0o777, 0o700);
  for (const name of await readdir(path)) {
    assert.equal((await stat(join(path, name))).mode & 0o777, 0o600);
    assert.equal(
      (await readFile(join(path, name), "utf8")).includes(request.userText),
      false,
    );
  }
});
test("incomplete permanent claim is never reclaimed or executed", async () => {
  const root = await fixture();
  await mkdir(join(root, "conversation-turns", claim.idempotencyKey), {
    recursive: true,
    mode: 0o700,
  });
  let executions = 0;
  for (let i = 0; i < 2; i += 1) {
    const result = await create(root).execute(claim, async () => {
      executions += 1;
      return refused;
    });
    assert.deepEqual(result.result, refused);
  }
  assert.equal(executions, 0);
});
test("failure after claim but before linking consumes the gesture without exposure", async () => {
  const root = await fixture();
  let executions = 0;
  const operation = async (): Promise<ConversationTurnResult> => {
    executions += 1;
    throw new Error("synthetic interruption");
  };
  await create(root).execute(claim, operation);
  const duplicate = await create(root).execute(claim, operation);
  assert.equal(duplicate.duplicate, true);
  assert.equal(executions, 1);
  assert.deepEqual(duplicate.result, refused);
});
test("link publication failure cannot expose and cannot make the identity reusable", async () => {
  const root = await fixture();
  let exposures = 0;
  const path = join(
    root,
    "conversation-turns",
    claim.idempotencyKey,
    "attempt.json",
  );
  const operation = async (
    execution: Parameters<
      Parameters<JsonConversationTurnRegistry["execute"]>[1]
    >[0],
  ) => {
    await mkdir(path);
    await execution.bindAttempt(reference);
    exposures += 1;
    return unknown;
  };
  await create(root).execute(claim, operation);
  await create(root).execute(claim, operation);
  assert.equal(exposures, 0);
});
test("failed final publication recovers linked evidence without executing again", async () => {
  const root = await fixture();
  let exposures = 0;
  const operation = async (
    execution: Parameters<
      Parameters<JsonConversationTurnRegistry["execute"]>[1]
    >[0],
  ) => {
    await execution.bindAttempt(reference);
    exposures += 1;
    await mkdir(
      join(root, "conversation-turns", claim.idempotencyKey, "result.json"),
    );
    return unknown;
  };
  await create(root).execute(claim, operation);
  await create(root).execute(claim, operation);
  assert.equal(exposures, 1);
});
for (const damage of ["json", "hash", "permissions", "oversize", "symlink"]) {
  test(`refuses ${damage} registry damage with no new exposure`, async () => {
    const root = await fixture();
    let executions = 0;
    const operation = async () => {
      executions += 1;
      return refused;
    };
    await create(root).execute(claim, operation);
    const path = join(
      root,
      "conversation-turns",
      claim.idempotencyKey,
      "claim.json",
    );
    if (damage === "json") await writeFile(path, "{");
    if (damage === "hash") {
      const value = JSON.parse(await readFile(path, "utf8")) as {
        digest: string;
      };
      value.digest = "0".repeat(64);
      await writeFile(path, JSON.stringify(value));
    }
    if (damage === "permissions") await chmod(path, 0o644);
    if (damage === "oversize") await writeFile(path, " ".repeat(16385));
    if (damage === "symlink") {
      const other = join(root, "other.json");
      await writeFile(other, await readFile(path));
      await rm(path);
      await symlink(other, path);
    }
    const result = await create(root).execute(claim, operation);
    assert.deepEqual(result.result, refused);
    assert.equal(executions, 1);
  });
}
test("unwritable registry root fails before invoking the executor", async () => {
  const root = await fixture();
  await writeFile(join(root, "conversation-turns"), "occupied");
  let executions = 0;
  const result = await create(root).execute(claim, async () => {
    executions += 1;
    return refused;
  });
  assert.deepEqual(result.result, refused);
  assert.equal(executions, 0);
});
test("completed receipt contains only digest/reference metadata", async () => {
  const root = await fixture();
  await create(root).execute(claim, async (execution) => {
    await execution.bindAttempt(reference);
    return {
      kind: "COMPLETED",
      assistantMessageId: "event",
      text: "Private synthetic answer",
      occurredAt: new Date().toISOString(),
      effectiveModel: "Synthetic",
    };
  });
  const raw = await readFile(
    join(root, "conversation-turns", claim.idempotencyKey, "result.json"),
    "utf8",
  );
  assert.equal(raw.includes("Private synthetic answer"), false);
  assert.equal(raw.includes(request.userText), false);
  assert.match(raw, /responseDigest/u);
});
