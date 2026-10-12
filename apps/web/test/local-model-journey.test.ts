import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { conversationTurnClaim } from "@ai-workspace/conversation-turn";
import { GeneralConversations } from "@ai-workspace/general-conversation";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { JsonModelAttemptStore } from "@ai-workspace/local-model-attempts";
import { JsonSessionStore } from "@ai-workspace/local-session-ingestion";
import { JsonLocalModelAttemptStore } from "@ai-workspace/local-model-run-attempts";
import {
  LOCAL_MODEL_PROTECTION,
  LocalModelAttempts,
} from "@ai-workspace/local-model-execution";
import { ModelAttempts } from "@ai-workspace/model-attempts";

import { conversationTurnRecovery } from "../src/conversation-turn-recovery.ts";
import {
  configureAndSelect,
  generalScopeId,
  localModelApplication,
  localModelTarget,
  responsesTarget,
  syntheticLocalModelLog,
} from "./local-model-turn-fixture.ts";

/**
 * Local model journey with the real turn, registry, coordinator and stores.
 * Only the executor is synthetic: it opens no socket and records `plan.body`.
 * ADR-0051: a LOCAL_ONLY local model receives the original text, every other
 * class is pseudonymized again from the original on each composition.
 */
const EMAIL = "anna@example.test";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

type Outcome = {
  duplicate: boolean;
  result: {
    kind: string;
    reason?: string;
    text?: string;
    effectiveModel?: string;
    attemptId?: string;
    protection?: unknown;
  };
};

async function root(prefix: string) {
  const path = await mkdtemp(join(tmpdir(), `ai-workspace-${prefix}-`));
  roots.push(path);
  return path;
}

const run = (
  application: ReturnType<typeof localModelApplication>,
  conversationId: string,
  projectId: string | null,
  targetId: string,
  userText: string,
  clientRequestId: string,
) =>
  application.conversationTurns.run({
    conversationId,
    projectId,
    targetId,
    userText,
    clientRequestId,
  }) as Promise<Outcome>;

const attemptsOf = (home: string) =>
  new LocalModelAttempts(new JsonLocalModelAttemptStore(home));

async function attemptFiles(home: string) {
  const directory = join(home, "local-model-run-attempts");
  const names = await readdir(directory).catch(() => [] as string[]);
  return Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map((name) => readFile(join(directory, name), "utf8")),
  );
}

async function generalSetup(prefix: string, selected = "local") {
  const dir = await root(prefix);
  const log = syntheticLocalModelLog();
  const sent: string[] = [];
  const application = localModelApplication(dir, { log, sent });
  const general = await application.createGeneralConversation(
    "Conversazione locale sintetica",
  );
  await configureAndSelect(
    application,
    [await localModelTarget(dir, null), await responsesTarget(dir, null)],
    general.id,
    null,
    selected,
  );
  return { dir, home: join(dir, "home"), log, sent, application, general };
}

describe("local model journey from the conversation", () => {
  it("1. sends the original text, stores a LOCAL_MODEL answer and keeps no copy in the registry", async () => {
    const { home, log, application, general } = await generalSetup("n9-local");
    const text = `Scrivi ad ${EMAIL} sul lavoro sintetico`;
    const first = await run(application, general.id, null, "local", text, "g1");
    assert.equal(first.result.kind, "COMPLETED", JSON.stringify(first));
    assert.equal(first.result.text, "Risposta locale sintetica");
    assert.equal(first.result.effectiveModel, "Modello locale");
    assert.equal("protection" in first.result, false);

    assert.equal(log.bodies.length, 1);
    assert.ok(log.bodies[0]!.includes(EMAIL), "the original reaches the model");
    assert.doesNotMatch(log.bodies[0]!, /\[\[EMAIL_/u);

    const stored = await new GeneralConversations({
      store: new JsonGeneralConversationStore(home),
      ids: () => "unused",
      clock: () => new Date(),
    }).show(general.id);
    const answers = stored.events.filter(
      (event) => event.type === "AGENT_MESSAGE",
    );
    assert.equal(answers.length, 1);
    const provenance =
      answers[0]!.type === "AGENT_MESSAGE" ? answers[0]!.provenance : null;
    assert.ok(provenance && "executionClass" in provenance);
    assert.equal(provenance.executionClass, "LOCAL_MODEL");
    assert.equal(provenance.targetId, "local");

    const snapshot = await attemptsOf(home).list(generalScopeId(general.id));
    const completed = snapshot.records.filter(
      (record) => record.state === "COMPLETED",
    );
    assert.equal(completed.length, 1);
    assert.equal(completed[0]!.protection, LOCAL_MODEL_PROTECTION);
    assert.equal(
      completed[0]!.protection,
      "PSEUDONYMIZATION_SKIPPED_LOCAL_MODEL_LOCAL_ONLY",
    );
    assert.equal(completed[0]!.executionClass, "LOCAL_MODEL");
    const files = await attemptFiles(home);
    assert.ok(files.length > 0);
    for (const file of files) {
      assert.equal(file.includes(EMAIL), false, "no copy of the text");
      assert.equal(file.includes("Risposta locale sintetica"), false);
      assert.equal(file.includes("lavoro sintetico"), false);
    }
  });

  it("1. records the LOCAL_MODEL source in a project conversation", async () => {
    const dir = await root("n9-project");
    const log = syntheticLocalModelLog();
    const application = localModelApplication(dir, { log });
    const project = await application.registerProject(process.cwd());
    const { sessionId } = await application.importSample(project.id);
    await configureAndSelect(
      application,
      [await localModelTarget(dir, project.id)],
      sessionId,
      project.id,
      "local",
    );
    const text = `Domanda di progetto per ${EMAIL}`;
    const first = await run(
      application,
      sessionId,
      project.id,
      "local",
      text,
      "p1",
    );
    assert.equal(first.result.kind, "COMPLETED", JSON.stringify(first));
    assert.equal("protection" in first.result, false);
    assert.equal(log.bodies.length, 1);
    assert.ok(log.bodies[0]!.includes(EMAIL));
    assert.doesNotMatch(log.bodies[0]!, /\[\[EMAIL_/u);
    const events = (await new JsonSessionStore(join(dir, "home")).load(
      sessionId,
    ))!.events;
    assert.equal(
      events.at(-1)?.source.sourceType,
      "LOCAL_MODEL:Modello locale",
    );
    const completed = (
      await attemptsOf(join(dir, "home")).list(project.id)
    ).records.filter((record) => record.state === "COMPLETED");
    assert.equal(completed.length, 1);
    assert.equal(completed[0]!.protection, LOCAL_MODEL_PROTECTION);
    for (const file of await attemptFiles(join(dir, "home")))
      assert.equal(file.includes(EMAIL), false);
    const replay = await run(
      application,
      sessionId,
      project.id,
      "local",
      text,
      "p1",
    );
    assert.equal(replay.duplicate, true);
    assert.equal(replay.result.kind, "COMPLETED");
    assert.equal(log.bodies.length, 1);
  });

  it("2. pseudonymizes the same text again for an external target right after the local one", async () => {
    const { log, sent, application, general } = await generalSetup("n9-switch");
    const text = `Scrivi ad ${EMAIL} sul lavoro sintetico`;
    const local = await run(application, general.id, null, "local", text, "s1");
    assert.equal(local.result.kind, "COMPLETED");
    assert.ok(log.bodies[0]!.includes(EMAIL));
    // The local answer repeats the address, so history carries it as well.
    log.result = {
      kind: "ANSWER",
      text: `Ho scritto ad ${EMAIL}`,
      reportedModel: null,
    };
    await run(application, general.id, null, "local", `Ancora ${EMAIL}`, "s2");

    await configureAndSelect(application, [], general.id, null, "external");
    const external = await run(
      application,
      general.id,
      null,
      "external",
      text,
      "s3",
    );
    assert.equal(external.result.kind, "COMPLETED", JSON.stringify(external));
    assert.equal(sent.length, 1);
    assert.match(sent[0]!, /\[\[EMAIL_1\]\]/u);
    assert.equal(sent[0]!.includes(EMAIL), false);
    assert.equal(
      (external.result.protection as { replacements: number }).replacements > 0,
      true,
    );
    assert.equal(log.bodies.length, 2, "the local model was not called again");
  });

  it("3. refuses a LOCAL_MODEL target with an unclassified boundary and never calls the executor", async () => {
    const dir = await root("n9-unclassified");
    const log = syntheticLocalModelLog();
    const application = localModelApplication(dir, { log });
    const general = await application.createGeneralConversation("Sintetica");
    await configureAndSelect(
      application,
      [await localModelTarget(dir, null, { boundary: "UNCLASSIFIED" })],
      general.id,
      null,
      "local",
    );
    const view = await application.modelTargets.view();
    assert.deepEqual(
      view.targets.map((entry) => [
        entry.availability.launch,
        entry.availability.reason,
      ]),
      [["UNAVAILABLE", "UNCLASSIFIED"]],
    );
    const result = await run(
      application,
      general.id,
      null,
      "local",
      "Ciao",
      "u1",
    );
    assert.equal(result.result.kind, "REFUSED_BEFORE_EXPOSURE");
    assert.equal(result.result.reason, "TARGET_UNAVAILABLE");
    assert.deepEqual(log.bodies, []);
    assert.deepEqual(await attemptFiles(join(dir, "home")), []);
  });

  it("4. refuses a LOCAL_ONLY target when the host offers no local executor", async () => {
    const dir = await root("n9-absent");
    const application = localModelApplication(dir);
    const general = await application.createGeneralConversation("Sintetica");
    await configureAndSelect(
      application,
      [await localModelTarget(dir, null)],
      general.id,
      null,
      "local",
    );
    const view = await application.modelTargets.view();
    assert.equal(view.targets[0]!.availability.reason, "NOT_CONNECTED");
    const result = await run(
      application,
      general.id,
      null,
      "local",
      "Ciao",
      "a1",
    );
    assert.equal(result.result.kind, "REFUSED_BEFORE_EXPOSURE");
    assert.equal(result.result.reason, "TARGET_UNAVAILABLE");
    assert.deepEqual(await attemptFiles(join(dir, "home")), []);
  });

  it("5. keeps an unknown outcome unknown and never calls the executor a second time", async () => {
    const { home, log, application, general } =
      await generalSetup("n9-unknown");
    log.result = { kind: "UNKNOWN", reason: "FINISH_REASON_NOT_STOP" };
    const first = await run(
      application,
      general.id,
      null,
      "local",
      "Domanda",
      "k1",
    );
    assert.equal(
      first.result.kind,
      "UNKNOWN_AFTER_EXPOSURE",
      JSON.stringify(first),
    );
    assert.equal(log.bodies.length, 1);
    log.result = { kind: "ANSWER", text: "Tardiva", reportedModel: null };
    const replay = await run(
      application,
      general.id,
      null,
      "local",
      "Domanda",
      "k1",
    );
    assert.equal(replay.duplicate, true);
    assert.equal(replay.result.kind, "UNKNOWN_AFTER_EXPOSURE");
    assert.equal(replay.result.attemptId, first.result.attemptId);
    assert.equal(log.bodies.length, 1);
    const snapshot = await attemptsOf(home).list(generalScopeId(general.id));
    const last = snapshot.records.at(-1)!;
    assert.equal(last.state, "UNKNOWN_AFTER_EXECUTION");
    assert.equal(last.unknownReason, "FINISH_REASON_NOT_STOP");
    assert.equal(last.attemptId, first.result.attemptId);
    const stored = await new GeneralConversations({
      store: new JsonGeneralConversationStore(home),
      ids: () => "unused",
      clock: () => new Date(),
    }).show(general.id);
    assert.equal(
      stored.events.some((event) => event.type === "AGENT_MESSAGE"),
      false,
    );
  });

  it("6. still blocks restricted material before any local call", async () => {
    const { home, log, application, general } =
      await generalSetup("n9-blocked");
    const result = await run(
      application,
      general.id,
      null,
      "local",
      "La chiave AKIAIOSFODNN7EXAMPLE è nel testo",
      "b1",
    );
    assert.equal(result.result.kind, "REFUSED_BEFORE_EXPOSURE");
    assert.equal(result.result.reason, "PRIVACY_BLOCKED");
    assert.deepEqual(log.bodies, []);
    assert.deepEqual(await attemptFiles(home), []);
  });

  it("7. stores a local answer that looks like a placeholder exactly as written", async () => {
    const { home, log, application, general } =
      await generalSetup("n9-lookalike");
    const answer = "Ho scritto a [[EMAIL_1]] e a [[PERSON_2]] come richiesto";
    log.result = { kind: "ANSWER", text: answer, reportedModel: null };
    const result = await run(
      application,
      general.id,
      null,
      "local",
      `Scrivi ad ${EMAIL}`,
      "l1",
    );
    assert.equal(result.result.kind, "COMPLETED", JSON.stringify(result));
    assert.equal(result.result.text, answer);
    const stored = await new GeneralConversations({
      store: new JsonGeneralConversationStore(home),
      ids: () => "unused",
      clock: () => new Date(),
    }).show(general.id);
    const last = stored.events.at(-1)!;
    assert.equal(last.type === "AGENT_MESSAGE" && last.content, answer);
  });

  it("8. previews the original payload for the local target and refuses a bound review", async () => {
    const { log, sent, application, general } =
      await generalSetup("n9-preview");
    const input = {
      conversationId: general.id,
      targetId: "local",
      userText: `Scrivi ad ${EMAIL}`,
    };
    const preview =
      await application.conversationTurns.previewTurnPayload(input);
    assert.equal(preview.kind, "READY");
    if (preview.kind !== "READY") return;
    assert.equal(preview.replacements, 0);
    assert.equal(
      preview.protection,
      "PSEUDONYMIZATION_SKIPPED_LOCAL_MODEL_LOCAL_ONLY",
    );
    const question = preview.sections.find(
      (section) => section.key === "REDUCED_QUESTION",
    )!;
    assert.equal(question.text, input.userText);
    assert.equal(JSON.stringify(preview).includes("[[EMAIL_"), false);

    const bound = await application.conversationTurns.previewTurnPayload({
      ...input,
      bindReview: true,
    });
    assert.deepEqual(
      [bound.kind, bound.kind === "BLOCKED" ? bound.reason : null],
      ["BLOCKED", "REVIEW_UNAVAILABLE"],
    );
    assert.deepEqual([log.bodies, sent], [[], []], "a preview sends nothing");

    // Contrast: the external target is previewed protected, without the field.
    await configureAndSelect(application, [], general.id, null, "external");
    const external = await application.conversationTurns.previewTurnPayload({
      ...input,
      targetId: "external",
    });
    assert.equal(external.kind, "READY");
    if (external.kind !== "READY") return;
    assert.equal(external.replacements, 1);
    assert.equal("protection" in external, false);
    assert.equal(JSON.stringify(external).includes(EMAIL), false);
  });

  describe("9. recovery after a restart", () => {
    const sourcesOf = (home: string) => {
      const general = new GeneralConversations({
        store: new JsonGeneralConversationStore(home),
        ids: () => "unused",
        clock: () => new Date(),
      });
      return {
        conversations: {
          projects: async () => [],
          sessions: { list: async () => [] },
          notes: { list: () => general.list() },
          workItems: { list: async () => [] },
        },
        general,
      };
    };
    const referenceFor = async (home: string, conversationId: string) => {
      const record = (
        await attemptsOf(home).list(generalScopeId(conversationId))
      ).records.at(-1)!;
      return {
        projectId: record.scopeId,
        authorizationId: record.authorizationId,
        attemptId: record.attemptId,
        executionClass: "LOCAL_MODEL" as const,
      };
    };
    const scope = (conversationId: string) => ({
      conversationId,
      projectId: null,
      workItemId: null,
      handoffId: null,
    });

    it("replays a completed turn from a new instance without a local executor", async () => {
      const { dir, home, log, general } = await generalSetup("n9-restart");
      const first = await run(
        localModelApplication(dir, { log }),
        general.id,
        null,
        "local",
        "Domanda",
        "r1",
      );
      assert.equal(first.result.kind, "COMPLETED");
      const restarted = localModelApplication(dir);
      const replay = await run(
        restarted,
        general.id,
        null,
        "local",
        "Domanda",
        "r1",
      );
      assert.equal(replay.duplicate, true);
      assert.equal(replay.result.kind, "COMPLETED");
      assert.equal(replay.result.text, first.result.text);
      assert.equal(log.bodies.length, 1);

      // The same evidence without a stored receipt is read back from the stores.
      const recovered = await conversationTurnRecovery(
        sourcesOf(home),
        new ModelAttempts(new JsonModelAttemptStore(home)),
        undefined,
        attemptsOf(home),
      )(
        conversationTurnClaim(
          {
            conversationId: general.id,
            projectId: null,
            targetId: "local",
            userText: "Domanda",
            clientRequestId: "r1",
          },
          scope(general.id),
        ),
        await referenceFor(home, general.id),
        null,
      );
      assert.equal(recovered.kind, "COMPLETED");
      assert.equal(
        recovered.kind === "COMPLETED" && recovered.text,
        first.result.text,
      );
      assert.equal(log.bodies.length, 1);
    });

    it("keeps an uncertain turn unknown after a restart", async () => {
      const { dir, home, log, general } =
        await generalSetup("n9-restart-unknown");
      log.result = { kind: "UNKNOWN", reason: "TIMED_OUT" };
      const first = await run(
        localModelApplication(dir, { log }),
        general.id,
        null,
        "local",
        "Domanda",
        "r2",
      );
      assert.equal(first.result.kind, "UNKNOWN_AFTER_EXPOSURE");
      const replay = await run(
        localModelApplication(dir),
        general.id,
        null,
        "local",
        "Domanda",
        "r2",
      );
      assert.equal(replay.result.kind, "UNKNOWN_AFTER_EXPOSURE");
      const recovered = await conversationTurnRecovery(
        sourcesOf(home),
        new ModelAttempts(new JsonModelAttemptStore(home)),
        undefined,
        attemptsOf(home),
      )(
        conversationTurnClaim(
          {
            conversationId: general.id,
            projectId: null,
            targetId: "local",
            userText: "Domanda",
            clientRequestId: "r2",
          },
          scope(general.id),
        ),
        await referenceFor(home, general.id),
        null,
      );
      assert.deepEqual(recovered, {
        kind: "UNKNOWN_AFTER_EXPOSURE",
        attemptId: first.result.attemptId,
      });
      assert.equal(log.bodies.length, 1);
    });

    it("treats a local reference without the local store as unknown", async () => {
      const { dir, home, log, general } = await generalSetup("n9-no-store");
      await run(
        localModelApplication(dir, { log }),
        general.id,
        null,
        "local",
        "Domanda",
        "r3",
      );
      const reference = await referenceFor(home, general.id);
      const recovered = await conversationTurnRecovery(
        sourcesOf(home),
        new ModelAttempts(new JsonModelAttemptStore(home)),
      )(
        conversationTurnClaim(
          {
            conversationId: general.id,
            projectId: null,
            targetId: "local",
            userText: "Domanda",
            clientRequestId: "r3",
          },
          scope(general.id),
        ),
        reference,
        null,
      );
      assert.deepEqual(recovered, {
        kind: "UNKNOWN_AFTER_EXPOSURE",
        attemptId: reference.attemptId,
      });
    });
  });
});
