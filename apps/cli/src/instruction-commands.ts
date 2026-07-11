import {
  composeInstructions,
  encodeEffectiveInstructions,
  type EffectiveInstructions,
} from "@ai-workspace/instruction-manager";
import { LocalInstructionBundleReader } from "@ai-workspace/local-instructions";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";

export type InstructionCliDependencies = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  stdout: (content: string) => void;
}>;
export class InstructionCliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InstructionCliUsageError";
  }
}

export async function runInstructionCommand(
  command: string | undefined,
  args: readonly string[],
  json: boolean,
  deps: InstructionCliDependencies,
): Promise<number> {
  if (command !== "preview")
    throw new InstructionCliUsageError(
      `Unknown instructions command '${command ?? ""}'.`,
    );
  const options = parse(args);
  const projectId = one(options, "--project");
  const bundles = many(options, "--bundle");
  if (bundles.length === 0)
    throw new InstructionCliUsageError(
      "At least one explicit --bundle is required.",
    );
  const digests = many(options, "--expect-digest");
  if (digests.length !== 0 && digests.length !== bundles.length)
    throw new InstructionCliUsageError(
      "Repeat --expect-digest once for every --bundle, in the same order, or omit it entirely.",
    );
  const home =
    deps.environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
  const projects = await new JsonProjectRegistryStore(
    join(home, "projects.json"),
  ).load();
  if (!projects.some((project) => project.id === projectId))
    throw new InstructionCliUsageError(
      `Project '${projectId}' is not registered. Run project list or project register and retry.`,
    );
  const bundle = await new LocalInstructionBundleReader().read(
    projectId,
    bundles.map((path, index) => ({
      path,
      ...(digests.length === 0 ? {} : { expectedDigest: digests[index]! }),
    })),
  );
  const result = composeInstructions(bundle, {
    projectId,
    ...(options.has("--model") ? { model: one(options, "--model") } : {}),
    ...(options.has("--agent") ? { agent: one(options, "--agent") } : {}),
    ...(options.has("--task") ? { task: one(options, "--task") } : {}),
  });
  deps.stdout(json ? encodeEffectiveInstructions(result) : render(result));
  return 0;
}

type Options = Map<string, string[]>;
function parse(args: readonly string[]): Options {
  const allowed = new Set([
    "--project",
    "--bundle",
    "--expect-digest",
    "--model",
    "--agent",
    "--task",
  ]);
  const repeatable = new Set(["--bundle", "--expect-digest"]);
  const result: Options = new Map();
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!;
    if (!allowed.has(option))
      throw new InstructionCliUsageError(
        `Unknown instructions option '${option}'.`,
      );
    const value = args[++index];
    if (value === undefined || value.startsWith("--"))
      throw new InstructionCliUsageError(`${option} requires a value.`);
    if (!repeatable.has(option) && result.has(option))
      throw new InstructionCliUsageError(`${option} cannot be repeated.`);
    result.set(option, [...(result.get(option) ?? []), value]);
  }
  return result;
}
function one(options: Options, name: string) {
  const value = options.get(name)?.[0];
  if (value === undefined)
    throw new InstructionCliUsageError(`${name} is required.`);
  return value;
}
function many(options: Options, name: string) {
  return options.get(name) ?? [];
}
function render(value: EffectiveInstructions) {
  const lines = [
    "Effective instruction preview (read-only; nothing was executed or persisted)",
    `Project: ${safe(value.projectId)}`,
    `Model: ${safe(value.target.model ?? "(not selected)")}`,
    `Agent: ${safe(value.target.agent ?? "(not selected)")}`,
    `Task: ${safe(value.target.task ?? "(not selected)")}`,
    `Enforcement: ${value.enforcement}`,
    "WARNING: configured instruction text and precedence are not runtime permission enforcement.",
  ];
  let scope = "";
  for (const rule of value.rules) {
    if (rule.scope !== scope) {
      scope = rule.scope;
      lines.push("", scope);
    }
    lines.push(
      `- ${safe(rule.ruleId)} [${rule.kind}] ${rule.status}: ${rule.reason}`,
      `  Source: ${safe(rule.sourceId)} sha256:${rule.sourceDigest} trust=${rule.sourceTrust}`,
      `  Content: ${safe(rule.content)}`,
      ...(rule.supersedingRule === null
        ? []
        : [
            `  Superseded by: ${safe(rule.supersedingRule.sourceId)}/${safe(rule.supersedingRule.ruleId)}@${rule.supersedingRule.position}`,
          ]),
    );
  }
  return `${lines.join("\n")}\n`;
}
function safe(value: string) {
  return [...value]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return (point < 32 && point !== 9 && point !== 10 && point !== 13) ||
        (point >= 127 && point <= 159)
        ? "�"
        : character;
    })
    .join("");
}

export function instructionUsage() {
  return `Effective instruction preview

Usage:
  ai-workspace instructions preview --project <id> --bundle <file> [--bundle <file>] [--expect-digest <sha256>] [--model <id>] [--agent <id>] [--task <id>] [--json]

Bundles must be explicitly selected authored-synthetic schema-v1 JSON files. Repeat --expect-digest once per bundle to detect changed bytes. Preview is read-only, preserves source digests and conflict reasons, and never executes instruction text, an agent, model, or tool. Prompt precedence is not runtime permission enforcement.
`;
}
import { homedir } from "node:os";
import { join } from "node:path";
