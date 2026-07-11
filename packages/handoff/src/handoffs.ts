import type { MemoryItem } from "@ai-workspace/active-memory";
import type {
  CanonicalWorkItemSourceEvent,
  WorkItem,
  WorkItemSource,
} from "@ai-workspace/core";
import {
  HANDOFF_SCHEMA_VERSION,
  type CreateHandoffInput,
  type Handoff,
  type HandoffSection,
  type MemorySnapshot,
  type RepositorySnapshot,
  type SectionMetadata,
  type TestObservation,
} from "./model.ts";

export type HandoffStore = Readonly<{
  create(handoff: Handoff): Promise<Handoff>;
  find(
    projectId: string,
    workItemId: string,
    handoffId: string,
  ): Promise<Handoff | null>;
}>;
export type HandoffDependencies = Readonly<{
  store: HandoffStore;
  workItems: Readonly<{
    find(projectId: string, id: string): Promise<WorkItem | null>;
  }>;
  memory: Readonly<{
    find(projectId: string, id: string): Promise<MemoryItem | null>;
  }>;
  sourceEvents: Readonly<{
    find(
      projectId: string,
      id: string,
    ): Promise<CanonicalWorkItemSourceEvent | null>;
  }>;
  ids: () => string;
  clock: () => Date;
}>;
export class HandoffError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "HandoffError";
  }
}
const MAX_MEMORY = 20,
  MAX_SOURCES = 20,
  MAX_PATHS = 100,
  MAX_TESTS = 50,
  MAX_TEXT = 4_096,
  MAX_PATH = 1_024;

export class Handoffs {
  readonly #deps: HandoffDependencies;
  public constructor(dependencies: HandoffDependencies) {
    this.#deps = dependencies;
  }
  public async create(input: CreateHandoffInput): Promise<Handoff> {
    const projectId = required(input.projectId, "Project ID"),
      workItemId = required(input.workItemId, "Work Item ID"),
      nextAction = bounded(input.nextAction, "Next action", MAX_TEXT);
    const workItem = await this.#deps.workItems.find(projectId, workItemId);
    if (workItem === null || workItem.projectId !== projectId)
      throw new HandoffError(
        `Work Item '${workItemId}' was not found in project '${projectId}'.`,
      );
    const sources = await this.#sources(projectId, input.sourceEventIds);
    const memory = await this.#memory(projectId, input.memoryIds);
    const failures = Object.freeze(
      memory.filter((item) => item.type === "FAILURE"),
    );
    const paths = list(
      input.relevantFiles ?? [],
      "Relevant files",
      MAX_PATHS,
      MAX_PATH,
    );
    const tests = testsChecked(input.testState ?? []);
    const repository = repositoryChecked(input.repository);
    const createdAt = timestamp(this.#deps.clock(), "Handoff clock");
    const predecessorId =
      input.predecessorId === undefined
        ? null
        : required(input.predecessorId, "Predecessor ID");
    if (
      predecessorId !== null &&
      (await this.#deps.store.find(projectId, workItemId, predecessorId)) ===
        null
    ) {
      throw new HandoffError(
        `Predecessor handoff '${predecessorId}' was not found for the same project and Work Item.`,
      );
    }
    const objectiveMeta = meta(
      "WORK_ITEM",
      "USER_CURATED",
      "USER_CURATED",
      "UNVERIFIED",
      "DERIVED",
      workItem.sources,
    );
    const memoryMeta = meta(
      "ACTIVE_MEMORY",
      "USER_CURATED",
      "USER_CURATED",
      memory.every((x) => x.verification === "VERIFIED") && memory.length > 0
        ? "VERIFIED"
        : "UNVERIFIED",
      "DERIVED",
      Object.freeze(memory.flatMap((item) => item.sources)),
    );
    const userMeta = meta(
      "USER_INPUT",
      "USER_CURATED",
      "USER_CURATED",
      "UNVERIFIED",
      "USER_AUTHORED",
      sources,
    );
    const handoff: Handoff = Object.freeze({
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      id: required(this.#deps.ids(), "Handoff ID"),
      projectId,
      workItemId,
      predecessorId,
      createdBy: "LOCAL_USER",
      createdAt,
      sections: Object.freeze({
        objective: section(objectiveMeta, workItem.objective),
        repository: section(
          meta(
            "REPOSITORY_OBSERVATION",
            "OBSERVED",
            "NONE",
            "NOT_APPLICABLE",
            "OBSERVED",
            sources,
          ),
          repository,
        ),
        selectedMemory: section(
          memoryMeta,
          Object.freeze(memory.map(snapshot)),
        ),
        knownFailures: section(
          memoryMeta,
          Object.freeze(failures.map(snapshot)),
        ),
        testState: section(
          meta(
            "USER_INPUT",
            "OBSERVED",
            "NONE",
            "UNVERIFIED",
            "OBSERVED",
            sources,
          ),
          tests,
        ),
        relevantFiles: section(userMeta, paths),
        nextAction: section(userMeta, nextAction),
        sourceReferences: section(
          meta(
            "CANONICAL_EVENT",
            "UNTRUSTED",
            "NONE",
            "NOT_APPLICABLE",
            "IMPORTED",
            sources,
          ),
          sources,
        ),
      }),
    });
    return this.#deps.store.create(handoff);
  }
  public async show(
    projectIdValue: string,
    workItemIdValue: string,
    handoffIdValue: string,
  ): Promise<Handoff> {
    const projectId = required(projectIdValue, "Project ID");
    const workItemId = required(workItemIdValue, "Work Item ID");
    const handoffId = required(handoffIdValue, "Handoff ID");
    const value = await this.#deps.store.find(projectId, workItemId, handoffId);
    if (
      value === null ||
      value.projectId !== projectId ||
      value.workItemId !== workItemId
    )
      throw new HandoffError(
        `Handoff '${handoffId}' was not found for the explicit project and Work Item.`,
      );
    return value;
  }
  async #memory(
    projectId: string,
    values: readonly string[],
  ): Promise<readonly MemoryItem[]> {
    uniqueBound(values, "Memory IDs", MAX_MEMORY);
    const result: MemoryItem[] = [];
    for (const value of values) {
      const id = required(value, "Memory ID"),
        item = await this.#deps.memory.find(projectId, id);
      if (
        item === null ||
        item.projectId !== projectId ||
        item.validity !== "ACTIVE"
      )
        throw new HandoffError(
          `Memory '${id}' was not found as ACTIVE in project '${projectId}'. Select an explicit active item and retry.`,
        );
      result.push(item);
    }
    return Object.freeze(result);
  }
  async #sources(
    projectId: string,
    values: readonly string[],
  ): Promise<readonly WorkItemSource[]> {
    uniqueBound(values, "Source event IDs", MAX_SOURCES, true);
    const result: WorkItemSource[] = [];
    for (const value of values) {
      const id = required(value, "Source event ID"),
        event = await this.#deps.sourceEvents.find(projectId, id);
      if (event === null)
        throw new HandoffError(
          `Source event '${id}' was not found in project '${projectId}'.`,
        );
      result.push(
        Object.freeze({
          eventId: event.id,
          sessionId: event.sessionId,
          eventType: event.type,
          trust: event.trust,
          sourceArtifactId: event.source.artifactId,
          sourcePosition: event.source.position,
          sourceRecordHash: event.source.recordHash,
        }),
      );
    }
    return Object.freeze(result);
  }
}
function snapshot(item: MemoryItem): MemorySnapshot {
  return Object.freeze({
    id: item.id,
    type: item.type,
    content: item.content,
    verification: item.verification,
    confidence: item.confidence,
  });
}
function meta(
  origin: SectionMetadata["origin"],
  trust: SectionMetadata["trust"],
  curation: SectionMetadata["curation"],
  verification: SectionMetadata["verification"],
  observation: SectionMetadata["observation"],
  sources: readonly WorkItemSource[],
): SectionMetadata {
  return Object.freeze({
    origin,
    trust,
    curation,
    verification,
    observation,
    sources,
  });
}
function section<T>(metadata: SectionMetadata, value: T): HandoffSection<T> {
  return Object.freeze({ metadata, value });
}
function repositoryChecked(value: RepositorySnapshot): RepositorySnapshot {
  const head = bounded(value.head, "Repository HEAD", 256),
    branch =
      value.branch === null
        ? null
        : bounded(value.branch, "Repository branch", 256),
    changedPaths = list(
      value.changedPaths,
      "Changed paths",
      MAX_PATHS,
      MAX_PATH,
    );
  return Object.freeze({ branch, head, dirty: value.dirty, changedPaths });
}
function testsChecked(
  values: readonly TestObservation[],
): readonly TestObservation[] {
  if (values.length > MAX_TESTS)
    throw new HandoffError(
      `Test observations must contain at most ${MAX_TESTS} entries.`,
    );
  return Object.freeze(
    values.map((value) =>
      Object.freeze({
        command: bounded(value.command, "Test command", MAX_TEXT),
        outcome: value.outcome,
        observedAt:
          value.observedAt === null
            ? null
            : timestamp(
                new Date(value.observedAt),
                "Test observation timestamp",
              ),
      }),
    ),
  );
}
function list(
  values: readonly string[],
  label: string,
  max: number,
  itemMax: number,
): readonly string[] {
  uniqueBound(values, label, max);
  return Object.freeze(
    values.map((value) => bounded(value, label.slice(0, -1), itemMax)),
  );
}
function uniqueBound(
  values: readonly string[],
  label: string,
  max: number,
  requiredOne = false,
) {
  if (
    values.length > max ||
    (requiredOne && values.length < 1) ||
    new Set(values).size !== values.length
  )
    throw new HandoffError(
      `${label} must contain ${requiredOne ? "from 1 to " : "at most "}${max} unique entries.`,
    );
}
function bounded(value: string, label: string, max: number) {
  const normalized = required(value, label);
  if (normalized.length > max)
    throw new HandoffError(`${label} must be at most ${max} characters.`);
  return normalized;
}
function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new HandoffError(`${label} cannot be empty.`);
  return normalized;
}
function timestamp(value: Date, label: string) {
  if (Number.isNaN(value.getTime()))
    throw new HandoffError(`${label} returned an invalid date.`);
  return value.toISOString();
}
