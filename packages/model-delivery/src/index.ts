import { createHash, randomUUID } from "node:crypto";
import type { ModelAttempts } from "@ai-workspace/model-attempts";

export type DeliveryInput = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  model: string;
  text: string;
  bindingDigest: string;
  preflightAuditEventHash: string;
  destination: "EXTERNAL";
  providerKind: "OPENAI_RESPONSES";
  maxOutputTokens: number;
  timeoutMs: number;
}>;
export type DeliveryUsage = Readonly<{
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
}>;
export type TransportResult =
  | Readonly<{
      kind: "COMPLETED";
      text: string;
      requestId: string;
      responseId: string;
      usage: DeliveryUsage;
    }>
  | Readonly<{ kind: "REJECTED" }>
  | Readonly<{ kind: "UNKNOWN" }>;
export type DeliveryTransport = Readonly<{
  send(
    input: Pick<
      DeliveryInput,
      "model" | "text" | "maxOutputTokens" | "timeoutMs"
    >,
  ): Promise<TransportResult>;
}>;
export type DeliveryOutcome =
  | Readonly<{
      kind: "COMPLETED";
      attemptId: string;
      text: string;
      usage: DeliveryUsage;
    }>
  | Readonly<{
      kind: "TERMINAL_REJECTED" | "UNKNOWN_AFTER_EXPOSURE";
      attemptId: string;
    }>
  | Readonly<{
      kind: "REFUSED_BEFORE_EXPOSURE";
      reason:
        "EXPIRED_OR_USED" | "BINDING_CHANGED" | "LOCAL_EVIDENCE_UNAVAILABLE";
    }>;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const hash = (value: string) => /^[a-f0-9]{64}$/u.test(value);
const bounded = (value: string) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 256 &&
  ![...value].some((character) => {
    const point = character.codePointAt(0)!;
    return point < 32 || point === 127;
  });

/** One coordinator owns transient authorizations. Only the attempt service can
 * publish durable evidence; only the injected transport can cross the boundary. */
export class ModelDelivery {
  readonly #attempts: ModelAttempts;
  readonly #transport: DeliveryTransport;
  readonly #clock: () => number;
  readonly #ids: () => string;
  readonly #pending = new Map<
    string,
    { input: DeliveryInput; expiresAt: number }
  >();
  readonly #recovering = new Map<string, Promise<void>>();
  constructor(
    dependencies: Readonly<{
      attempts: ModelAttempts;
      transport: DeliveryTransport;
      clock?: () => number;
      ids?: () => string;
    }>,
  ) {
    this.#attempts = dependencies.attempts;
    this.#transport = dependencies.transport;
    this.#clock = dependencies.clock ?? Date.now;
    this.#ids = dependencies.ids ?? randomUUID;
  }
  /** Run once per project before enabling confirmation; never a GET side effect. */
  initialize(projectId: string): Promise<void> {
    let recovery = this.#recovering.get(projectId);
    if (!recovery) {
      recovery = this.#attempts.recover(projectId).then(() => undefined);
      this.#recovering.set(projectId, recovery);
    }
    return recovery;
  }
  prepare(input: DeliveryInput) {
    if (
      ![input.projectId, input.workItemId, input.handoffId, input.model].every(
        bounded,
      ) ||
      input.destination !== "EXTERNAL" ||
      input.providerKind !== "OPENAI_RESPONSES" ||
      !hash(input.bindingDigest) ||
      !hash(input.preflightAuditEventHash) ||
      !input.text.trim() ||
      !input.text.isWellFormed() ||
      Buffer.byteLength(input.text) > 262144 ||
      !Number.isInteger(input.maxOutputTokens) ||
      input.maxOutputTokens < 1 ||
      input.maxOutputTokens > 16384 ||
      !Number.isInteger(input.timeoutMs) ||
      input.timeoutMs < 1 ||
      input.timeoutMs > 120000
    )
      throw new Error("INVALID_DELIVERY_PREPARATION");
    const now = this.#clock();
    for (const [id, entry] of this.#pending)
      if (entry.expiresAt <= now) this.#pending.delete(id);
    if (this.#pending.size >= 20)
      throw new Error("DELIVERY_PREPARATION_CAPACITY");
    const authorizationId = this.#ids();
    if (!bounded(authorizationId) || this.#pending.has(authorizationId))
      throw new Error("INVALID_AUTHORIZATION_ID");
    const expiresAt = now + 5 * 60_000;
    this.#pending.set(authorizationId, {
      input: Object.freeze({ ...input }),
      expiresAt,
    });
    return Object.freeze({
      authorizationId,
      expiresAt,
      text: input.text,
      model: input.model,
      destination: input.destination,
      maxOutputTokens: input.maxOutputTokens,
      timeoutMs: input.timeoutMs,
    });
  }
  async confirm(
    authorizationId: string,
    scope: Readonly<{
      projectId: string;
      workItemId: string;
      handoffId: string;
    }>,
    revalidate: () => Promise<string>,
    bindAttempt?: (
      reference: Readonly<{
        projectId: string;
        authorizationId: string;
        attemptId: string;
      }>,
    ) => Promise<void>,
  ): Promise<DeliveryOutcome> {
    const entry = this.#pending.get(authorizationId);
    // Scope is checked before consumption so a different conversation cannot use it.
    if (
      !entry ||
      entry.expiresAt <= this.#clock() ||
      entry.input.projectId !== scope.projectId ||
      entry.input.workItemId !== scope.workItemId ||
      entry.input.handoffId !== scope.handoffId
    )
      return { kind: "REFUSED_BEFORE_EXPOSURE", reason: "EXPIRED_OR_USED" };
    this.#pending.delete(authorizationId);
    const input = entry.input;
    const attemptId = this.#ids();
    try {
      if (
        (await revalidate()) !== input.bindingDigest ||
        entry.expiresAt <= this.#clock()
      )
        return { kind: "REFUSED_BEFORE_EXPOSURE", reason: "BINDING_CHANGED" };
      // A durable turn recovers only its own identity. Sweeping the project here
      // could mark another process's in-flight delivery unknown.
      if (bindAttempt)
        await bindAttempt({
          projectId: input.projectId,
          authorizationId,
          attemptId,
        });
      else await this.initialize(input.projectId);
      const requestDigest = digest(
        JSON.stringify({
          model: input.model,
          text: input.text,
          maxOutputTokens: input.maxOutputTokens,
          timeoutMs: input.timeoutMs,
        }),
      );
      await this.#attempts.prepare({
        schemaVersion: 1,
        projectId: input.projectId,
        authorizationId,
        attemptId,
        providerKind: input.providerKind,
        requestDigest,
        authorizationDigest: digest(
          JSON.stringify({
            authorizationId,
            ...scope,
            bindingDigest: input.bindingDigest,
            requestDigest,
          }),
        ),
        preflightAuditEventHash: input.preflightAuditEventHash,
      });
      // Durable binding/preparation perform I/O too. Recheck after those writes,
      // immediately before consuming the executor's exposure claim.
      if (
        bindAttempt &&
        ((await revalidate()) !== input.bindingDigest ||
          entry.expiresAt <= this.#clock())
      )
        return { kind: "REFUSED_BEFORE_EXPOSURE", reason: "BINDING_CHANGED" };
      const claim = await this.#attempts.claimExposure(
        input.projectId,
        attemptId,
      );
      const reread = await this.#attempts.inspect(input.projectId, attemptId);
      if (
        reread.recordHash !== claim.recordHash ||
        reread.state !== "EXPOSURE_STARTED" ||
        reread.exposureCount !== 1
      )
        throw new Error("CLAIM_NOT_VERIFIED");
    } catch {
      return {
        kind: "REFUSED_BEFORE_EXPOSURE",
        reason: "LOCAL_EVIDENCE_UNAVAILABLE",
      };
    }
    try {
      const result = await this.#transport.send({
        model: input.model,
        text: input.text,
        maxOutputTokens: input.maxOutputTokens,
        timeoutMs: input.timeoutMs,
      });
      if (result.kind === "REJECTED") {
        await this.#attempts.terminalReject(input.projectId, attemptId);
        return { kind: "TERMINAL_REJECTED", attemptId };
      }
      if (
        result.kind !== "COMPLETED" ||
        !result.text.trim() ||
        !result.text.isWellFormed() ||
        Buffer.byteLength(result.text) > 1024 * 1024
      )
        throw new Error("UNRESOLVED_TRANSPORT");
      await this.#attempts.acknowledge(
        input.projectId,
        attemptId,
        result.requestId,
        result.responseId,
      );
      await this.#attempts.complete(input.projectId, attemptId, result.text);
      return {
        kind: "COMPLETED",
        attemptId,
        text: result.text,
        usage: result.usage,
      };
    } catch {
      try {
        await this.#attempts.markUnknown(input.projectId, attemptId);
      } catch {
        /* Recovery will preserve uncertainty if local evidence could not be updated. */
      }
      return { kind: "UNKNOWN_AFTER_EXPOSURE", attemptId };
    }
  }
}
