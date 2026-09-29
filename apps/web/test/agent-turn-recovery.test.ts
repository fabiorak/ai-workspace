import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";

import { AgentAttempts } from "@ai-workspace/agent-execution";
import { conversationTurnClaim } from "@ai-workspace/conversation-turn";
import { JsonAgentAttemptStore } from "@ai-workspace/local-agent-attempts";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { ModelAttempts } from "@ai-workspace/model-attempts";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";

import { conversationTurnRecovery } from "../src/conversation-turn-recovery.ts";
import {
  agentGeneral,
  agentRequest,
  agentTurn,
  type AgentStage,
} from "./agent-turn-fixture.ts";

const GENERAL_SCOPE = `general-${createHash("sha256").update(agentRequest.conversationId).digest("hex")}`;
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "aiw-n5-agent-"));
  roots.push(home);
  await new JsonGeneralConversationStore(home).create({
    id: agentRequest.conversationId,
    title: "Synthetic agent recovery",
    scope: "GENERAL",
    createdAt: new Date().toISOString(),
    events: [],
  });
  return home;
}

const executions = (home: string) =>
  readFile(join(home, "synthetic-executions.log"), "utf8").then(
    (content) => content.split("\n").filter(Boolean).length,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return 0;
      throw error;
    },
  );

function child(home: string, stage: AgentStage) {
  return new Promise<{ code: number | null; output: string }>(
    (resolve, reject) => {
      const process = spawn(
        globalThis.process.execPath,
        [
          fileURLToPath(new URL("./agent-turn-fixture.ts", import.meta.url)),
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

for (const [stage, expectedKind, executed] of [
  ["after-link", "UNKNOWN_AFTER_EXPOSURE", 0],
  ["after-prepare", "REFUSED_BEFORE_EXPOSURE", 0],
  ["after-execution-claim", "UNKNOWN_AFTER_EXPOSURE", 0],
  ["after-execution", "UNKNOWN_AFTER_EXPOSURE", 1],
  ["before-append", "RESPONSE_WITHHELD", 1],
  ["after-append", "COMPLETED", 1],
  ["normal", "COMPLETED", 1],
] as const) {
  test(`recovers an agent turn whose process exited ${stage} without running again`, async () => {
    const home = await fixture();
    const previous = await child(home, stage);
    assert.equal(previous.code, stage === "normal" ? 0 : 73);
    const result = await agentTurn(home).run(agentRequest);
    assert.equal(result.duplicate, true);
    assert.equal(result.result.kind, expectedKind, JSON.stringify(result));
    if (result.result.kind === "COMPLETED")
      assert.equal(result.result.text, "Synthetic agent answer");
    assert.equal(await executions(home), executed);
    assert.equal(
      (await agentGeneral(home).show(agentRequest.conversationId)).events
        .length,
      stage === "after-append" || stage === "normal" ? 2 : 0,
    );
    const again = await agentTurn(home).run(agentRequest);
    assert.deepEqual(again.result, result.result);
    assert.equal(await executions(home), executed);
  });
}

test("two independent processes on the same home run the agent once", async () => {
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
  assert.equal(await executions(home), 1);
  assert.equal(
    (await agentGeneral(home).show(agentRequest.conversationId)).events.length,
    2,
  );
});

for (const stage of ["duplicate-final", "tool-event"] as const)
  test(`promotes no answer when the adapter sees a ${stage}`, async () => {
    const home = await fixture();
    const first = await agentTurn(home, stage).run(agentRequest);
    assert.equal(first.result.kind, "UNKNOWN_AFTER_EXPOSURE");
    assert.equal(await executions(home), 1);
    assert.equal(
      (await agentGeneral(home).show(agentRequest.conversationId)).events
        .length,
      0,
    );
    const replay = await agentTurn(home).run(agentRequest);
    assert.deepEqual(replay.result, first.result);
    assert.equal(await executions(home), 1);
  });

test("a failed save withholds the answer and never runs the agent a second time", async () => {
  const home = await fixture();
  const first = await agentTurn(home, "save-fails").run(agentRequest);
  assert.equal(first.result.kind, "RESPONSE_WITHHELD");
  const replay = await agentTurn(home).run(agentRequest);
  assert.deepEqual(replay.result, first.result);
  assert.equal(await executions(home), 1);
  const [document] = await readdir(join(home, "agent-attempts")).then((names) =>
    names.filter((name) => name.endsWith(".json")),
  );
  const stored = await readFile(
    join(home, "agent-attempts", document!),
    "utf8",
  );
  assert.doesNotMatch(
    stored,
    /Synthetic agent answer|synthetic agent recovery question|nonexistent/iu,
  );
});

test("Claude Code shares the coordinator and keeps the requested alias", async () => {
  const home = await fixture();
  const result = await agentTurn(home, "normal", "CLAUDE_CODE").run({
    ...agentRequest,
    targetId: "claude",
  });
  assert.equal(result.result.kind, "COMPLETED");
  if (result.result.kind !== "COMPLETED") return;
  assert.equal(result.result.text, "Synthetic Claude answer");
  const [event] = (
    await agentGeneral(home).show(agentRequest.conversationId)
  ).events.filter((entry) => entry.type === "AGENT_MESSAGE");
  assert.equal(
    event?.type === "AGENT_MESSAGE" && event.provenance.model,
    "sonnet",
  );
  const snapshot = await new AgentAttempts(
    new JsonAgentAttemptStore(home),
  ).list(GENERAL_SCOPE);
  assert.deepEqual(
    snapshot.records.map((entry) => [
      entry.kind,
      entry.state,
      entry.reportedModel,
    ]),
    [
      ["CLAUDE_CODE", "PREPARED", null],
      ["CLAUDE_CODE", "EXECUTION_STARTED", null],
      ["CLAUDE_CODE", "COMPLETED", null],
    ],
  );
});

test("an agent reference is never read from model-delivery evidence", async () => {
  const home = await fixture();
  await agentTurn(home).run(agentRequest);
  const general = agentGeneral(home);
  const sources = {
    conversations: {
      projects: async () => [],
      sessions: { list: async () => [] },
      notes: { list: () => general.list() },
      workItems: { list: async () => [] },
    },
    general,
  };
  const claim = conversationTurnClaim(agentRequest, {
    conversationId: agentRequest.conversationId,
    projectId: null,
    workItemId: null,
    handoffId: null,
  });
  const snapshot = await new AgentAttempts(
    new JsonAgentAttemptStore(home),
  ).list(GENERAL_SCOPE);
  const completed = snapshot.records.at(-1)!;
  const reference = {
    projectId: completed.scopeId,
    authorizationId: completed.authorizationId,
    attemptId: completed.attemptId,
    executionClass: "AGENT_EXECUTION" as const,
  };
  const models = new ModelAttempts(new JsonModelAttemptStore(home));
  assert.deepEqual(
    await conversationTurnRecovery(sources, models)(claim, reference, null),
    { kind: "UNKNOWN_AFTER_EXPOSURE", attemptId: completed.attemptId },
  );
  const { executionClass: _class, ...unclassed } = reference;
  void _class;
  assert.deepEqual(
    await conversationTurnRecovery(
      sources,
      models,
      new AgentAttempts(new JsonAgentAttemptStore(home)),
    )(claim, unclassed, null),
    { kind: "UNKNOWN_AFTER_EXPOSURE", attemptId: completed.attemptId },
  );
  const recovered = await conversationTurnRecovery(
    sources,
    models,
    new AgentAttempts(new JsonAgentAttemptStore(home)),
  )(claim, reference, null);
  assert.equal(recovered.kind, "COMPLETED");
});
