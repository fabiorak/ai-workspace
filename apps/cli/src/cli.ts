import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { GitRepositoryInspector } from "@ai-workspace/git-adapter";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import {
  ProjectRegistry,
  type RegisteredProject,
} from "@ai-workspace/project-registry";

export type CliEnvironment = Readonly<Record<string, string | undefined>>;

export type CliWriter = (content: string) => void;

export type CliDependencies = Readonly<{
  environment: CliEnvironment;
  stdout: CliWriter;
  stderr: CliWriter;
}>;

class CliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export async function runCli(
  rawArguments: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  const { arguments: commandArguments, json } =
    parseGlobalOptions(rawArguments);

  if (
    commandArguments.length === 0 ||
    commandArguments[0] === "help" ||
    commandArguments[0] === "--help" ||
    commandArguments[0] === "-h"
  ) {
    dependencies.stdout(usage());
    return 0;
  }

  try {
    const registry = createRegistry(dependencies.environment);
    const [group, command, operand, ...extraArguments] = commandArguments;

    if (group !== "project") {
      throw new CliUsageError(`Unknown command group '${group ?? ""}'`);
    }

    if (extraArguments.length > 0) {
      throw new CliUsageError("Too many command arguments");
    }

    switch (command) {
      case "register": {
        if (operand === undefined) {
          throw new CliUsageError(
            "project register requires a repository path",
          );
        }

        const project = await registry.register(operand);
        dependencies.stdout(formatProject(project, json, "Registered project"));
        return 0;
      }
      case "inspect": {
        if (operand === undefined) {
          throw new CliUsageError("project inspect requires a project id");
        }

        const project = await registry.inspect(operand);
        dependencies.stdout(formatProject(project, json, "Inspected project"));
        return 0;
      }
      case "list": {
        if (operand !== undefined) {
          throw new CliUsageError("project list does not accept an operand");
        }

        const projects = await registry.list();
        dependencies.stdout(formatProjectList(projects, json));
        return 0;
      }
      default:
        throw new CliUsageError(`Unknown project command '${command ?? ""}'`);
    }
  } catch (error) {
    if (error instanceof CliUsageError) {
      dependencies.stderr(`Error: ${error.message}\n\n${usage()}`);
      return 2;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    dependencies.stderr(`Error: ${terminalText(message)}\n`);
    return 1;
  }
}

function createRegistry(environment: CliEnvironment): ProjectRegistry {
  const workspaceHome =
    environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
  const registryPath = join(workspaceHome, "projects.json");

  return new ProjectRegistry({
    inspector: new GitRepositoryInspector(),
    store: new JsonProjectRegistryStore(registryPath),
    generateId: randomUUID,
  });
}

function parseGlobalOptions(rawArguments: readonly string[]): Readonly<{
  arguments: readonly string[];
  json: boolean;
}> {
  const commandArguments: string[] = [];
  let json = false;

  for (const argument of rawArguments) {
    if (argument === "--json") {
      json = true;
      continue;
    }

    commandArguments.push(argument);
  }

  return { arguments: commandArguments, json };
}

function formatProject(
  project: RegisteredProject,
  json: boolean,
  heading: string,
): string {
  if (json) {
    return `${JSON.stringify(project, null, 2)}\n`;
  }

  return [
    heading,
    `ID: ${terminalText(project.id)}`,
    `Name: ${terminalText(project.name)}`,
    `Path: ${terminalText(project.canonicalPath)}`,
    `Type: ${project.repositoryType}`,
    `Branch: ${terminalText(project.branch ?? "(detached or unborn)")}`,
    `HEAD: ${terminalText(project.headCommit ?? "(no commits)")}`,
    `Origin: ${terminalText(project.remoteUrl ?? "(not configured)")}`,
    `Worktree: ${project.isDirty ? "dirty" : "clean"}`,
    `Inspected: ${project.lastInspectedAt}`,
    "",
  ].join("\n");
}

function formatProjectList(
  projects: readonly RegisteredProject[],
  json: boolean,
): string {
  if (json) {
    return `${JSON.stringify(projects, null, 2)}\n`;
  }

  if (projects.length === 0) {
    return "No projects registered.\n";
  }

  return `${projects
    .map(
      (project) =>
        `${terminalText(project.id)}  ${terminalText(project.name)}  ${terminalText(project.branch ?? "(detached)")}  ${
          project.isDirty ? "dirty" : "clean"
        }\n  ${terminalText(project.canonicalPath)}`,
    )
    .join("\n")}\n`;
}

function terminalText(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)
      ? "�"
      : character;
  }).join("");
}

function usage(): string {
  return `AI Workspace CLI

Usage:
  ai-workspace project register <path> [--json]
  ai-workspace project list [--json]
  ai-workspace project inspect <project-id> [--json]
  ai-workspace help

Environment:
  AI_WORKSPACE_HOME  Local state directory (default: ~/.ai-workspace)
`;
}
