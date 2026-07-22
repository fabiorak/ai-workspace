import { measureResponsesQualificationCorpus } from "../packages/privacy-gateway/test/openai-transport-qualification-evidence.ts";

const first = await measureResponsesQualificationCorpus();
const second = await measureResponsesQualificationCorpus();
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error(
    "The OpenAI Responses qualification corpus is not deterministic.",
  );
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
