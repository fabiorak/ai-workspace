import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * ADR-0035 decomposes the presentation layer while the shell is rebuilt, and
 * forbids the three oversized modules to grow. A prohibition nobody measures is
 * an exhortation, so the counts below are ceilings a test enforces.
 *
 * The rule for changing this file has one direction: a ceiling may be lowered
 * when work moves out of a module, and may never be raised. A change that needs
 * more room in one of these modules is a change that belongs in a new module.
 */
const CEILINGS = Object.freeze({
  "application.ts": 1357,
  "localization.ts": 1401,
  "server.ts": 1177,
});

/** Counts terminated lines, so the number matches what a line-counting tool reports. */
const lineCount = async (name: string) => {
  const path = fileURLToPath(new URL(`../src/${name}`, import.meta.url));
  const content = await readFile(path, "utf8");
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
};

describe("presentation module ceilings", () => {
  it("keeps every oversized module at or below its recorded ceiling", async () => {
    const measured = await Promise.all(
      Object.entries(CEILINGS).map(async ([name, ceiling]) =>
        Object.freeze({ name, ceiling, lines: await lineCount(name) }),
      ),
    );
    const grown = measured.filter((module) => module.lines > module.ceiling);
    assert.deepEqual(
      grown,
      [],
      `These modules grew past their ceiling. Move the addition into a new module instead of raising the number: ${grown
        .map((module) => `${module.name} ${module.lines}/${module.ceiling}`)
        .join(", ")}`,
    );
  });

  it("names only modules that exist, so a rename cannot silently drop a ceiling", async () => {
    for (const name of Object.keys(CEILINGS))
      assert.ok(
        (await lineCount(name)) > 0,
        `${name} is named as a ceiling but was not found. Rename the entry or remove it deliberately.`,
      );
  });
});
