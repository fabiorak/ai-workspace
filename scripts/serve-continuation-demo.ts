import { continuationFixture } from "../apps/web/test/continuation-fixture.ts";
import { startGuiServer } from "../apps/web/src/server.ts";
// A fresh synthetic home on every run; no credential reader or network transport.
const fixture = await continuationFixture({
  send: async ({ text }) => {
    const customer =
      text.match(/\[\[AW_CUSTOMER_[A-F0-9]{16}\]\]/u)?.[0] ??
      "the synthetic customer";
    return {
      kind: "COMPLETED",
      text: `SIMULATED RESPONSE: Inspect the recorded failure for ${customer}. No model was called.`,
      requestId: "synthetic-request",
      responseId: "synthetic-response",
      usage: { inputTokens: null, cachedInputTokens: null, outputTokens: null },
    };
  },
});
await fixture.app.continuations.configure(fixture.query, {
  ...fixture.target,
  label: "Simulated assistant - no provider",
});
const server = await startGuiServer(fixture.app);
process.stdout.write(
  JSON.stringify(
    {
      simulated: true,
      home: fixture.home,
      model: fixture.target.model,
      profile: fixture.target.profile,
      policy: fixture.target.policy,
      bundles: fixture.target.bundles,
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
