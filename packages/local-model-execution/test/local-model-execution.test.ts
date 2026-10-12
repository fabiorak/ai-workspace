import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LOCAL_MODEL_PROTECTION,
  LocalModelAttemptError,
  LocalModelAttempts,
  LocalModelExecution,
  createLocalModelAttemptRecord,
  sha256,
  transitionLocalModelAttemptRecord,
  validateLocalModelAttemptRecord,
  type LocalModelAttemptInput,
  type LocalModelAttemptRecord,
  type LocalModelAttemptReference,
  type LocalModelAttemptStore,
  type LocalModelExecutionInput,
  type LocalModelExecutor,
  type LocalModelPlan,
  type LocalModelRunResult,
} from "../src/index.ts";

const AT = "2026-09-30T10:00:00.000Z";
const BINDING = "b".repeat(64);

const attemptInput = (attemptId = "attempt-1"): LocalModelAttemptInput => ({
  schemaVersion: 1,
  scopeId: "project-one",
  authorizationId: `authorization-${attemptId}`,
  attemptId,
  executionClass: "LOCAL_MODEL",
  kind: "LLAMA_SERVER_LOOPBACK",
  targetId: "local",
  qualification: "llama-server-offline-synthetic",
  protection: LOCAL_MODEL_PROTECTION,
  inputDigest: "1".repeat(64),
  invocationDigest: "2".repeat(64),
  bindingDigest: BINDING,
  preflightAuditEventHash: "3".repeat(64),
  preparedAt: AT,
});

function memoryStore(): LocalModelAttemptStore & {
  records: LocalModelAttemptRecord[];
} {
  const records: LocalModelAttemptRecord[] = [];
  const latest = (attemptId: string) => {
    const found = records.findLast((r) => r.attemptId === attemptId);
    if (!found) throw new Error("NOT_FOUND");
    return found;
  };
  return {
    records,
    async prepare(input) {
      const head = records.at(-1);
      const record = createLocalModelAttemptRecord(
        input,
        records.length + 1,
        head?.recordHash ?? null,
      );
      records.push(record);
      return record;
    },
    async transition(_scope, attemptId, allowed, patch) {
      const previous = latest(attemptId);
      if (!allowed.includes(previous.state)) throw new Error("STATE");
      const next = transitionLocalModelAttemptRecord(
        previous,
        records.length + 1,
        patch,
        records.at(-1)!.recordHash,
      );
      records.push(next);
      return next;
    },
    async inspect(_scope, attemptId) {
      return latest(attemptId);
    },
    async list(scopeId) {
      return {
        schemaVersion: 1,
        scopeId,
        revision: records.length,
        records: [...records],
        effect: "LOCAL_MODEL_ATTEMPT_STORE_NOT_MODEL_EXECUTION",
      };
    },
  };
}

const input = (
  overrides: Partial<LocalModelExecutionInput> = {},
): LocalModelExecutionInput => ({
  scopeId: "project-one",
  targetId: "local",
  model: "modello-finto",
  text: "Domanda sintetica",
  boundary: "LOCAL_ONLY",
  bindingDigest: BINDING,
  preflightAuditEventHash: "3".repeat(64),
  ...overrides,
});

function setup(result: () => Promise<LocalModelRunResult>) {
  const store = memoryStore();
  const plans: LocalModelPlan[] = [];
  const executor: LocalModelExecutor = {
    qualification: "llama-server-offline-synthetic",
    async execute(plan) {
      plans.push(plan);
      return result();
    },
  };
  let n = 0;
  const execution = new LocalModelExecution({
    attempts: new LocalModelAttempts(store),
    executor,
    clock: () => Date.parse(AT),
    ids: () => `id-${++n}`,
  });
  const references: LocalModelAttemptReference[] = [];
  const confirm = (
    authorizationId: string,
    revalidate: () => Promise<string> = async () => BINDING,
  ) =>
    execution.confirm(authorizationId, "project-one", revalidate, async (r) => {
      references.push(r);
    });
  return { store, plans, execution, references, confirm };
}

const ok = async (): Promise<LocalModelRunResult> => ({
  kind: "ANSWER",
  text: "Risposta",
  reportedModel: "m",
});

describe("local model attempt record", () => {
  it("chains states and keeps digests only", () => {
    const prepared = createLocalModelAttemptRecord(attemptInput(), 1, null);
    const started = transitionLocalModelAttemptRecord(prepared, 2, {
      state: "EXECUTION_STARTED",
      executionCount: 1,
      updatedAt: AT,
    });
    const unknown = transitionLocalModelAttemptRecord(started, 3, {
      state: "UNKNOWN_AFTER_EXECUTION",
      unknownReason: "FINISH_REASON_NOT_STOP",
      updatedAt: AT,
    });
    assert.equal(unknown.automaticRetryScheduled, false);
    assert.equal(unknown.protection, LOCAL_MODEL_PROTECTION);
    assert.deepEqual(validateLocalModelAttemptRecord(unknown), unknown);
    assert.throws(
      () =>
        transitionLocalModelAttemptRecord(unknown, 4, {
          state: "COMPLETED",
          updatedAt: AT,
        }),
      LocalModelAttemptError,
    );
  });

  it("rejects tampering, a foreign class and a reason outside unknown", () => {
    const record = createLocalModelAttemptRecord(attemptInput(), 1, null);
    for (const tampered of [
      { ...record, executionClass: "AGENT_EXECUTION" },
      { ...record, protection: "NONE" },
      { ...record, unknownReason: "TIMED_OUT" },
      { ...record, targetId: "other" },
      { ...record, extra: true },
    ])
      assert.throws(
        () => validateLocalModelAttemptRecord(tampered),
        LocalModelAttemptError,
      );
  });

  it("refuses an unknown state without a reason", () => {
    const started = transitionLocalModelAttemptRecord(
      createLocalModelAttemptRecord(attemptInput(), 1, null),
      2,
      { state: "EXECUTION_STARTED", executionCount: 1, updatedAt: AT },
    );
    assert.throws(
      () =>
        transitionLocalModelAttemptRecord(started, 3, {
          state: "UNKNOWN_AFTER_EXECUTION",
          updatedAt: AT,
        }),
      LocalModelAttemptError,
    );
  });
});

describe("local model execution", () => {
  it("completes once, recording digests and the exemption only", async () => {
    const { store, plans, execution, references, confirm } = setup(ok);
    const prepared = execution.prepare(input());
    assert.equal(prepared.protection, LOCAL_MODEL_PROTECTION);
    const outcome = await confirm(prepared.authorizationId);
    assert.deepEqual(outcome, {
      kind: "COMPLETED",
      attemptId: "id-2",
      text: "Risposta",
      reportedModel: "m",
    });
    assert.equal(plans.length, 1);
    assert.deepEqual(references, [
      {
        projectId: "project-one",
        authorizationId: prepared.authorizationId,
        attemptId: "id-2",
        executionClass: "LOCAL_MODEL",
      },
    ]);
    assert.deepEqual(
      store.records.map((r) => r.state),
      ["PREPARED", "EXECUTION_STARTED", "COMPLETED"],
    );
    const last = store.records.at(-1)!;
    assert.equal(last.outputDigest, sha256("Risposta"));
    assert.equal(last.inputDigest, plans[0]!.inputDigest);
    const serialized = JSON.stringify(store.records);
    assert.ok(!serialized.includes("Domanda sintetica"));
    assert.ok(!serialized.includes('Risposta"'));
    assert.equal(
      (await confirm(prepared.authorizationId)).kind,
      "REFUSED_BEFORE_EXECUTION",
    );
    assert.equal(plans.length, 1);
  });

  it("refuses unclassified boundaries and malformed input before any I/O", () => {
    const { store, execution } = setup(ok);
    for (const bad of [
      input({ boundary: "UNCLASSIFIED" as never }),
      input({ text: " " }),
      input({ model: "" }),
      input({ bindingDigest: "x" }),
    ])
      assert.throws(() => execution.prepare(bad));
    assert.equal(store.records.length, 0);
  });

  it("leaves every non-answer unknown with its reason and never retries", async () => {
    for (const reason of [
      "FINISH_REASON_NOT_STOP",
      "TIMED_OUT",
      "REDIRECTED",
    ] as const) {
      const { store, plans, execution, confirm } = setup(async () => ({
        kind: "UNKNOWN",
        reason,
      }));
      const { authorizationId } = execution.prepare(input());
      assert.deepEqual(await confirm(authorizationId), {
        kind: "UNKNOWN_AFTER_EXECUTION",
        attemptId: "id-2",
        reason,
      });
      assert.equal(plans.length, 1);
      const last = store.records.at(-1)!;
      assert.equal(last.state, "UNKNOWN_AFTER_EXECUTION");
      assert.equal(last.unknownReason, reason);
      assert.equal(last.outputDigest, null);
    }
  });

  it("treats a throwing or lying executor as unresolved", async () => {
    const cases: Array<() => Promise<LocalModelRunResult>> = [
      async () => {
        throw new Error("boom");
      },
      async () => ({ kind: "ANSWER", text: " ", reportedModel: null }),
      async () => ({
        kind: "ANSWER",
        text: "a".repeat(128 * 1024 + 1),
        reportedModel: null,
      }),
      async () => ({ kind: "UNKNOWN", reason: "INVENTATO" as never }),
    ];
    for (const result of cases) {
      const { store, execution, confirm } = setup(result);
      const { authorizationId } = execution.prepare(input());
      const outcome = await confirm(authorizationId);
      assert.equal(outcome.kind, "UNKNOWN_AFTER_EXECUTION");
      assert.equal(store.records.at(-1)!.unknownReason, "UNRESOLVED");
    }
  });

  it("refuses without sending when the binding changed", async () => {
    const { plans, store, execution, confirm } = setup(ok);
    const { authorizationId } = execution.prepare(input());
    assert.deepEqual(
      await confirm(authorizationId, async () => "c".repeat(64)),
      {
        kind: "REFUSED_BEFORE_EXECUTION",
        reason: "BINDING_CHANGED",
      },
    );
    assert.equal(plans.length, 0);
    assert.equal(store.records.length, 0);
  });

  it("refuses without sending when evidence cannot be written", async () => {
    const { plans, store, execution, confirm } = setup(ok);
    const { authorizationId } = execution.prepare(input());
    Object.assign(store, {
      prepare: async () => {
        throw new Error("disk");
      },
    });

    assert.deepEqual(await confirm(authorizationId), {
      kind: "REFUSED_BEFORE_EXECUTION",
      reason: "LOCAL_EVIDENCE_UNAVAILABLE",
    });
    assert.equal(plans.length, 0);
  });

  it("does not let another scope spend an authorization", async () => {
    const { plans, execution } = setup(ok);
    const { authorizationId } = execution.prepare(input());
    const outcome = await execution.confirm(
      authorizationId,
      "other-scope",
      async () => BINDING,
      async () => undefined,
    );
    assert.equal(outcome.kind, "REFUSED_BEFORE_EXECUTION");
    assert.equal(plans.length, 0);
    assert.equal(
      (
        await execution.confirm(
          authorizationId,
          "project-one",
          async () => BINDING,
          async () => undefined,
        )
      ).kind,
      "COMPLETED",
    );
  });
});
