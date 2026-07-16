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
  measureContextSelectorCorpus,
  type ContextSelectorCorpusReport,
  type ExpandedContextPackPreview,
} from "@ai-workspace/context-builder";
import {
  GitHandoffRepositoryReader,
  GitRepositoryInspector,
} from "@ai-workspace/git-adapter";
import {
  GeneralConversations,
  type GeneralConversation,
} from "@ai-workspace/general-conversation";
import {
  GeneralProjectLinks,
  type GeneralProjectLink,
} from "@ai-workspace/general-project-link";
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
  composeProfileInstructions,
  composeInstructions,
  type EffectiveInstructions,
  type ProfileInstructionSelection,
} from "@ai-workspace/instruction-manager";
import {
  LocalAgentProfileReader,
  LocalInstructionBundleReader,
  type LocalAgentProfileInput,
  type LocalAgentProfileInspection,
  type LocalInstructionBundleInput,
} from "@ai-workspace/local-instructions";
import {
  LocalModelDataPolicyReader,
  type LocalModelDataPolicyInput,
  type LocalModelDataPolicyInspection,
} from "@ai-workspace/local-privacy-policy";
import { PassphraseKeyCustody } from "@ai-workspace/local-key-custody";
import { EncryptedPrivacyMappingStore } from "@ai-workspace/local-privacy-mapping";
import { JsonProjectRegistryStore } from "@ai-workspace/local-project-registry";
import {
  JsonActiveMemoryStore,
  LocalMemorySourceEventReader,
} from "@ai-workspace/local-active-memory";
import { JsonHandoffStore } from "@ai-workspace/local-handoffs";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { JsonGeneralProjectLinkStore } from "@ai-workspace/local-general-project-link";
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
  evaluatePrivacyPreflight,
  pseudonymizeContextPack,
  restorePseudonymizedItems,
  suggestCustomerAliases,
  type CustomerAliasEntry,
  type CustomerAliasSuggestionReport,
  type PseudonymReview,
  type PseudonymizationPreview,
  type PrivacyPreflightReport,
} from "@ai-workspace/privacy-gateway";
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
export type GuiAgentProfilePreviewInput = Readonly<{
  projectId: string;
  profile: LocalAgentProfileInput;
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
export type GuiProfileContextPreviewInput = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  profile: LocalAgentProfileInput;
  bundles: readonly LocalInstructionBundleInput[];
  model: string;
  task?: string;
}>;
export type GuiProfileContextPreview = Readonly<{
  profile: LocalAgentProfileInspection;
  selection: ProfileInstructionSelection;
  instructions: EffectiveInstructions;
  contextPack: ExpandedContextPackPreview;
  effect: "READ_ONLY_NOT_INSTALLED_PERSISTED_DELIVERED_OR_EXECUTED";
}>;
export type GuiPrivacyPreflightInput = GuiProfileContextPreviewInput &
  Readonly<{ policy: LocalModelDataPolicyInput }>;
export type GuiPrivacyPreflightPreview = Readonly<{
  profile: LocalAgentProfileInspection;
  selection: ProfileInstructionSelection;
  policy: LocalModelDataPolicyInspection;
  preflight: PrivacyPreflightReport;
  effect: "READ_ONLY_NOT_AUTHORIZED_PERSISTED_DELIVERED_OR_EXECUTED";
}>;
export type GuiPseudonymizationInput = GuiPrivacyPreflightInput &
  Readonly<{
    review: PseudonymReview;
    keyCustody: Readonly<{
      mode: "PASSPHRASE_WRAPPING";
      passphrase: string;
    }>;
  }>;
export type GuiPseudonymizationPreview = Readonly<{
  policy: LocalModelDataPolicyInspection;
  preflight: PrivacyPreflightReport;
  transformation: PseudonymizationPreview;
  mapping: Readonly<{
    persisted: true;
    restorationVerified: true;
    mappingSetId: string;
    encryptedAtRest: true;
    keyCustody: "PASSPHRASE_WRAPPED_LOCAL";
  }>;
  effect: "LOCAL_REVIEW_AND_ENCRYPTED_MAPPING_NOT_AUTHORIZED_DELIVERED_OR_EXECUTED";
}>;
export type GuiCustomerAliasSuggestionInput = GuiPrivacyPreflightInput &
  Readonly<{ dictionary: readonly CustomerAliasEntry[] }>;
export type GuiCustomerAliasSuggestionPreview = Readonly<{
  policy: LocalModelDataPolicyInspection;
  preflight: PrivacyPreflightReport;
  suggestions: CustomerAliasSuggestionReport;
  effect: "LOCAL_SUGGESTIONS_NOT_REVIEWED_TRANSFORMED_AUTHORIZED_OR_DELIVERED";
}>;
export type GuiContextSelectorPreviewInput = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  profile: LocalAgentProfileInput;
}>;
export type GuiContextSelectorPreview = Readonly<{
  profile: LocalAgentProfileInspection;
  report: ContextSelectorCorpusReport;
  effect: "EXPERIMENT_ONLY_NO_CONTEXT_BUILDER_OR_PROFILE_POLICY_CHANGE";
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
  readonly #general: GeneralConversations;
  readonly #generalLinks: GeneralProjectLinks;
  readonly #listRegisteredProjects: () => Promise<readonly RegisteredProject[]>;
  readonly #memory: ActiveMemory;
  readonly #workItems: WorkItems;
  readonly #handoffs: Handoffs;
  readonly #previewInstructions: (
    input: GuiInstructionPreviewInput,
  ) => Promise<EffectiveInstructions>;
  readonly #previewAgentProfile: (
    input: GuiAgentProfilePreviewInput,
  ) => Promise<LocalAgentProfileInspection>;
  readonly #previewProfileContext: (
    input: GuiProfileContextPreviewInput,
  ) => Promise<GuiProfileContextPreview>;
  readonly #previewContextSelectors: (
    input: GuiContextSelectorPreviewInput,
  ) => Promise<GuiContextSelectorPreview>;
  readonly #previewPrivacyPreflight: (
    input: GuiPrivacyPreflightInput,
  ) => Promise<GuiPrivacyPreflightPreview>;
  readonly #sampleSessionPath: string;
  readonly #workspaceHome: string;

  public constructor(
    dependencies: Readonly<{
      workspaceHome: string;
      sampleSessionPath: string;
    }>,
  ) {
    this.#workspaceHome = dependencies.workspaceHome;
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
    const generalStore = new JsonGeneralConversationStore(
      dependencies.workspaceHome,
    );
    this.#general = new GeneralConversations({
      store: generalStore,
      ids: randomUUID,
      clock: () => new Date(),
    });
    const generalLinkStore = new JsonGeneralProjectLinkStore(
      dependencies.workspaceHome,
    );
    this.#generalLinks = new GeneralProjectLinks({
      store: generalLinkStore,
      general: generalStore,
      projects,
      ids: randomUUID,
      clock: () => new Date(),
    });
    this.#history = new HistoricalSearch({
      events: new LocalHistoricalEventReader(dependencies.workspaceHome),
      artifacts: new FileArtifactStore(dependencies.workspaceHome),
      projects,
      general: generalStore,
      links: generalLinkStore,
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
    const agentProfileReader = new LocalAgentProfileReader();
    const modelDataPolicyReader = new LocalModelDataPolicyReader();
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
    this.#previewAgentProfile = async (input) => {
      if (!(await projects.exists(input.projectId)))
        throw new Error(
          "The agent profile preview project is not registered locally.",
        );
      return agentProfileReader.read(input.projectId, input.profile);
    };
    this.#previewProfileContext = async (input) => {
      if (!(await projects.exists(input.projectId)))
        throw new Error(
          "The profile-governed Context Pack project is not registered locally.",
        );
      const [profile, bundle, handoff] = await Promise.all([
        agentProfileReader.read(input.projectId, input.profile),
        instructionReader.read(input.projectId, input.bundles),
        this.#handoffs.show(input.projectId, input.workItemId, input.handoffId),
      ]);
      const composition = composeProfileInstructions(profile.bundle, bundle, {
        model: input.model,
        ...(input.task === undefined ? {} : { task: input.task }),
      });
      const contextPack = expandContextPack(
        buildContextPack({
          handoff,
          instructions: composition.instructions,
          budgets: composition.selection.budgets,
        }),
      );
      return Object.freeze({
        profile,
        selection: composition.selection,
        instructions: composition.instructions,
        contextPack,
        effect:
          "READ_ONLY_NOT_INSTALLED_PERSISTED_DELIVERED_OR_EXECUTED" as const,
      });
    };
    this.#previewContextSelectors = async (input) => {
      if (!(await projects.exists(input.projectId)))
        throw new Error(
          "The context-selector report project is not registered locally.",
        );
      const [profile, handoff] = await Promise.all([
        agentProfileReader.read(input.projectId, input.profile),
        this.#handoffs.show(input.projectId, input.workItemId, input.handoffId),
      ]);
      const report = measureContextSelectorCorpus([
        {
          label: "selected-profile",
          handoff,
          selectors: profile.bundle.agent.context,
          budgets: [
            {
              label: "profile-continuity-budget",
              exactBytes: profile.bundle.agent.context.continuityBudgetBytes,
            },
          ],
        },
      ]);
      return Object.freeze({
        profile,
        report,
        effect:
          "EXPERIMENT_ONLY_NO_CONTEXT_BUILDER_OR_PROFILE_POLICY_CHANGE" as const,
      });
    };
    this.#previewPrivacyPreflight = async (input) => {
      const [composition, policy] = await Promise.all([
        this.#previewProfileContext(input),
        modelDataPolicyReader.read(input.projectId, input.policy),
      ]);
      const preflight = evaluatePrivacyPreflight({
        policy: policy.policy,
        modelId: input.model,
        contextPack: composition.contextPack,
      });
      return Object.freeze({
        profile: composition.profile,
        selection: composition.selection,
        policy,
        preflight,
        effect:
          "READ_ONLY_NOT_AUTHORIZED_PERSISTED_DELIVERED_OR_EXECUTED" as const,
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

  public async listGeneralConversations(): Promise<
    readonly GeneralConversation[]
  > {
    return this.#run(
      () => this.#general.list(),
      "Preserve local General state, move only the diagnosed corrupt document aside, and reload without partial results.",
    );
  }

  public async createGeneralConversation(
    title: string,
  ): Promise<GeneralConversation> {
    return this.#run(
      () => this.#general.create(title),
      "Keep the title, remove control or oversized text, and retry the explicit General destination.",
    );
  }

  public async appendGeneralQuestion(
    input: Readonly<{
      conversationId: string;
      expectedEventCount: number;
      content: string;
    }>,
  ): Promise<GeneralConversation> {
    return this.#run(
      () => this.#general.append(input),
      "No content was saved. Remove restricted data or reload the immutable conversation before retrying.",
    );
  }

  public async listGeneralProjectLinks(): Promise<
    readonly GeneralProjectLink[]
  > {
    return this.#run(
      () => this.#generalLinks.list(),
      "Preserve local link state, repair only the diagnosed document or stale lock, and retry without partial results.",
    );
  }

  public async createGeneralProjectLink(
    input: Parameters<GeneralProjectLinks["create"]>[0],
  ): Promise<GeneralProjectLink> {
    return this.#run(
      () => this.#generalLinks.create(input),
      "No link was created. Reload the exact General event and registered projects, review the rationale, and explicitly confirm again.",
    );
  }

  public async searchScopes(
    input: Readonly<{
      scope: "GENERAL_ONLY" | "ALL_SCOPES";
      text: string;
      type?: SessionEventType;
      limit?: number;
      associatedProjectId?: string;
    }>,
  ) {
    return this.#run(async () => {
      const projects =
        input.scope === "ALL_SCOPES"
          ? await this.#listRegisteredProjects()
          : [];
      const report = await this.#history.searchAcrossScopes({
        scope: input.scope,
        projectIds: projects.map((project) => project.id),
        text: input.text,
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.associatedProjectId === undefined
          ? {}
          : { associatedProjectId: input.associatedProjectId }),
      });
      const names = new Map(
        projects.map((project) => [project.id, project.name]),
      );
      return Object.freeze({
        ...report,
        results: Object.freeze(
          report.results.map((result) =>
            result.scope === "PROJECT"
              ? Object.freeze({
                  ...result,
                  projectName: names.get(result.projectId) ?? "Unknown project",
                })
              : result,
          ),
        ),
      });
    }, "Keep the query and explicit scope, repair the reported local state, and retry without partial results.");
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

  public async previewAgentProfile(
    input: GuiAgentProfilePreviewInput,
  ): Promise<LocalAgentProfileInspection> {
    return this.#run(
      () => this.#previewAgentProfile(input),
      "Keep the selected project and reviewed profile path, correct the profile or digest, and preview again.",
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

  public async previewProfileContext(
    input: GuiProfileContextPreviewInput,
  ): Promise<GuiProfileContextPreview> {
    return this.#run(
      () => this.#previewProfileContext(input),
      "Keep the explicit handoff, reviewed profile and instruction paths, and allowed model; correct the incompatible selection and preview again.",
    );
  }

  public async previewContextSelectors(
    input: GuiContextSelectorPreviewInput,
  ): Promise<GuiContextSelectorPreview> {
    return this.#run(
      () => this.#previewContextSelectors(input),
      "Keep the explicit handoff and reviewed profile path; use only documented experiment-only handoff selectors, preserve the safety floor, and preview again.",
    );
  }

  public async previewPrivacyPreflight(
    input: GuiPrivacyPreflightInput,
  ): Promise<GuiPrivacyPreflightPreview> {
    return this.#run(
      () => this.#previewPrivacyPreflight(input),
      "Keep the explicit handoff, reviewed profile, exact instruction sources, allowed model, and digest-pinned same-project policy; correct the incompatible selection and preview again. No data was sent.",
    );
  }

  public async previewCustomerAliasSuggestions(
    input: GuiCustomerAliasSuggestionInput,
  ): Promise<GuiCustomerAliasSuggestionPreview> {
    return this.#run(async () => {
      const [composition, policy] = await Promise.all([
        this.#previewProfileContext(input),
        new LocalModelDataPolicyReader().read(input.projectId, input.policy),
      ]);
      const preflight = evaluatePrivacyPreflight({
        policy: policy.policy,
        modelId: input.model,
        contextPack: composition.contextPack,
      });
      const suggestions = suggestCustomerAliases({
        modelId: input.model,
        contextPack: composition.contextPack,
        dictionary: input.dictionary,
      });
      return Object.freeze({
        policy,
        preflight,
        suggestions,
        effect:
          "LOCAL_SUGGESTIONS_NOT_REVIEWED_TRANSFORMED_AUTHORIZED_OR_DELIVERED" as const,
      });
    }, "Keep the exact handoff, reviewed profile and instruction sources, model policy, and transient synthetic customer aliases; correct the highlighted input and preview again. No alias was persisted or reviewed.");
  }

  public async previewPseudonymization(
    input: GuiPseudonymizationInput,
  ): Promise<GuiPseudonymizationPreview> {
    return this.#run(async () => {
      if (input.keyCustody.mode !== "PASSPHRASE_WRAPPING")
        throw new Error("The selected local key-custody mode is unsupported.");
      const [composition, policy] = await Promise.all([
        this.#previewProfileContext(input),
        new LocalModelDataPolicyReader().read(input.projectId, input.policy),
      ]);
      const preflight = evaluatePrivacyPreflight({
        policy: policy.policy,
        modelId: input.model,
        contextPack: composition.contextPack,
      });
      const validationKey = crypto.getRandomValues(new Uint8Array(32));
      try {
        pseudonymizeContextPack({
          review: input.review,
          contextPack: composition.contextPack,
          key: validationKey,
        });
      } finally {
        validationKey.fill(0);
      }
      const custody = new PassphraseKeyCustody(this.#workspaceHome);
      const key = await custody.create(
        input.review.mappingSetId,
        input.keyCustody.passphrase,
      );
      try {
        const transformed = pseudonymizeContextPack({
          review: input.review,
          contextPack: composition.contextPack,
          key,
        });
        const store = new EncryptedPrivacyMappingStore(
          this.#workspaceHome,
          key,
        );
        await store.save(transformed.mapping);
        const unlocked = await custody.unlock(
          input.review.mappingSetId,
          input.keyCustody.passphrase,
        );
        try {
          const persisted = await new EncryptedPrivacyMappingStore(
            this.#workspaceHome,
            unlocked,
          ).read(input.review.mappingSetId);
          const restored = restorePseudonymizedItems({
            mapping: persisted,
            items: transformed.preview.items,
          });
          if (restored.length !== transformed.preview.items.length)
            throw new Error(
              "The encrypted mapping did not verify a complete local round trip.",
            );
        } finally {
          unlocked.fill(0);
        }
        return Object.freeze({
          policy,
          preflight,
          transformation: transformed.preview,
          mapping: Object.freeze({
            persisted: true as const,
            restorationVerified: true as const,
            mappingSetId: input.review.mappingSetId,
            encryptedAtRest: true as const,
            keyCustody: "PASSPHRASE_WRAPPED_LOCAL" as const,
          }),
          effect:
            "LOCAL_REVIEW_AND_ENCRYPTED_MAPPING_NOT_AUTHORIZED_DELIVERED_OR_EXECUTED" as const,
        });
      } finally {
        key.fill(0);
      }
    }, "No source evidence changed and no data was sent. Keep the reviewed exact hashes and UTF-8 byte ranges, use a new mapping-set identity, verify the local custody passphrase, and retry.");
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
