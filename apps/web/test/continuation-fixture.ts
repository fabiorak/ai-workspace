import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSyntheticAgentProfile } from "../../../packages/instruction-manager/test/synthetic-agent-profile.ts";
import { GuiApplication } from "../src/application.ts";
import type { HostedAgentExecutor } from "../src/execution-host.ts";
export async function continuationFixture(
  transport?: DeliveryTransport,
  agentExecutors?: readonly HostedAgentExecutor[],
) {
  const root = await mkdtemp(join(tmpdir(), "aiw-continuation-flow-"));
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
    ...(transport ? { continuationTransport: transport } : {}),
    ...(agentExecutors ? { agentExecutors } : {}),
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

  const work = await app.workItems.create({
    projectId: project.id,
    objective: "Continue synthetic diagnosis",
    sourceEventIds: [event.eventId],
  });
  const handoff = await app.createHandoff({
    projectId: project.id,
    workItemId: work.id,
    sourceEventIds: [event.eventId],
    memoryIds: [],
    nextAction: "Inspect the rare failure before retrying",
  });
  const policyPath = join(root, "policy.json");
  await writeFile(
    policyPath,
    JSON.stringify({
      schemaVersion: 1,
      id: "synthetic-policy",
      version: "1.0.0",
      projectId: project.id,
      modelId: target.model,
      maximumDataClass: "CONFIDENTIAL",
      assertions: [],
      attribution: "USER_CONFIGURED",
      author: "Synthetic fixture",
      license: "Apache-2.0",
    }),
  );
  return {
    root,
    home,
    repository,
    app,
    project,
    event,
    query,
    target: {
      ...target,
      label: "Synthetic assistant",
      policy: { path: policyPath },
    },
    handoff,
    work,
  };
}
