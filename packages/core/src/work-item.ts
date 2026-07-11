export type WorkItemId = string & { readonly __brand: "WorkItemId" };
export type RepositoryType = "SOFTWARE" | "DOCUMENTS" | "MIXED";
export type WorkItemStatus = "PROPOSED" | "ACTIVE" | "BLOCKED" | "COMPLETED";
export type WorkItemActor = "LOCAL_USER";

export type WorkItemSource = Readonly<{
  eventId: string;
  sessionId: string;
  eventType: string;
  trust: string;
  sourceArtifactId: string;
  sourcePosition: number;
  sourceRecordHash: string;
}>;

export type WorkItemTransition = Readonly<{
  id: string;
  from: WorkItemStatus;
  to: WorkItemStatus;
  actor: WorkItemActor;
  occurredAt: string;
  sources: readonly WorkItemSource[];
}>;

export type WorkItem = Readonly<{
  id: WorkItemId;
  objective: string;
  projectId: string;
  status: WorkItemStatus;
  version: number;
  createdBy: WorkItemActor;
  createdAt: string;
  updatedAt: string;
  sources: readonly WorkItemSource[];
  transitions: readonly WorkItemTransition[];
}>;

export type CanonicalWorkItemSourceEvent = Readonly<{
  id: string;
  sessionId: string;
  type: string;
  trust: string;
  source: Readonly<{
    artifactId: string;
    position: number;
    recordHash: string;
  }>;
}>;

export type WorkItemStore = Readonly<{
  list(projectId: string): Promise<readonly WorkItem[]>;
  find(projectId: string, workItemId: string): Promise<WorkItem | null>;
  create(item: WorkItem): Promise<WorkItem>;
  transition(item: WorkItem, transition: WorkItemTransition): Promise<WorkItem>;
}>;

export type WorkItemDependencies = Readonly<{
  store: WorkItemStore;
  projects: Readonly<{ exists(projectId: string): Promise<boolean> }>;
  sourceEvents: Readonly<{
    find(
      projectId: string,
      eventId: string,
    ): Promise<CanonicalWorkItemSourceEvent | null>;
  }>;
  ids: () => string;
  clock: () => Date;
}>;

export type CreateWorkItemInput = Readonly<{
  objective: string;
  projectId: string;
  sourceEventIds: readonly string[];
}>;

export type TransitionWorkItemInput = Readonly<{
  projectId: string;
  workItemId: string;
  sourceEventIds: readonly string[];
}>;

export class WorkItemError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkItemError";
  }
}

export class WorkItemConflictError extends WorkItemError {
  public constructor(id: string) {
    super(`Work Item '${id}' changed concurrently. Reload it and retry.`);
    this.name = "WorkItemConflictError";
  }
}

const MAX_OBJECTIVE_LENGTH = 4_096;
const MAX_SOURCES = 20;

export class WorkItems {
  readonly #deps: WorkItemDependencies;
  public constructor(dependencies: WorkItemDependencies) {
    this.#deps = dependencies;
  }

  public async create(input: CreateWorkItemInput): Promise<WorkItem> {
    const projectId = required(input.projectId, "Project ID");
    const objective = bounded(
      input.objective,
      "Objective",
      MAX_OBJECTIVE_LENGTH,
    );
    await this.#project(projectId);
    const sources = await this.#sources(projectId, input.sourceEventIds);
    const now = this.#now();
    return this.#deps.store.create(
      Object.freeze({
        id: required(this.#deps.ids(), "Work Item ID") as WorkItemId,
        objective,
        projectId,
        status: "PROPOSED",
        version: 1,
        createdBy: "LOCAL_USER",
        createdAt: now,
        updatedAt: now,
        sources,
        transitions: Object.freeze([]),
      }),
    );
  }

  public async show(
    projectIdValue: string,
    idValue: string,
  ): Promise<WorkItem> {
    const projectId = required(projectIdValue, "Project ID");
    const id = required(idValue, "Work Item ID");
    await this.#project(projectId);
    const item = await this.#deps.store.find(projectId, id);
    if (item === null || item.projectId !== projectId)
      throw new WorkItemError(
        `Work Item '${id}' was not found in project '${projectId}'. List that project's Work Items and retry.`,
      );
    return item;
  }

  public async list(projectIdValue: string): Promise<readonly WorkItem[]> {
    const projectId = required(projectIdValue, "Project ID");
    await this.#project(projectId);
    return Object.freeze(
      [...(await this.#deps.store.list(projectId))]
        .filter((x) => x.projectId === projectId)
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
        ),
    );
  }

  public activate(input: TransitionWorkItemInput) {
    return this.#move(input, "ACTIVE", ["PROPOSED"]);
  }
  public block(input: TransitionWorkItemInput) {
    return this.#move(input, "BLOCKED", ["PROPOSED", "ACTIVE"]);
  }
  public complete(input: TransitionWorkItemInput) {
    return this.#move(input, "COMPLETED", ["ACTIVE", "BLOCKED"]);
  }
  public reopen(input: TransitionWorkItemInput) {
    return this.#move(input, "ACTIVE", ["COMPLETED"]);
  }

  async #move(
    input: TransitionWorkItemInput,
    to: WorkItemStatus,
    allowed: readonly WorkItemStatus[],
  ): Promise<WorkItem> {
    const current = await this.show(input.projectId, input.workItemId);
    if (!allowed.includes(current.status))
      throw new WorkItemError(
        `Cannot transition Work Item '${current.id}' from ${current.status} to ${to}. Reload it and choose a valid lifecycle action.`,
      );
    const sources = await this.#sources(
      current.projectId,
      input.sourceEventIds,
    );
    const occurredAt = this.#now();
    const transition = Object.freeze({
      id: required(this.#deps.ids(), "Transition ID"),
      from: current.status,
      to,
      actor: "LOCAL_USER" as const,
      occurredAt,
      sources,
    });
    return this.#deps.store.transition(
      Object.freeze({
        ...current,
        status: to,
        version: current.version + 1,
        updatedAt: occurredAt,
        transitions: Object.freeze([...current.transitions, transition]),
      }),
      transition,
    );
  }

  async #project(id: string): Promise<void> {
    if (!(await this.#deps.projects.exists(id)))
      throw new WorkItemError(
        `Project '${id}' is not registered. List or register projects and retry.`,
      );
  }
  async #sources(
    projectId: string,
    values: readonly string[],
  ): Promise<readonly WorkItemSource[]> {
    if (
      values.length < 1 ||
      values.length > MAX_SOURCES ||
      new Set(values).size !== values.length
    )
      throw new WorkItemError(
        `Provide from 1 to ${MAX_SOURCES} unique canonical source event IDs from the same project.`,
      );
    const result: WorkItemSource[] = [];
    for (const value of values) {
      const id = required(value, "Source event ID");
      const event = await this.#deps.sourceEvents.find(projectId, id);
      if (event === null)
        throw new WorkItemError(
          `Source event '${id}' was not found in project '${projectId}'. Search that project's history and retry.`,
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
  #now(): string {
    const date = this.#deps.clock();
    if (Number.isNaN(date.getTime()))
      throw new WorkItemError("Work Item clock returned an invalid date.");
    return date.toISOString();
  }
}

function required(value: string, label: string): string {
  const v = value.trim();
  if (!v) throw new WorkItemError(`${label} cannot be empty.`);
  return v;
}
function bounded(value: string, label: string, max: number): string {
  const v = required(value, label);
  if (v.length > max)
    throw new WorkItemError(`${label} must be at most ${max} characters.`);
  return v;
}
