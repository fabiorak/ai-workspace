import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { continuationFixture } from "../apps/web/test/continuation-fixture.ts";
import { startGuiServer } from "../apps/web/src/server.ts";
// A fresh synthetic home on every run; no credential reader or network transport.
// The simulated transport only ever sees protected text, so it answers with the
// placeholders it received and the app restores them before the answer is shown.
const fixture = await continuationFixture({
  send: async ({ text, model }) => {
    if (model === "model-unknown") return { kind: "UNKNOWN" };
    const placeholders = [
      ...new Set(text.match(/\[\[[A-Z_]+_\d+\]\]/gu) ?? []),
    ];
    const subject = placeholders.join(", ") || "the synthetic case";
    return {
      kind: "COMPLETED",
      text: `SIMULATED RESPONSE (${model}): Inspect the recorded failure for ${subject}. No model was called.`,
      requestId: "synthetic-request",
      responseId: "synthetic-response",
      usage: { inputTokens: null, cachedInputTokens: null, outputTokens: null },
    };
  },
});
/** Two targets, because changing model is a step the acceptance has to exercise:
 * with one configured target the only other entry is the empty placeholder. */
const targets = [
  { targetId: "demo-a", displayName: "Demo A", modelId: "model-balanced" },
  { targetId: "demo-b", displayName: "Demo B", modelId: "model-small" },
  {
    targetId: "demo-unknown",
    displayName: "Demo esito incerto",
    modelId: "model-unknown",
  },
];
/** The shared synthetic profile deliberately allows two ordinary fixture models.
 * This acceptance-only third model makes the post-exposure UNKNOWN state visible
 * without a provider, timeout or network fault. */
const profile = JSON.parse(
  await readFile(fixture.target.profile.path, "utf8"),
) as Readonly<{ agent: Readonly<{ allowedModels: readonly string[] }> }>;
await writeFile(
  fixture.target.profile.path,
  JSON.stringify({
    ...profile,
    agent: {
      ...profile.agent,
      allowedModels: [...profile.agent.allowedModels, "model-unknown"],
    },
  }),
);
/** A privacy policy names the model it was written for, so a second model needs
 * a policy of its own: reusing the first one refuses the turn before exposure. */
const policyFor = async (modelId: string) => {
  const path = join(fixture.root, `policy-${modelId}.json`);
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 1,
      id: `synthetic-policy-${modelId}`,
      version: "1.0.0",
      projectId: fixture.project.id,
      modelId,
      maximumDataClass: "CONFIDENTIAL",
      assertions: [],
      attribution: "USER_CONFIGURED",
      author: "Synthetic fixture",
      license: "Apache-2.0",
    }),
  );
  return path;
};
let configuration = { revision: 0 };
for (const { targetId, displayName, modelId } of targets)
  configuration = await fixture.app.modelTargets.configure(
    {
      targetId,
      displayName,
      providerKind: "OPENAI_RESPONSES",
      modelId,
      boundary: "EXTERNAL_SERVICE",
      profileRef: fixture.target.profile.path,
      policyRef: await policyFor(modelId),
      instructionRefs: fixture.target.bundles.map((bundle) => bundle.path),
      maxInputBytes: 256 * 1024,
      maxOutputBytes: 16_384,
      enabled: true,
    },
    configuration.revision,
  );
configuration = await fixture.app.modelTargets.selectDefault(
  targets[0]!.targetId,
  configuration.revision,
);
await fixture.app.modelTargets.selectConversation(
  fixture.query.conversationId,
  fixture.query.projectId,
  targets[0]!.targetId,
  configuration.revision,
);
const server = await startGuiServer(fixture.app);
process.stdout.write(
  JSON.stringify(
    {
      simulated: true,
      home: fixture.home,
      targets: targets.map((t) => t.displayName),
    },
    null,
    2,
  ) + "\n",
);
process.stdout.write(`Open once: ${server.bootstrapUrl}\nStop: Ctrl+C\n`);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    if (stopping) return;
    stopping = true;
    await server.close();
  });
