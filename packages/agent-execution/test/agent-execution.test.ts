import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AgentAttemptError,
  AgentAttempts,
  AgentExecution,
  createAgentAttemptRecord,
  sha256,
  transitionAgentAttemptRecord,
  validateAgentAttemptRecord,
  type AgentAttemptInput,
  type AgentAttemptRecord,
  type AgentAttemptReference,
  type AgentAttemptSnapshot,
  type AgentAttemptStore,
  type AgentExecutionInput,
  type AgentExecutor,
  type AgentRunResult,
} from "../src/index.ts";

const AT = "2026-09-28T10:00:00.000Z";
const BINDING = "b".repeat(64);

const attemptInput = (attemptId = "attempt-1"): AgentAttemptInput => ({
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
  bindingDigest: BINDING,
  preflightAuditEventHash: "3".repeat(64),
  preparedAt: AT,
});

describe("agent attempt records", () => {
  it("allows only the ADR-0049 transitions and keeps no content", () => {
    const prepared = createAgentAttemptRecord(attemptInput(), 1, null);
    assert.equal(prepared.state, "PREPARED");
    const started = transitionAgentAttemptRecord(prepared, 2, {
      state: "EXECUTION_STARTED",
      executionCount: 1,
      updatedAt: AT,
    });
    const completed = transitionAgentAttemptRecord(started, 3, {
      state: "COMPLETED",
      outputDigest: sha256("answer"),
      reportedModel: "synthetic-model",
      updatedAt: AT,
    });
    assert.equal(completed.outputDigest, sha256("answer"));
    assert.doesNotMatch(JSON.stringify(completed), /"answer"/u);
    const refused = transitionAgentAttemptRecord(prepared, 2, {
      state: "REFUSED_BEFORE_EXECUTION",
      updatedAt: AT,
    });
    for (const [from, patch] of [
      [prepared, { state: "COMPLETED", outputDigest: sha256("x") }],
      [prepared, { state: "UNKNOWN_AFTER_EXECUTION", executionCount: 1 }],
      [refused, { state: "EXECUTION_STARTED", executionCount: 1 }],
      [completed, { state: "UNKNOWN_AFTER_EXECUTION", outputDigest: null }],
      [started, { state: "REFUSED_BEFORE_EXECUTION", executionCount: 0 }],
      [started, { state: "COMPLETED" }],
      [started, { targetId: "other", state: "UNKNOWN_AFTER_EXECUTION" }],
      [prepared, { state: "EXECUTION_STARTED" }],
    ] as const)
      assert.throws(
        () =>
          transitionAgentAttemptRecord(from, from.revision + 1, {
            ...patch,
            updatedAt: AT,
          } as never),
        AgentAttemptError,
        JSON.stringify(patch),
      );
  });

  it("rejects altered, oversized or non-canonical evidence", () => {
    const prepared = createAgentAttemptRecord(attemptInput(), 1, null);
    for (const change of [
      { targetId: "changed" },
      { kind: "OPENAI_RESPONSES" },
      { executionClass: "MODEL_DELIVERY" },
      { automaticRetryScheduled: true },
      { stdout: "never" },
      { preparedAt: "2026-09-28T10:00:00Z" },
      { qualification: "x".repeat(257) },
    ])
      assert.throws(
        () => validateAgentAttemptRecord({ ...prepared, ...change }),
        AgentAttemptError,
        JSON.stringify(change),
      );
  });
});

describe("agent execution coordinator", () => {
  it("links, prepares, claims and rereads before one execution", async () => {
    const fixture = harness();
    const prepared = fixture.execution.prepare(executionInput());
    const outcome = await fixture.confirm(prepared.authorizationId);
    assert.deepEqual(outcome, {
      kind: "COMPLETED",
      attemptId: "id-2",
      text: "Synthetic agent answer",
      reportedModel: "synthetic-reported",
    });
    assert.equal(fixture.executions, 1);
    assert.deepEqual(fixture.links, [
      {
        projectId: "project-one",
        authorizationId: "id-1",
        attemptId: "id-2",
        executionClass: "AGENT_EXECUTION",
      },
    ]);
    assert.deepEqual(fixture.order, [
      "revalidate",
      "link",
      "prepare",
      "revalidate",
      "claim",
      "execute",
      "complete",
    ]);
    const record = fixture.store.current("id-2");
    assert.equal(record.state, "COMPLETED");
    assert.equal(record.outputDigest, sha256("Synthetic agent answer"));
    assert.equal(record.qualification, "synthetic-codex-qualification");
    assert.equal(
      await fixture.confirm(prepared.authorizationId).then((r) => r.kind),
      "REFUSED_BEFORE_EXECUTION",
    );
    assert.equal(fixture.executions, 1);
  });

  it("refuses before any process when the binding, scope or plan is wrong", async () => {
    const fixture = harness();
    let prepared = fixture.execution.prepare(executionInput());
    assert.deepEqual(
      await fixture.execution.confirm(
        prepared.authorizationId,
        "project-two",
        async () => BINDING,
        fixture.link,
      ),
      { kind: "REFUSED_BEFORE_EXECUTION", reason: "EXPIRED_OR_USED" },
    );
    fixture.binding = "c".repeat(64);
    assert.deepEqual(await fixture.confirm(prepared.authorizationId), {
      kind: "REFUSED_BEFORE_EXECUTION",
      reason: "BINDING_CHANGED",
    });
    assert.deepEqual(fixture.links, []);

    fixture.binding = BINDING;
    fixture.changeBindingAfterPrepare = true;
    prepared = fixture.execution.prepare(executionInput());
    assert.deepEqual(await fixture.confirm(prepared.authorizationId), {
      kind: "REFUSED_BEFORE_EXECUTION",
      reason: "BINDING_CHANGED",
    });
    assert.equal(
      fixture.store.current("id-4").state,
      "REFUSED_BEFORE_EXECUTION",
    );

    fixture.changeBindingAfterPrepare = false;
    prepared = fixture.execution.prepare(executionInput());
    fixture.planSalt = "drifted";
    assert.deepEqual(await fixture.confirm(prepared.authorizationId), {
      kind: "REFUSED_BEFORE_EXECUTION",
      reason: "BINDING_CHANGED",
    });
    fixture.planSalt = "";

    prepared = fixture.execution.prepare(executionInput());
    fixture.now += 5 * 60_000;
    assert.deepEqual(await fixture.confirm(prepared.authorizationId), {
      kind: "REFUSED_BEFORE_EXECUTION",
      reason: "EXPIRED_OR_USED",
    });
    assert.equal(fixture.executions, 0);
    assert.throws(
      () =>
        fixture.execution.prepare({ ...executionInput(), kind: "CLAUDE_CODE" }),
      /AGENT_EXECUTOR_UNAVAILABLE/u,
    );
    assert.throws(
      () => fixture.execution.prepare({ ...executionInput(), text: "  " }),
      /INVALID_AGENT_EXECUTION_PREPARATION/u,
    );
  });

  it("never starts a process when evidence cannot be linked, stored or verified", async () => {
    for (const failure of ["link", "prepare", "claim", "reread"] as const) {
      const fixture = harness();
      fixture.fail = failure;
      const prepared = fixture.execution.prepare(executionInput());
      assert.deepEqual(
        await fixture.confirm(prepared.authorizationId),
        {
          kind: "REFUSED_BEFORE_EXECUTION",
          reason: "LOCAL_EVIDENCE_UNAVAILABLE",
        },
        failure,
      );
      assert.equal(fixture.executions, 0, failure);
    }
  });

  it("keeps every post-claim failure unknown and never promotes a partial answer", async () => {
    const results: readonly (AgentRunResult | Error)[] = [
      { kind: "UNKNOWN_AFTER_EXECUTION" },
      { kind: "REJECTED_BEFORE_EXECUTION" },
      new Error("spawn ambiguous"),
      { kind: "COMPLETED", text: "  ", reportedModel: null },
      { kind: "COMPLETED", text: "\ud800", reportedModel: null },
      {
        kind: "COMPLETED",
        text: "x".repeat(1024 * 1024 + 1),
        reportedModel: null,
      },
      { kind: "COMPLETED", text: "ok", reportedModel: "bad\nmodel" },
    ];
    for (const result of results) {
      const fixture = harness(result);
      const prepared = fixture.execution.prepare(executionInput());
      const outcome = await fixture.confirm(prepared.authorizationId);
      assert.deepEqual(outcome, {
        kind: "UNKNOWN_AFTER_EXECUTION",
        attemptId: "id-2",
      });
      assert.equal(fixture.executions, 1);
      assert.equal(
        fixture.store.current("id-2").state,
        "UNKNOWN_AFTER_EXECUTION",
      );
    }
    const fixture = harness();
    fixture.fail = "complete";
    const prepared = fixture.execution.prepare(executionInput());
    assert.deepEqual(await fixture.confirm(prepared.authorizationId), {
      kind: "UNKNOWN_AFTER_EXECUTION",
      attemptId: "id-2",
    });
    assert.equal(
      fixture.store.current("id-2").state,
      "UNKNOWN_AFTER_EXECUTION",
    );
  });

  it("spends one authorization once even for concurrent confirmations", async () => {
    const fixture = harness();
    const prepared = fixture.execution.prepare(executionInput());
    const outcomes = await Promise.all([
      fixture.confirm(prepared.authorizationId),
      fixture.confirm(prepared.authorizationId),
    ]);
    assert.deepEqual(outcomes.map((outcome) => outcome.kind).sort(), [
      "COMPLETED",
      "REFUSED_BEFORE_EXECUTION",
    ]);
    assert.equal(fixture.executions, 1);
  });
});

function executionInput(): AgentExecutionInput {
  return {
    scopeId: "project-one",
    targetId: "codex",
    kind: "CODEX_CLI",
    model: "synthetic-model",
    text: "Synthetic protected request",
    bindingDigest: BINDING,
    preflightAuditEventHash: "3".repeat(64),
    timeoutMs: 30_000,
  };
}

function harness(
  result: AgentRunResult | Error = {
    kind: "COMPLETED",
    text: "Synthetic agent answer",
    reportedModel: "synthetic-reported",
  },
) {
  const store = memoryStore();
  const state = {
    now: Date.parse(AT),
    binding: BINDING,
    changeBindingAfterPrepare: false,
    planSalt: "",
    executions: 0,
    fail: null as null | "link" | "prepare" | "claim" | "reread" | "complete",
    order: [] as string[],
    links: [] as AgentAttemptReference[],
  };
  let count = 0;
  const executor: AgentExecutor = {
    kind: "CODEX_CLI",
    qualification: "synthetic-codex-qualification",
    plan: (request) => ({
      inputDigest: sha256(request.text),
      invocationDigest: sha256(
        JSON.stringify([request.model, request.timeoutMs, state.planSalt]),
      ),
    }),
    execute: async () => {
      state.executions += 1;
      state.order.push("execute");
      if (result instanceof Error) throw result;
      return result;
    },
  };
  const tracked: AgentAttemptStore = {
    prepare: async (input) => {
      state.order.push("prepare");
      if (state.fail === "prepare") throw new Error("disk full");
      const record = await store.prepare(input);
      if (state.changeBindingAfterPrepare) state.binding = "d".repeat(64);
      return record;
    },
    transition: async (scopeId, attemptId, allowed, patch) => {
      if (patch.state === "EXECUTION_STARTED") {
        state.order.push("claim");
        if (state.fail === "claim") throw new Error("lock contended");
      }
      if (patch.state === "COMPLETED") {
        state.order.push("complete");
        if (state.fail === "complete") throw new Error("disk full");
      }
      return store.transition(scopeId, attemptId, allowed, patch);
    },
    inspect: async (scopeId, attemptId) => {
      const record = await store.inspect(scopeId, attemptId);
      return state.fail === "reread"
        ? { ...record, recordHash: "f".repeat(64) }
        : record;
    },
    list: (scopeId) => store.list(scopeId),
  };
  const execution = new AgentExecution({
    attempts: new AgentAttempts(tracked),
    executors: [executor],
    clock: () => state.now,
    ids: () => `id-${++count}`,
  });
  const link = async (reference: AgentAttemptReference) => {
    state.order.push("link");
    if (state.fail === "link") throw new Error("registry unavailable");
    state.links.push(reference);
  };
  return Object.assign(state, {
    store,
    execution,
    link,
    confirm: (authorizationId: string) =>
      execution.confirm(
        authorizationId,
        "project-one",
        async () => {
          state.order.push("revalidate");
          return state.binding;
        },
        link,
      ),
  });
}

function memoryStore() {
  const records: AgentAttemptRecord[] = [];
  const current = (attemptId: string) => {
    const record = records.findLast((entry) => entry.attemptId === attemptId);
    if (!record) throw new AgentAttemptError();
    return record;
  };
  const store: AgentAttemptStore & {
    current: typeof current;
  } = {
    current,
    prepare: async (input) => {
      const record = createAgentAttemptRecord(
        input,
        records.length + 1,
        records.at(-1)?.recordHash ?? null,
      );
      records.push(record);
      return record;
    },
    transition: async (_scopeId, attemptId, allowed, patch) => {
      const previous = current(attemptId);
      if (!allowed.includes(previous.state)) throw new AgentAttemptError();
      const next = transitionAgentAttemptRecord(
        previous,
        records.length + 1,
        patch,
        records.at(-1)!.recordHash,
      );
      records.push(next);
      return next;
    },
    inspect: async (_scopeId, attemptId) => current(attemptId),
    list: async (scopeId): Promise<AgentAttemptSnapshot> => ({
      schemaVersion: 1,
      scopeId,
      revision: records.length,
      records,
      effect: "LOCAL_AGENT_ATTEMPT_STORE_NOT_AGENT_EXECUTION",
    }),
  };
  return store;
}
