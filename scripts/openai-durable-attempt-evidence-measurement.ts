import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { measureDurableAttemptEvidenceCorpus } from "../packages/privacy-gateway/test/openai-durable-attempt-evidence.ts";

const home = await mkdtemp(join(tmpdir(), "aiw-openai-durable-attempt-"));
try {
  const report = await measureDurableAttemptEvidenceCorpus(home);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await rm(home, { recursive: true, force: true });
}
