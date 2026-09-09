import { mkdir, writeFile } from "node:fs/promises";
import { measureContinuationQuality } from "../apps/web/test/continuation-quality-fixture.ts";
const report = await measureContinuationQuality();
await mkdir(".ai-workspace/measurements", { recursive: true });
await writeFile(
  ".ai-workspace/measurements/continuation-quality.json",
  JSON.stringify(report, null, 2) + "\n",
);
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
