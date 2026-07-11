import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { WorkItems, type WorkItem } from "@ai-workspace/core";
import { LocalMemorySourceEventReader } from "@ai-workspace/local-active-memory";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import { JsonWorkItemStore } from "@ai-workspace/local-work-items";

export type WorkCliDependencies = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  stdout: (content: string) => void;
  stdin?: () => Promise<string>;
}>;
export class WorkCliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkCliUsageError";
  }
}
export async function runWorkCommand(
  command: string | undefined,
  args: readonly string[],
  json: boolean,
  deps: WorkCliDependencies,
): Promise<number> {
  const work = createWorkItems(deps.environment);
  switch (command) {
    case "create": {
      const options = parse(
        args,
        ["--project", "--objective", "--source-event"],
        ["--objective-stdin"],
      );
      const item = await work.create({
        projectId: one(options, "--project"),
        objective: await inlineOrStdin(
          options,
          "--objective",
          "--objective-stdin",
          deps,
        ),
        sourceEventIds: sources(options),
      });
      deps.stdout(format(item, json, "Created PROPOSED Work Item"));
      return 0;
    }
    case "list": {
      const options = parse(args, ["--project"], []);
      const items = await work.list(one(options, "--project"));
      deps.stdout(
        json
          ? `${JSON.stringify(items, null, 2)}\n`
          : items.length === 0
            ? "No Work Items found for this project.\n"
            : `${items.map((item) => `${safe(item.id)}  ${item.status}  v${item.version}\n  ${safe(item.objective)}`).join("\n")}\n`,
      );
      return 0;
    }
    case "show": {
      const { id, options } = operand(args);
      deps.stdout(
        format(
          await work.show(one(options, "--project"), id),
          json,
          "Work Item",
        ),
      );
      return 0;
    }
    case "activate":
    case "block":
    case "complete":
    case "reopen": {
      const { id, options } = operand(args, true);
      const input = {
        projectId: one(options, "--project"),
        workItemId: id,
        sourceEventIds: sources(options),
      };
      const item = await work[command](input);
      deps.stdout(
        format(
          item,
          json,
          `${command[0]!.toUpperCase()}${command.slice(1)}d Work Item`,
        ),
      );
      return 0;
    }
    default:
      throw new WorkCliUsageError(`Unknown work command '${command ?? ""}'`);
  }
}
function createWorkItems(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const home =
      environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace"),
    projects = new JsonProjectRegistryStore(join(home, "projects.json"));
  return new WorkItems({
    store: new JsonWorkItemStore(home),
    projects: {
      exists: async (id) =>
        (await projects.load()).some((project) => project.id === id),
    },
    sourceEvents: new LocalMemorySourceEventReader(home),
    ids: randomUUID,
    clock: () => new Date(),
  });
}
function operand(args: readonly string[], transitions = false) {
  const [id, ...rest] = args;
  if (id === undefined || id.startsWith("--"))
    throw new WorkCliUsageError(
      "Work command requires an explicit Work Item ID.",
    );
  return {
    id,
    options: parse(
      rest,
      transitions ? ["--project", "--source-event"] : ["--project"],
      [],
    ),
  };
}
type Options = Map<string, string[]>;
function parse(
  args: readonly string[],
  values: readonly string[],
  flags: readonly string[],
): Options {
  const result: Options = new Map();
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!;
    if (flags.includes(option)) {
      if (result.has(option))
        throw new WorkCliUsageError(`${option} cannot be repeated.`);
      result.set(option, []);
      continue;
    }
    if (!values.includes(option))
      throw new WorkCliUsageError(`Unknown work option '${option}'.`);
    const value = args[++index];
    if (value === undefined || value.startsWith("--"))
      throw new WorkCliUsageError(`${option} requires a value.`);
    if (option !== "--source-event" && result.has(option))
      throw new WorkCliUsageError(`${option} cannot be repeated.`);
    result.set(option, [...(result.get(option) ?? []), value]);
  }
  return result;
}
function one(options: Options, name: string) {
  const value = options.get(name)?.[0];
  if (value === undefined) throw new WorkCliUsageError(`${name} is required.`);
  return value;
}
function sources(options: Options) {
  const values = options.get("--source-event") ?? [];
  if (values.length === 0)
    throw new WorkCliUsageError("At least one --source-event is required.");
  return values;
}
async function inlineOrStdin(
  options: Options,
  valueName: string,
  flag: string,
  deps: WorkCliDependencies,
) {
  const inline = options.get(valueName)?.[0],
    stdin = options.has(flag);
  if ((inline === undefined) === !stdin)
    throw new WorkCliUsageError(`Use exactly one of ${valueName} or ${flag}.`);
  if (stdin) {
    if (deps.stdin === undefined)
      throw new WorkCliUsageError("Standard input is unavailable.");
    return (await deps.stdin()).replace(/\r?\n$/u, "");
  }
  return inline!;
}
function format(item: WorkItem, json: boolean, heading: string) {
  if (json) return `${JSON.stringify(item, null, 2)}\n`;
  return [
    heading,
    `ID: ${safe(item.id)}`,
    `Project: ${safe(item.projectId)}`,
    `Status: ${item.status}`,
    `Version: ${item.version}`,
    `Objective: ${safe(item.objective)}`,
    `Creation sources: ${item.sources.length}`,
    `Lifecycle transitions: ${item.transitions.length}`,
    "Effect: lifecycle is additive; objective and history were not edited in place.",
    "",
  ].join("\n");
}
function safe(value: string) {
  return [...value]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point <= 31 || (point >= 127 && point <= 159) ? "�" : character;
    })
    .join("");
}
export function workUsage(command?: string) {
  return `Work Item commands (${command ?? "overview"})

Usage:
  ai-workspace work create --project <id> (--objective <text>|--objective-stdin) --source-event <id> [--json]
  ai-workspace work list --project <id> [--json]
  ai-workspace work show <work-id> --project <id> [--json]
  ai-workspace work activate|block|complete|reopen <work-id> --project <id> --source-event <id> [--json]

No current Work Item is inferred. Creation and every transition require explicit same-project canonical evidence.
`;
}
