import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  ModelAttempts,
  type ModelAttemptStore,
} from "@ai-workspace/model-attempts";
import { JsonModelAttemptStore } from "../../../integrations/local-model-attempts/src/index.ts";
import {
  ModelDelivery,
  type DeliveryInput,
  type TransportResult,
} from "../src/index.ts";

const input: DeliveryInput = {
  projectId: "project",
  workItemId: "work",
  handoffId: "handoff",
  model: "synthetic-model",
  text: "Exactly reviewed synthetic question",
  bindingDigest: "a".repeat(64),
  preflightAuditEventHash: "b".repeat(64),
  providerKind: "OPENAI_RESPONSES",
  destination: "EXTERNAL",
  maxOutputTokens: 100,
  timeoutMs: 1000,
};
const completed: TransportResult = {
  kind: "COMPLETED",
  text: "Synthetic answer",
  requestId: "request-private-correlation",
  responseId: "response-private-correlation",
  usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 3 },
};

test("durable delivery coordinates exposure, replay and uncertainty", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "aiw-delivery-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  let serial = 0;
  const fixture = () => {
    const projectId = `project-${++serial}`;
    const store = new JsonModelAttemptStore(home);
    const attempts = new ModelAttempts(store);
    const selected = { ...input, projectId };
    let calls = 0;
    const transport = {
      send: async (request: { text: string }) => {
        calls++;
        assert.equal(request.text, selected.text);
        const latest = (await attempts.list(projectId)).records.at(-1)!;
        assert.equal(latest.state, "EXPOSURE_STARTED");
        assert.equal(latest.exposureCount, 1);
        assert.equal(
          (await attempts.inspect(projectId, latest.attemptId)).recordHash,
          latest.recordHash,
        );
        return completed;
      },
    };
    const delivery = new ModelDelivery({ attempts, transport });
    return {
      selected,
      store,
      attempts,
      transport,
      delivery,
      calls: () => calls,
    };
  };
  await t.test(
    "double click consumes once and completes only after the durable claim",
    async () => {
      const f = fixture();
      const prepared = f.delivery.prepare(f.selected);
      const answers = await Promise.all([
        f.delivery.confirm(
          prepared.authorizationId,
          f.selected,
          async () => input.bindingDigest,
        ),
        f.delivery.confirm(
          prepared.authorizationId,
          f.selected,
          async () => input.bindingDigest,
        ),
      ]);
      assert.equal(f.calls(), 1);
      assert.equal(
        answers.filter((answer) => answer.kind === "COMPLETED").length,
        1,
      );
      assert.equal(
        (await f.attempts.list(f.selected.projectId)).records.at(-1)!.state,
        "COMPLETED",
      );
      const replay = await new ModelDelivery({
        attempts: f.attempts,
        transport: f.transport,
      }).confirm(
        prepared.authorizationId,
        f.selected,
        async () => input.bindingDigest,
      );
      assert.equal(replay.kind, "REFUSED_BEFORE_EXPOSURE");
      assert.equal(f.calls(), 1);
    },
  );
  await t.test(
    "cross-scope, expired and changed binding never invoke transport",
    async () => {
      const f = fixture();
      let now = 0;
      const delivery = new ModelDelivery({
        attempts: f.attempts,
        transport: f.transport,
        clock: () => now,
      });
      const expired = delivery.prepare(f.selected);
      now = expired.expiresAt;
      assert.equal(
        (
          await delivery.confirm(
            expired.authorizationId,
            f.selected,
            async () => input.bindingDigest,
          )
        ).kind,
        "REFUSED_BEFORE_EXPOSURE",
      );
      const changed = delivery.prepare(f.selected);
      assert.equal(
        (
          await delivery.confirm(
            changed.authorizationId,
            { ...f.selected, workItemId: "other" },
            async () => input.bindingDigest,
          )
        ).kind,
        "REFUSED_BEFORE_EXPOSURE",
      );
      assert.deepEqual(
        await delivery.confirm(changed.authorizationId, f.selected, async () =>
          "c".repeat(64),
        ),
        { kind: "REFUSED_BEFORE_EXPOSURE", reason: "BINDING_CHANGED" },
      );
      assert.equal(f.calls(), 0);
      assert.equal(
        (await f.attempts.list(f.selected.projectId)).records.length,
        0,
      );
    },
  );
  await t.test(
    "pre-claim disk failure refuses and a failed reread cannot invoke transport",
    async () => {
      for (const fault of ["prepare", "inspect"] as const) {
        const f = fixture();
        const broken: ModelAttemptStore = {
          prepare: f.store.prepare.bind(f.store),
          transition: f.store.transition.bind(f.store),
          inspect: f.store.inspect.bind(f.store),
          list: f.store.list.bind(f.store),
          recover: f.store.recover.bind(f.store),
          [fault]: async () => {
            throw new Error("synthetic disk failure");
          },
        };
        const delivery = new ModelDelivery({
          attempts: new ModelAttempts(broken),
          transport: f.transport,
        });
        const prepared = delivery.prepare(f.selected);
        assert.equal(
          (
            await delivery.confirm(
              prepared.authorizationId,
              f.selected,
              async () => input.bindingDigest,
            )
          ).kind,
          "REFUSED_BEFORE_EXPOSURE",
        );
        assert.equal(f.calls(), 0);
      }
    },
  );
  await t.test(
    "timeout, crash and malformed response are unknown with zero retry",
    async () => {
      for (const result of [
        null,
        { kind: "UNKNOWN" },
        { ...completed, text: "" },
      ]) {
        const f = fixture();
        let calls = 0;
        const delivery = new ModelDelivery({
          attempts: f.attempts,
          transport: {
            send: async () => {
              calls++;
              if (result === null) throw new Error("synthetic timeout");
              return result as TransportResult;
            },
          },
        });
        const prepared = delivery.prepare(f.selected);
        const outcome = await delivery.confirm(
          prepared.authorizationId,
          f.selected,
          async () => input.bindingDigest,
        );
        assert.equal(outcome.kind, "UNKNOWN_AFTER_EXPOSURE");
        assert.equal(calls, 1);
        assert.equal(
          (await f.attempts.list(f.selected.projectId)).records.at(-1)!.state,
          "UNKNOWN_AFTER_EXPOSURE",
        );
        await delivery.confirm(
          prepared.authorizationId,
          f.selected,
          async () => input.bindingDigest,
        );
        assert.equal(calls, 1);
      }
    },
  );
  await t.test(
    "conclusive rejection is terminal and restart recovery never resends",
    async () => {
      const f = fixture();
      const delivery = new ModelDelivery({
        attempts: f.attempts,
        transport: { send: async () => ({ kind: "REJECTED" }) },
      });
      const prepared = delivery.prepare(f.selected);
      assert.equal(
        (
          await delivery.confirm(
            prepared.authorizationId,
            f.selected,
            async () => input.bindingDigest,
          )
        ).kind,
        "TERMINAL_REJECTED",
      );
      await f.attempts.prepare({
        schemaVersion: 1,
        projectId: f.selected.projectId,
        attemptId: "crashed",
        authorizationId: "crashed-authorization",
        providerKind: "OPENAI_RESPONSES",
        requestDigest: "c".repeat(64),
        authorizationDigest: "d".repeat(64),
        preflightAuditEventHash: input.preflightAuditEventHash,
      });
      await f.attempts.claimExposure(f.selected.projectId, "crashed");
      const restarted = new ModelDelivery({
        attempts: new ModelAttempts(new JsonModelAttemptStore(home)),
        transport: f.transport,
      });
      await restarted.initialize(f.selected.projectId);
      assert.equal(
        (await f.attempts.inspect(f.selected.projectId, "crashed")).state,
        "UNKNOWN_AFTER_EXPOSURE",
      );
      assert.equal(f.calls(), 0);
    },
  );
  await t.test(
    "preparations are bounded and invalid destinations do not become permissions",
    () => {
      const f = fixture();
      assert.throws(() =>
        f.delivery.prepare({
          ...f.selected,
          destination: "UNCLASSIFIED" as "EXTERNAL",
        }),
      );
      assert.throws(() =>
        f.delivery.prepare({ ...f.selected, text: "x".repeat(262145) }),
      );
      for (let index = 0; index < 20; index++) f.delivery.prepare(f.selected);
      assert.throws(() => f.delivery.prepare(f.selected), /CAPACITY/u);
    },
  );
  await t.test(
    "the durable store contains only metadata and digests",
    async () => {
      async function readTree(root: string): Promise<string> {
        const values = await Promise.all(
          (await readdir(root, { withFileTypes: true })).map((entry) =>
            entry.isDirectory()
              ? readTree(join(root, entry.name))
              : readFile(join(root, entry.name), "utf8"),
          ),
        );
        return values.join("\n");
      }
      const stored = await readTree(home);
      for (const forbidden of [
        input.text,
        input.model,
        "Synthetic answer",
        "request-private-correlation",
        "response-private-correlation",
      ])
        assert.equal(stored.includes(forbidden), false);
    },
  );
});
