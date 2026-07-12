import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { CodexSessionSourceAdapter } from "@ai-workspace/codex-adapter";
import { GitRepositoryInspector } from "@ai-workspace/git-adapter";
import {
  HistoricalSearch,
  type HistoricalSearchQuery,
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
    const projects = {
      exists: async (projectId: string) =>
        (await projectStore.load()).some((project) => project.id === projectId),
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
