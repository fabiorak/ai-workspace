import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { GuiApplication } from "../src/index.ts";
import { buildSyntheticAgentProfile } from "../../../packages/instruction-manager/test/synthetic-agent-profile.ts";

const execFileAsync = promisify(execFile);
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

describe("GUI application facade", () => {
  it("reuses existing use cases without exposing project paths", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      assert.equal("canonicalPath" in project, false);
      assert.equal((await app.listProjects())[0]?.id, project.id);
      assert.equal((await app.inspectProject(project.id)).name, project.name);
    }));

  it("imports idempotently and navigates project-scoped evidence", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      const first = await app.importSample(project.id);
      const second = await app.importSample(project.id);
      assert.ok(first.addedEvents > 0);
      assert.equal(second.addedEvents, 0);
      assert.equal(second.existingEvents, first.totalEvents);
      const search = await app.search({ projectId: project.id, text: "test" });
      assert.ok(search.results.length > 0);
      assert.equal(search.results[0]?.trust, "UNTRUSTED");
      const event = await app.showEvent(project.id, search.results[0]!.eventId);
      assert.match(event.injectionWarning, /inert data/u);
      const artifact = await app.openEventSource(project.id, event.eventId);
      assert.equal(artifact.trust, "UNTRUSTED");
      assert.ok(artifact.byteLength > 0);
    }));

  it("searches all registered projects without exposing paths", async () =>
    withFixture(async ({ app, repository, root }) => {
      const first = await app.registerProject(repository);
      await app.importSample(first.id);
      const secondRepository = join(root, "second-repository");
      await mkdir(secondRepository);
      await execFileAsync("git", [
        "-C",
        secondRepository,
        "init",
        "--initial-branch=main",
      ]);
      await writeFile(
        join(secondRepository, "README.md"),
        "# Second synthetic GUI project\n",
      );
      await execFileAsync("git", ["-C", secondRepository, "add", "README.md"]);
      await execFileAsync("git", [
        "-C",
        secondRepository,
        "-c",
        "user.name=Synthetic GUI Fixture",
        "-c",
        "user.email=gui-fixture@example.invalid",
        "commit",
        "-m",
        "initial",
      ]);
      await app.registerProject(secondRepository);

      const report = await app.searchAllProjects({
        text: "expectation failed",
        type: "COMMAND_RESULT",
      });
      assert.equal(report.scope, "ALL_REGISTERED_PROJECTS");
      assert.equal(report.searchedProjects, 2);
      assert.equal(report.results.length, 1);
      assert.equal(report.results[0]?.projectId, first.id);
      assert.equal(report.results[0]?.projectName, first.name);
      assert.equal("canonicalPath" in report.results[0]!, false);
      assert.equal(JSON.stringify(report).includes(repository), false);
    }));

  it("curates source-linked memory through its additive lifecycle", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      await app.importSample(project.id);
      const eventId = (
        await app.search({ projectId: project.id, text: "test" })
      ).results[0]!.eventId;
      const created = await app.addMemory({
        projectId: project.id,
        type: "DECISION",
        content: "Use the fictional tested greeting.",
        sourceEventIds: [eventId],
      });
      assert.equal(created.curation, "USER_CURATED");
      assert.equal(created.sources[0]!.trust, "UNTRUSTED");
      const verified = await app.verifyMemory({
        projectId: project.id,
        memoryId: created.id,
        note: "Reviewed against the synthetic test result.",
        sourceEventIds: [eventId],
      });
      assert.equal(verified.verification, "VERIFIED");
      const superseded = await app.supersedeMemory({
        projectId: project.id,
        memoryId: verified.id,
        content: "Use the revised fictional tested greeting.",
        sourceEventIds: [eventId],
      });
      assert.equal(superseded.previous.validity, "SUPERSEDED");
      assert.equal(superseded.replacement.verification, "UNVERIFIED");
      assert.equal(superseded.replacement.confidence, "UNASSESSED");
      const invalidated = await app.invalidateMemory({
        projectId: project.id,
        memoryId: superseded.replacement.id,
        reason: "The fictional requirement was withdrawn.",
        sourceEventIds: [eventId],
      });
      assert.equal(invalidated.validity, "INVALIDATED");
      assert.deepEqual(
        (await app.listMemory({ projectId: project.id })).items,
        [],
      );
    }));

  it("manages Work Item lifecycle and immutable handoff continuity", async () =>
    withFixture(async ({ app, repository }) => {
      const project = await app.registerProject(repository);
      await app.importSample(project.id);
      const eventId = (
        await app.search({ projectId: project.id, text: "test" })
      ).results[0]!.eventId;
      const work = await app.createWorkItem({
        projectId: project.id,
        objective: "Preserve the synthetic greeting behavior.",
        sourceEventIds: [eventId],
      });
      assert.equal(work.status, "PROPOSED");
      const active = await app.transitionWorkItem("activate", {
        projectId: project.id,
        workItemId: work.id,
        sourceEventIds: [eventId],
      });
      const input = {
        projectId: project.id,
        workItemId: active.id,
        nextAction: "Inspect the synthetic test result.",
        sourceEventIds: [eventId],
        memoryIds: [],
        relevantFiles: ["README.md"],
      };
      const preview = await app.previewHandoff(input);
      assert.ok(preview.measurement.exactHandoffBytes > 0);
      assert.deepEqual(await app.listHandoffs(project.id, active.id), []);
      const created = await app.createHandoff(input);
      const context = await app.previewContext({
        projectId: project.id,
        workItemId: active.id,
        handoffId: created.id,
        bundles: [],
        continuityBudget: 100_000,
        instructionBudget: 1,
      });
      assert.equal(context.effect, "READ_ONLY_NOT_PERSISTED_OR_EXECUTED");
      assert.equal(context.schemaVersion, 2);
      assert.ok(context.sourceTableSummary?.exactBytes);
      assert.ok(context.included.length > 0);
      assert.equal(
        (await app.listHandoffs(project.id, active.id))[0]!.id,
        created.id,
      );
      assert.equal(
        (await app.validateHandoff(project.id, active.id, created.id)).matches,
        true,
      );
      const successor = await app.createHandoff({
        ...input,
        predecessorId: created.id,
        nextAction: "Continue the synthetic review.",
      });
      assert.equal(successor.predecessorId, created.id);
    }));

  it("previews explicit effective instructions without persistence or execution", async () =>
    withFixture(async ({ app, repository, root }) => {
      const project = await app.registerProject(repository);
      const bundlePath = join(root, "project-instructions.json");
      await writeFile(
        bundlePath,
        JSON.stringify({
          schemaVersion: 1,
          projectId: project.id,
          source: {
            id: "synthetic-project-rules",
            projectId: project.id,
            scope: "PROJECT",
            target: null,
            trust: "USER_CONFIGURED",
            rules: [
              {
                id: "coding.language",
                kind: "PREFERENCE",
                overridable: true,
                content: "Prefer TypeScript.",
                position: 0,
              },
            ],
          },
        }),
      );
      const preview = await app.previewInstructions({
        projectId: project.id,
        bundles: [{ path: bundlePath }],
      });
      assert.equal(
        preview.enforcement,
        "DESCRIPTIVE_INSTRUCTIONS_NOT_RUNTIME_POLICY",
      );
      assert.equal(preview.rules[0]!.status, "ACTIVE");
      assert.equal(preview.rules[0]!.sourceTrust, "USER_CONFIGURED");
    }));

  it("inspects one portable agent and skill profile without path exposure or activation", async () =>
    withFixture(async ({ app, repository, root }) => {
      const project = await app.registerProject(repository);
      const profilePath = join(root, "synthetic-agent-profile.json");
      await writeFile(
        profilePath,
        JSON.stringify(buildSyntheticAgentProfile(project.id), null, 2),
      );
      const preview = await app.previewAgentProfile({
        projectId: project.id,
        profile: { path: profilePath },
      });
      assert.equal(preview.bundle.agent.id, "review-agent");
      assert.equal(preview.bundle.skills.length, 2);
      assert.equal(preview.sourceName, "synthetic-agent-profile.json");
      assert.equal(
        preview.effect,
        "DESCRIPTIVE_NOT_INSTALLED_SELECTED_ENFORCED_OR_EXECUTED",
      );
      assert.equal(JSON.stringify(preview).includes(root), false);
    }));

  it("composes a profile-governed Context Pack from explicit reviewed inputs", async () =>
    withFixture(async ({ app, repository, root }) => {
      const project = await app.registerProject(repository);
      await app.importSample(project.id);
      const eventId = (
        await app.search({ projectId: project.id, text: "test" })
      ).results[0]!.eventId;
      const work = await app.createWorkItem({
        projectId: project.id,
        objective: "Review the synthetic profile composition.",
        sourceEventIds: [eventId],
      });
      await app.transitionWorkItem("activate", {
        projectId: project.id,
        workItemId: work.id,
        sourceEventIds: [eventId],
      });
      const handoff = await app.createHandoff({
        projectId: project.id,
        workItemId: work.id,
        nextAction: "Compose the reviewed synthetic profile.",
        sourceEventIds: [eventId],
        memoryIds: [],
        relevantFiles: ["README.md"],
      });
      const fixture = await writeProfileCompositionFixtures(root, project.id);
      const value = await app.previewProfileContext({
        projectId: project.id,
        workItemId: work.id,
        handoffId: handoff.id,
        profile: { path: fixture.profilePath },
        bundles: fixture.bundlePaths.map((path) => ({ path })),
        model: "model-balanced",
        task: "synthetic-review",
      });
      assert.equal(value.selection.target.agent, "review-agent");
      assert.equal(value.selection.target.model, "model-balanced");
      assert.deepEqual(value.contextPack.budgets, {
        CONTINUITY: 16_384,
        INSTRUCTIONS: 4_096,
      });
      assert.equal(value.profile.sourceName, "profile-composition.json");
      assert.equal(value.instructions.rules.length, 3);
      assert.equal(value.contextPack.schemaVersion, 2);
      assert.equal(
        value.effect,
        "READ_ONLY_NOT_INSTALLED_PERSISTED_DELIVERED_OR_EXECUTED",
      );
      const policyPath = join(root, "synthetic-model-data-policy.json");
      await writeFile(
        policyPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "synthetic-balanced-policy",
            version: "1.0.0",
            projectId: project.id,
            modelId: "model-balanced",
            maximumDataClass: "CONFIDENTIAL",
            assertions: [],
            attribution: "USER_CONFIGURED",
            author: "AI Workspace contributors",
            license: "Apache-2.0",
          },
          null,
          2,
        ),
      );
      const privacy = await app.previewPrivacyPreflight({
        projectId: project.id,
        workItemId: work.id,
        handoffId: handoff.id,
        profile: { path: fixture.profilePath },
        bundles: fixture.bundlePaths.map((path) => ({ path })),
        model: "model-balanced",
        task: "synthetic-review",
        policy: { path: policyPath },
      });
      assert.equal(
        privacy.preflight.overallResult,
        "REVIEWABLE_NOT_AUTHORIZED",
      );
      assert.equal(
        privacy.preflight.accounting.defaultedItems,
        privacy.preflight.accounting.evaluatedItems,
      );
      assert.equal(
        privacy.policy.sourceName,
        "synthetic-model-data-policy.json",
      );
      assert.equal(privacy.selection.target.model, privacy.preflight.modelId);
      assert.equal(JSON.stringify(privacy).includes(root), false);
      const reviewedItem = value.contextPack.included[0]!;
      const pseudonymized = await app.previewPseudonymization({
        projectId: project.id,
        workItemId: work.id,
        handoffId: handoff.id,
        profile: { path: fixture.profilePath },
        bundles: fixture.bundlePaths.map((path) => ({ path })),
        model: "model-balanced",
        task: "synthetic-review",
        policy: { path: policyPath },
        keyCustody: {
          mode: "PASSPHRASE_WRAPPING",
          passphrase: "synthetic application passphrase",
        },
        review: {
          schemaVersion: 1,
          mappingSetId: "synthetic-mapping-1",
          projectId: project.id,
          workItemId: work.id,
          handoffId: handoff.id,
          modelId: "model-balanced",
          attribution: "USER_REVIEWED",
          selections: [
            {
              itemId: reviewedItem.id,
              contentSha256: createHash("sha256")
                .update(reviewedItem.content, "utf8")
                .digest("hex"),
              byteStart: 0,
              byteEnd: 1,
              entityType: "OTHER",
            },
          ],
        },
      });
      assert.equal(pseudonymized.mapping.restorationVerified, true);
      assert.equal(pseudonymized.mapping.encryptedAtRest, true);
      assert.match(pseudonymized.effect, /NOT_AUTHORIZED/u);
      assert.equal(
        JSON.stringify(pseudonymized).includes(
          "synthetic application passphrase",
        ),
        false,
      );
      assert.equal(
        pseudonymized.mapping.keyCustody,
        "PASSPHRASE_WRAPPED_LOCAL",
      );
      assert.equal(JSON.stringify(pseudonymized).includes(root), false);
      const outputPseudonym =
        pseudonymized.transformation.selections[0]!.pseudonym;
      const restoredOutput = await app.inspectPseudonymizedOutput({
        projectId: project.id,
        workItemId: work.id,
        handoffId: handoff.id,
        mappingSetId: pseudonymized.mapping.mappingSetId,
        passphrase: "synthetic application passphrase",
        output: `Synthetic result: ${outputPseudonym}.`,
      });
      assert.equal(restoredOutput.decision, "RESTORABLE_LOCAL_EVIDENCE");
      assert.equal(restoredOutput.restoredTokens, 1);
      assert.equal(
        restoredOutput.restoredContent?.includes(outputPseudonym),
        false,
      );
      assert.match(restoredOutput.effect, /NOT_AUTHORIZED/u);
      await assert.rejects(
        app.inspectPseudonymizedOutput({
          projectId: project.id,
          workItemId: work.id,
          handoffId: "foreign-handoff",
          mappingSetId: pseudonymized.mapping.mappingSetId,
          passphrase: "synthetic application passphrase",
          output: `Synthetic result: ${outputPseudonym}.`,
        }),
        /malformed, oversized, incompatible, or cross-scoped/u,
      );
      await assert.rejects(
        app.previewPrivacyPreflight({
          projectId: project.id,
          workItemId: work.id,
          handoffId: handoff.id,
          profile: { path: fixture.profilePath },
          bundles: fixture.bundlePaths.map((path) => ({ path })),
          model: "model-fast",
          policy: { path: policyPath },
        }),
        /selected model|incompatible/u,
      );
      const selectorPreview = await app.previewContextSelectors({
        projectId: project.id,
        workItemId: work.id,
        handoffId: handoff.id,
        profile: { path: fixture.selectorProfilePath },
      });
      const selectorCase = selectorPreview.report.cases[0]!;
      assert.equal(selectorPreview.report.caseCount, 1);
      assert.equal(selectorCase.safetyFloorLossCount, 0);
      assert.ok(
        selectorCase.selectedCandidateBytes <
          selectorCase.baselineCandidateBytes,
      );
      assert.equal(selectorCase.budgets[0]!.label, "profile-continuity-budget");
      assert.equal(
        selectorPreview.effect,
        "EXPERIMENT_ONLY_NO_CONTEXT_BUILDER_OR_PROFILE_POLICY_CHANGE",
      );
      assert.equal(JSON.stringify(value).includes(root), false);
      assert.equal(JSON.stringify(selectorPreview).includes(root), false);
    }));
});

async function writeProfileCompositionFixtures(
  root: string,
  projectId: string,
) {
  const profilePath = join(root, "profile-composition.json");
  await writeFile(
    profilePath,
    JSON.stringify(buildSyntheticAgentProfile(projectId), null, 2),
  );
  const selectorProfilePath = join(root, "selector-profile.json");
  const profile = buildSyntheticAgentProfile(projectId);
  await writeFile(
    selectorProfilePath,
    JSON.stringify(
      {
        ...profile,
        agent: {
          ...profile.agent,
          context: {
            ...profile.agent.context,
            include: ["handoff.test_state", "handoff.relevant_files"],
            exclude: [],
          },
        },
      },
      null,
      2,
    ),
  );
  const sourceIds = [
    "project-review-rules",
    "dependency-review-rules",
    "test-review-rules",
  ];
  const bundlePaths: string[] = [];
  for (const [position, id] of sourceIds.entries()) {
    const path = join(root, `${id}.json`);
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: 1,
        projectId,
        source: {
          id,
          projectId,
          scope: "PROJECT",
          target: null,
          trust: "USER_CONFIGURED",
          rules: [
            {
              id: `synthetic.rule.${position}`,
              kind: "CONSTRAINT",
              overridable: false,
              content: `Synthetic reviewed instruction ${position}.`,
              position,
            },
          ],
        },
      }),
    );
    bundlePaths.push(path);
  }
  return { profilePath, selectorProfilePath, bundlePaths };
}

async function withFixture(
  run: (value: {
    app: GuiApplication;
    repository: string;
    root: string;
  }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "ai-workspace-gui-app-"));
  const home = join(root, "home");
  const repository = join(root, "repository");
  try {
    await mkdir(repository);
    await execFileAsync("git", [
      "-C",
      repository,
      "init",
      "--initial-branch=main",
    ]);
    await writeFile(join(repository, "README.md"), "# Synthetic GUI project\n");
    await execFileAsync("git", ["-C", repository, "add", "README.md"]);
    await execFileAsync("git", [
      "-C",
      repository,
      "-c",
      "user.name=Synthetic GUI Fixture",
      "-c",
      "user.email=gui-fixture@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    await run({
      app: new GuiApplication({ workspaceHome: home, sampleSessionPath }),
      repository,
      root,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
