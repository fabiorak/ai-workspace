import { measureAnthropicMessagesQualificationCorpus } from "../packages/privacy-gateway/test/anthropic-transport-qualification-evidence.ts";

const first = await measureAnthropicMessagesQualificationCorpus();
const second = await measureAnthropicMessagesQualificationCorpus();
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error(
    "The Anthropic Messages qualification corpus is not deterministic.",
  );
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
