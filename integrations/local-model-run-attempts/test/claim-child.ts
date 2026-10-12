import { LocalModelAttempts } from "@ai-workspace/local-model-execution";
import { JsonLocalModelAttemptStore } from "../src/index.ts";

// Synthetic child for the cross-process claim test: one claim, one line out.
const [home, scopeId, attemptId] = process.argv.slice(2) as [
  string,
  string,
  string,
];
try {
  const claimed = await new LocalModelAttempts(
    new JsonLocalModelAttemptStore(home),
  ).claimExecution(scopeId, attemptId, new Date().toISOString());
  process.stdout.write(`CLAIMED ${claimed.state}\n`);
} catch {
  process.stdout.write("REFUSED\n");
}
