import { randomUUID } from "node:crypto";

import type { LocalModelAttempts } from "./attempts.ts";
import { LOCAL_MODEL_LIMITS } from "./limits.ts";
import {
  LOCAL_MODEL_PROTECTION,
  LOCAL_MODEL_UNKNOWN_REASONS,
  validDigest,
  validText,
  type LocalModelUnknownReason,
} from "./record.ts";
import { planChatRequest, type LocalModelPlan } from "./request.ts";

const PENDING_LIMIT = 20;
const AUTHORIZATION_MS = 5 * 60_000;

export type LocalModelRunResult =
  | Readonly<{ kind: "ANSWER"; text: string; reportedModel: string | null }>
  | Readonly<{ kind: "UNKNOWN"; reason: LocalModelUnknownReason }>;

/**
 * The one qualified adapter behind a port. It receives the plan the
 * coordinator computed and sends exactly `plan.body` to the loopback server
 * the user started: no redirect, no proxy, no fallback. It is the only
 * operation that can reach the network and it never throws an answer.
 */
export type LocalModelExecutor = Readonly<{
  qualification: string;
  execute(plan: LocalModelPlan): Promise<LocalModelRunResult>;
}>;

export type LocalModelExecutionInput = Readonly<{
  scopeId: string;
  targetId: string;
  model: string;
  text: string;
  /** Declared by the user in the target; anything else is refused. */
  boundary: "LOCAL_ONLY";
  bindingDigest: string;
  preflightAuditEventHash: string;
}>;

/** The shape the durable turn registry links before execution is claimed. */
export type LocalModelAttemptReference = Readonly<{
  projectId: string;
  authorizationId: string;
  attemptId: string;
  executionClass: "LOCAL_MODEL";
}>;

export type LocalModelExecutionOutcome =
  | Readonly<{
      kind: "COMPLETED";
      attemptId: string;
      text: string;
      reportedModel: string | null;
    }>
  | Readonly<{
      kind: "UNKNOWN_AFTER_EXECUTION";
      attemptId: string;
      reason: LocalModelUnknownReason;
    }>
  | Readonly<{
      kind: "REFUSED_BEFORE_EXECUTION";
      reason:
        "EXPIRED_OR_USED" | "BINDING_CHANGED" | "LOCAL_EVIDENCE_UNAVAILABLE";
    }>;

type Pending = Readonly<{
  input: LocalModelExecutionInput;
  plan: LocalModelPlan;
  expiresAt: number;
}>;

/**
 * ADR-0051. Owns transient local model authorizations. Everything that can
 * refuse runs before the durable execution claim; after it, only a validated
 * answer that was recorded as completed is an answer, and nothing is sent
 * twice.
 */
export class LocalModelExecution {
  readonly #attempts: LocalModelAttempts;
  readonly #executor: LocalModelExecutor;
  readonly #clock: () => number;
  readonly #ids: () => string;
  readonly #pending = new Map<string, Pending>();

  public constructor(
    dependencies: Readonly<{
      attempts: LocalModelAttempts;
      executor: LocalModelExecutor;
      clock?: () => number;
      ids?: () => string;
    }>,
  ) {
    if (!validText(dependencies.executor.qualification))
      throw new Error("INVALID_LOCAL_MODEL_EXECUTOR");
    this.#attempts = dependencies.attempts;
    this.#executor = dependencies.executor;
    this.#clock = dependencies.clock ?? Date.now;
    this.#ids = dependencies.ids ?? randomUUID;
  }

  /** Validates and plans without I/O. Throws when the request cannot run. */
  public prepare(input: LocalModelExecutionInput) {
    if (
      ![input.scopeId, input.targetId, input.model].every(validText) ||
      input.boundary !== "LOCAL_ONLY" ||
      !validDigest(input.bindingDigest) ||
      !validDigest(input.preflightAuditEventHash)
    )
      throw new Error("INVALID_LOCAL_MODEL_EXECUTION_PREPARATION");
    const plan = planChatRequest({ model: input.model, text: input.text });
    const now = this.#clock();
    for (const [id, entry] of this.#pending)
      if (entry.expiresAt <= now) this.#pending.delete(id);
    if (this.#pending.size >= PENDING_LIMIT)
      throw new Error("LOCAL_MODEL_PREPARATION_CAPACITY");
    const authorizationId = this.#ids();
    if (!validText(authorizationId) || this.#pending.has(authorizationId))
      throw new Error("INVALID_AUTHORIZATION_ID");
    const expiresAt = now + AUTHORIZATION_MS;
    this.#pending.set(
      authorizationId,
      Object.freeze({ input: Object.freeze({ ...input }), plan, expiresAt }),
    );
    return Object.freeze({
      authorizationId,
      expiresAt,
      model: input.model,
      text: input.text,
      protection: LOCAL_MODEL_PROTECTION,
    });
  }

  public async confirm(
    authorizationId: string,
    scopeId: string,
    revalidate: () => Promise<string>,
    bindAttempt: (reference: LocalModelAttemptReference) => Promise<void>,
  ): Promise<LocalModelExecutionOutcome> {
    const entry = this.#pending.get(authorizationId);
    // Scope is checked before consumption so another scope cannot spend it.
    if (
      !entry ||
      entry.expiresAt <= this.#clock() ||
      entry.input.scopeId !== scopeId
    )
      return { kind: "REFUSED_BEFORE_EXECUTION", reason: "EXPIRED_OR_USED" };
    this.#pending.delete(authorizationId);
    const { input, plan } = entry;
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
          executionClass: "LOCAL_MODEL",
        }),
      );
      await this.#attempts.prepare({
        schemaVersion: 1,
        scopeId: input.scopeId,
        authorizationId,
        attemptId,
        executionClass: "LOCAL_MODEL",
        kind: "LLAMA_SERVER_LOOPBACK",
        targetId: input.targetId,
        qualification: this.#executor.qualification,
        protection: LOCAL_MODEL_PROTECTION,
        inputDigest: plan.inputDigest,
        invocationDigest: plan.invocationDigest,
        bindingDigest: input.bindingDigest,
        preflightAuditEventHash: input.preflightAuditEventHash,
        preparedAt: this.#now(),
      });
      // The durable writes above awaited too. Recheck the binding and the plan
      // immediately before the claim that makes the call possible.
      const replanned = planChatRequest({
        model: input.model,
        text: input.text,
      });
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
      // Nothing was sent. Recovery of the linked turn still treats a
      // reference without readable evidence as unknown, never as refused.
      return {
        kind: "REFUSED_BEFORE_EXECUTION",
        reason: "LOCAL_EVIDENCE_UNAVAILABLE",
      };
    }
    let reason: LocalModelUnknownReason = "UNRESOLVED";
    try {
      const result = await this.#executor.execute(plan);
      if (result.kind === "UNKNOWN") {
        if (LOCAL_MODEL_UNKNOWN_REASONS.includes(result.reason))
          reason = result.reason;
        throw new Error("UNKNOWN_LOCAL_MODEL_EXECUTION");
      }
      if (
        result.kind !== "ANSWER" ||
        typeof result.text !== "string" ||
        !result.text.trim() ||
        !result.text.isWellFormed() ||
        Buffer.byteLength(result.text, "utf8") >
          LOCAL_MODEL_LIMITS.answerBytes ||
        !(result.reportedModel === null || validText(result.reportedModel))
      )
        throw new Error("UNRESOLVED_LOCAL_MODEL_EXECUTION");
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
        .markUnknown(input.scopeId, attemptId, reason, this.#now())
        .catch(() => undefined);
      return { kind: "UNKNOWN_AFTER_EXECUTION", attemptId, reason };
    }
  }

  #now(): string {
    return new Date(this.#clock()).toISOString();
  }
}
