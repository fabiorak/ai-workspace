import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GuiApplication } from "./application.ts";
import { modelTransportFromEnvironment } from "./model-transport.ts";
import { startGuiServer } from "./server.ts";

const workspaceHome =
  process.env.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const continuationTransport = modelTransportFromEnvironment(process.env);

const server = await startGuiServer(
  new GuiApplication({
    workspaceHome,
    sampleSessionPath,
    ...(continuationTransport ? { continuationTransport } : {}),
  }),
);

process.stdout.write(
  `AI Workspace GUI is ready. Open this one-time local URL:\n${server.bootstrapUrl}\nPress Ctrl+C to stop it.\n`,
);

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await server.close();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
