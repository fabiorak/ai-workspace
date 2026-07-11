import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  composeInstructions,
  encodeEffectiveInstructions,
} from "@ai-workspace/instruction-manager";
import { LocalInstructionBundleReader } from "../src/index.ts";

const fixtureDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
const paths = [
  "global.json",
  "workspace.json",
  "project.json",
  "model.json",
  "agent.json",
  "task.json",
].map((name) => join(fixtureDirectory, name));

describe("synthetic effective-instruction workflow", () => {
  it("composes all scopes deterministically without changing or promoting sources", async () => {
    const before = await Promise.all(paths.map((path) => readFile(path)));
    const reader = new LocalInstructionBundleReader();
    const firstBundle = await reader.read(
      "synthetic-project",
      paths.map((path) => ({ path })),
    );
    const secondBundle = await reader.read(
      "synthetic-project",
      [...paths].reverse().map((path) => ({ path })),
    );
    const target = {
      projectId: "synthetic-project",
      model: "synthetic-model",
      agent: "synthetic-agent",
      task: "synthetic-task",
    };
    const first = composeInstructions(firstBundle, target);
    const second = composeInstructions(secondBundle, target);
    assert.equal(
      encodeEffectiveInstructions(first),
      encodeEffectiveInstructions(second),
    );
    assert.deepEqual(
      new Set(first.rules.map((rule) => rule.scope)),
      new Set(["GLOBAL", "WORKSPACE", "PROJECT", "MODEL", "AGENT", "TASK"]),
    );
    assert.ok(first.rules.some((rule) => rule.status === "OVERRIDDEN"));
    assert.ok(first.rules.some((rule) => rule.status === "REJECTED"));
    assert.equal(
      first.rules.every((rule) =>
        [
          "global-source",
          "workspace-source",
          "project-source",
          "model-source",
          "agent-source",
          "task-source",
        ].includes(rule.sourceId),
      ),
      true,
    );
    assert.deepEqual(
      await Promise.all(paths.map((path) => readFile(path))),
      before,
    );
    if (process.env.AI_WORKSPACE_DEMO_REPORT === "1")
      process.stdout.write(
        `SYNTHETIC_INSTRUCTION_PREVIEW ${encodeEffectiveInstructions(first)}`,
      );
  });
});
