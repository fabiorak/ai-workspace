import { measureOutputRestorationCorpus } from "../packages/privacy-gateway/src/index.ts";
import {
  frozenOutputRestorationCorpus,
  permutedOutputRestorationCorpus,
} from "../packages/privacy-gateway/test/synthetic-output-restoration.ts";

const first = measureOutputRestorationCorpus(frozenOutputRestorationCorpus());
const second = measureOutputRestorationCorpus(
  permutedOutputRestorationCorpus(),
);
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error("Output-restoration measurement is not deterministic.");
process.stdout.write(`${JSON.stringify(first, null, 2)}\n`);
