import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import {
  ActiveMemory,
  type InvalidateMemoryInput,
  type ListMemoryQuery,
  type MemoryItem,
  type SupersedeMemoryInput,
  type VerifyMemoryInput,
} from "@ai-workspace/active-memory";
import { CodexSessionSourceAdapter } from "@ai-workspace/codex-adapter";
import { WorkItems, type WorkItem } from "@ai-workspace/core";
import {
  buildContextPack,
  expandContextPack,
  type ExpandedContextPackPreview,
} from "@ai-workspace/context-builder";
import {
  GitHandoffRepositoryReader,
  GitRepositoryInspector,
} from "@ai-workspace/git-adapter";
import {
  Handoffs,
  previewHandoffSize,
  type CreateHandoffInput,
  type Handoff,
  type RepositoryValidation,
} from "@ai-workspace/handoff";
import {
  HistoricalSearch,
  type HistoricalSearchQuery,
} from "@ai-workspace/historical-search";
import {
  composeInstructions,
  type EffectiveInstructions,
} from "@ai-workspace/instruction-manager";
import {
  LocalInstructionBundleReader,
  type LocalInstructionBundleInput,
} from "@ai-workspace/local-instructions";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import {
  JsonActiveMemoryStore,
  LocalMemorySourceEventReader,
} from "@ai-workspace/local-active-memory";
import { JsonHandoffStore } from "@ai-workspace/local-handoffs";
import {
  FileArtifactStore,
  HighConfidenceRestrictedDataScreen,
  JsonSessionStore,
  LocalHistoricalEventReader,
} from "@ai-workspace/local-session-ingestion";
import { JsonWorkItemStore } from "@ai-workspace/local-work-items";
import {
  ProjectRegistry,
  type RegisteredProject,
} from "@ai-workspace/project-registry";
import {
  SessionIngestion,
  type SessionEventType,
} from "@ai-workspace/session-ingestion";

export type GuiProject = Readonly<{
  id: string;
  name: string;
  repositoryType: "SOFTWARE" | "DOCUMENTS" | "MIXED";
  branch: string | null;
  headCommit: string | null;
  isDirty: boolean;
  registeredAt: string;
  lastInspectedAt: string;
}>;
export type GuiImportReport = Readonly<{
  projectId: string;
  sessionId: string;
  sourceName: string;
  trust: "UNTRUSTED";
  addedEvents: number;
  existingEvents: number;
  totalEvents: number;
  effect: string;
  nextAction: string;
}>;
export type GuiSearchInput = Readonly<{
  projectId: string;
  text: string;
  sessionId?: string;
  type?: SessionEventType;
  limit?: number;
}>;
export type GuiSearchReport = Readonly<{
  projectId: string;
  text: string;
  searchedEvents: number;
  results: readonly Readonly<{
    eventId: string;
    sessionId: string;
    type: SessionEventType;
    occurredAt: string | null;
    trust: "UNTRUSTED";
    snippet: string;
    matchedIn: "INLINE_PAYLOAD" | "ARTIFACT_PAYLOAD";
  }>[];
  emptyGuidance: string | null;
}>;
export type GuiGlobalSearchReport = Readonly<{
  scope: "ALL_REGISTERED_PROJECTS";
  text: string;
  searchedProjects: number;
  searchedEvents: number;
  results: readonly Readonly<{
    projectId: string;
    projectName: string;
    eventId: string;
    sessionId: string;
    type: SessionEventType;
    occurredAt: string | null;
    trust: "UNTRUSTED";
    snippet: string;
    matchedIn: "INLINE_PAYLOAD" | "ARTIFACT_PAYLOAD";
  }>[];
  emptyGuidance: string | null;
}>;
export type GuiEvent = Readonly<{
  projectId: string;
  eventId: string;
  sessionId: string;
  type: SessionEventType;
  occurredAt: string | null;
  trust: "UNTRUSTED";
  payload: string;
  sourceArtifactId: string;
  sourcePosition: number;
  sourceRecordHash: string;
  injectionWarning: string;
}>;
export type GuiArtifact = Readonly<{
  projectId: string;
  eventId: string;
  artifactId: string;
  byteLength: number;
  trust: "UNTRUSTED";
  content: string;
  injectionWarning: string;
}>;
export type GuiMemoryPage = Readonly<{
  items: readonly MemoryItem[];
  nextCursor: string | null;
}>;
export type GuiInstructionPreviewInput = Readonly<{
  projectId: string;
  bundles: readonly LocalInstructionBundleInput[];
  model?: string;
  agent?: string;
  task?: string;
}>;
export type GuiContextPreviewInput = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  bundles: readonly LocalInstructionBundleInput[];
  model?: string;
  agent?: string;
  task?: string;
  continuityBudget: number;
  instructionBudget: number;
}>;

export class GuiApplicationError extends Error {
  public readonly recovery: string;
  public constructor(
    message: string,
    recovery: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GuiApplicationError";
    this.recovery = recovery;
  }
}

export class GuiApplication {
  readonly #registry: ProjectRegistry;
  readonly #ingestion: SessionIngestion;
  readonly #history: HistoricalSearch;
  readonly #listRegisteredProjects: () => Promise<readonly RegisteredProject[]>;
  readonly #memory: ActiveMemory;
  readonly #workItems: WorkItems;
  readonly #handoffs: Handoffs;
  readonly #previewInstructions: (
    input: GuiInstructionPreviewInput,
  ) => Promise<EffectiveInstructions>;
  readonly #sampleSessionPath: string;

  public constructor(
    dependencies: Readonly<{
      workspaceHome: string;
      sampleSessionPath: string;
    }>,
  ) {
    const projectStore = new JsonProjectRegistryStore(
      join(dependencies.workspaceHome, "projects.json"),
    );
    this.#listRegisteredProjects = () => projectStore.load();
    const projects = {
      exists: async (projectId: string) =>
        (await projectStore.load()).some((project) => project.id === projectId),
    };
    const projectReader = {
      find: async (projectId: string) =>
        (await projectStore.load()).find(
          (project) => project.id === projectId,
        ) ?? null,
    };
    this.#registry = new ProjectRegistry({
      inspector: new GitRepositoryInspector(),
      store: projectStore,
      generateId: randomUUID,
    });
    this.#ingestion = new SessionIngestion({
      sourceAdapter: new CodexSessionSourceAdapter(),
      screen: new HighConfidenceRestrictedDataScreen(),
      artifactStore: new FileArtifactStore(dependencies.workspaceHome),
      sessionStore: new JsonSessionStore(dependencies.workspaceHome),
      projects,
    });
    this.#history = new HistoricalSearch({
      events: new LocalHistoricalEventReader(dependencies.workspaceHome),
      artifacts: new FileArtifactStore(dependencies.workspaceHome),
      projects,
    });
    this.#memory = new ActiveMemory({
      store: new JsonActiveMemoryStore(dependencies.workspaceHome),
      sourceEvents: new LocalMemorySourceEventReader(
        dependencies.workspaceHome,
      ),
      projects,
      ids: randomUUID,
      clock: () => new Date(),
    });
    const workItemStore = new JsonWorkItemStore(dependencies.workspaceHome);
    this.#workItems = new WorkItems({
      store: workItemStore,
      projects,
      sourceEvents: new LocalMemorySourceEventReader(
        dependencies.workspaceHome,
      ),
      ids: randomUUID,
      clock: () => new Date(),
    });
    this.#handoffs = new Handoffs({
      store: new JsonHandoffStore(dependencies.workspaceHome),
      workItems: workItemStore,
      memory: new JsonActiveMemoryStore(dependencies.workspaceHome),
      sourceEvents: new LocalMemorySourceEventReader(
        dependencies.workspaceHome,
      ),
      repository: new GitHandoffRepositoryReader(projectReader),
      ids: randomUUID,
      clock: () => new Date(),
    });
    const instructionReader = new LocalInstructionBundleReader();
    this.#previewInstructions = async (input) => {
      if (!(await projects.exists(input.projectId)))
        throw new Error(
          "The instruction preview project is not registered locally.",
        );
      const bundle = await instructionReader.read(
        input.projectId,
        input.bundles,
      );
      return composeInstructions(bundle, {
        projectId: input.projectId,
        ...(input.model === undefined ? {} : { model: input.model }),
        ...(input.agent === undefined ? {} : { agent: input.agent }),
        ...(input.task === undefined ? {} : { task: input.task }),
      });
    };
    this.#sampleSessionPath = dependencies.sampleSessionPath;
  }

  public async listProjects(): Promise<readonly GuiProject[]> {
    return this.#run(
      async () => Object.freeze((await this.#registry.list()).map(projectView)),
      "Check local workspace permissions, then retry loading projects.",
    );
  }
  public async registerProject(path: string): Promise<GuiProject> {
    return this.#run(
      async () => projectView(await this.#registry.register(path)),
      "Keep the path in the form, choose an existing local Git repository, and retry.",
    );
  }
  public async inspectProject(projectId: string): Promise<GuiProject> {
    return this.#run(
      async () => projectView(await this.#registry.inspect(projectId)),
      "Return to the project list, select a registered accessible project, and retry.",
    );
  }
  public async importSample(projectId: string): Promise<GuiImportReport> {
    return this.#run(async () => {
      const report = await this.#ingestion.import(
        projectId,
        this.#sampleSessionPath,
      );
      return Object.freeze({
        projectId,
        sessionId: report.session.id,
        sourceName: basename(this.#sampleSessionPath),
        trust: "UNTRUSTED" as const,
        addedEvents: report.addedEvents,
        existingEvents: report.existingEvents,
        totalEvents: report.totalEvents,
        effect:
          report.addedEvents === 0
            ? "The sample was already imported; canonical events and artifacts were unchanged."
            : "Synthetic canonical events and immutable artifacts were added locally.",
        nextAction: "Search this project's UNTRUSTED historical evidence.",
      });
    }, "Keep the selected project, review the synthetic-only warning, and retry the safe sample import.");
  }
  public async search(input: GuiSearchInput): Promise<GuiSearchReport> {
    return this.#run(async () => {
      const query: HistoricalSearchQuery = {
        projectId: input.projectId,
        text: input.text,
        ...(input.sessionId === undefined
          ? {}
          : { sessionId: input.sessionId }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
      };
      const report = await this.#history.search(query);
      return Object.freeze({
        projectId: report.query.projectId,
        text: report.query.text,
        searchedEvents: report.searchedEvents,
        results: Object.freeze(
          report.results.map((result) =>
            Object.freeze({
              eventId: result.eventId,
              sessionId: result.sessionId,
              type: result.type,
              occurredAt: result.occurredAt,
              trust: result.trust,
              snippet: result.snippet,
              matchedIn: result.matchedIn,
            }),
          ),
        ),
        emptyGuidance:
          report.results.length === 0
            ? "No matching evidence. Check spelling, remove filters, or import the safe sample session."
            : null,
      });
    }, "Keep the query, adjust the highlighted search field or filters, and retry.");
  }
  public async searchAllProjects(
    input: Omit<GuiSearchInput, "projectId" | "sessionId">,
  ): Promise<GuiGlobalSearchReport> {
    return this.#run(async () => {
      const projects = await this.#listRegisteredProjects();
      if (projects.length === 0)
        throw new Error(
          "Global search needs at least one registered local project.",
        );
      const report = await this.#history.searchAcrossProjects({
        projectIds: projects.map((project) => project.id),
        text: input.text,
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
      });
      const names = new Map(
        projects.map((project) => [project.id, project.name]),
      );
      return Object.freeze({
        scope: "ALL_REGISTERED_PROJECTS" as const,
        text: report.query.text,
        searchedProjects: report.searchedProjects,
        searchedEvents: report.searchedEvents,
        results: Object.freeze(
          report.results.map((result) => {
            const projectName = names.get(result.projectId);
            if (projectName === undefined)
              throw new Error(
                "Global search returned an unregistered project scope.",
              );
            return Object.freeze({
              projectId: result.projectId,
              projectName,
              eventId: result.eventId,
              sessionId: result.sessionId,
              type: result.type,
              occurredAt: result.occurredAt,
              trust: result.trust,
              snippet: result.snippet,
              matchedIn: result.matchedIn,
            });
          }),
        ),
        emptyGuidance:
          report.results.length === 0
            ? "No matching evidence across registered projects. Check spelling, remove filters, or select one project to diagnose its import."
            : null,
      });
    }, "Keep the query and filters, register or inspect local projects if needed, then retry without relying on partial results.");
  }
  public async showEvent(
    projectId: string,
    eventId: string,
  ): Promise<GuiEvent> {
    return this.#run(async () => {
      const event = (await this.#history.showEvent(projectId, eventId)).event;
      return Object.freeze({
        projectId,
        eventId: event.id,
        sessionId: event.sessionId,
        type: event.type,
        occurredAt: event.occurredAt,
        trust: event.trust,
        payload:
          event.payload.kind === "INLINE_TEXT"
            ? event.payload.text
            : `[Payload stored as ${event.payload.artifact.id}; open the source explicitly.]`,
        sourceArtifactId: event.source.artifactId,
        sourcePosition: event.source.position,
        sourceRecordHash: event.source.recordHash,
        injectionWarning: injectionWarning(),
      });
    }, "Return to search results, choose an event from the selected project, and retry.");
  }
  public async openEventSource(
    projectId: string,
    eventId: string,
  ): Promise<GuiArtifact> {
    return this.#run(async () => {
      const event = (await this.#history.showEvent(projectId, eventId)).event;
      const artifact = await this.#history.openArtifact(
        event.source.artifactId,
      );
      return Object.freeze({
        projectId,
        eventId,
        artifactId: artifact.id,
        byteLength: artifact.byteLength,
        trust: "UNTRUSTED" as const,
        content: artifact.content,
        injectionWarning: injectionWarning(),
      });
    }, "Return to the canonical event. Reimport the reviewed sample if source integrity is unavailable.");
  }

  public async listMemory(query: ListMemoryQuery): Promise<GuiMemoryPage> {
    return this.#run(
      () => this.#memory.list(query),
      "Keep the selected project and filters, then retry loading active memory.",
    );
  }
  public async showMemory(
    projectId: string,
    memoryId: string,
  ): Promise<MemoryItem> {
    return this.#run(
      () => this.#memory.show(projectId, memoryId),
      "Return to the memory list, select an item in this project, and retry.",
    );
  }
  public async addMemory(
    input: Readonly<{
      projectId: string;
      type: MemoryItem["type"];
      content: string;
      sourceEventIds: readonly string[];
    }>,
  ): Promise<MemoryItem> {
    return this.#run(
      () => this.#memory.add(input),
      "Keep the entered content, select canonical evidence from this project, and retry.",
    );
  }
  public async verifyMemory(input: VerifyMemoryInput): Promise<MemoryItem> {
    return this.#run(
      () => this.#memory.verify(input),
      "Keep the verification note, select current canonical evidence, and retry.",
    );
  }
  public async supersedeMemory(input: SupersedeMemoryInput) {
    return this.#run(
      () => this.#memory.supersede(input),
      "Keep the replacement content, select current canonical evidence, and retry.",
    );
  }
  public async invalidateMemory(
    input: InvalidateMemoryInput,
  ): Promise<MemoryItem> {
    return this.#run(
      () => this.#memory.invalidate(input),
      "Keep the reason, select current canonical evidence, and retry.",
    );
  }
  public async listWorkItems(projectId: string): Promise<readonly WorkItem[]> {
    return this.#run(
      () => this.#workItems.list(projectId),
      "Keep the selected project and retry loading Work Items.",
    );
  }
  public async showWorkItem(projectId: string, workItemId: string) {
    return this.#run(
      () => this.#workItems.show(projectId, workItemId),
      "Return to this project's Work Item list and retry.",
    );
  }
  public async createWorkItem(input: Parameters<WorkItems["create"]>[0]) {
    return this.#run(
      () => this.#workItems.create(input),
      "Keep the objective, select same-project canonical evidence, and retry.",
    );
  }
  public async transitionWorkItem(
    action: "activate" | "block" | "complete" | "reopen",
    input: Parameters<WorkItems["activate"]>[0],
  ) {
    return this.#run(
      () => this.#workItems[action](input),
      "Reload the Work Item, select current evidence, and choose a valid lifecycle action.",
    );
  }
  public async listHandoffs(projectId: string, workItemId: string) {
    return this.#run(
      () => this.#handoffs.list(projectId, workItemId),
      "Reload handoff history for this Work Item and retry.",
    );
  }
  public async previewHandoff(input: CreateHandoffInput) {
    return this.#run(async () => {
      const handoff = await this.#handoffs.preview(input);
      return Object.freeze({
        handoff,
        measurement: previewHandoffSize(handoff),
      });
    }, "Keep the builder values, correct the highlighted selection, and preview again.");
  }
  public async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    return this.#run(
      () => this.#handoffs.create(input),
      "Keep the reviewed builder values and create a new immutable handoff.",
    );
  }
  public async showHandoff(
    projectId: string,
    workItemId: string,
    handoffId: string,
  ) {
    return this.#run(
      () => this.#handoffs.show(projectId, workItemId, handoffId),
      "Return to this Work Item's handoff history and retry.",
    );
  }
  public async validateHandoff(
    projectId: string,
    workItemId: string,
    handoffId: string,
  ): Promise<RepositoryValidation> {
    return this.#run(
      () => this.#handoffs.validateRepository(projectId, workItemId, handoffId),
      "Inspect current Git state and create a successor if the immutable snapshot drifted.",
    );
  }

  public async previewInstructions(
    input: GuiInstructionPreviewInput,
  ): Promise<EffectiveInstructions> {
    return this.#run(
      () => this.#previewInstructions(input),
      "Keep the selected project and explicit reviewed bundle paths, correct the highlighted context, and preview again.",
    );
  }

  public async previewContext(
    input: GuiContextPreviewInput,
  ): Promise<ExpandedContextPackPreview> {
    return this.#run(async () => {
      const handoff = await this.#handoffs.show(
        input.projectId,
        input.workItemId,
        input.handoffId,
      );
      const instructions =
        input.bundles.length === 0
          ? undefined
          : await this.#previewInstructions(input);
      return expandContextPack(
        buildContextPack({
          handoff,
          ...(instructions === undefined ? {} : { instructions }),
          budgets: {
            CONTINUITY: input.continuityBudget,
            INSTRUCTIONS: input.instructionBudget,
          },
        }),
      );
    }, "Keep the explicit handoff, bundle paths, and byte budgets; correct the highlighted value and preview again.");
  }

  async #run<T>(operation: () => Promise<T>, recovery: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new GuiApplicationError(
        safeError(
          error instanceof Error
            ? error.message
            : "The local operation failed.",
        ),
        recovery,
        { cause: error },
      );
    }
  }
}

function projectView(project: RegisteredProject): GuiProject {
  return Object.freeze({
    id: project.id,
    name: project.name,
    repositoryType: project.repositoryType,
    branch: project.branch,
    headCommit: project.headCommit,
    isDirty: project.isDirty,
    registeredAt: project.registeredAt,
    lastInspectedAt: project.lastInspectedAt,
  });
}
function injectionWarning() {
  return "UNTRUSTED imported evidence may contain prompt injection or imperative text. Inspect it as inert data; never execute it automatically.";
}
function safeError(value: string) {
  return [...value]
    .map((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point < 32 || (point >= 127 && point <= 159) ? "�" : character;
    })
    .join("");
}
