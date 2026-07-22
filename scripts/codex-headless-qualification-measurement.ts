import { measureCodexHeadlessQualificationCorpus } from "../packages/privacy-gateway/test/openai-transport-qualification-evidence.ts";

const first = await measureCodexHeadlessQualificationCorpus();
const second = await measureCodexHeadlessQualificationCorpus();
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error(
    "The Codex headless qualification corpus is not deterministic.",
  );
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
