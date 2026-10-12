import { createHash } from "node:crypto";

export const CONVERSATION_TURN_SCHEMA_VERSION = 1 as const;
export const CONVERSATION_TURN_EFFECT =
  "SERVER_SCOPED_TURN_COORDINATION_NOT_MODEL_DELIVERY" as const;
export const CONVERSATION_TURN_LIMITS = Object.freeze({
  identifierBytes: 256,
  userTextBytes: 64 * 1024,
});

export type ConversationTurnRequest = Readonly<{
  conversationId: string;
  projectId: string | null;
  targetId: string;
  userText: string;
  clientRequestId: string;
  /** Optional opaque server preparation. Its absence preserves the five-field protocol. */
  reviewId?: string;
}>;

export type ConversationTurnScope = Readonly<{
  conversationId: string;
  projectId: string | null;
  workItemId: string | null;
  handoffId: string | null;
}>;

export type ResolvedConversationTurn = Readonly<{
  schemaVersion: typeof CONVERSATION_TURN_SCHEMA_VERSION;
  request: ConversationTurnRequest;
  scope: ConversationTurnScope;
  effect: typeof CONVERSATION_TURN_EFFECT;
}>;

export type ConversationTurnResult =
  | Readonly<{
      kind: "COMPLETED";
      assistantMessageId: string;
      effectiveModel: string;
      text: string;
      occurredAt: string;
      protection?: Readonly<{
        automatic: true;
        replacements: number;
      }>;
    }>
  | Readonly<{
      kind: "REFUSED_BEFORE_EXPOSURE";
      reason:
        | "TARGET_UNAVAILABLE"
        | "PRIVACY_BLOCKED"
        | "CONTEXT_UNAVAILABLE"
        | "REVIEW_INVALID"
        | "LOCAL_EVIDENCE_UNAVAILABLE";
    }>
  | Readonly<{
      kind: "UNKNOWN_AFTER_EXPOSURE";
      attemptId: string;
    }>
  | Readonly<{
      kind: "RESPONSE_WITHHELD";
      attemptId: string;
      reason: "RESTORATION_FAILED" | "CONTENT_BLOCKED" | "SAVE_FAILED";
    }>;

export type ConversationTurnOutcome = Readonly<{
  conversationId: string;
  projectId: string | null;
  clientRequestId: string;
  duplicate: boolean;
  result: ConversationTurnResult;
}>;

export type ConversationTurnScopeResolver = Readonly<{
  resolve(conversationId: string): Promise<ConversationTurnScope>;
}>;

export type ConversationTurnExecutor = Readonly<{
  execute(
    turn: ResolvedConversationTurn,
    execution: ConversationTurnExecution,
  ): Promise<ConversationTurnResult>;
}>;

/**
 * Executor evidence is linked durably before it can claim exposure. The class
 * names the store that holds it; its absence means model delivery, so links
 * written before agent execution existed keep their meaning (ADR-0049).
 */
export type ConversationTurnAttempt = Readonly<{
  projectId: string;
  authorizationId: string;
  attemptId: string;
  executionClass?: "MODEL_DELIVERY" | "AGENT_EXECUTION" | "LOCAL_MODEL";
}>;
export type ConversationTurnExecution = Readonly<{
  bindAttempt(attempt: ConversationTurnAttempt): Promise<void>;
}>;

export type ConversationTurnClaim = Readonly<{
  idempotencyKey: string;
  requestDigest: string;
  scope: ConversationTurnScope;
}>;

export type ConversationTurnIdempotency = Readonly<{
  /**
   * Serialize equal keys, execute an operation once, and return its first result
   * to an exact duplicate. Reusing a key with another digest must fail closed.
   */
  execute(
    claim: ConversationTurnClaim,
    operation: (
      execution: ConversationTurnExecution,
    ) => Promise<ConversationTurnResult>,
  ): Promise<Readonly<{ duplicate: boolean; result: ConversationTurnResult }>>;
}>;

export type ConversationTurnDependencies = Readonly<{
  scopes: ConversationTurnScopeResolver;
  idempotency: ConversationTurnIdempotency;
  executor: ConversationTurnExecutor;
}>;

export class ConversationTurnError extends Error {
  public constructor(message = "Conversation turn input or scope is invalid.") {
    super(message);
    this.name = "ConversationTurnError";
  }
}

export class ConversationTurnConflictError extends ConversationTurnError {
  public constructor() {
    super(
      "The client request identity is already bound to another conversation turn.",
    );
    this.name = "ConversationTurnConflictError";
  }
}

/**
 * Owns the stable provider-neutral boundary only. The injected executor composes
 * context, privacy, durable attempts, transport, restoration, and persistence.
 */
export class ConversationTurn {
  readonly #dependencies: ConversationTurnDependencies;

  public constructor(dependencies: ConversationTurnDependencies) {
    this.#dependencies = dependencies;
  }

  public async run(value: unknown): Promise<ConversationTurnOutcome> {
    const request = validateConversationTurnRequest(value);
    const scope = validateScope(
      await this.#dependencies.scopes.resolve(request.conversationId),
    );
    if (
      scope.conversationId !== request.conversationId ||
      scope.projectId !== request.projectId
    )
      throw new ConversationTurnError(
        "The requested conversation does not belong to the claimed project scope.",
      );
    const turn: ResolvedConversationTurn = Object.freeze({
      schemaVersion: CONVERSATION_TURN_SCHEMA_VERSION,
      request,
      scope,
      effect: CONVERSATION_TURN_EFFECT,
    });
    const outcome = await this.#dependencies.idempotency.execute(
      conversationTurnClaim(request, scope),
      (execution) => this.#dependencies.executor.execute(turn, execution),
    );
    return Object.freeze({
      conversationId: scope.conversationId,
      projectId: scope.projectId,
      clientRequestId: request.clientRequestId,
      duplicate: outcome.duplicate,
      result: outcome.result,
    });
  }
}

export function validateConversationTurnRequest(
  value: unknown,
): ConversationTurnRequest {
  if (
    !record(value) ||
    !exactKeys(value, [
      "clientRequestId",
      "conversationId",
      "projectId",
      "targetId",
      "userText",
      ...(Object.hasOwn(value, "reviewId") ? ["reviewId"] : []),
    ]) ||
    !identifier(value.conversationId) ||
    !(value.projectId === null || identifier(value.projectId)) ||
    !identifier(value.targetId) ||
    !message(value.userText) ||
    !identifier(value.clientRequestId) ||
    (Object.hasOwn(value, "reviewId") &&
      (typeof value.reviewId !== "string" ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value.reviewId)))
  )
    throw new ConversationTurnError();
  return Object.freeze({
    conversationId: value.conversationId,
    projectId: value.projectId,
    targetId: value.targetId,
    userText: value.userText,
    clientRequestId: value.clientRequestId,
    ...(typeof value.reviewId === "string" ? { reviewId: value.reviewId } : {}),
  });
}

export function conversationTurnClaim(
  requestValue: unknown,
  scopeValue: unknown,
): ConversationTurnClaim {
  const request = validateConversationTurnRequest(requestValue);
  const scope = validateScope(scopeValue);
  if (
    scope.conversationId !== request.conversationId ||
    scope.projectId !== request.projectId
  )
    throw new ConversationTurnError();
  return Object.freeze({
    idempotencyKey: sha256(
      JSON.stringify([request.conversationId, request.clientRequestId]),
    ),
    requestDigest: sha256(JSON.stringify(request)),
    scope,
  });
}

export function validateScope(value: unknown): ConversationTurnScope {
  if (
    !record(value) ||
    !exactKeys(value, [
      "conversationId",
      "handoffId",
      "projectId",
      "workItemId",
    ]) ||
    !identifier(value.conversationId) ||
    !(value.projectId === null || identifier(value.projectId)) ||
    !(value.workItemId === null || identifier(value.workItemId)) ||
    !(value.handoffId === null || identifier(value.handoffId)) ||
    (value.projectId === null &&
      (value.workItemId !== null || value.handoffId !== null)) ||
    (value.workItemId === null && value.handoffId !== null)
  )
    throw new ConversationTurnError(
      "The authoritative conversation scope is invalid.",
    );
  return Object.freeze({
    conversationId: value.conversationId,
    projectId: value.projectId,
    workItemId: value.workItemId,
    handoffId: value.handoffId,
  });
}

function identifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.isWellFormed() &&
    Buffer.byteLength(value, "utf8") <=
      CONVERSATION_TURN_LIMITS.identifierBytes &&
    !/\p{Cc}/u.test(value)
  );
}

function message(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    value.isWellFormed() &&
    Buffer.byteLength(value, "utf8") <=
      CONVERSATION_TURN_LIMITS.userTextBytes &&
    !/[\p{Cc}&&[^\n\r\t]]/v.test(value)
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
