/**
 * The view models the GUI facade returns.
 *
 * ADR-0035 separates presentation by responsibility, and these are the shapes
 * that cross the boundary: bounded, already-decided values a screen can render
 * without reaching back into a domain use case. They live apart from the facade
 * so that reading what a screen receives does not mean reading how it is built.
 *
 * `application.ts` re-exports every name here, so existing importers are
 * unaffected by where the declaration lives.
 */
import type { MemoryItem } from "@ai-workspace/active-memory";
import type {
  ContextSelectorCorpusReport,
  ExpandedContextPackPreview,
} from "@ai-workspace/context-builder";
import type {
  EffectiveInstructions,
  ProfileInstructionSelection,
} from "@ai-workspace/instruction-manager";
import type {
  LocalAgentProfileInput,
  LocalAgentProfileInspection,
  LocalInstructionBundleInput,
} from "@ai-workspace/local-instructions";
import type {
  LocalModelDataPolicyInput,
  LocalModelDataPolicyInspection,
} from "@ai-workspace/local-privacy-policy";
import type { MatchReason } from "@ai-workspace/historical-search";
import type {
  EntityAliasEntry,
  EntityAliasSuggestionReport,
  OutputRestorationReport,
  PrivacyPreflightReport,
  PseudonymReview,
  PseudonymReviewV2,
  PseudonymizationPreview,
  PseudonymizationPreviewV2,
} from "@ai-workspace/privacy-gateway";
import type { PrivacyAuditEvent } from "@ai-workspace/privacy-audit";
import type { SessionEventType } from "@ai-workspace/session-ingestion";

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

export type GuiDashboard = Readonly<{
  schemaVersion: 1;
  asOf: string;
  projects: Readonly<{ total: number; clean: number; attention: number }>;
  general: Readonly<{ conversations: number; questions: number }>;
  memory: Readonly<{
    active: number;
    verified: number;
    unverified: number;
    sampled: number;
    truncated: boolean;
  }>;
  workItems: Readonly<{
    proposed: number;
    active: number;
    blocked: number;
    completed: number;
  }>;
  privacy: Readonly<{ reviewable: number; blocked: number; total: number }>;
  coverage: Readonly<{
    availableProjects: number;
    unavailableProjects: number;
    memoryLimitPerProject: 100;
    privacyLimitPerProject: 100;
  }>;
  modelDelivery: Readonly<{
    status: "UNAVAILABLE";
    reason: "NO_PROVIDER_DELIVERY_SURFACE";
  }>;
  effect: "READ_ONLY_LOCAL_AGGREGATE_NO_TELEMETRY_OR_MODEL_ACCESS";
}>;
export type GuiImportReport = Readonly<{
  projectId: string;
  sessionId: string;
  sourceName: string;
  trust: "UNTRUSTED";
  addedEvents: number;
  existingEvents: number;
  totalEvents: number;
  skippedRecords: readonly Readonly<{ reason: string; count: number }>[];
  effect: string;
  nextAction: string;
}>;
export type GuiTranscriptCandidate = Readonly<{
  filePath: string;
  fileName: string;
  byteLength: number;
  modifiedAt: string;
}>;
export type GuiTranscriptDiscovery = Readonly<{
  directory: string;
  candidates: readonly GuiTranscriptCandidate[];
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
    /**
     * Why this result matched. The rank score stays out of the interface: it
     * only compares within one report, so it is a number a reader cannot act
     * on, while the reason is a sentence they can.
     */
    reasons: readonly MatchReason[];
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
    /**
     * Why this result matched. The rank score stays out of the interface: it
     * only compares within one report, so it is a number a reader cannot act
     * on, while the reason is a sentence they can.
     */
    reasons: readonly MatchReason[];
  }>[];
  emptyGuidance: string | null;
}>;
export type GuiRestartSummary = Readonly<{
  projectId: string;
  /** The passage to copy. Composed on demand and never stored. */
  text: string;
  exactBytes: number;
  omissions: readonly string[];
  effect: "READ_ONLY_LOCAL_SUMMARY_NOT_PERSISTED_AND_NOT_SENT";
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
  auditEvent: PrivacyAuditEvent;
  effect: "LOCAL_AUDITED_NOT_AUTHORIZED_DELIVERED_OR_EXECUTED";
}>;
export type GuiPseudonymizationInput = GuiPrivacyPreflightInput &
  Readonly<{
    review: PseudonymReview | PseudonymReviewV2;
    keyCustody: Readonly<{
      mode: "PASSPHRASE_WRAPPING";
      passphrase: string;
    }>;
  }>;
export type GuiPseudonymizationPreview = Readonly<{
  policy: LocalModelDataPolicyInspection;
  preflight: PrivacyPreflightReport;
  transformation: PseudonymizationPreview | PseudonymizationPreviewV2;
  mapping: Readonly<{
    persisted: true;
    restorationVerified: true;
    mappingSetId: string;
    schemaVersion: 1 | 2;
    encryptedAtRest: true;
    keyCustody: "PASSPHRASE_WRAPPED_LOCAL";
  }>;
  effect: "LOCAL_REVIEW_AND_ENCRYPTED_MAPPING_NOT_AUTHORIZED_DELIVERED_OR_EXECUTED";
}>;
export type GuiOutputRestorationInput = Readonly<{
  projectId: string;
  workItemId: string;
  handoffId: string;
  mappingSetId: string;
  passphrase: string;
  output: string;
}>;
export type GuiOutputRestorationPreview = OutputRestorationReport;
export type GuiCustomerAliasSuggestionInput = GuiPrivacyPreflightInput &
  Readonly<{ dictionary: readonly EntityAliasEntry[] }>;
export type GuiCustomerAliasSuggestionPreview = Readonly<{
  policy: LocalModelDataPolicyInspection;
  preflight: PrivacyPreflightReport;
  suggestions: EntityAliasSuggestionReport;
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
