import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";
import {
  recoveryArea,
  recoveryGeneral,
  recoveryRequest,
} from "./conversation-turn-recovery-fixture.ts";
import { conversationTurnClaim } from "@ai-workspace/conversation-turn";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "aiw-n2-crash-"));
  roots.push(home);
  await writeReducedTurnConfiguration(home);
  await new JsonGeneralConversationStore(home).create({
    id: recoveryRequest.conversationId,
    title: "Synthetic recovery",
    scope: "GENERAL",
    createdAt: new Date().toISOString(),
    events: [],
  });
  return home;
}
function child(home: string, stage: string) {
  return new Promise<{ code: number | null; output: string }>(
    (resolve, reject) => {
      const process = spawn(
        globalThis.process.execPath,
        [
          fileURLToPath(
            new URL("./conversation-turn-recovery-fixture.ts", import.meta.url),
          ),
          home,
          stage,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let output = "";
      let errors = "";
      process.stdout.on("data", (part) => {
        output += String(part);
      });
      process.stderr.on("data", (part) => {
        errors += String(part);
      });
      process.on("error", reject);
      process.on("exit", (code) =>
        code === 0 || code === 73
          ? resolve({ code, output })
          : reject(new Error(errors)),
      );
    },
  );
}
for (const [stage, expectedKind, exposed] of [
  ["after-turn-claim", "REFUSED_BEFORE_EXPOSURE", false],
  ["after-link", "UNKNOWN_AFTER_EXPOSURE", false],
  ["after-prepare", "REFUSED_BEFORE_EXPOSURE", false],
  ["after-executor-claim", "UNKNOWN_AFTER_EXPOSURE", false],
  ["after-exposure", "UNKNOWN_AFTER_EXPOSURE", true],
  ["before-append", "RESPONSE_WITHHELD", true],
  ["after-append", "COMPLETED", true],
  ["normal", "COMPLETED", true],
] as const) {
  test(`recovers an actual exited process ${stage} without another exposure`, async () => {
    const home = await fixture();
    const previous = await child(home, stage);
    assert.equal(previous.code, stage === "normal" ? 0 : 73);
    const result = await recoveryArea(home).run(recoveryRequest);
    assert.equal(result.duplicate, true);
    assert.equal(result.result.kind, expectedKind);
    if (result.result.kind === "COMPLETED")
      assert.equal(result.result.text, "Synthetic durable answer");
    if (exposed)
      assert.equal(
        await readFile(join(home, "synthetic-exposures.log"), "utf8"),
        "exposure\n",
      );
    else
      await assert.rejects(readFile(join(home, "synthetic-exposures.log")), {
        code: "ENOENT",
      });
    assert.equal(
      (await recoveryGeneral(home).show(recoveryRequest.conversationId)).events
        .length,
      stage === "after-append" || stage === "normal" ? 2 : 0,
    );
    const again = await recoveryArea(home).run(recoveryRequest);
    assert.deepEqual(again.result, result.result);
  });
}
test("two independent processes on the same home expose and append once", async () => {
  const home = await fixture();
  const results = await Promise.all([
    child(home, "normal"),
    child(home, "normal"),
  ]);
  assert.equal(
    results.filter(
      (item) => (JSON.parse(item.output) as { duplicate: boolean }).duplicate,
    ).length,
    1,
  );
  assert.deepEqual(
    results.map(
      (item) =>
        (JSON.parse(item.output) as { result: { kind: string } }).result.kind,
    ),
    ["COMPLETED", "COMPLETED"],
  );
  assert.equal(
    await readFile(join(home, "synthetic-exposures.log"), "utf8"),
    "exposure\n",
  );
  assert.equal(
    (await recoveryGeneral(home).show(recoveryRequest.conversationId)).events
      .length,
    2,
  );
});
test("completed receipt cannot substitute for missing canonical answer", async () => {
  const home = await fixture();
  const area = recoveryArea(home);
  const result = await area.run(recoveryRequest);
  assert.equal(result.result.kind, "COMPLETED");
  // A canonical store outage must not serve a response copied into the registry.
  const general = recoveryGeneral(home);
  const originalShow = general.show.bind(general);
  const { conversationTurnRecovery } =
    await import("../src/conversation-turn-recovery.ts");
  const { JsonConversationTurnRegistry } =
    await import("@ai-workspace/local-conversation-turns");
  const { JsonModelAttemptStore } =
    await import("@ai-workspace/local-model-attempts");
  const { ModelAttempts } = await import("@ai-workspace/model-attempts");
  let reads = 0;
  const recovery = conversationTurnRecovery(
    {
      conversations: {
        projects: async () => [],
        sessions: { list: async () => [] },
        notes: { list: () => general.list() },
        workItems: { list: async () => [] },
      },
      general: {
        show: async (id) => {
          reads += 1;
          return { ...(await originalShow(id)), events: [] };
        },
      },
    },
    new ModelAttempts(new JsonModelAttemptStore(home)),
  );
  const registry = new JsonConversationTurnRegistry(home, recovery);
  const claim = conversationTurnClaim(recoveryRequest, {
    conversationId: recoveryRequest.conversationId,
    projectId: null,
    workItemId: null,
    handoffId: null,
  });
  const replay = await registry.execute(claim, async () => {
    throw new Error("Must not execute");
  });
  assert.equal(reads, 1);
  assert.equal(replay.result.kind, "RESPONSE_WITHHELD");
  assert.equal(
    await readFile(join(home, "synthetic-exposures.log"), "utf8"),
    "exposure\n",
  );
  // Removing only the completion receipt models a crash after canonical append.
  await rm(
    join(home, "conversation-turns", claim.idempotencyKey, "result.json"),
  );
  const afterAppend = await recoveryArea(home).run(recoveryRequest);
  assert.equal(afterAppend.result.kind, "COMPLETED");
  // Corruption is not treated as a fresh identity, even after a real completion.
  await writeFile(
    join(home, "conversation-turns", claim.idempotencyKey, "claim.json"),
    "{",
  );
  await recoveryArea(home).run(recoveryRequest);
  assert.equal(
    await readFile(join(home, "synthetic-exposures.log"), "utf8"),
    "exposure\n",
  );
});
