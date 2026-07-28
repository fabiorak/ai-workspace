import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

type RootManifest = { readonly workspaces?: readonly string[] };
type PackageManifest = {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
};
type RootConfig = {
  readonly compilerOptions?: {
    readonly paths?: Readonly<Record<string, readonly string[]>>;
  };
};
type BuildConfig = {
  readonly references?: readonly { readonly path: string }[];
};

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(join(root, relative), "utf8")) as T;
}

const workspaceDirectories = ((): readonly string[] => {
  const directories: string[] = [];
  for (const pattern of readJson<RootManifest>("package.json").workspaces ??
    []) {
    const group = pattern.replace(/\/\*$/, "");
    if (!existsSync(join(root, group))) continue;
    for (const entry of readdirSync(join(root, group)).sort())
      if (existsSync(join(root, group, entry, "package.json")))
        directories.push(`${group}/${entry}`);
  }
  return directories;
})();

const providedBy = new Map<string, string>();
const declaredDependencies = new Set<string>();
for (const directory of workspaceDirectories) {
  const manifest = readJson<PackageManifest>(`${directory}/package.json`);
  if (manifest.name !== undefined) providedBy.set(manifest.name, directory);
  for (const name of Object.keys(manifest.dependencies ?? {}))
    if (name.startsWith("@ai-workspace/")) declaredDependencies.add(name);
}

const pathMap =
  readJson<RootConfig>("tsconfig.json").compilerOptions?.paths ?? {};
const buildReferences = (
  readJson<BuildConfig>("tsconfig.build.json").references ?? []
).map((reference) => reference.path);

/**
 * `npm run check` typechecks before it builds, so `tsc --noEmit` has to resolve
 * every internal dependency from source. The path map in `tsconfig.json` is what
 * makes that possible: without an entry, resolution falls back to the `dist`
 * output the package manifest names, which is present on a machine that has
 * built once and absent from a fresh clone. `@ai-workspace/tolerant-retrieval`
 * shipped without its entry and the failure was invisible where it was written —
 * the gate was green locally and failed in continuous integration with two
 * `TS2307` errors. Comparing the declared dependencies against the path map in
 * both directions is what makes that class of omission fail here instead of in
 * someone else's clone.
 */
test("resolves every declared internal dependency from source", () => {
  for (const name of [...declaredDependencies].sort()) {
    const directory = providedBy.get(name);
    assert.ok(
      directory !== undefined,
      `${name} is declared as a dependency but no workspace provides it`,
    );
    const mapped = pathMap[name];
    assert.ok(
      mapped !== undefined,
      `${name} has no entry in the path map of tsconfig.json, so typecheck resolves it through built output that a fresh clone does not have`,
    );
    assert.deepEqual(
      mapped,
      [`./${directory}/src/index.ts`],
      `${name} must be mapped to the source of ${directory}`,
    );
    assert.ok(
      existsSync(join(root, directory, "src", "index.ts")),
      `${name} is mapped to a source file that does not exist`,
    );
  }
});

test("keeps the path map free of names no workspace provides", () => {
  for (const [name, targets] of Object.entries(pathMap)) {
    assert.ok(
      providedBy.has(name),
      `${name} is mapped in tsconfig.json but no workspace provides it`,
    );
    for (const target of targets)
      assert.ok(
        existsSync(join(root, target)),
        `${name} is mapped to ${target}, which does not exist`,
      );
  }
});

test("builds exactly the workspaces that declare a build configuration", () => {
  const buildable = workspaceDirectories
    .filter((directory) =>
      existsSync(join(root, directory, "tsconfig.build.json")),
    )
    .map((directory) => `./${directory}/tsconfig.build.json`);
  assert.deepEqual(
    [...buildReferences].sort(),
    [...buildable].sort(),
    "tsconfig.build.json must reference exactly the workspaces that declare a build configuration",
  );
});
