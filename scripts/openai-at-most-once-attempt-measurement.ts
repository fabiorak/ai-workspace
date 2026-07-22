import { measureOpenAiAtMostOnceAttemptCorpus } from "../packages/privacy-gateway/test/openai-at-most-once-attempt-evidence.ts";

const first = await measureOpenAiAtMostOnceAttemptCorpus();
const second = await measureOpenAiAtMostOnceAttemptCorpus();
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error(
    "The OpenAI bounded at-most-once attempt corpus is not deterministic.",
  );
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
