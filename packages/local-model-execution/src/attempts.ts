import {
  LocalModelAttemptError,
  sha256,
  validateLocalModelAttemptInput,
  validText,
  type LocalModelAttemptInput,
  type LocalModelAttemptPatch,
  type LocalModelAttemptRecord,
  type LocalModelAttemptSnapshot,
  type LocalModelAttemptState,
  type LocalModelUnknownReason,
} from "./record.ts";

export type LocalModelAttemptStore = Readonly<{
  prepare(input: LocalModelAttemptInput): Promise<LocalModelAttemptRecord>;
  transition(
    scopeId: string,
    attemptId: string,
    allowed: readonly LocalModelAttemptState[],
    patch: LocalModelAttemptPatch,
  ): Promise<LocalModelAttemptRecord>;
  inspect(scopeId: string, attemptId: string): Promise<LocalModelAttemptRecord>;
  list(scopeId: string): Promise<LocalModelAttemptSnapshot>;
}>;

/**
 * The only writer of local model attempt evidence. It records digests, never
 * the supplied input, the answer, reasoning text, addresses or credentials.
 */
export class LocalModelAttempts {
  readonly #store: LocalModelAttemptStore;

  public constructor(store: LocalModelAttemptStore) {
    this.#store = store;
  }

  public prepare(
    input: LocalModelAttemptInput,
  ): Promise<LocalModelAttemptRecord> {
    return this.#run(() =>
      this.#store.prepare(validateLocalModelAttemptInput(input)),
    );
  }

  public claimExecution(
    scopeId: string,
    attemptId: string,
    at: string,
  ): Promise<LocalModelAttemptRecord> {
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
  ): Promise<LocalModelAttemptRecord> {
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
  ): Promise<LocalModelAttemptRecord> {
    if (
      typeof output !== "string" ||
      !output.trim() ||
      (reportedModel !== null && !validText(reportedModel))
    )
      return Promise.reject(new LocalModelAttemptError());
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
    reason: LocalModelUnknownReason,
    at: string,
  ): Promise<LocalModelAttemptRecord> {
    return this.#run(() =>
      this.#store.transition(scopeId, attemptId, ["EXECUTION_STARTED"], {
        state: "UNKNOWN_AFTER_EXECUTION",
        unknownReason: reason,
        updatedAt: at,
      }),
    );
  }

  public inspect(
    scopeId: string,
    attemptId: string,
  ): Promise<LocalModelAttemptRecord> {
    return this.#run(() => this.#store.inspect(scopeId, attemptId));
  }

  public list(scopeId: string): Promise<LocalModelAttemptSnapshot> {
    return this.#run(() => this.#store.list(scopeId));
  }

  async #run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LocalModelAttemptError) throw error;
      throw new LocalModelAttemptError({ cause: error });
    }
  }
}
