import { randomUUID } from "node:crypto";

import type { AgentAttempts } from "./attempts.ts";
import {
  AGENT_EXECUTION_KINDS,
  agentUnknownDetail,
  validDigest,
  validText,
  type AgentExecutionKind,
} from "./record.ts";

const PENDING_LIMIT = 20;
const AUTHORIZATION_MS = 5 * 60_000;
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export type AgentExecutionRequest = Readonly<{
  model: string;
  text: string;
  timeoutMs: number;
}>;

/** What will run, as digests only, computed without starting a process. */
export type AgentExecutionPlan = Readonly<{
  inputDigest: string;
  invocationDigest: string;
}>;

export type AgentRunResult =
  | Readonly<{ kind: "COMPLETED"; text: string; reportedModel: string | null }>
  | Readonly<{ kind: "REJECTED_BEFORE_EXECUTION" }>
  | Readonly<{
      kind: "UNKNOWN_AFTER_EXECUTION";
      /** Checked against the closed list; anything else becomes UNRESOLVED. */
      reason?: string;
      unexpectedEvent?: string | null;
    }>;

/**
 * One qualified agent adapter behind a port. `plan` is pure and may throw;
 * `execute` is the only operation that can start a process. The coordinator
 * never falls back to another executor or to model delivery.
 */
export type AgentExecutor = Readonly<{
  kind: AgentExecutionKind;
  qualification: string;
  plan(request: AgentExecutionRequest): AgentExecutionPlan;
  execute(request: AgentExecutionRequest): Promise<AgentRunResult>;
}>;

export type AgentExecutionInput = Readonly<{
  scopeId: string;
  targetId: string;
  kind: AgentExecutionKind;
  model: string;
  text: string;
  bindingDigest: string;
  preflightAuditEventHash: string;
  timeoutMs: number;
}>;

/** The shape the durable turn registry links before execution is claimed. */
export type AgentAttemptReference = Readonly<{
  projectId: string;
  authorizationId: string;
  attemptId: string;
  executionClass: "AGENT_EXECUTION";
}>;

export type AgentExecutionOutcome =
  | Readonly<{
      kind: "COMPLETED";
      attemptId: string;
      text: string;
      reportedModel: string | null;
    }>
  | Readonly<{ kind: "UNKNOWN_AFTER_EXECUTION"; attemptId: string }>
  | Readonly<{
      kind: "REFUSED_BEFORE_EXECUTION";
      reason:
        "EXPIRED_OR_USED" | "BINDING_CHANGED" | "LOCAL_EVIDENCE_UNAVAILABLE";
    }>;

type Pending = Readonly<{
  input: AgentExecutionInput;
  plan: AgentExecutionPlan;
  executor: AgentExecutor;
  expiresAt: number;
}>;

/**
 * ADR-0049. Owns transient agent authorizations. Everything that can refuse
 * runs before the durable execution claim; after it, only a validated answer
 * that was recorded as completed is an answer, and nothing is run twice.
 */
export class AgentExecution {
  readonly #attempts: AgentAttempts;
  readonly #executors: ReadonlyMap<AgentExecutionKind, AgentExecutor>;
  readonly #clock: () => number;
  readonly #ids: () => string;
  readonly #pending = new Map<string, Pending>();

  public constructor(
    dependencies: Readonly<{
      attempts: AgentAttempts;
      executors: readonly AgentExecutor[];
      clock?: () => number;
      ids?: () => string;
    }>,
  ) {
    const executors = new Map<AgentExecutionKind, AgentExecutor>();
    for (const executor of dependencies.executors) {
      if (
        !AGENT_EXECUTION_KINDS.includes(executor.kind) ||
        !validText(executor.qualification) ||
        executors.has(executor.kind)
      )
        throw new Error("INVALID_AGENT_EXECUTOR");
      executors.set(executor.kind, executor);
    }
    this.#attempts = dependencies.attempts;
    this.#executors = executors;
    this.#clock = dependencies.clock ?? Date.now;
    this.#ids = dependencies.ids ?? randomUUID;
  }

  /** Validates and plans without I/O. Throws when the request cannot run. */
  public prepare(input: AgentExecutionInput) {
    if (
      ![input.scopeId, input.targetId, input.model].every(validText) ||
      !validDigest(input.bindingDigest) ||
      !validDigest(input.preflightAuditEventHash) ||
      typeof input.text !== "string" ||
      !input.text.trim() ||
      !input.text.isWellFormed() ||
      Buffer.byteLength(input.text, "utf8") > MAX_INPUT_BYTES ||
      !Number.isInteger(input.timeoutMs) ||
      input.timeoutMs < 1 ||
      input.timeoutMs > 120_000
    )
      throw new Error("INVALID_AGENT_EXECUTION_PREPARATION");
    const executor = this.#executors.get(input.kind);
    if (executor === undefined) throw new Error("AGENT_EXECUTOR_UNAVAILABLE");
    const plan = checkedPlan(executor, request(input));
    const now = this.#clock();
    for (const [id, entry] of this.#pending)
      if (entry.expiresAt <= now) this.#pending.delete(id);
    if (this.#pending.size >= PENDING_LIMIT)
      throw new Error("AGENT_EXECUTION_PREPARATION_CAPACITY");
    const authorizationId = this.#ids();
    if (!validText(authorizationId) || this.#pending.has(authorizationId))
      throw new Error("INVALID_AUTHORIZATION_ID");
    const expiresAt = now + AUTHORIZATION_MS;
    this.#pending.set(
      authorizationId,
      Object.freeze({
        input: Object.freeze({ ...input }),
        plan,
        executor,
        expiresAt,
      }),
    );
    return Object.freeze({
      authorizationId,
      expiresAt,
      kind: input.kind,
      model: input.model,
      text: input.text,
    });
  }

  public async confirm(
    authorizationId: string,
    scopeId: string,
    revalidate: () => Promise<string>,
    bindAttempt: (reference: AgentAttemptReference) => Promise<void>,
  ): Promise<AgentExecutionOutcome> {
    const entry = this.#pending.get(authorizationId);
    // Scope is checked before consumption so another scope cannot spend it.
    if (
      !entry ||
      entry.expiresAt <= this.#clock() ||
      entry.input.scopeId !== scopeId
    )
      return { kind: "REFUSED_BEFORE_EXECUTION", reason: "EXPIRED_OR_USED" };
    this.#pending.delete(authorizationId);
    const { input, executor, plan } = entry;
    const current = () =>
      entry.expiresAt > this.#clock() &&
      revalidate().then((digest) => digest === input.bindingDigest);
    const attemptId = this.#ids();
    try {
      if (!validText(attemptId) || !(await current()))
        return { kind: "REFUSED_BEFORE_EXECUTION", reason: "BINDING_CHANGED" };
      await bindAttempt(
        Object.freeze({
          projectId: input.scopeId,
          authorizationId,
          attemptId,
          executionClass: "AGENT_EXECUTION",
        }),
      );
      await this.#attempts.prepare({
        schemaVersion: 1,
        scopeId: input.scopeId,
        authorizationId,
        attemptId,
        executionClass: "AGENT_EXECUTION",
        kind: input.kind,
        targetId: input.targetId,
        qualification: executor.qualification,
        inputDigest: plan.inputDigest,
        invocationDigest: plan.invocationDigest,
        bindingDigest: input.bindingDigest,
        preflightAuditEventHash: input.preflightAuditEventHash,
        preparedAt: this.#now(),
      });
      // The durable writes above awaited too. Recheck the binding and the plan
      // immediately before the claim that makes execution possible.
      const replanned = checkedPlan(executor, request(input));
      if (
        replanned.inputDigest !== plan.inputDigest ||
        replanned.invocationDigest !== plan.invocationDigest ||
        !(await current())
      ) {
        await this.#attempts
          .refuse(input.scopeId, attemptId, this.#now())
          .catch(() => undefined);
        return { kind: "REFUSED_BEFORE_EXECUTION", reason: "BINDING_CHANGED" };
      }
      const claim = await this.#attempts.claimExecution(
        input.scopeId,
        attemptId,
        this.#now(),
      );
      const reread = await this.#attempts.inspect(input.scopeId, attemptId);
      if (
        reread.recordHash !== claim.recordHash ||
        reread.state !== "EXECUTION_STARTED" ||
        reread.executionCount !== 1
      )
        throw new Error("CLAIM_NOT_VERIFIED");
    } catch {
      // Nothing was started. Recovery of the linked turn still treats a
      // reference without readable evidence as unknown, never as refused.
      return {
        kind: "REFUSED_BEFORE_EXECUTION",
        reason: "LOCAL_EVIDENCE_UNAVAILABLE",
      };
    }
    let reported: unknown = null;
    try {
      const result = await executor.execute(request(input));
      if (result.kind === "UNKNOWN_AFTER_EXECUTION") reported = result;
      if (
        result.kind !== "COMPLETED" ||
        typeof result.text !== "string" ||
        !result.text.trim() ||
        !result.text.isWellFormed() ||
        Buffer.byteLength(result.text, "utf8") > MAX_OUTPUT_BYTES ||
        !(result.reportedModel === null || validText(result.reportedModel))
      )
        throw new Error("UNRESOLVED_AGENT_EXECUTION");
      await this.#attempts.complete(
        input.scopeId,
        attemptId,
        result.text,
        result.reportedModel,
        this.#now(),
      );
      return {
        kind: "COMPLETED",
        attemptId,
        text: result.text,
        reportedModel: result.reportedModel,
      };
    } catch {
      await this.#attempts
        .markUnknown(
          input.scopeId,
          attemptId,
          this.#now(),
          agentUnknownDetail(reported),
        )
        .catch(() => undefined);
      return { kind: "UNKNOWN_AFTER_EXECUTION", attemptId };
    }
  }

  #now(): string {
    return new Date(this.#clock()).toISOString();
  }
}

function request(input: AgentExecutionInput): AgentExecutionRequest {
  return Object.freeze({
    model: input.model,
    text: input.text,
    timeoutMs: input.timeoutMs,
  });
}

function checkedPlan(
  executor: AgentExecutor,
  value: AgentExecutionRequest,
): AgentExecutionPlan {
  const plan = executor.plan(value);
  if (!validDigest(plan.inputDigest) || !validDigest(plan.invocationDigest))
    throw new Error("INVALID_AGENT_EXECUTION_PLAN");
  return Object.freeze({
    inputDigest: plan.inputDigest,
    invocationDigest: plan.invocationDigest,
  });
}
