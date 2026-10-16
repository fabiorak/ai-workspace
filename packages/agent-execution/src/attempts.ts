import {
  AgentAttemptError,
  agentUnknownDetail,
  sha256,
  validateAgentAttemptInput,
  validText,
  type AgentAttemptInput,
  type AgentAttemptPatch,
  type AgentAttemptRecord,
  type AgentAttemptSnapshot,
  type AgentAttemptState,
  type AgentUnknownDetail,
} from "./record.ts";

export type AgentAttemptStore = Readonly<{
  prepare(input: AgentAttemptInput): Promise<AgentAttemptRecord>;
  transition(
    scopeId: string,
    attemptId: string,
    allowed: readonly AgentAttemptState[],
    patch: AgentAttemptPatch,
  ): Promise<AgentAttemptRecord>;
  inspect(scopeId: string, attemptId: string): Promise<AgentAttemptRecord>;
  list(scopeId: string): Promise<AgentAttemptSnapshot>;
}>;

/**
 * The only writer of agent attempt evidence. It records digests, never the
 * supplied input, the answer, process streams, paths or credentials.
 */
export class AgentAttempts {
  readonly #store: AgentAttemptStore;

  public constructor(store: AgentAttemptStore) {
    this.#store = store;
  }

  public prepare(input: AgentAttemptInput): Promise<AgentAttemptRecord> {
    return this.#run(() =>
      this.#store.prepare(validateAgentAttemptInput(input)),
    );
  }

  public claimExecution(
    scopeId: string,
    attemptId: string,
    at: string,
  ): Promise<AgentAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(scopeId, attemptId, ["PREPARED"], {
        state: "EXECUTION_STARTED",
        executionCount: 1,
        updatedAt: at,
      }),
    );
  }

  public refuse(
    scopeId: string,
    attemptId: string,
    at: string,
  ): Promise<AgentAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(scopeId, attemptId, ["PREPARED"], {
        state: "REFUSED_BEFORE_EXECUTION",
        updatedAt: at,
      }),
    );
  }

  public complete(
    scopeId: string,
    attemptId: string,
    output: string,
    reportedModel: string | null,
    at: string,
  ): Promise<AgentAttemptRecord> {
    if (
      typeof output !== "string" ||
      !output.trim() ||
      (reportedModel !== null && !validText(reportedModel))
    )
      return Promise.reject(new AgentAttemptError());
    return this.#run(() =>
      this.#store.transition(scopeId, attemptId, ["EXECUTION_STARTED"], {
        state: "COMPLETED",
        outputDigest: sha256(output),
        reportedModel,
        updatedAt: at,
      }),
    );
  }

  public markUnknown(
    scopeId: string,
    attemptId: string,
    at: string,
    detail: AgentUnknownDetail = agentUnknownDetail(null),
  ): Promise<AgentAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(scopeId, attemptId, ["EXECUTION_STARTED"], {
        state: "UNKNOWN_AFTER_EXECUTION",
        unknownReason: detail.unknownReason,
        unexpectedEvent: detail.unexpectedEvent,
        updatedAt: at,
      }),
    );
  }

  public inspect(
    scopeId: string,
    attemptId: string,
  ): Promise<AgentAttemptRecord> {
    return this.#run(() => this.#store.inspect(scopeId, attemptId));
  }

  public list(scopeId: string): Promise<AgentAttemptSnapshot> {
    return this.#run(() => this.#store.list(scopeId));
  }

  async #run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AgentAttemptError) throw error;
      throw new AgentAttemptError({ cause: error });
    }
  }
}
