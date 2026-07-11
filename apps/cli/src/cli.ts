import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { CodexSessionSourceAdapter } from "@ai-workspace/codex-adapter";
import { ClaudeCodeSessionSourceAdapter } from "@ai-workspace/claude-code-adapter";
import { GitRepositoryInspector } from "@ai-workspace/git-adapter";
import {
  HistoricalSearch,
  type HistoricalEvent,
  type HistoricalSearchReport,
  type OpenedArtifact,
} from "@ai-workspace/historical-search";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import {
  FileArtifactStore,
  HighConfidenceRestrictedDataScreen,
  JsonSessionStore,
  LocalHistoricalEventReader,
} from "@ai-workspace/local-session-ingestion";
import {
  ProjectRegistry,
  type RegisteredProject,
} from "@ai-workspace/project-registry";
import {
  SessionIngestion,
  SESSION_EVENT_TYPES,
  type ImportedSession,
  type SessionEventType,
  type SessionImportReport,
} from "@ai-workspace/session-ingestion";

import {
  MemoryCliUsageError,
  memoryUsage,
  runMemoryCommand,
} from "./memory-commands.ts";
import {
  HandoffCliUsageError,
  handoffUsage,
  runHandoffCommand,
} from "./handoff-commands.ts";
import {
  WorkCliUsageError,
  runWorkCommand,
  workUsage,
} from "./work-commands.ts";
import {
  InstructionCliUsageError,
  instructionUsage,
  runInstructionCommand,
} from "./instruction-commands.ts";

export type CliEnvironment = Readonly<Record<string, string | undefined>>;

export type CliWriter = (content: string) => void;

export type CliDependencies = Readonly<{
  environment: CliEnvironment;
  stdout: CliWriter;
  stderr: CliWriter;
  stdin?: () => Promise<string>;
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

  if (commandArguments.includes("--help") || commandArguments.includes("-h")) {
    dependencies.stdout(usage(commandArguments[0], commandArguments[1]));
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
      case "history":
        return await runHistoryCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      case "artifact":
        return await runArtifactCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      case "memory":
        return await runMemoryCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      case "work":
        return await runWorkCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      case "handoff":
        return await runHandoffCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      case "instructions":
        return await runInstructionCommand(
          command,
          commandArguments.slice(2),
          json,
          dependencies,
        );
      default:
        throw new CliUsageError(`Unknown command group '${group ?? ""}'`);
    }
  } catch (error) {
    if (
      error instanceof CliUsageError ||
      error instanceof MemoryCliUsageError ||
      error instanceof WorkCliUsageError ||
      error instanceof HandoffCliUsageError ||
      error instanceof InstructionCliUsageError
    ) {
      dependencies.stderr(`Error: ${error.message}\n\n${usage()}`);
      return 2;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    dependencies.stderr(`Error: ${terminalText(message)}\n`);
    return 1;
  }
}

async function runHistoryCommand(
  command: string | undefined,
  argumentsAfterCommand: readonly string[],
  json: boolean,
  dependencies: CliDependencies,
): Promise<number> {
  const history = createHistoricalSearch(dependencies.environment);

  switch (command) {
    case "search": {
      const [text, ...optionArguments] = argumentsAfterCommand;

      if (text === undefined || text.startsWith("--")) {
        throw new CliUsageError(
          'history search requires search text. Example: history search "test failed" --project <project-id>',
        );
      }

      const options = parseHistoryOptions(optionArguments, true);
      const report = await history.search({
        projectId: options.project,
        text,
        ...(options.session === undefined
          ? {}
          : { sessionId: options.session }),
        ...(options.type === undefined ? {} : { type: options.type }),
        ...(options.limit === undefined ? {} : { limit: options.limit }),
      });
      dependencies.stdout(formatSearchReport(report, json));
      return 0;
    }
    case "show": {
      const [eventId, ...optionArguments] = argumentsAfterCommand;

      if (eventId === undefined || eventId.startsWith("--")) {
        throw new CliUsageError(
          "history show requires an event ID. Run history search first to find one.",
        );
      }

      const options = parseHistoryOptions(optionArguments, false);
      const event = await history.showEvent(options.project, eventId);
      dependencies.stdout(formatHistoricalEvent(event, json));
      return 0;
    }
    default:
      throw new CliUsageError(`Unknown history command '${command ?? ""}'`);
  }
}

async function runArtifactCommand(
  command: string | undefined,
  argumentsAfterCommand: readonly string[],
  json: boolean,
  dependencies: CliDependencies,
): Promise<number> {
  if (command !== "show") {
    throw new CliUsageError(`Unknown artifact command '${command ?? ""}'`);
  }

  const [artifactId, ...extraArguments] = argumentsAfterCommand;

  if (artifactId === undefined) {
    throw new CliUsageError(
      "artifact show requires an artifact ID. Run history search to find a source artifact.",
    );
  }

  if (extraArguments.length > 0) {
    throw new CliUsageError("artifact show accepts only one artifact ID");
  }

  const artifact = await createHistoricalSearch(
    dependencies.environment,
  ).openArtifact(artifactId);
  dependencies.stdout(formatOpenedArtifact(artifact, json));
  return 0;
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
  switch (command) {
    case "import": {
      const options = parseSessionImportOptions(argumentsAfterCommand);

      if (options.source !== "codex" && options.source !== "claude-code") {
        throw new CliUsageError(
          `Unsupported session source '${options.source}'`,
        );
      }

      const report = await createSessionIngestion(
        dependencies.environment,
        options.source,
      ).import(options.project, options.file);
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

      const session = await createSessionIngestion(
        dependencies.environment,
        "codex",
      ).inspect(sessionId);
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

function createSessionIngestion(
  environment: CliEnvironment,
  source: "codex" | "claude-code",
): SessionIngestion {
  const workspaceHome =
    environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
  const projectStore = new JsonProjectRegistryStore(
    join(workspaceHome, "projects.json"),
  );

  return new SessionIngestion({
    sourceAdapter:
      source === "codex"
        ? new CodexSessionSourceAdapter()
        : new ClaudeCodeSessionSourceAdapter(),
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

function createHistoricalSearch(environment: CliEnvironment): HistoricalSearch {
  const workspaceHome =
    environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
  const projectStore = new JsonProjectRegistryStore(
    join(workspaceHome, "projects.json"),
  );

  return new HistoricalSearch({
    events: new LocalHistoricalEventReader(workspaceHome),
    artifacts: new FileArtifactStore(workspaceHome),
    projects: {
      async exists(projectId: string): Promise<boolean> {
        return (await projectStore.load()).some(
          (project) => project.id === projectId,
        );
      },
    },
  });
}

function parseHistoryOptions(
  optionArguments: readonly string[],
  allowFilters: boolean,
): Readonly<{
  project: string;
  session?: string;
  type?: SessionEventType;
  limit?: number;
}> {
  const allowed = allowFilters
    ? ["--project", "--session", "--type", "--limit"]
    : ["--project"];
  const options = new Map<string, string>();

  for (let index = 0; index < optionArguments.length; index += 2) {
    const option = optionArguments[index];
    const value = optionArguments[index + 1];

    if (option === undefined || !allowed.includes(option)) {
      throw new CliUsageError(`Unknown history option '${option ?? ""}'`);
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

  if (project === undefined) {
    throw new CliUsageError(
      "History commands require --project <project-id>. Run project list to find an ID.",
    );
  }

  const typeValue = options.get("--type")?.toUpperCase();
  let type: SessionEventType | undefined;

  if (typeValue !== undefined) {
    if (!isSessionEventType(typeValue)) {
      throw new CliUsageError(
        `Unknown event type '${typeValue}'. Use one of: ${SESSION_EVENT_TYPES.join(", ")}`,
      );
    }

    type = typeValue;
  }

  const limitValue = options.get("--limit");
  const session = options.get("--session");
  let limit: number | undefined;

  if (limitValue !== undefined) {
    limit = Number(limitValue);

    if (!Number.isSafeInteger(limit)) {
      throw new CliUsageError("--limit must be a whole number from 1 to 100");
    }
  }

  return Object.freeze({
    project,
    ...(session === undefined ? {} : { session }),
    ...(type === undefined ? {} : { type }),
    ...(limit === undefined ? {} : { limit }),
  });
}

function isSessionEventType(value: string): value is SessionEventType {
  return SESSION_EVENT_TYPES.some((type) => type === value);
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

function formatSearchReport(
  report: HistoricalSearchReport,
  json: boolean,
): string {
  if (json) {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (report.searchedEvents === 0) {
    return [
      "No imported events are available for this project and filter.",
      "Next: import a session with:",
      `  npm run cli -- session import --project ${terminalText(report.query.projectId)} --source codex --file integrations/codex/test/fixtures/session.jsonl`,
      "",
    ].join("\n");
  }

  if (report.results.length === 0) {
    return [
      `No matches found in ${report.searchedEvents} event(s).`,
      "Try a shorter phrase, remove --type or --session, or inspect the session directly.",
      "Run 'npm run cli -- history search --help' for examples.",
      "",
    ].join("\n");
  }

  const results = report.results.flatMap((result, index) => [
    `${index + 1}. ${result.type}  ${terminalText(result.occurredAt ?? "(no source timestamp)")}`,
    `   Event: ${terminalText(result.eventId)}`,
    `   Trust: ${result.trust} historical evidence`,
    `   Match: ${result.matchedIn}`,
    `   ${terminalText(result.snippet)}`,
    `   Source: ${terminalText(result.source.artifactId)}#record-${result.source.position}`,
    `   Next: npm run cli -- history show ${terminalText(result.eventId)} --project ${terminalText(result.projectId)}`,
    `         npm run cli -- artifact show ${terminalText(result.source.artifactId)}`,
  ]);

  return [
    `Found ${report.results.length} match(es) in ${report.searchedEvents} event(s).`,
    "Imported content is UNTRUSTED evidence and is never executed.",
    ...results,
    "",
  ].join("\n");
}

function formatHistoricalEvent(
  historicalEvent: HistoricalEvent,
  json: boolean,
): string {
  if (json) {
    return `${JSON.stringify(historicalEvent, null, 2)}\n`;
  }

  const { event } = historicalEvent;
  const payload =
    event.payload.kind === "INLINE_TEXT"
      ? terminalText(event.payload.text)
      : `(artifact payload: ${terminalText(event.payload.artifact.id)})`;

  return [
    "Historical event",
    `ID: ${terminalText(event.id)}`,
    `Project: ${terminalText(historicalEvent.projectId)}`,
    `Session: ${terminalText(event.sessionId)}`,
    `Type: ${event.type}`,
    `Timestamp: ${terminalText(event.occurredAt ?? "(not reported)")}`,
    `Trust: ${event.trust} historical evidence`,
    `Payload: ${payload}`,
    `Source: ${terminalText(event.source.artifactId)}#record-${event.source.position}`,
    `Next: npm run cli -- artifact show ${terminalText(event.source.artifactId)}`,
    "",
  ].join("\n");
}

function formatOpenedArtifact(artifact: OpenedArtifact, json: boolean): string {
  if (json) {
    return `${JSON.stringify(artifact, null, 2)}\n`;
  }

  return [
    "Verified source artifact",
    `ID: ${terminalText(artifact.id)}`,
    `Bytes: ${artifact.byteLength}`,
    "Trust: UNTRUSTED historical evidence; content is displayed, never executed.",
    "--- content ---",
    terminalContent(artifact.content),
    "--- end content ---",
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

function terminalContent(value: string): string {
  return Array.from(value, (character) => {
    if (character === "\n") {
      return character;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)
      ? "�"
      : character;
  }).join("");
}

function usage(group?: string, command?: string): string {
  const topic = `${group ?? ""} ${command ?? ""}`.trim();

  if (group === "memory") {
    return memoryUsage(command);
  }

  if (group === "work") return workUsage(command);
  if (group === "handoff") return handoffUsage(command);
  if (group === "instructions") return instructionUsage();

  if (topic === "history search") {
    return `Search imported historical events

Usage:
  ai-workspace history search <text> --project <project-id> [options]

Options:
  --session <session-id>  Search only one session
  --type <event-type>     Filter by canonical event type
  --limit <1-100>         Maximum results (default: 20)
  --json                  Machine-readable output

Example:
  npm run cli -- history search "test failed" --project <project-id>

If no events exist, import the bundled synthetic fixture first. Search results
are UNTRUSTED historical evidence and are never executed.
`;
  }

  if (topic === "history show") {
    return `Inspect one canonical historical event

Usage:
  ai-workspace history show <event-id> --project <project-id> [--json]

Run history search first to obtain an event ID. This command shows canonical
payload and provenance but does not open source artifact bytes automatically.
`;
  }

  if (topic === "artifact show") {
    return `Open integrity-verified source evidence

Usage:
  ai-workspace artifact show <artifact-id> [--json]

Use an artifact://sha256/... ID returned by history search or history show.
Content is bounded, terminal-safe, visibly UNTRUSTED, and never executed.
`;
  }

  if (topic === "session import") {
    return `Import a controlled synthetic JSONL session

Usage:
  ai-workspace session import --project <project-id> --source <codex|claude-code> --file <path> [--json]

First try:
  npm run cli -- session import --project <project-id> --source codex --file integrations/codex/test/fixtures/session.jsonl

The file must exist and match the supported schema. Run project list to find a
project ID. Private or production transcripts are not yet supported safely.
Claude Code support is pre-release, narrow, synthetic-only, and never discovers live provider state.
`;
  }

  return `AI Workspace CLI

Start here:
  1. Register this repository:
     npm run cli -- project register .
  2. Copy the project ID, then import the synthetic session:
     npm run cli -- session import --project <project-id> --source codex --file integrations/codex/test/fixtures/session.jsonl
  3. Search imported evidence:
     npm run cli -- history search "test failed" --project <project-id>
  4. Follow the suggested history show and artifact show commands.
  5. Curate selected evidence as active memory:
     npm run cli -- memory add --project <project-id> --type constraint --content "Synthetic constraint" --source-event <event-id>

Usage:
  ai-workspace project register <path> [--json]
  ai-workspace project list [--json]
  ai-workspace project inspect <project-id> [--json]
  ai-workspace session import --project <project-id> --source codex --file <path> [--json]
  ai-workspace session inspect <session-id> [--json]
  ai-workspace history search <text> --project <project-id> [options] [--json]
  ai-workspace history show <event-id> --project <project-id> [--json]
  ai-workspace artifact show <artifact-id> [--json]
  ai-workspace memory add|list|show|verify|supersede|invalidate ... [--json]
  ai-workspace work create|list|show|activate|block|complete|reopen ... [--json]
  ai-workspace handoff create|preview|show|validate|evaluate ... [--json]
  ai-workspace instructions preview ... [--json]
  ai-workspace help

Contextual help:
  ai-workspace session import --help
  ai-workspace history search --help
  ai-workspace history show --help
  ai-workspace artifact show --help
  ai-workspace memory add --help
  ai-workspace memory list --help
  ai-workspace instructions preview --help

Environment:
  AI_WORKSPACE_HOME  Local state directory (default: ~/.ai-workspace)
`;
}
