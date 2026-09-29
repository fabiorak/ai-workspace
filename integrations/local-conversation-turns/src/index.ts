import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import {
  ConversationTurnConflictError,
  type ConversationTurnAttempt,
  type ConversationTurnClaim,
  type ConversationTurnExecution,
  type ConversationTurnIdempotency,
  type ConversationTurnResult,
} from "@ai-workspace/conversation-turn";
import {
  directory,
  exists,
  publish,
  read,
  syncDirectory,
  unavailable,
} from "./files.ts";
import {
  attempt,
  claimRecord,
  digest,
  envelope,
  object,
  keys,
  receipt,
  summarize,
  unwrap,
  type Receipt,
} from "./record.ts";
export type { Receipt } from "./record.ts";

export type TurnRecovery = (
  claim: ConversationTurnClaim,
  reference: ConversationTurnAttempt | null,
  receipt: Receipt | null,
) => Promise<ConversationTurnResult>;
const active = new Map<string, Promise<void>>();
const refused = (): ConversationTurnResult => ({
  kind: "REFUSED_BEFORE_EXPOSURE",
  reason: "LOCAL_EVIDENCE_UNAVAILABLE",
});

/** A permanent directory is the atomic claim, never a reclaimable lease.
 * Crashes and partial files consume the identity. Only its winner may execute. */
export class JsonConversationTurnRegistry implements ConversationTurnIdempotency {
  readonly #directory: string;
  readonly #recover: TurnRecovery;
  constructor(home: string, recover: TurnRecovery) {
    this.#directory = resolve(home, "conversation-turns");
    this.#recover = recover;
  }
  async execute(
    claim: ConversationTurnClaim,
    operation: (
      execution: ConversationTurnExecution,
    ) => Promise<ConversationTurnResult>,
  ) {
    const initial = claimRecord({
      schemaVersion: 1,
      claim,
      owner: process.pid,
    });
    const path = join(this.#directory, claim.idempotencyKey);
    let owns = false;
    try {
      await directory(this.#directory, true);
      await syncDirectory(dirname(this.#directory));
      try {
        await mkdir(path, { mode: 0o700 });
        owns = true;
      } catch (error) {
        if (!exists(error)) throw error;
      }
      if (!owns)
        return { duplicate: true, result: await this.#duplicate(path, claim) };
      let release!: () => void;
      active.set(
        path,
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      const bound: { reference: ConversationTurnAttempt | null } = {
        reference: null,
      };
      try {
        await syncDirectory(this.#directory);
        await publish(join(path, "claim.json"), envelope(initial));
        const bindAttempt = async (value: ConversationTurnAttempt) => {
          if (bound.reference !== null) throw unavailable();
          const checked = attempt(value);
          await publish(
            join(path, "attempt.json"),
            envelope({
              claimDigest: digest(JSON.stringify(initial)),
              reference: checked,
            }),
          );
          bound.reference = checked;
        };
        const result = await operation({ bindAttempt });
        const summary = summarize(result);
        if (
          summary.kind !== "REFUSED_BEFORE_EXPOSURE" &&
          bound.reference === null
        )
          throw unavailable();
        if (
          (summary.kind === "UNKNOWN_AFTER_EXPOSURE" ||
            summary.kind === "RESPONSE_WITHHELD") &&
          summary.attemptId !== bound.reference?.attemptId
        )
          throw unavailable();
        await publish(
          join(path, "result.json"),
          envelope({
            claimDigest: digest(JSON.stringify(initial)),
            result: summary,
          }),
        );
        return { duplicate: false, result };
      } catch {
        return {
          duplicate: false,
          result: await this.#recovery(path, claim).catch(() =>
            bound.reference
              ? {
                  kind: "UNKNOWN_AFTER_EXPOSURE" as const,
                  attemptId: bound.reference.attemptId,
                }
              : refused(),
          ),
        };
      } finally {
        active.delete(path);
        release();
      }
    } catch (error) {
      if (error instanceof ConversationTurnConflictError) throw error;
      return { duplicate: !owns, result: refused() };
    }
  }
  async #duplicate(
    path: string,
    claim: ConversationTurnClaim,
  ): Promise<ConversationTurnResult> {
    const deadline = Date.now() + 35_000;
    await directory(path);
    const pending = active.get(path);
    if (pending)
      await Promise.race([
        pending,
        setTimeout(35_000, undefined, { ref: false }),
      ]);
    // The winner may have reserved the directory but not yet published its
    // manifest. Wait briefly for that publication; never reclaim the directory.
    let manifest = await read(join(path, "claim.json"));
    for (
      let count = 0;
      manifest === null && count < 20 && Date.now() < deadline;
      count += 1
    ) {
      await setTimeout(50);
      manifest = await read(join(path, "claim.json"));
    }
    const initial = claimRecord(unwrap(manifest));
    this.#matches(initial.claim, claim);
    // This wait never grants execution or removes evidence. PID reuse can only
    // delay a conservative recovery, never authorize another exposure.
    while (
      initial.owner !== process.pid &&
      alive(initial.owner) &&
      Date.now() < deadline &&
      (await read(join(path, "result.json"))) === null
    )
      await setTimeout(50);
    return this.#recovery(path, claim);
  }
  async #recovery(
    path: string,
    claim: ConversationTurnClaim,
  ): Promise<ConversationTurnResult> {
    await directory(path);
    const initial = claimRecord(unwrap(await read(join(path, "claim.json"))));
    this.#matches(initial.claim, claim);
    const claimDigest = digest(JSON.stringify(initial));
    const linked = await read(join(path, "attempt.json"));
    const finished = await read(join(path, "result.json"));
    let reference: ConversationTurnAttempt | null = null;
    let result: Receipt | null = null;
    if (linked !== null) {
      const value = unwrap(linked);
      if (
        !object(value) ||
        !keys(value, ["claimDigest", "reference"]) ||
        value.claimDigest !== claimDigest
      )
        throw unavailable();
      reference = attempt(value.reference);
    }
    if (finished !== null) {
      const value = unwrap(finished);
      if (
        !object(value) ||
        !keys(value, ["claimDigest", "result"]) ||
        value.claimDigest !== claimDigest
      )
        throw unavailable();
      result = receipt(value.result);
      if (result.kind !== "REFUSED_BEFORE_EXPOSURE" && reference === null)
        throw unavailable();
      if (
        (result.kind === "UNKNOWN_AFTER_EXPOSURE" ||
          result.kind === "RESPONSE_WITHHELD") &&
        result.attemptId !== reference?.attemptId
      )
        throw unavailable();
    }
    return this.#recover(initial.claim, reference, result);
  }
  #matches(previous: ConversationTurnClaim, current: ConversationTurnClaim) {
    if (
      previous.idempotencyKey !== current.idempotencyKey ||
      previous.requestDigest !== current.requestDigest ||
      previous.scope.conversationId !== current.scope.conversationId ||
      previous.scope.projectId !== current.scope.projectId
    )
      throw new ConversationTurnConflictError();
    // Work/handoff can advance after a completed turn; recovery uses the stored
    // authoritative scope, never a newly selected handoff or model.
  }
}
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      error.code === "ESRCH"
    );
  }
}
