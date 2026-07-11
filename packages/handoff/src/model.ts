import type {
  MemoryConfidence,
  MemoryItemType,
  MemoryVerification,
} from "@ai-workspace/active-memory";
import type { WorkItemSource } from "@ai-workspace/core";

export const HANDOFF_SCHEMA_VERSION = 1;
export type HandoffOrigin =
  | "WORK_ITEM"
  | "ACTIVE_MEMORY"
  | "REPOSITORY_OBSERVATION"
  | "USER_INPUT"
  | "CANONICAL_EVENT";
export type HandoffTrust = "UNTRUSTED" | "USER_CURATED" | "OBSERVED";
export type HandoffCuration = "NONE" | "USER_CURATED";
export type HandoffVerification = "UNVERIFIED" | "VERIFIED" | "NOT_APPLICABLE";
export type SectionMetadata = Readonly<{
  origin: HandoffOrigin;
  trust: HandoffTrust;
  curation: HandoffCuration;
  verification: HandoffVerification;
  observation: "IMPORTED" | "USER_AUTHORED" | "OBSERVED" | "DERIVED";
  sources: readonly WorkItemSource[];
}>;
export type HandoffSection<T> = Readonly<{
  metadata: SectionMetadata;
  value: T;
}>;
export type RepositorySnapshot = Readonly<{
  branch: string | null;
  head: string | null;
  dirty: boolean;
  changedPaths: readonly string[];
}>;
export type MemorySnapshot = Readonly<{
  id: string;
  type: MemoryItemType;
  content: string;
  verification: MemoryVerification;
  confidence: MemoryConfidence;
}>;
export type TestObservation = Readonly<{
  command: string;
  outcome: "PASS" | "FAIL" | "NOT_RUN";
  observedAt: string | null;
}>;

export type Handoff = Readonly<{
  schemaVersion: 1;
  id: string;
  projectId: string;
  workItemId: string;
  predecessorId: string | null;
  createdBy: "LOCAL_USER";
  createdAt: string;
  sections: Readonly<{
    objective: HandoffSection<string>;
    repository: HandoffSection<RepositorySnapshot>;
    selectedMemory: HandoffSection<readonly MemorySnapshot[]>;
    knownFailures: HandoffSection<readonly MemorySnapshot[]>;
    testState: HandoffSection<readonly TestObservation[]>;
    relevantFiles: HandoffSection<readonly string[]>;
    nextAction: HandoffSection<string>;
    sourceReferences: HandoffSection<readonly WorkItemSource[]>;
  }>;
}>;

export type CreateHandoffInput = Readonly<{
  projectId: string;
  workItemId: string;
  memoryIds: readonly string[];
  nextAction: string;
  sourceEventIds: readonly string[];
  testState?: readonly TestObservation[];
  relevantFiles?: readonly string[];
  predecessorId?: string;
}>;

export type RepositoryValidation = Readonly<{
  matches: boolean;
  differences: readonly ("BRANCH" | "HEAD" | "DIRTY" | "CHANGED_PATHS")[];
  captured: RepositorySnapshot;
  current: RepositorySnapshot;
  recovery: string | null;
}>;
