import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GuiApplication } from "./application.ts";
import { LocalSessionStore } from "./local-session-store.ts";
import { agentExecutorsFromEnvironment } from "./agent-executors.ts";
import { modelTransportFromEnvironment } from "./model-transport.ts";
import { startGuiServer } from "./server.ts";

const workspaceHome =
  process.env.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const continuationTransport = modelTransportFromEnvironment(process.env);
// Without the exact opt-in this reads and locates nothing (ADR-0050).
const agents = await agentExecutorsFromEnvironment(process.env);
for (const entry of agents.report)
  process.stdout.write(
    entry.outcome === "OFFERED"
      ? `Agent execution offered: ${entry.kind}.\n`
      : `Agent execution not offered: ${entry.kind} (${entry.reason}).\n`,
  );

/**
 * The session outlives the process (ADR-0046), so a restart usually needs no
 * link at all. Which of the two things to do is decided here rather than left
 * to the reader: the terminal says the address when the browser still holds the
 * session, and the link when it does not.
 */
const session = await new LocalSessionStore(workspaceHome).establish();

const server = await startGuiServer(
  new GuiApplication({
    workspaceHome,
    sampleSessionPath,
    ...(continuationTransport ? { continuationTransport } : {}),
    agentExecutors: agents.executors,
  }),
  { sessionToken: session.token, sessionMaxAgeSeconds: session.maxAgeSeconds },
);

const RENEWAL_REASONS = {
  MISSING: "no local session was stored yet",
  EXPIRED: "the stored session had expired",
  UNREADABLE: "the stored session could not be read",
  UNSAFE_PERMISSIONS:
    "the stored session was readable by other accounts, so it was discarded",
} as const;

process.stdout.write(
  session.reused
    ? `AI Workspace GUI is ready. Open this local URL:\n${server.origin}/\nIf this browser has no session yet, use the one-time link instead:\n${server.bootstrapUrl}\nPress Ctrl+C to stop it.\n`
    : `AI Workspace GUI is ready. Open this one-time local URL:\n${server.bootstrapUrl}\nA new session was created because ${RENEWAL_REASONS[session.renewedBecause ?? "MISSING"]}.${session.stored ? "" : " It could not be written down, so the next start will ask for a link again."}\nPress Ctrl+C to stop it.\n`,
);

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await server.close();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
