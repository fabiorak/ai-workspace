import { AgentAttempts } from "@ai-workspace/agent-execution";
import { JsonAgentAttemptStore } from "../src/index.ts";

// Synthetic child for the cross-process claim test: one claim, one line out.
const [home, scopeId, attemptId] = process.argv.slice(2) as [
  string,
  string,
  string,
];
try {
  const claimed = await new AgentAttempts(
    new JsonAgentAttemptStore(home),
  ).claimExecution(scopeId, attemptId, new Date().toISOString());
  process.stdout.write(`CLAIMED ${claimed.state}\n`);
} catch {
  process.stdout.write("REFUSED\n");
}
