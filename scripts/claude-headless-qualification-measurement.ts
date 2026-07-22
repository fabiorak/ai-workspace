import { measureClaudeHeadlessQualificationCorpus } from "../packages/privacy-gateway/test/anthropic-transport-qualification-evidence.ts";

const first = await measureClaudeHeadlessQualificationCorpus();
const second = await measureClaudeHeadlessQualificationCorpus();
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error(
    "The Claude headless qualification corpus is not deterministic.",
  );
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
