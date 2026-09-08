import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildContextPack,
  expandContextPack,
} from "@ai-workspace/context-builder";
import { buildSyntheticAgentProfile } from "../../../packages/instruction-manager/test/synthetic-agent-profile.ts";
import {
  prepareContinuation,
  type ContinuationSources,
} from "../src/continuation-preparation.ts";
import { composeHandoffProfile } from "../src/profile-context.ts";
import { GuiApplication } from "../src/application.ts";

async function snapshot(root: string): Promise<unknown> {
  const entries = await readdir(root, { withFileTypes: true });
  return Promise.all(
    entries.map(async (entry) => [
      entry.name,
      entry.isDirectory()
        ? await snapshot(join(root, entry.name))
        : (await readFile(join(root, entry.name))).toString("hex"),
    ]),
  );
}

test("prepares the latest kept handoff through the application without changing local state", async () => {
  const root = await mkdtemp(join(tmpdir(), "aiw-continuation-"));
  try {
    const home = join(root, "home"),
      repository = join(root, "repository");
    await mkdir(repository);
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", repository, ...args]);
    git("init", "--initial-branch=main");
    await writeFile(join(repository, "README.md"), "Synthetic continuation\n");
    git("add", "README.md");
    git(
      "-c",
      "user.name=Synthetic",
      "-c",
      "user.email=synthetic@example.invalid",
      "commit",
      "-m",
      "Initial",
    );
    const app = new GuiApplication({
      workspaceHome: home,
      sampleSessionPath: new URL(
        "../../../integrations/codex/test/fixtures/session.jsonl",
        import.meta.url,
      ).pathname,
    });
    const project = await app.registerProject(repository);
    await app.importSample(project.id);
    const event = (await app.search({ projectId: project.id, text: "test" }))
      .results[0]!;
    const query = { projectId: project.id, conversationId: event.sessionId };
    const profile = buildSyntheticAgentProfile(project.id);
    const profilePath = join(root, "profile.json");
    await writeFile(profilePath, JSON.stringify(profile));
    const bundles = [];
    for (const id of [
      "project-review-rules",
      "dependency-review-rules",
      "test-review-rules",
    ]) {
      const path = join(root, `${id}.json`);
      await writeFile(
        path,
        JSON.stringify({
          schemaVersion: 1,
          projectId: project.id,
          source: {
            id,
            projectId: project.id,
            scope: "PROJECT",
            target: null,
            trust: "USER_CONFIGURED",
            rules: [
              {
                id: `${id}.rule`,
                kind: "CONSTRAINT",
                overridable: false,
                content: "Use synthetic evidence.",
                position: 0,
              },
            ],
          },
        }),
      );
      bundles.push({ path });
    }
    const target = {
      destinationId: "synthetic-recipient",
      model: "model-balanced",
      profile: { path: profilePath },
      bundles,
    };
    const prepare = () => app.continuations.prepare(query, target);
    assert.equal((await prepare()).reason, "NO_LINKED_WORK");
    const work = await app.workItems.create({
      projectId: project.id,
      objective: "Continue synthetic diagnosis",
      sourceEventIds: [event.eventId],
    });
    assert.equal((await prepare()).reason, "NO_HANDOFF");
    const input = {
      projectId: project.id,
      workItemId: work.id,
      sourceEventIds: [event.eventId],
      memoryIds: [],
    };
    const first = await app.createHandoff({
      ...input,
      nextAction: "Earlier action",
    });
    await app.createHandoff({
      ...input,
      predecessorId: first.id,
      nextAction: "Read the full failure before retrying",
    });
    const latest = (await app.listHandoffs(project.id, work.id))[0]!;
    const before = await snapshot(home);
    const answer = await prepare();
    assert.equal(answer.prepared, true);
    assert.equal(answer.handoffId, latest.id);
    assert.equal(answer.handoffCreatedAt, latest.createdAt);
    assert.equal(answer.authorized, false);
    const expected = buildContextPack({
      handoff: latest,
      instructions: answer.instructions,
      budgets: answer.selection.budgets,
    });
    assert.deepEqual(answer.contextPack, expected);
    assert.deepEqual(answer.expandedContextPack, expandContextPack(expected));
    assert.ok(
      JSON.stringify(answer.expandedContextPack).includes(
        latest.sections.nextAction.value,
      ),
    );
    assert.equal(answer.repository.matches, true);
    await writeFile(
      join(repository, "README.md"),
      "Changed after the photograph\n",
    );
    const changed = await prepare();
    assert.ok(changed.prepared);
    assert.ok(changed.repository.differences.includes("DIRTY"));
    assert.deepEqual(changed.contextPack, answer.contextPack);
    assert.equal(
      (
        await app.continuations.prepare(
          { ...query, conversationId: "missing" },
          target,
        )
      ).reason,
      "CONVERSATION_NOT_FOUND",
    );
    assert.equal(
      (await app.continuations.prepare({ ...query, projectId: null }, target))
        .reason,
      "NOT_A_WORK_CONVERSATION",
    );
    assert.equal(
      (await app.continuations.prepare(query, null)).reason,
      "TARGET_NOT_CONFIGURED",
    );
    assert.equal(
      (
        await app.continuations.prepare(query, {
          ...target,
          model: "forbidden",
        })
      ).reason,
      "INVALID_TARGET",
    );
    assert.equal(
      (await app.continuations.prepare(query, { ...target, bundles: [] }))
        .reason,
      "INVALID_TARGET",
    );
    // Hostile or broken read ports must never leak another work's content.
    let compositionCalls = 0;
    const sources: ContinuationSources = {
      sessions: {
        list: async () => [{ id: event.sessionId, projectId: project.id }],
      },
      workItems: { list: async () => [work] },
      handoffs: {
        list: async () => [
          { ...latest, id: "z-canonical-first" },
          { ...first, id: "a-second" },
        ],
        show: async (_project, _work, id) => ({ ...latest, id }),
        validateRepository: async () => answer.repository,
      },
      compose: async (...args) => {
        compositionCalls++;
        return composeHandoffProfile(...args);
      },
    };
    const canonical = await prepareContinuation(sources, query, target);
    assert.ok(canonical.prepared);
    assert.equal(canonical.handoffId, "z-canonical-first");
    compositionCalls = 0;
    for (const corrupt of [
      { ...latest, workItemId: "other-work" },
      { ...latest, projectId: "other-project" },
    ]) {
      const refused = await prepareContinuation(
        {
          ...sources,
          handoffs: { ...sources.handoffs, list: async () => [corrupt] },
        },
        query,
        target,
      );
      assert.equal(refused.reason, "INCOHERENT_DATA");
      const reread = await prepareContinuation(
        {
          ...sources,
          handoffs: { ...sources.handoffs, show: async () => corrupt },
        },
        query,
        target,
      );
      assert.equal(reread.reason, "INCOHERENT_DATA");
    }
    assert.equal(
      (
        await prepareContinuation(
          {
            ...sources,
            sessions: {
              list: async () => [
                { id: event.sessionId, projectId: "other-project" },
              ],
            },
          },
          query,
          target,
        )
      ).reason,
      "INCOHERENT_DATA",
    );
    assert.equal(
      (
        await prepareContinuation(
          {
            ...sources,
            workItems: {
              list: async () => [{ ...work, projectId: "other-project" }],
            },
          },
          query,
          target,
        )
      ).reason,
      "INCOHERENT_DATA",
    );
    assert.equal(
      (
        await prepareContinuation(
          {
            ...sources,
            handoffs: {
              ...sources.handoffs,
              show: async () => {
                throw new Error("Private filesystem detail");
              },
            },
          },
          query,
          target,
        )
      ).reason,
      "INCOHERENT_DATA",
    );
    assert.equal(compositionCalls, 0);
    await writeFile(
      profilePath,
      JSON.stringify({ ...profile, projectId: "other-project" }),
    );
    assert.equal((await prepare()).reason, "INVALID_TARGET");
    await writeFile(
      profilePath,
      JSON.stringify({
        ...profile,
        agent: {
          ...profile.agent,
          context: {
            ...profile.agent.context,
            continuityBudgetBytes: 1,
            instructionBudgetBytes: 1,
          },
        },
      }),
    );
    const bounded = await prepare();
    assert.ok(bounded.prepared);
    assert.equal(bounded.contextPack.included.length, 0);
    assert.ok(bounded.contextPack.omitted.length > 0);
    assert.ok(bounded.contextPack.omitted.every((item) => item.exactBytes > 1));
    assert.deepEqual(await snapshot(home), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
