import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

const DIGEST = /^[a-f0-9]{64}$/u;
const DOCUMENT = /^project_[a-f0-9]{64}\.json$/u;
const LOCK = ".attempt-evidence.lock";
const MAX_TEXT = 256;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

export const DURABLE_ATTEMPT_RECORD_LIMIT = 64;

export type DurableAttemptState =
  | "PREPARED"
  | "EXPOSURE_STARTED"
  | "ACKNOWLEDGED"
  | "COMPLETED"
  | "TERMINAL_REJECTED"
  | "UNKNOWN_AFTER_EXPOSURE";

export type DurableAttemptRecord = Readonly<{
  schemaVersion: 1;
  projectId: string;
  authorizationId: string;
  attemptId: string;
  providerKind: "OPENAI_RESPONSES";
  requestDigest: string;
  authorizationDigest: string;
  preflightAuditEventHash: string;
  state: DurableAttemptState;
  revision: number;
  exposureCount: 0 | 1;
  providerRequestIdDigest: string | null;
  responseIdDigest: string | null;
  outputDigest: string | null;
  automaticRetryScheduled: false;
  predecessorRecordHash: string | null;
  recordHash: string;
  effect: "SYNTHETIC_DURABLE_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH";
}>;

export type DurableAttemptSnapshot = Readonly<{
  schemaVersion: 1;
  projectId: string;
  revision: number;
  records: readonly DurableAttemptRecord[];
  effect: "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY";
}>;

export type DurableFaultPoint =
  "BEFORE_TEMP_WRITE" | "AFTER_TEMP_SYNC" | "AFTER_RENAME" | "AFTER_REREAD";

type Aggregate = Readonly<{
  schemaVersion: 1;
  projectId: string;
  revision: number;
  records: readonly DurableAttemptRecord[];
  effect: "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY";
}>;

type PrepareInput = Readonly<{
  projectId: string;
  authorizationId: string;
  attemptId: string;
  requestDigest: string;
  authorizationDigest: string;
  preflightAuditEventHash: string;
}>;

type AdapterMode =
  | "COMPLETE"
  | "TIMEOUT_AFTER_EXPOSURE"
  | "ACK_THEN_LOSS"
  | "MALFORMED_RECEIPT"
  | "TERMINAL_REJECTION"
  | "MISMATCHED_RECEIPT";

type MeasuredCase = Readonly<{
  id: string;
  expected: DurableAttemptState | "BLOCKED" | "UNCHANGED";
  actual: DurableAttemptState | "BLOCKED" | "UNCHANGED";
  createCalls: number;
  scheduledRetries: number;
  matchesExpected: boolean;
}>;

export class DurableAttemptEvidenceError extends Error {
  public constructor(options?: ErrorOptions) {
    super("Durable attempt evidence is invalid or unavailable.", options);
    this.name = "DurableAttemptEvidenceError";
  }
}

export class JsonDurableAttemptEvidenceStore {
  readonly #directory: string;
  #fault: DurableFaultPoint | null;

  public constructor(
    workspaceHome: string,
    options: Readonly<{ failAt?: DurableFaultPoint }> = {},
  ) {
    this.#directory = join(workspaceHome, "openai-attempt-evidence");
    this.#fault = options.failAt ?? null;
  }

  public async prepare(input: PrepareInput): Promise<DurableAttemptRecord> {
    validatePrepareInput(input);
    return this.#locked(async () => {
      const aggregate = await this.#read(input.projectId, true);
      const current = currentRecords(aggregate.records);
      if (
        current.has(input.attemptId) ||
        [...current.values()].some(
          (record) => record.authorizationId === input.authorizationId,
        )
      ) {
        throw invalid();
      }
      return this.#append(aggregate, {
        ...input,
        providerKind: "OPENAI_RESPONSES",
        state: "PREPARED",
        exposureCount: 0,
        providerRequestIdDigest: null,
        responseIdDigest: null,
        outputDigest: null,
        automaticRetryScheduled: false,
        effect: "SYNTHETIC_DURABLE_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH",
      });
    });
  }

  public async claimExposure(
    projectId: string,
    attemptId: string,
  ): Promise<DurableAttemptRecord> {
    return this.#transition(
      projectId,
      attemptId,
      ["PREPARED"],
      Object.freeze({ state: "EXPOSURE_STARTED", exposureCount: 1 }),
    );
  }

  public async acknowledge(
    projectId: string,
    attemptId: string,
    providerRequestId: string,
    responseId: string,
  ): Promise<DurableAttemptRecord> {
    if (!validText(providerRequestId) || !validText(responseId)) {
      throw invalid();
    }
    return this.#transition(
      projectId,
      attemptId,
      ["EXPOSURE_STARTED"],
      Object.freeze({
        state: "ACKNOWLEDGED",
        providerRequestIdDigest: sha256(providerRequestId),
        responseIdDigest: sha256(responseId),
      }),
    );
  }

  public async complete(
    projectId: string,
    attemptId: string,
    output: string,
  ): Promise<DurableAttemptRecord> {
    if (!validText(output)) {
      throw invalid();
    }
    return this.#transition(
      projectId,
      attemptId,
      ["ACKNOWLEDGED"],
      Object.freeze({ state: "COMPLETED", outputDigest: sha256(output) }),
    );
  }

  public async terminalReject(
    projectId: string,
    attemptId: string,
  ): Promise<DurableAttemptRecord> {
    return this.#transition(
      projectId,
      attemptId,
      ["EXPOSURE_STARTED"],
      Object.freeze({ state: "TERMINAL_REJECTED" }),
    );
  }

  public async markUnknown(
    projectId: string,
    attemptId: string,
  ): Promise<DurableAttemptRecord> {
    return this.#transition(
      projectId,
      attemptId,
      ["EXPOSURE_STARTED", "ACKNOWLEDGED"],
      Object.freeze({ state: "UNKNOWN_AFTER_EXPOSURE" }),
    );
  }

  public async recover(projectId: string): Promise<DurableAttemptSnapshot> {
    requireText(projectId);
    return this.#locked(async () => {
      let aggregate = await this.#read(projectId, true);
      const recoverable = [...currentRecords(aggregate.records).values()]
        .filter(
          (record) =>
            record.state === "EXPOSURE_STARTED" ||
            record.state === "ACKNOWLEDGED",
        )
        .sort((left, right) => left.attemptId.localeCompare(right.attemptId));
      for (const record of recoverable) {
        aggregate = appendAggregate(aggregate, {
          ...record,
          state: "UNKNOWN_AFTER_EXPOSURE",
        });
      }
      if (recoverable.length > 0) {
        await this.#publish(aggregate);
        aggregate = await this.#verifiedReread(aggregate);
      }
      return snapshot(aggregate);
    });
  }

  public async inspect(
    projectId: string,
    attemptId: string,
  ): Promise<DurableAttemptRecord> {
    requireText(projectId);
    requireText(attemptId);
    const aggregate = await this.#read(projectId, false);
    const record = currentRecords(aggregate.records).get(attemptId);
    if (record === undefined) {
      throw invalid();
    }
    return record;
  }

  public async list(projectId: string): Promise<DurableAttemptSnapshot> {
    requireText(projectId);
    return snapshot(await this.#read(projectId, false));
  }

  async #transition(
    projectId: string,
    attemptId: string,
    allowed: readonly DurableAttemptState[],
    patch: Readonly<
      Partial<
        Pick<
          DurableAttemptRecord,
          | "state"
          | "exposureCount"
          | "providerRequestIdDigest"
          | "responseIdDigest"
          | "outputDigest"
        >
      >
    >,
  ): Promise<DurableAttemptRecord> {
    requireText(projectId);
    requireText(attemptId);
    return this.#locked(async () => {
      const aggregate = await this.#read(projectId, true);
      const current = currentRecords(aggregate.records).get(attemptId);
      if (current === undefined || !allowed.includes(current.state)) {
        throw invalid();
      }
      return this.#append(aggregate, { ...current, ...patch });
    });
  }

  async #append(
    aggregate: Aggregate,
    input: Omit<
      DurableAttemptRecord,
      "schemaVersion" | "revision" | "predecessorRecordHash" | "recordHash"
    >,
  ): Promise<DurableAttemptRecord> {
    const next = appendAggregate(aggregate, input);
    await this.#publish(next);
    const reread = await this.#verifiedReread(next);
    const record = reread.records.at(-1);
    if (record === undefined) {
      throw invalid();
    }
    return record;
  }

  async #verifiedReread(expected: Aggregate): Promise<Aggregate> {
    const reread = await this.#read(expected.projectId, true);
    if (
      reread.revision !== expected.revision ||
      reread.records.at(-1)?.recordHash !== expected.records.at(-1)?.recordHash
    ) {
      throw invalid();
    }
    this.#fail("AFTER_REREAD");
    return reread;
  }

  async #publish(aggregate: Aggregate): Promise<void> {
    const content = encodeAggregate(aggregate);
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
      throw invalid();
    }
    const path = documentPath(this.#directory, aggregate.projectId);
    const temporary = `${path}.${randomUUID()}.tmp`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      this.#fail("BEFORE_TEMP_WRITE");
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(content, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      this.#fail("AFTER_TEMP_SYNC");
      await rename(temporary, path);
      this.#fail("AFTER_RENAME");
      const directory = await open(this.#directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      if (error instanceof DurableAttemptEvidenceError) {
        throw error;
      }
      throw invalid(error);
    }
  }

  async #read(projectId: string, ownLock: boolean): Promise<Aggregate> {
    try {
      const directoryStat = await stat(this.#directory);
      if (
        !directoryStat.isDirectory() ||
        (directoryStat.mode & 0o777) !== 0o700
      ) {
        throw invalid();
      }
      const names = await readdir(this.#directory);
      if (
        names.some((name) => name.endsWith(".tmp")) ||
        (!ownLock && names.includes(LOCK)) ||
        names.some(
          (name) =>
            name !== LOCK && name.endsWith(".json") && !DOCUMENT.test(name),
        )
      ) {
        throw invalid();
      }
      const path = documentPath(this.#directory, projectId);
      const content = await readFile(path, "utf8");
      if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
        throw invalid();
      }
      const fileStat = await stat(path);
      if (!fileStat.isFile() || (fileStat.mode & 0o777) !== 0o600) {
        throw invalid();
      }
      return decodeAggregate(content, projectId);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return emptyAggregate(projectId);
      }
      if (error instanceof DurableAttemptEvidenceError) {
        throw error;
      }
      throw invalid(error);
    }
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const ownerToken = randomUUID();
    const path = join(this.#directory, LOCK);
    let owns = false;
    try {
      await mkdir(this.#directory, { recursive: true, mode: 0o700 });
      await chmod(this.#directory, 0o700);
      const handle = await open(path, "wx", 0o600);
      owns = true;
      try {
        await handle.writeFile(
          `${JSON.stringify({ schemaVersion: 1, ownerToken })}\n`,
          "utf8",
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      return await operation();
    } catch (error) {
      if (error instanceof DurableAttemptEvidenceError) {
        throw error;
      }
      throw invalid(error);
    } finally {
      if (owns) {
        await releaseOwnedLock(path, ownerToken);
      }
    }
  }

  #fail(point: DurableFaultPoint): void {
    if (this.#fault === point) {
      this.#fault = null;
      throw invalid();
    }
  }
}

export class DurableFakeResponsesAdapter {
  #createCalls = 0;
  readonly #scheduledRetries = 0;

  public async create(
    mode: AdapterMode,
    attemptId: string,
  ): Promise<
    | Readonly<{
        kind: "COMPLETE";
        attemptId: string;
        providerRequestId: string;
        responseId: string;
        output: string;
      }>
    | Readonly<{
        kind: "ACK_THEN_LOSS";
        attemptId: string;
        providerRequestId: string;
        responseId: string;
      }>
    | Readonly<{ kind: "MALFORMED_RECEIPT"; attemptId: string }>
    | Readonly<{ kind: "TERMINAL_REJECTION"; attemptId: string }>
  > {
    this.#createCalls += 1;
    await Promise.resolve();
    if (mode === "TIMEOUT_AFTER_EXPOSURE") {
      throw invalid();
    }
    if (mode === "MALFORMED_RECEIPT") {
      return Object.freeze({ kind: "MALFORMED_RECEIPT", attemptId });
    }
    if (mode === "TERMINAL_REJECTION") {
      return Object.freeze({ kind: "TERMINAL_REJECTION", attemptId });
    }
    const receiptAttemptId =
      mode === "MISMATCHED_RECEIPT" ? `${attemptId}-other` : attemptId;
    if (mode === "ACK_THEN_LOSS") {
      return Object.freeze({
        kind: "ACK_THEN_LOSS",
        attemptId: receiptAttemptId,
        providerRequestId: "request-synthetic",
        responseId: "response-synthetic",
      });
    }
    return Object.freeze({
      kind: "COMPLETE",
      attemptId: receiptAttemptId,
      providerRequestId: "request-synthetic",
      responseId: "response-synthetic",
      output: "Synthetic bounded output.",
    });
  }

  public evidence(): Readonly<{
    createCalls: number;
    scheduledRetries: number;
  }> {
    return Object.freeze({
      createCalls: this.#createCalls,
      scheduledRetries: this.#scheduledRetries,
    });
  }
}

export async function executeDurableSyntheticAttempt(
  input: Readonly<{
    store: JsonDurableAttemptEvidenceStore;
    adapter: DurableFakeResponsesAdapter;
    projectId: string;
    attemptId: string;
    mode: AdapterMode;
  }>,
): Promise<DurableAttemptRecord> {
  await input.store.claimExposure(input.projectId, input.attemptId);
  let result: Awaited<ReturnType<DurableFakeResponsesAdapter["create"]>>;
  try {
    result = await input.adapter.create(input.mode, input.attemptId);
  } catch {
    return input.store.markUnknown(input.projectId, input.attemptId);
  }
  if (
    result.attemptId !== input.attemptId ||
    result.kind === "MALFORMED_RECEIPT"
  ) {
    return input.store.markUnknown(input.projectId, input.attemptId);
  }
  if (result.kind === "TERMINAL_REJECTION") {
    return input.store.terminalReject(input.projectId, input.attemptId);
  }
  await input.store.acknowledge(
    input.projectId,
    input.attemptId,
    result.providerRequestId,
    result.responseId,
  );
  if (result.kind === "ACK_THEN_LOSS") {
    return input.store.markUnknown(input.projectId, input.attemptId);
  }
  return input.store.complete(input.projectId, input.attemptId, result.output);
}

export type DurableAttemptMeasurementReport = Readonly<{
  schemaVersion: 1;
  evidenceDate: "2026-07-23";
  providerKind: "OPENAI_RESPONSES";
  corpusSha256: string;
  caseCount: 29;
  passedCases: 29;
  incorrectCases: 0;
  maximumCreateCallsPerCase: number;
  invalidPreExposureCalls: 0;
  scheduledRetries: 0;
  decision: "ADOPT_TEST_ONLY_DURABLE_ATTEMPT_EVIDENCE";
  cases: readonly MeasuredCase[];
  effect: "OFFLINE_SYNTHETIC_NO_MODEL_DELIVERY_OR_PRODUCTION_STORE";
}>;

export async function measureDurableAttemptEvidenceCorpus(
  root: string,
  order: "REFERENCE" | "REVERSED" = "REFERENCE",
): Promise<DurableAttemptMeasurementReport> {
  const definitions = caseDefinitions();
  if (order === "REVERSED") {
    definitions.reverse();
  }
  const cases: MeasuredCase[] = [];
  for (const definition of definitions) {
    const home = join(root, definition.id);
    await mkdir(home, { recursive: true });
    cases.push(await definition.run(home));
  }
  cases.sort((left, right) => left.id.localeCompare(right.id));
  const incorrectCases = cases.filter((entry) => !entry.matchesExpected).length;
  const maximumCreateCallsPerCase = Math.max(
    ...cases.map((entry) => entry.createCalls),
  );
  const scheduledRetries = cases.reduce(
    (total, entry) => total + entry.scheduledRetries,
    0,
  );
  const invalidPreExposureCalls = cases
    .filter((entry) =>
      [
        "06-before-temp-write",
        "07-after-temp-sync",
        "14-lock-contention",
        "15-corrupt-json",
        "16-noncanonical-document",
        "17-revision-gap",
        "18-predecessor-mismatch",
        "19-cross-project-document",
        "20-unsupported-schema",
        "21-capacity-exhaustion",
        "22-forbidden-extra-field",
        "23-permissive-file-mode",
        "24-transient-artifact",
        "28-duplicate-authorization",
      ].includes(entry.id),
    )
    .reduce((total, entry) => total + entry.createCalls, 0);
  if (
    cases.length !== 29 ||
    incorrectCases !== 0 ||
    maximumCreateCallsPerCase > 1 ||
    scheduledRetries !== 0 ||
    invalidPreExposureCalls !== 0
  ) {
    throw invalid();
  }
  const frozenCases = Object.freeze(cases);
  return Object.freeze({
    schemaVersion: 1,
    evidenceDate: "2026-07-23",
    providerKind: "OPENAI_RESPONSES",
    corpusSha256: sha256(JSON.stringify(frozenCases)),
    caseCount: 29,
    passedCases: 29,
    incorrectCases: 0,
    maximumCreateCallsPerCase,
    invalidPreExposureCalls: 0,
    scheduledRetries: 0,
    decision: "ADOPT_TEST_ONLY_DURABLE_ATTEMPT_EVIDENCE",
    cases: frozenCases,
    effect: "OFFLINE_SYNTHETIC_NO_MODEL_DELIVERY_OR_PRODUCTION_STORE",
  });
}

export function durableAttemptDocumentPath(
  workspaceHome: string,
  projectId: string,
): string {
  return documentPath(
    join(workspaceHome, "openai-attempt-evidence"),
    projectId,
  );
}

function caseDefinitions(): {
  id: string;
  run: (home: string) => Promise<MeasuredCase>;
}[] {
  return [
    executionCase("01-complete", "COMPLETE", "COMPLETED"),
    executionCase(
      "02-timeout-after-exposure",
      "TIMEOUT_AFTER_EXPOSURE",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
    executionCase(
      "03-acknowledgement-loss",
      "ACK_THEN_LOSS",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
    executionCase(
      "04-malformed-receipt",
      "MALFORMED_RECEIPT",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
    executionCase(
      "05-terminal-rejection",
      "TERMINAL_REJECTION",
      "TERMINAL_REJECTED",
    ),
    faultCase("06-before-temp-write", "BEFORE_TEMP_WRITE", "PREPARED"),
    faultCase("07-after-temp-sync", "AFTER_TEMP_SYNC", "PREPARED"),
    faultCase("08-after-rename", "AFTER_RENAME", "UNKNOWN_AFTER_EXPOSURE"),
    faultCase("09-after-reread", "AFTER_REREAD", "UNKNOWN_AFTER_EXPOSURE"),
    {
      id: "10-restart-exposure",
      run: async (home) => {
        const store = await preparedStore(home);
        await store.claimExposure(PROJECT_ID, ATTEMPT_ID);
        const recovered = await new JsonDurableAttemptEvidenceStore(
          home,
        ).recover(PROJECT_ID);
        return measured(
          "10-restart-exposure",
          "UNKNOWN_AFTER_EXPOSURE",
          currentRecords(recovered.records).get(ATTEMPT_ID)?.state ?? "BLOCKED",
          0,
          0,
        );
      },
    },
    {
      id: "11-restart-acknowledged",
      run: async (home) => {
        const store = await preparedStore(home);
        await store.claimExposure(PROJECT_ID, ATTEMPT_ID);
        await store.acknowledge(
          PROJECT_ID,
          ATTEMPT_ID,
          "request-synthetic",
          "response-synthetic",
        );
        const recovered = await new JsonDurableAttemptEvidenceStore(
          home,
        ).recover(PROJECT_ID);
        return measured(
          "11-restart-acknowledged",
          "UNKNOWN_AFTER_EXPOSURE",
          currentRecords(recovered.records).get(ATTEMPT_ID)?.state ?? "BLOCKED",
          0,
          0,
        );
      },
    },
    replayCase("12-replay-completed", "COMPLETE"),
    replayCase("13-replay-unknown", "TIMEOUT_AFTER_EXPOSURE"),
    blockingMutationCase("14-lock-contention", async (home) => {
      const directory = join(home, "openai-attempt-evidence");
      await writeFile(
        join(directory, LOCK),
        `${JSON.stringify({ schemaVersion: 1, ownerToken: "foreign-owner" })}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
    }),
    blockingMutationCase("15-corrupt-json", async (home) => {
      await writeFile(
        durableAttemptDocumentPath(home, PROJECT_ID),
        "{not-json}\n",
        "utf8",
      );
    }),
    blockingMutationCase("16-noncanonical-document", async (home) => {
      const path = durableAttemptDocumentPath(home, PROJECT_ID);
      await writeFile(path, `${await readFile(path, "utf8")}\n`, "utf8");
    }),
    blockingDocumentCase("17-revision-gap", (value) => {
      value.revision = 7;
    }),
    blockingDocumentCase("18-predecessor-mismatch", (value) => {
      const records = value.records as Record<string, unknown>[];
      records[0]!.predecessorRecordHash = "f".repeat(64);
    }),
    blockingDocumentCase("19-cross-project-document", (value) => {
      value.projectId = "project-foreign";
    }),
    blockingDocumentCase("20-unsupported-schema", (value) => {
      value.schemaVersion = 2;
    }),
    {
      id: "21-capacity-exhaustion",
      run: async (home) => {
        const store = new JsonDurableAttemptEvidenceStore(home);
        for (let index = 0; index < DURABLE_ATTEMPT_RECORD_LIMIT; index += 1) {
          await store.prepare(
            prepareInput(`authorization-${index}`, `attempt-${index}`),
          );
        }
        let actual: "BLOCKED" | DurableAttemptState = "BLOCKED";
        try {
          await store.prepare(
            prepareInput("authorization-overflow", "attempt-overflow"),
          );
          actual = "PREPARED";
        } catch (error) {
          assertEvidenceError(error);
        }
        return measured("21-capacity-exhaustion", "BLOCKED", actual, 0, 0);
      },
    },
    blockingDocumentCase("22-forbidden-extra-field", (value) => {
      value.requestBody = "synthetic-forbidden";
    }),
    blockingMutationCase("23-permissive-file-mode", async (home) => {
      await chmod(durableAttemptDocumentPath(home, PROJECT_ID), 0o644);
    }),
    blockingMutationCase("24-transient-artifact", async (home) => {
      await writeFile(
        join(home, "openai-attempt-evidence", "interrupted.tmp"),
        "synthetic",
        "utf8",
      );
    }),
    {
      id: "25-concurrent-claim",
      run: async (home) => {
        await preparedStore(home);
        const results = await Promise.allSettled([
          new JsonDurableAttemptEvidenceStore(home).claimExposure(
            PROJECT_ID,
            ATTEMPT_ID,
          ),
          new JsonDurableAttemptEvidenceStore(home).claimExposure(
            PROJECT_ID,
            ATTEMPT_ID,
          ),
        ]);
        const fulfilled = results.filter(
          (result) => result.status === "fulfilled",
        ).length;
        const state = (
          await new JsonDurableAttemptEvidenceStore(home).inspect(
            PROJECT_ID,
            ATTEMPT_ID,
          )
        ).state;
        const actual =
          fulfilled === 1 && state === "EXPOSURE_STARTED" ? state : "BLOCKED";
        return measured(
          "25-concurrent-claim",
          "EXPOSURE_STARTED",
          actual,
          0,
          0,
        );
      },
    },
    {
      id: "26-late-callback",
      run: async (home) => {
        const store = await preparedStore(home);
        const adapter = new DurableFakeResponsesAdapter();
        await executeDurableSyntheticAttempt({
          store,
          adapter,
          projectId: PROJECT_ID,
          attemptId: ATTEMPT_ID,
          mode: "TIMEOUT_AFTER_EXPOSURE",
        });
        try {
          await store.acknowledge(
            PROJECT_ID,
            ATTEMPT_ID,
            "late-request",
            "late-response",
          );
        } catch (error) {
          assertEvidenceError(error);
        }
        const evidence = adapter.evidence();
        return measured(
          "26-late-callback",
          "UNKNOWN_AFTER_EXPOSURE",
          (await store.inspect(PROJECT_ID, ATTEMPT_ID)).state,
          evidence.createCalls,
          evidence.scheduledRetries,
        );
      },
    },
    {
      id: "27-inspection-no-mutation",
      run: async (home) => {
        const store = await preparedStore(home);
        const before = JSON.stringify(await store.list(PROJECT_ID));
        await store.inspect(PROJECT_ID, ATTEMPT_ID);
        const after = JSON.stringify(await store.list(PROJECT_ID));
        return measured(
          "27-inspection-no-mutation",
          "UNCHANGED",
          before === after ? "UNCHANGED" : "BLOCKED",
          0,
          0,
        );
      },
    },
    {
      id: "28-duplicate-authorization",
      run: async (home) => {
        const store = await preparedStore(home);
        let actual: "BLOCKED" | DurableAttemptState = "BLOCKED";
        try {
          await store.prepare(
            prepareInput("authorization-synthetic", "attempt-other"),
          );
          actual = "PREPARED";
        } catch (error) {
          assertEvidenceError(error);
        }
        return measured("28-duplicate-authorization", "BLOCKED", actual, 0, 0);
      },
    },
    executionCase(
      "29-mismatched-receipt",
      "MISMATCHED_RECEIPT",
      "UNKNOWN_AFTER_EXPOSURE",
    ),
  ];
}

function executionCase(
  id: string,
  mode: AdapterMode,
  expected: DurableAttemptState,
): { id: string; run: (home: string) => Promise<MeasuredCase> } {
  return {
    id,
    run: async (home) => {
      const store = await preparedStore(home);
      const adapter = new DurableFakeResponsesAdapter();
      const record = await executeDurableSyntheticAttempt({
        store,
        adapter,
        projectId: PROJECT_ID,
        attemptId: ATTEMPT_ID,
        mode,
      });
      const evidence = adapter.evidence();
      return measured(
        id,
        expected,
        record.state,
        evidence.createCalls,
        evidence.scheduledRetries,
      );
    },
  };
}

function faultCase(
  id: string,
  failAt: DurableFaultPoint,
  expected: DurableAttemptState,
): { id: string; run: (home: string) => Promise<MeasuredCase> } {
  return {
    id,
    run: async (home) => {
      await preparedStore(home);
      const store = new JsonDurableAttemptEvidenceStore(home, { failAt });
      const adapter = new DurableFakeResponsesAdapter();
      try {
        await executeDurableSyntheticAttempt({
          store,
          adapter,
          projectId: PROJECT_ID,
          attemptId: ATTEMPT_ID,
          mode: "COMPLETE",
        });
      } catch (error) {
        assertEvidenceError(error);
      }
      const recovered = await new JsonDurableAttemptEvidenceStore(home).recover(
        PROJECT_ID,
      );
      const actual =
        currentRecords(recovered.records).get(ATTEMPT_ID)?.state ?? "BLOCKED";
      const evidence = adapter.evidence();
      return measured(
        id,
        expected,
        actual,
        evidence.createCalls,
        evidence.scheduledRetries,
      );
    },
  };
}

function replayCase(
  id: string,
  mode: AdapterMode,
): { id: string; run: (home: string) => Promise<MeasuredCase> } {
  return {
    id,
    run: async (home) => {
      const store = await preparedStore(home);
      const adapter = new DurableFakeResponsesAdapter();
      await executeDurableSyntheticAttempt({
        store,
        adapter,
        projectId: PROJECT_ID,
        attemptId: ATTEMPT_ID,
        mode,
      });
      try {
        await executeDurableSyntheticAttempt({
          store,
          adapter,
          projectId: PROJECT_ID,
          attemptId: ATTEMPT_ID,
          mode: "COMPLETE",
        });
      } catch (error) {
        assertEvidenceError(error);
      }
      const evidence = adapter.evidence();
      return measured(
        id,
        "BLOCKED",
        evidence.createCalls === 1 ? "BLOCKED" : "UNCHANGED",
        evidence.createCalls,
        evidence.scheduledRetries,
      );
    },
  };
}

function blockingMutationCase(
  id: string,
  mutate: (home: string) => Promise<void>,
): { id: string; run: (home: string) => Promise<MeasuredCase> } {
  return {
    id,
    run: async (home) => {
      await preparedStore(home);
      await mutate(home);
      const adapter = new DurableFakeResponsesAdapter();
      let actual: DurableAttemptState | "BLOCKED" = "BLOCKED";
      try {
        await executeDurableSyntheticAttempt({
          store: new JsonDurableAttemptEvidenceStore(home),
          adapter,
          projectId: PROJECT_ID,
          attemptId: ATTEMPT_ID,
          mode: "COMPLETE",
        });
        actual = "COMPLETED";
      } catch (error) {
        assertEvidenceError(error);
      }
      const evidence = adapter.evidence();
      return measured(
        id,
        "BLOCKED",
        actual,
        evidence.createCalls,
        evidence.scheduledRetries,
      );
    },
  };
}

function blockingDocumentCase(
  id: string,
  mutate: (value: Record<string, unknown>) => void,
): { id: string; run: (home: string) => Promise<MeasuredCase> } {
  return blockingMutationCase(id, async (home) => {
    const path = durableAttemptDocumentPath(home, PROJECT_ID);
    const value = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
    mutate(value);
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  });
}

function measured(
  id: string,
  expected: MeasuredCase["expected"],
  actual: MeasuredCase["actual"],
  createCalls: number,
  scheduledRetries: number,
): MeasuredCase {
  return Object.freeze({
    id,
    expected,
    actual,
    createCalls,
    scheduledRetries,
    matchesExpected: expected === actual,
  });
}

const PROJECT_ID = "project-synthetic";
const ATTEMPT_ID = "attempt-synthetic";

async function preparedStore(
  home: string,
): Promise<JsonDurableAttemptEvidenceStore> {
  const store = new JsonDurableAttemptEvidenceStore(home);
  await store.prepare(prepareInput("authorization-synthetic", ATTEMPT_ID));
  return store;
}

function prepareInput(
  authorizationId: string,
  attemptId: string,
): PrepareInput {
  return Object.freeze({
    projectId: PROJECT_ID,
    authorizationId,
    attemptId,
    requestDigest: sha256("synthetic transformed request"),
    authorizationDigest: sha256(authorizationId),
    preflightAuditEventHash: sha256("synthetic audit event"),
  });
}

function appendAggregate(
  aggregate: Aggregate,
  input: Omit<
    DurableAttemptRecord,
    "schemaVersion" | "revision" | "predecessorRecordHash" | "recordHash"
  >,
): Aggregate {
  if (aggregate.records.length >= DURABLE_ATTEMPT_RECORD_LIMIT) {
    throw invalid();
  }
  const withoutHash = Object.freeze({
    schemaVersion: 1 as const,
    projectId: input.projectId,
    authorizationId: input.authorizationId,
    attemptId: input.attemptId,
    providerKind: input.providerKind,
    requestDigest: input.requestDigest,
    authorizationDigest: input.authorizationDigest,
    preflightAuditEventHash: input.preflightAuditEventHash,
    state: input.state,
    revision: aggregate.revision + 1,
    exposureCount: input.exposureCount,
    providerRequestIdDigest: input.providerRequestIdDigest,
    responseIdDigest: input.responseIdDigest,
    outputDigest: input.outputDigest,
    automaticRetryScheduled: false as const,
    predecessorRecordHash: aggregate.records.at(-1)?.recordHash ?? null,
    effect: input.effect,
  });
  const record = validateRecord({
    ...withoutHash,
    recordHash: sha256(JSON.stringify(withoutHash)),
  });
  return Object.freeze({
    schemaVersion: 1,
    projectId: aggregate.projectId,
    revision: record.revision,
    records: Object.freeze([...aggregate.records, record]),
    effect: "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY",
  });
}

function emptyAggregate(projectId: string): Aggregate {
  requireText(projectId);
  return Object.freeze({
    schemaVersion: 1,
    projectId,
    revision: 0,
    records: Object.freeze([]),
    effect: "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY",
  });
}

function snapshot(aggregate: Aggregate): DurableAttemptSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    projectId: aggregate.projectId,
    revision: aggregate.revision,
    records: aggregate.records,
    effect: "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY",
  });
}

function encodeAggregate(value: Aggregate): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function decodeAggregate(content: string, projectId: string): Aggregate {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !record(value) ||
      !exactKeys(value, [
        "effect",
        "projectId",
        "records",
        "revision",
        "schemaVersion",
      ]) ||
      value.schemaVersion !== 1 ||
      value.projectId !== projectId ||
      value.effect !== "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY" ||
      !Number.isSafeInteger(value.revision) ||
      (value.revision as number) < 0 ||
      !Array.isArray(value.records) ||
      value.records.length > DURABLE_ATTEMPT_RECORD_LIMIT ||
      value.revision !== value.records.length
    ) {
      throw invalid();
    }
    const records = Object.freeze(value.records.map(validateRecord));
    let predecessor: string | null = null;
    const latest = new Map<string, DurableAttemptRecord>();
    const authorizations = new Map<string, string>();
    for (const entry of records) {
      if (
        entry.projectId !== projectId ||
        entry.predecessorRecordHash !== predecessor
      ) {
        throw invalid();
      }
      validateTransition(latest.get(entry.attemptId), entry);
      const priorAttempt = authorizations.get(entry.authorizationId);
      if (priorAttempt !== undefined && priorAttempt !== entry.attemptId) {
        throw invalid();
      }
      authorizations.set(entry.authorizationId, entry.attemptId);
      latest.set(entry.attemptId, entry);
      predecessor = entry.recordHash;
    }
    const aggregate = Object.freeze({
      schemaVersion: 1 as const,
      projectId,
      revision: value.revision as number,
      records,
      effect: "TEST_ONLY_NON_CONTENT_PERSISTENCE_NOT_MODEL_DELIVERY" as const,
    });
    if (encodeAggregate(aggregate) !== content) {
      throw invalid();
    }
    return aggregate;
  } catch (error) {
    if (error instanceof DurableAttemptEvidenceError) {
      throw error;
    }
    throw invalid(error);
  }
}

function validateRecord(value: unknown): DurableAttemptRecord {
  if (
    !record(value) ||
    !exactKeys(value, [
      "authorizationDigest",
      "authorizationId",
      "automaticRetryScheduled",
      "effect",
      "exposureCount",
      "outputDigest",
      "predecessorRecordHash",
      "preflightAuditEventHash",
      "projectId",
      "providerKind",
      "providerRequestIdDigest",
      "recordHash",
      "requestDigest",
      "responseIdDigest",
      "revision",
      "schemaVersion",
      "state",
      "attemptId",
    ]) ||
    value.schemaVersion !== 1 ||
    !validText(value.projectId) ||
    !validText(value.authorizationId) ||
    !validText(value.attemptId) ||
    value.providerKind !== "OPENAI_RESPONSES" ||
    !validDigest(value.requestDigest) ||
    !validDigest(value.authorizationDigest) ||
    !validDigest(value.preflightAuditEventHash) ||
    !STATES.includes(value.state as DurableAttemptState) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    ![0, 1].includes(value.exposureCount as number) ||
    !nullableDigest(value.providerRequestIdDigest) ||
    !nullableDigest(value.responseIdDigest) ||
    !nullableDigest(value.outputDigest) ||
    value.automaticRetryScheduled !== false ||
    !nullableDigest(value.predecessorRecordHash) ||
    !validDigest(value.recordHash) ||
    value.effect !== "SYNTHETIC_DURABLE_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH"
  ) {
    throw invalid();
  }
  const normalized = Object.freeze({
    schemaVersion: 1 as const,
    projectId: value.projectId,
    authorizationId: value.authorizationId,
    attemptId: value.attemptId,
    providerKind: "OPENAI_RESPONSES" as const,
    requestDigest: value.requestDigest,
    authorizationDigest: value.authorizationDigest,
    preflightAuditEventHash: value.preflightAuditEventHash,
    state: value.state as DurableAttemptState,
    revision: value.revision as number,
    exposureCount: value.exposureCount as 0 | 1,
    providerRequestIdDigest: value.providerRequestIdDigest as string | null,
    responseIdDigest: value.responseIdDigest as string | null,
    outputDigest: value.outputDigest as string | null,
    automaticRetryScheduled: false as const,
    predecessorRecordHash: value.predecessorRecordHash as string | null,
    recordHash: value.recordHash,
    effect: "SYNTHETIC_DURABLE_ATTEMPT_EVIDENCE_NOT_PROVIDER_TRUTH" as const,
  });
  const { recordHash, ...withoutHash } = normalized;
  if (sha256(JSON.stringify(withoutHash)) !== recordHash) {
    throw invalid();
  }
  validateStateShape(normalized);
  return normalized;
}

const STATES: readonly DurableAttemptState[] = Object.freeze([
  "PREPARED",
  "EXPOSURE_STARTED",
  "ACKNOWLEDGED",
  "COMPLETED",
  "TERMINAL_REJECTED",
  "UNKNOWN_AFTER_EXPOSURE",
]);

function validateStateShape(value: DurableAttemptRecord): void {
  const noReceipt =
    value.providerRequestIdDigest === null && value.responseIdDigest === null;
  if (
    (value.state === "PREPARED" &&
      (value.exposureCount !== 0 ||
        !noReceipt ||
        value.outputDigest !== null)) ||
    ((value.state === "EXPOSURE_STARTED" ||
      value.state === "TERMINAL_REJECTED") &&
      (value.exposureCount !== 1 ||
        !noReceipt ||
        value.outputDigest !== null)) ||
    (value.state === "ACKNOWLEDGED" &&
      (value.exposureCount !== 1 ||
        value.providerRequestIdDigest === null ||
        value.responseIdDigest === null ||
        value.outputDigest !== null)) ||
    (value.state === "COMPLETED" &&
      (value.exposureCount !== 1 ||
        value.providerRequestIdDigest === null ||
        value.responseIdDigest === null ||
        value.outputDigest === null)) ||
    (value.state === "UNKNOWN_AFTER_EXPOSURE" &&
      (value.exposureCount !== 1 || value.outputDigest !== null))
  ) {
    throw invalid();
  }
}

function validateTransition(
  previous: DurableAttemptRecord | undefined,
  next: DurableAttemptRecord,
): void {
  if (previous === undefined) {
    if (next.state !== "PREPARED") {
      throw invalid();
    }
    return;
  }
  if (
    next.revision <= previous.revision ||
    next.projectId !== previous.projectId ||
    next.authorizationId !== previous.authorizationId ||
    next.attemptId !== previous.attemptId ||
    next.requestDigest !== previous.requestDigest ||
    next.authorizationDigest !== previous.authorizationDigest ||
    next.preflightAuditEventHash !== previous.preflightAuditEventHash ||
    next.providerKind !== previous.providerKind ||
    next.automaticRetryScheduled !== false
  ) {
    throw invalid();
  }
  const allowed =
    (previous.state === "PREPARED" && next.state === "EXPOSURE_STARTED") ||
    (previous.state === "EXPOSURE_STARTED" &&
      ["ACKNOWLEDGED", "TERMINAL_REJECTED", "UNKNOWN_AFTER_EXPOSURE"].includes(
        next.state,
      )) ||
    (previous.state === "ACKNOWLEDGED" &&
      ["COMPLETED", "UNKNOWN_AFTER_EXPOSURE"].includes(next.state));
  if (!allowed) {
    throw invalid();
  }
}

function currentRecords(
  records: readonly DurableAttemptRecord[],
): Map<string, DurableAttemptRecord> {
  const current = new Map<string, DurableAttemptRecord>();
  for (const record of records) {
    current.set(record.attemptId, record);
  }
  return current;
}

function validatePrepareInput(input: PrepareInput): void {
  requireText(input.projectId);
  requireText(input.authorizationId);
  requireText(input.attemptId);
  if (
    !validDigest(input.requestDigest) ||
    !validDigest(input.authorizationDigest) ||
    !validDigest(input.preflightAuditEventHash)
  ) {
    throw invalid();
  }
}

function documentPath(directory: string, projectId: string): string {
  requireText(projectId);
  return join(directory, `project_${sha256(projectId)}.json`);
}

async function releaseOwnedLock(
  path: string,
  ownerToken: string,
): Promise<void> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      !record(value) ||
      !exactKeys(value, ["ownerToken", "schemaVersion"]) ||
      value.schemaVersion !== 1 ||
      value.ownerToken !== ownerToken
    ) {
      return;
    }
    await rm(path, { force: true });
  } catch {
    return;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TEXT &&
    !/\p{Cc}/u.test(value)
  );
}

function requireText(value: unknown): asserts value is string {
  if (!validText(value)) {
    throw invalid();
  }
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function nullableDigest(value: unknown): value is string | null {
  return value === null || validDigest(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function assertEvidenceError(
  error: unknown,
): asserts error is DurableAttemptEvidenceError {
  if (!(error instanceof DurableAttemptEvidenceError)) {
    throw error;
  }
}

function invalid(cause?: unknown): DurableAttemptEvidenceError {
  return new DurableAttemptEvidenceError(
    cause === undefined ? undefined : { cause },
  );
}
