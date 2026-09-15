import { continuationFixture } from "../apps/web/test/continuation-fixture.ts";
import { startGuiServer } from "../apps/web/src/server.ts";
// A fresh synthetic home on every run; no credential reader or network transport.
// The simulated transport only ever sees protected text, so it answers with the
// placeholders it received and the app restores them before the answer is shown.
const fixture = await continuationFixture({
  send: async ({ text }) => {
    const placeholders = [
      ...new Set(text.match(/\[\[[A-Z_]+_\d+\]\]/gu) ?? []),
    ];
    const subject = placeholders.join(", ") || "the synthetic case";
    return {
      kind: "COMPLETED",
      text: `SIMULATED RESPONSE: Inspect the recorded failure for ${subject}. No model was called.`,
      requestId: "synthetic-request",
      responseId: "synthetic-response",
      usage: { inputTokens: null, cachedInputTokens: null, outputTokens: null },
    };
  },
});
const targetId = "simulated-assistant";
let configuration = await fixture.app.modelTargets.configure(
  {
    targetId,
    displayName: "Simulated assistant - no provider",
    providerKind: "OPENAI_RESPONSES",
    modelId: fixture.target.model,
    boundary: "EXTERNAL_SERVICE",
    profileRef: fixture.target.profile.path,
    policyRef: fixture.target.policy.path,
    instructionRefs: fixture.target.bundles.map((bundle) => bundle.path),
    maxInputBytes: 256 * 1024,
    maxOutputBytes: 16_384,
    enabled: true,
  },
  0,
);
configuration = await fixture.app.modelTargets.selectDefault(
  targetId,
  configuration.revision,
);
await fixture.app.modelTargets.selectConversation(
  fixture.query.conversationId,
  fixture.query.projectId,
  targetId,
  configuration.revision,
);
const server = await startGuiServer(fixture.app);
process.stdout.write(
  JSON.stringify(
    { simulated: true, home: fixture.home, target: targetId },
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
