import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { CodexSessionSourceAdapter } from "@ai-workspace/codex-adapter";
import { GitRepositoryInspector } from "@ai-workspace/git-adapter";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import {
  FileArtifactStore,
  HighConfidenceRestrictedDataScreen,
  JsonSessionStore,
} from "@ai-workspace/local-session-ingestion";
import {
  ProjectRegistry,
  type RegisteredProject,
} from "@ai-workspace/project-registry";
import {
  SessionIngestion,
  type ImportedSession,
  type SessionImportReport,
} from "@ai-workspace/session-ingestion";

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
    const [group, command, operand, ...extraArguments] = commandArguments;

    switch (group) {
      case "project":
        return await runProjectCommand(
          command,
          operand,
          extraArguments,
          json,
          dependencies,
        );
      case "session":
        return await runSessionCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      default:
        throw new CliUsageError(`Unknown command group '${group ?? ""}'`);
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

async function runProjectCommand(
  command: string | undefined,
  operand: string | undefined,
  extraArguments: readonly string[],
  json: boolean,
  dependencies: CliDependencies,
): Promise<number> {
  if (extraArguments.length > 0) {
    throw new CliUsageError("Too many command arguments");
  }

  const registry = createRegistry(dependencies.environment);

  switch (command) {
    case "register": {
      if (operand === undefined) {
        throw new CliUsageError("project register requires a repository path");
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
}

async function runSessionCommand(
  command: string | undefined,
  argumentsAfterCommand: readonly string[],
  json: boolean,
  dependencies: CliDependencies,
): Promise<number> {
  const ingestion = createSessionIngestion(dependencies.environment);

  switch (command) {
    case "import": {
      const options = parseSessionImportOptions(argumentsAfterCommand);

      if (options.source !== "codex") {
        throw new CliUsageError(
          `Unsupported session source '${options.source}'`,
        );
      }

      const report = await ingestion.import(options.project, options.file);
      dependencies.stdout(formatSessionImport(report, json));
      return 0;
    }
    case "inspect": {
      const [sessionId, ...extraArguments] = argumentsAfterCommand;

      if (sessionId === undefined) {
        throw new CliUsageError("session inspect requires a session id");
      }

      if (extraArguments.length > 0) {
        throw new CliUsageError("session inspect accepts only a session id");
      }

      const session = await ingestion.inspect(sessionId);
      dependencies.stdout(formatSession(session, json));
      return 0;
    }
    default:
      throw new CliUsageError(`Unknown session command '${command ?? ""}'`);
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

function createSessionIngestion(environment: CliEnvironment): SessionIngestion {
  const workspaceHome =
    environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
  const projectStore = new JsonProjectRegistryStore(
    join(workspaceHome, "projects.json"),
  );

  return new SessionIngestion({
    sourceAdapter: new CodexSessionSourceAdapter(),
    screen: new HighConfidenceRestrictedDataScreen(),
    artifactStore: new FileArtifactStore(workspaceHome),
    sessionStore: new JsonSessionStore(workspaceHome),
    projects: {
      async exists(projectId: string): Promise<boolean> {
        return (await projectStore.load()).some(
          (project) => project.id === projectId,
        );
      },
    },
  });
}

function parseSessionImportOptions(
  argumentsAfterCommand: readonly string[],
): Readonly<{ project: string; source: string; file: string }> {
  const options = new Map<string, string>();

  for (let index = 0; index < argumentsAfterCommand.length; index += 2) {
    const option = argumentsAfterCommand[index];
    const value = argumentsAfterCommand[index + 1];

    if (
      option === undefined ||
      !["--project", "--source", "--file"].includes(option)
    ) {
      throw new CliUsageError(
        `Unknown session import option '${option ?? ""}'`,
      );
    }

    if (value === undefined || value.startsWith("--")) {
      throw new CliUsageError(`${option} requires a value`);
    }

    if (options.has(option)) {
      throw new CliUsageError(`${option} cannot be repeated`);
    }

    options.set(option, value);
  }

  const project = options.get("--project");
  const source = options.get("--source");
  const file = options.get("--file");

  if (project === undefined || source === undefined || file === undefined) {
    throw new CliUsageError(
      "session import requires --project, --source, and --file",
    );
  }

  return Object.freeze({ project, source, file });
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

function formatSessionImport(
  report: SessionImportReport,
  json: boolean,
): string {
  if (json) {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  return [
    "Imported session",
    `ID: ${terminalText(report.session.id)}`,
    `Project: ${terminalText(report.session.projectId)}`,
    `Source: ${terminalText(report.session.sourceType)}`,
    `Source session: ${terminalText(report.session.sourceSessionId)}`,
    `Events added: ${report.addedEvents}`,
    `Events already present: ${report.existingEvents}`,
    `Events total: ${report.totalEvents}`,
    `Source artifact: ${terminalText(report.session.latestSourceArtifact.id)}`,
    "",
  ].join("\n");
}

function formatSession(session: ImportedSession, json: boolean): string {
  if (json) {
    return `${JSON.stringify(session, null, 2)}\n`;
  }

  const eventLines = session.events.map(
    (event) =>
      `${event.sequence}. ${event.type}  ${terminalText(event.occurredAt ?? "(no source timestamp)")}\n   ${terminalText(event.source.artifactId)}#record-${event.source.position}`,
  );

  return [
    "Session",
    `ID: ${terminalText(session.id)}`,
    `Project: ${terminalText(session.projectId)}`,
    `Source: ${terminalText(session.sourceType)}`,
    `Source session: ${terminalText(session.sourceSessionId)}`,
    `Agent: ${terminalText(session.agent)}`,
    `Model: ${terminalText(session.model ?? "(not reported)")}`,
    `Events: ${session.events.length}`,
    ...eventLines,
    "",
  ].join("\n");
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
  ai-workspace session import --project <project-id> --source codex --file <path> [--json]
  ai-workspace session inspect <session-id> [--json]
  ai-workspace help

Environment:
  AI_WORKSPACE_HOME  Local state directory (default: ~/.ai-workspace)
`;
}
