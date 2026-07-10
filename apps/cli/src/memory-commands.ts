import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  ActiveMemory,
  MEMORY_ITEM_TYPES,
  MEMORY_VALIDITIES,
  MEMORY_VERIFICATIONS,
  type MemoryItem,
  type MemoryItemType,
  type MemoryPage,
  type MemoryValidity,
  type MemoryVerification,
  type SupersededMemory,
} from "@ai-workspace/active-memory";
import {
  JsonActiveMemoryStore,
  LocalMemorySourceEventReader,
} from "@ai-workspace/local-active-memory";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";

export type MemoryCliDependencies = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  stdout: (content: string) => void;
  stdin?: () => Promise<string>;
}>;

export class MemoryCliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MemoryCliUsageError";
  }
}

export async function runMemoryCommand(
  command: string | undefined,
  argumentsAfterCommand: readonly string[],
  json: boolean,
  dependencies: MemoryCliDependencies,
): Promise<number> {
  const memory = createActiveMemory(dependencies.environment);

  switch (command) {
    case "add": {
      const options = parseMemoryOptions(argumentsAfterCommand, {
        values: ["--project", "--type", "--content", "--source-event"],
        flags: ["--content-stdin"],
      });
      const projectId = requiredOption(options, "--project");
      const type = memoryType(requiredOption(options, "--type"));
      const content = await inlineOrStdin(
        options,
        "--content",
        "--content-stdin",
        dependencies,
      );
      const item = await memory.add({
        projectId,
        type,
        content,
        sourceEventIds: requiredSources(options),
      });
      dependencies.stdout(formatWrite(item, json, "Created memory item"));
      return 0;
    }
    case "list": {
      const options = parseMemoryOptions(argumentsAfterCommand, {
        values: [
          "--project",
          "--type",
          "--validity",
          "--verification",
          "--limit",
          "--cursor",
        ],
        flags: [],
      });
      const query = listQuery(options);
      const page = await memory.list(query);
      dependencies.stdout(formatPage(page, json, query));
      return 0;
    }
    case "show": {
      const { operand: memoryId, options } = operandAndOptions(
        argumentsAfterCommand,
        ["--project"],
      );
      const item = await memory.show(
        requiredOption(options, "--project"),
        memoryId,
      );
      dependencies.stdout(formatShow(item, json));
      return 0;
    }
    case "verify": {
      const { operand: memoryId, options } = operandAndOptions(
        argumentsAfterCommand,
        ["--project", "--note", "--source-event"],
        ["--note-stdin"],
      );
      const sourceEventIds = requiredSources(options);
      const item = await memory.verify({
        projectId: requiredOption(options, "--project"),
        memoryId,
        sourceEventIds,
        note: await inlineOrStdin(
          options,
          "--note",
          "--note-stdin",
          dependencies,
        ),
      });
      dependencies.stdout(
        formatWrite(item, json, "Verified memory item", {
          label: "Verification source",
          sources: item.verifications.at(-1)?.sources ?? [],
        }),
      );
      return 0;
    }
    case "supersede": {
      const { operand: memoryId, options } = operandAndOptions(
        argumentsAfterCommand,
        ["--project", "--content", "--source-event"],
        ["--content-stdin"],
      );
      const result = await memory.supersede({
        projectId: requiredOption(options, "--project"),
        memoryId,
        content: await inlineOrStdin(
          options,
          "--content",
          "--content-stdin",
          dependencies,
        ),
        sourceEventIds: requiredSources(options),
      });
      dependencies.stdout(formatSupersession(result, json));
      return 0;
    }
    case "invalidate": {
      const { operand: memoryId, options } = operandAndOptions(
        argumentsAfterCommand,
        ["--project", "--reason", "--source-event"],
        ["--reason-stdin"],
      );
      const item = await memory.invalidate({
        projectId: requiredOption(options, "--project"),
        memoryId,
        sourceEventIds: requiredSources(options),
        reason: await inlineOrStdin(
          options,
          "--reason",
          "--reason-stdin",
          dependencies,
        ),
      });
      dependencies.stdout(
        formatWrite(item, json, "Invalidated memory item", {
          label: "Invalidation source",
          sources: item.invalidation?.sources ?? [],
        }),
      );
      return 0;
    }
    default:
      throw new MemoryCliUsageError(
        `Unknown memory command '${command ?? ""}'`,
      );
  }
}

export function memoryUsage(command?: string): string {
  if (command === "add") {
    return `Create USER_CURATED active memory from canonical evidence

Usage:
  ai-workspace memory add --project <project-id> --type <type> \\
    (--content <text> | --content-stdin) --source-event <event-id>... [--json]

Types: DECISION, CONSTRAINT, FAILURE

The new item is ACTIVE, UNVERIFIED, and UNASSESSED. USER_CURATED means the
local user deliberately recorded the statement; it does not mean trusted,
verified, or true. Source evidence remains UNTRUSTED and is never executed.
`;
  }

  if (command === "list") {
    return `List project memory with safe active-only default

Usage:
  ai-workspace memory list --project <project-id> [options] [--json]

Options:
  --type <type>                  DECISION, CONSTRAINT, or FAILURE
  --validity <validity>          ACTIVE, SUPERSEDED, or INVALIDATED
  --verification <verification> UNVERIFIED or VERIFIED
  --limit <1-100>                Page size (default: 20)
  --cursor <cursor>              Continue the same project/filter listing

Omit --validity to list ACTIVE items only. Terminal items remain available
through an explicit validity filter.
`;
  }

  if (command === "show") {
    return `Inspect complete memory lifecycle and provenance

Usage:
  ai-workspace memory show <memory-id> --project <project-id> [--json]
`;
  }

  if (command === "verify") {
    return `Record one attributable verification while an item is ACTIVE

Usage:
  ai-workspace memory verify <memory-id> --project <project-id> \\
    (--note <text> | --note-stdin) --source-event <event-id>... [--json]

Verification records a performed check; it does not make source evidence
trusted and does not change USER_CURATED curation.
`;
  }

  if (command === "supersede") {
    return `Replace active memory additively without rewriting history

Usage:
  ai-workspace memory supersede <memory-id> --project <project-id> \\
    (--content <text> | --content-stdin) --source-event <event-id>... [--json]

The previous item becomes SUPERSEDED. The replacement is a new ACTIVE,
UNVERIFIED, UNASSESSED item and inherits no assessment.
`;
  }

  if (command === "invalidate") {
    return `Mark active memory terminal without creating a replacement

Usage:
  ai-workspace memory invalidate <memory-id> --project <project-id> \\
    (--reason <text> | --reason-stdin) --source-event <event-id>... [--json]
`;
  }

  return `Active project memory

Usage:
  ai-workspace memory add --project <project-id> --type <type> ...
  ai-workspace memory list --project <project-id> [options]
  ai-workspace memory show <memory-id> --project <project-id>
  ai-workspace memory verify <memory-id> --project <project-id> ...
  ai-workspace memory supersede <memory-id> --project <project-id> ...
  ai-workspace memory invalidate <memory-id> --project <project-id> ...

Start with history search to find UNTRUSTED source evidence, then add an
explicit USER_CURATED statement. Run a command with --help for exact options.
`;
}

function createActiveMemory(
  environment: Readonly<Record<string, string | undefined>>,
): ActiveMemory {
  const workspaceHome =
    environment.AI_WORKSPACE_HOME ?? join(homedir(), ".ai-workspace");
  const projectStore = new JsonProjectRegistryStore(
    join(workspaceHome, "projects.json"),
  );

  return new ActiveMemory({
    store: new JsonActiveMemoryStore(workspaceHome),
    sourceEvents: new LocalMemorySourceEventReader(workspaceHome),
    projects: {
      async exists(projectId: string): Promise<boolean> {
        return (await projectStore.load()).some(
          (project) => project.id === projectId,
        );
      },
    },
    ids: randomUUID,
    clock: () => new Date(),
  });
}

type ParsedOptions = Readonly<{
  values: ReadonlyMap<string, readonly string[]>;
  flags: ReadonlySet<string>;
}>;

function parseMemoryOptions(
  argumentsAfterCommand: readonly string[],
  allowed: Readonly<{
    values: readonly string[];
    flags: readonly string[];
  }>,
): ParsedOptions {
  const values = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let index = 0; index < argumentsAfterCommand.length; index += 1) {
    const option = argumentsAfterCommand[index];

    if (option === undefined || !option.startsWith("--")) {
      throw new MemoryCliUsageError(
        `Unexpected memory argument '${option ?? ""}'`,
      );
    }
    if (allowed.flags.includes(option)) {
      if (flags.has(option)) {
        throw new MemoryCliUsageError(`${option} cannot be repeated`);
      }
      flags.add(option);
      continue;
    }
    if (!allowed.values.includes(option)) {
      throw new MemoryCliUsageError(`Unknown memory option '${option}'`);
    }

    const value = argumentsAfterCommand[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new MemoryCliUsageError(`${option} requires a value`);
    }
    const existing = values.get(option) ?? [];
    if (option !== "--source-event" && existing.length > 0) {
      throw new MemoryCliUsageError(`${option} cannot be repeated`);
    }
    values.set(option, [...existing, value]);
    index += 1;
  }

  return Object.freeze({ values, flags });
}

function operandAndOptions(
  argumentsAfterCommand: readonly string[],
  values: readonly string[],
  flags: readonly string[] = [],
): Readonly<{ operand: string; options: ParsedOptions }> {
  const [operand, ...optionArguments] = argumentsAfterCommand;
  if (operand === undefined || operand.startsWith("--")) {
    throw new MemoryCliUsageError(
      "Memory command requires a memory item ID before its options",
    );
  }
  return Object.freeze({
    operand,
    options: parseMemoryOptions(optionArguments, { values, flags }),
  });
}

function requiredOption(options: ParsedOptions, name: string): string {
  const value = options.values.get(name)?.[0];
  if (value === undefined) {
    throw new MemoryCliUsageError(`${name} is required`);
  }
  return value;
}

function requiredSources(options: ParsedOptions): readonly string[] {
  const sources = options.values.get("--source-event") ?? [];
  if (sources.length === 0) {
    throw new MemoryCliUsageError(
      "At least one --source-event <event-id> is required",
    );
  }
  return sources;
}

async function inlineOrStdin(
  options: ParsedOptions,
  inlineName: string,
  stdinName: string,
  dependencies: MemoryCliDependencies,
): Promise<string> {
  const inline = options.values.get(inlineName)?.[0];
  const fromStdin = options.flags.has(stdinName);

  if ((inline === undefined) === !fromStdin) {
    throw new MemoryCliUsageError(
      `Use exactly one of ${inlineName} <text> or ${stdinName}`,
    );
  }
  if (inline !== undefined) {
    return inline;
  }
  if (dependencies.stdin === undefined) {
    throw new MemoryCliUsageError(
      `${stdinName} requires readable stdin in this environment`,
    );
  }
  return dependencies.stdin();
}

function memoryType(value: string): MemoryItemType {
  const normalized = value.toUpperCase();
  if (!MEMORY_ITEM_TYPES.some((type) => type === normalized)) {
    throw new MemoryCliUsageError(
      `Unknown memory type '${value}'. Use one of: ${MEMORY_ITEM_TYPES.join(", ")}`,
    );
  }
  return normalized as MemoryItemType;
}

function memoryValidity(value: string): MemoryValidity {
  const normalized = value.toUpperCase();
  if (!MEMORY_VALIDITIES.some((validity) => validity === normalized)) {
    throw new MemoryCliUsageError(
      `Unknown memory validity '${value}'. Use one of: ${MEMORY_VALIDITIES.join(", ")}`,
    );
  }
  return normalized as MemoryValidity;
}

function memoryVerification(value: string): MemoryVerification {
  const normalized = value.toUpperCase();
  if (
    !MEMORY_VERIFICATIONS.some((verification) => verification === normalized)
  ) {
    throw new MemoryCliUsageError(
      `Unknown memory verification '${value}'. Use one of: ${MEMORY_VERIFICATIONS.join(", ")}`,
    );
  }
  return normalized as MemoryVerification;
}

function listQuery(options: ParsedOptions) {
  const projectId = requiredOption(options, "--project");
  const typeValue = options.values.get("--type")?.[0];
  const validityValue = options.values.get("--validity")?.[0];
  const verificationValue = options.values.get("--verification")?.[0];
  const limitValue = options.values.get("--limit")?.[0];
  const cursor = options.values.get("--cursor")?.[0];
  const limit = limitValue === undefined ? undefined : Number(limitValue);

  if (limit !== undefined && !Number.isSafeInteger(limit)) {
    throw new MemoryCliUsageError(
      "--limit must be a whole number from 1 to 100",
    );
  }

  return Object.freeze({
    projectId,
    ...(typeValue === undefined ? {} : { type: memoryType(typeValue) }),
    ...(validityValue === undefined
      ? {}
      : { validity: memoryValidity(validityValue) }),
    ...(verificationValue === undefined
      ? {}
      : { verification: memoryVerification(verificationValue) }),
    ...(limit === undefined ? {} : { limit }),
    ...(cursor === undefined ? {} : { cursor }),
  });
}

function formatWrite(
  item: MemoryItem,
  json: boolean,
  heading: string,
  transition?: Readonly<{
    label: string;
    sources: MemoryItem["sources"];
  }>,
): string {
  if (json) {
    return `${JSON.stringify(item, null, 2)}\n`;
  }

  return [
    heading,
    ...itemSummary(item),
    "USER_CURATED is an explicit local-user statement, not trusted or true.",
    "Sources remain UNTRUSTED historical evidence and are never executed.",
    ...(transition === undefined
      ? []
      : recordSourceCommands(
          transition.label,
          transition.sources,
          item.projectId,
        )),
    `Next: npm run cli -- memory show ${safe(item.id)} --project ${safe(item.projectId)}`,
    ...sourceCommands(item),
    "",
  ].join("\n");
}

function formatShow(item: MemoryItem, json: boolean): string {
  if (json) {
    return `${JSON.stringify(item, null, 2)}\n`;
  }

  const transitions = [
    ...item.verifications.flatMap((record) => [
      `Verification: ${safe(record.occurredAt)} by ${record.actor} — ${safe(record.note)}`,
      ...recordSourceCommands(
        "Verification source",
        record.sources,
        item.projectId,
      ),
    ]),
    ...(item.supersession === null
      ? []
      : [
          `Superseded: ${safe(item.supersession.occurredAt)} by ${item.supersession.actor} -> ${safe(item.supersession.replacementId)}`,
          ...recordSourceCommands(
            "Supersession source",
            item.supersession.sources,
            item.projectId,
          ),
        ]),
    ...(item.invalidation === null
      ? []
      : [
          `Invalidated: ${safe(item.invalidation.occurredAt)} by ${item.invalidation.actor} — ${safe(item.invalidation.reason)}`,
          ...recordSourceCommands(
            "Invalidation source",
            item.invalidation.sources,
            item.projectId,
          ),
        ]),
  ];

  return [
    "Memory item",
    ...itemSummary(item, true),
    `Supersedes: ${safe(item.supersedes ?? "(none)")}`,
    ...(transitions.length === 0 ? ["Lifecycle records: none"] : transitions),
    "Curation and source trust are independent from verification.",
    ...sourceCommands(item),
    ...nextTransitionCommands(item),
    "",
  ].join("\n");
}

function formatPage(
  page: MemoryPage,
  json: boolean,
  query: ReturnType<typeof listQuery>,
): string {
  if (json) {
    return `${JSON.stringify(page, null, 2)}\n`;
  }
  if (page.items.length === 0) {
    return [
      "No memory items match this project and filter set.",
      query.validity === undefined
        ? "The default is ACTIVE only. Use --validity SUPERSEDED or INVALIDATED to inspect terminal items."
        : "Run history search, then memory add to curate a source-linked item.",
      "",
    ].join("\n");
  }

  const lines = page.items.flatMap((item, index) => [
    `${index + 1}. ${item.type}  ${item.validity}  ${item.verification}  ${item.confidence}`,
    `   ID: ${safe(item.id)}`,
    `   Curation: ${item.curation}; source trust: UNTRUSTED`,
    `   Content: ${safe(snippet(item.content))}`,
    `   Sources: ${item.sources.length}`,
    `   Next: npm run cli -- memory show ${safe(item.id)} --project ${safe(item.projectId)}`,
  ]);
  const continuation =
    page.nextCursor === null
      ? []
      : [
          `Next cursor: ${safe(page.nextCursor)}`,
          `Next page: npm run cli -- memory list --project ${safe(query.projectId)}${filterArguments(query)} --cursor ${safe(page.nextCursor)}`,
        ];

  return [
    `Memory items: ${page.items.length}`,
    "USER_CURATED does not mean trusted or verified. Sources remain UNTRUSTED.",
    ...lines,
    ...continuation,
    "",
  ].join("\n");
}

function formatSupersession(result: SupersededMemory, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }
  return [
    "Superseded memory item additively",
    `Previous: ${safe(result.previous.id)}  ${result.previous.validity}`,
    `Replacement: ${safe(result.replacement.id)}  ${result.replacement.validity}  ${result.replacement.verification}  ${result.replacement.confidence}`,
    "The previous content and provenance remain unchanged and inspectable.",
    "The replacement is USER_CURATED; its sources remain UNTRUSTED evidence.",
    ...recordSourceCommands(
      "Replacement source",
      result.replacement.sources,
      result.replacement.projectId,
    ),
    `Next: npm run cli -- memory show ${safe(result.replacement.id)} --project ${safe(result.replacement.projectId)}`,
    "",
  ].join("\n");
}

function itemSummary(item: MemoryItem, fullContent = false): readonly string[] {
  return [
    `ID: ${safe(item.id)}`,
    `Project: ${safe(item.projectId)}`,
    `Type: ${item.type}`,
    `Content: ${safe(fullContent ? item.content : snippet(item.content))}`,
    `Curation: ${item.curation}`,
    `Validity: ${item.validity}`,
    `Verification: ${item.verification}`,
    `Confidence: ${item.confidence}`,
    `Version: ${item.version}`,
    `Sources: ${item.sources.length}`,
  ];
}

function sourceCommands(item: MemoryItem): readonly string[] {
  return item.sources.flatMap((source) => [
    `Source: ${safe(source.eventId)}  ${source.eventType}  ${source.trust}`,
    `Inspect: npm run cli -- history show ${safe(source.eventId)} --project ${safe(item.projectId)}`,
    `Artifact: npm run cli -- artifact show ${safe(source.sourceArtifactId)}`,
  ]);
}

function recordSourceCommands(
  label: string,
  sources: MemoryItem["sources"],
  projectId: string,
): readonly string[] {
  return sources.flatMap((source) => [
    `${label}: ${safe(source.eventId)}  ${source.eventType}  ${source.trust}`,
    `Inspect: npm run cli -- history show ${safe(source.eventId)} --project ${safe(projectId)}`,
  ]);
}

function nextTransitionCommands(item: MemoryItem): readonly string[] {
  if (item.validity !== "ACTIVE") {
    return [
      "This item is terminal and remains inspectable; no further transition is allowed.",
    ];
  }
  const commands = [
    `Next: npm run cli -- memory supersede ${safe(item.id)} --project ${safe(item.projectId)} --content-stdin --source-event <event-id>`,
    `      npm run cli -- memory invalidate ${safe(item.id)} --project ${safe(item.projectId)} --reason-stdin --source-event <event-id>`,
  ];
  if (item.verification === "UNVERIFIED") {
    commands.unshift(
      `Next: npm run cli -- memory verify ${safe(item.id)} --project ${safe(item.projectId)} --note-stdin --source-event <event-id>`,
    );
  }
  return commands;
}

function filterArguments(query: ReturnType<typeof listQuery>): string {
  return [
    query.type === undefined ? "" : ` --type ${query.type}`,
    query.validity === undefined ? "" : ` --validity ${query.validity}`,
    query.verification === undefined
      ? ""
      : ` --verification ${query.verification}`,
    query.limit === undefined ? "" : ` --limit ${query.limit}`,
  ].join("");
}

function snippet(value: string): string {
  return value.length <= 160 ? value : `${value.slice(0, 159)}…`;
}

function safe(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)
      ? "�"
      : character;
  }).join("");
}
