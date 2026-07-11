import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Handoffs,
  renderHandoff,
  type RepositoryValidation,
  type TestObservation,
} from "@ai-workspace/handoff";
import { GitHandoffRepositoryReader } from "@ai-workspace/git-adapter";
import {
  JsonActiveMemoryStore,
  LocalMemorySourceEventReader,
} from "@ai-workspace/local-active-memory";
import { JsonHandoffStore } from "@ai-workspace/local-handoffs";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import { JsonWorkItemStore } from "@ai-workspace/local-work-items";

export type HandoffCliDependencies = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  stdout: (content: string) => void;
  stdin?: () => Promise<string>;
}>;
export class HandoffCliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HandoffCliUsageError";
  }
}
export async function runHandoffCommand(
  command: string | undefined,
  args: readonly string[],
  json: boolean,
  deps: HandoffCliDependencies,
): Promise<number> {
  const handoffs = createHandoffs(deps.environment);
  switch (command) {
    case "create": {
      const options = parse(
        args,
        [
          "--project",
          "--work-item",
          "--memory",
          "--next-action",
          "--source-event",
          "--relevant-file",
          "--predecessor",
          "--test-command",
          "--test-outcome",
          "--test-observed-at",
        ],
        ["--next-action-stdin"],
      );
      const testState = testObservation(options);
      const value = await handoffs.create({
        projectId: one(options, "--project"),
        workItemId: one(options, "--work-item"),
        memoryIds: many(options, "--memory"),
        nextAction: await inlineOrStdin(
          options,
          "--next-action",
          "--next-action-stdin",
          deps,
        ),
        sourceEventIds: requiredMany(options, "--source-event"),
        relevantFiles: many(options, "--relevant-file"),
        ...(options.has("--predecessor")
          ? { predecessorId: one(options, "--predecessor") }
          : {}),
        ...(testState === undefined ? {} : { testState: [testState] }),
      });
      deps.stdout(
        json
          ? `${JSON.stringify(value, null, 2)}\n`
          : `Created immutable handoff. Included: objective, repository metadata, ${value.sections.selectedMemory.value.length} selected memory item(s), ${value.sections.knownFailures.value.length} known failure(s), ${value.sections.testState.value.length} test observation(s), ${value.sections.relevantFiles.value.length} relevant file(s), next action, and source references.\nNo agent was executed and no evidence, memory, repository file, or older handoff was mutated.\n\n${renderHandoff(value)}`,
      );
      return 0;
    }
    case "show": {
      const { id, options } = operand(args);
      const value = await handoffs.show(
        one(options, "--project"),
        one(options, "--work-item"),
        id,
      );
      deps.stdout(
        json ? `${JSON.stringify(value, null, 2)}\n` : renderHandoff(value),
      );
      return 0;
    }
    case "validate": {
      const { id, options } = operand(args);
      const report = await handoffs.validateRepository(
        one(options, "--project"),
        one(options, "--work-item"),
        id,
      );
      deps.stdout(formatValidation(report, json));
      return report.matches ? 0 : 1;
    }
    default:
      throw new HandoffCliUsageError(
        `Unknown handoff command '${command ?? ""}'.`,
      );
  }
}
function createHandoffs(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const home =
      environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace"),
    projectStore = new JsonProjectRegistryStore(join(home, "projects.json"));
  const projects = {
    find: async (id: string) =>
      (await projectStore.load()).find((project) => project.id === id) ?? null,
  };
  return new Handoffs({
    store: new JsonHandoffStore(home),
    workItems: new JsonWorkItemStore(home),
    memory: new JsonActiveMemoryStore(home),
    sourceEvents: new LocalMemorySourceEventReader(home),
    repository: new GitHandoffRepositoryReader(projects),
    ids: randomUUID,
    clock: () => new Date(),
  });
}
type Options = Map<string, string[]>;
function parse(
  args: readonly string[],
  values: readonly string[],
  flags: readonly string[],
): Options {
  const repeatable = ["--memory", "--source-event", "--relevant-file"];
  const result: Options = new Map();
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!;
    if (flags.includes(option)) {
      if (result.has(option))
        throw new HandoffCliUsageError(`${option} cannot be repeated.`);
      result.set(option, []);
      continue;
    }
    if (!values.includes(option))
      throw new HandoffCliUsageError(`Unknown handoff option '${option}'.`);
    const value = args[++index];
    if (value === undefined || value.startsWith("--"))
      throw new HandoffCliUsageError(`${option} requires a value.`);
    if (!repeatable.includes(option) && result.has(option))
      throw new HandoffCliUsageError(`${option} cannot be repeated.`);
    result.set(option, [...(result.get(option) ?? []), value]);
  }
  return result;
}
function operand(args: readonly string[]) {
  const [id, ...rest] = args;
  if (id === undefined || id.startsWith("--"))
    throw new HandoffCliUsageError(
      "Handoff command requires an explicit handoff ID.",
    );
  return { id, options: parse(rest, ["--project", "--work-item"], []) };
}
function one(options: Options, name: string) {
  const value = options.get(name)?.[0];
  if (value === undefined)
    throw new HandoffCliUsageError(`${name} is required.`);
  return value;
}
function many(options: Options, name: string) {
  return options.get(name) ?? [];
}
function requiredMany(options: Options, name: string) {
  const values = many(options, name);
  if (values.length === 0)
    throw new HandoffCliUsageError(`At least one ${name} is required.`);
  return values;
}
async function inlineOrStdin(
  options: Options,
  name: string,
  flag: string,
  deps: HandoffCliDependencies,
) {
  const inline = options.get(name)?.[0],
    stdin = options.has(flag);
  if ((inline === undefined) === !stdin)
    throw new HandoffCliUsageError(`Use exactly one of ${name} or ${flag}.`);
  if (stdin) {
    if (deps.stdin === undefined)
      throw new HandoffCliUsageError("Standard input is unavailable.");
    return (await deps.stdin()).replace(/\r?\n$/u, "");
  }
  return inline!;
}
function testObservation(options: Options): TestObservation | undefined {
  const command = options.get("--test-command")?.[0],
    outcome = options.get("--test-outcome")?.[0],
    observedAt = options.get("--test-observed-at")?.[0];
  if (
    command === undefined &&
    outcome === undefined &&
    observedAt === undefined
  )
    return undefined;
  if (command === undefined || outcome === undefined)
    throw new HandoffCliUsageError(
      "--test-command and --test-outcome must be supplied together.",
    );
  const normalized = outcome.toUpperCase();
  if (
    normalized !== "PASS" &&
    normalized !== "FAIL" &&
    normalized !== "NOT_RUN"
  )
    throw new HandoffCliUsageError(
      "--test-outcome must be PASS, FAIL, or NOT_RUN.",
    );
  return Object.freeze({
    command,
    outcome: normalized,
    observedAt: observedAt ?? null,
  });
}
function formatValidation(report: RepositoryValidation, json: boolean) {
  if (json) return `${JSON.stringify(report, null, 2)}\n`;
  return report.matches
    ? "Repository state matches the immutable handoff snapshot.\n"
    : [
        "Repository state differs from the immutable handoff snapshot.",
        `Differences: ${report.differences.join(", ")}`,
        report.recovery ?? "",
        "",
      ].join("\n");
}
export function handoffUsage(command?: string) {
  return `Handoff commands (${command ?? "overview"})

Usage:
  ai-workspace handoff create --project <id> --work-item <id> [--memory <id>] (--next-action <text>|--next-action-stdin) --source-event <id> [options] [--json]
  ai-workspace handoff show <handoff-id> --project <id> --work-item <id> [--json]
  ai-workspace handoff validate <handoff-id> --project <id> --work-item <id> [--json]

Creation captures bounded Git metadata, never file content or patches. It creates an immutable packet and never invokes an agent. Memory selection is explicit and ACTIVE-only.
`;
}
