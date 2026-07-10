import type { SessionEventType } from "@ai-workspace/session-ingestion";

export const MEMORY_ITEM_TYPES = ["DECISION", "CONSTRAINT", "FAILURE"] as const;
export type MemoryItemType = (typeof MEMORY_ITEM_TYPES)[number];

export const MEMORY_VALIDITIES = [
  "ACTIVE",
  "SUPERSEDED",
  "INVALIDATED",
] as const;
export type MemoryValidity = (typeof MEMORY_VALIDITIES)[number];

export const MEMORY_VERIFICATIONS = ["UNVERIFIED", "VERIFIED"] as const;
export type MemoryVerification = (typeof MEMORY_VERIFICATIONS)[number];

export const MEMORY_CONFIDENCES = [
  "UNASSESSED",
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;
export type MemoryConfidence = (typeof MEMORY_CONFIDENCES)[number];

export type MemorySourceLink = Readonly<{
  eventId: string;
  sessionId: string;
  eventType: SessionEventType;
  trust: "UNTRUSTED";
  sourceArtifactId: string;
  sourcePosition: number;
  sourceRecordHash: string;
}>;

export type MemoryVerificationRecord = Readonly<{
  id: string;
  actor: "LOCAL_USER";
  occurredAt: string;
  note: string;
  sources: readonly MemorySourceLink[];
}>;

export type MemorySupersessionRecord = Readonly<{
  id: string;
  actor: "LOCAL_USER";
  occurredAt: string;
  replacementId: string;
  sources: readonly MemorySourceLink[];
}>;

export type MemoryInvalidationRecord = Readonly<{
  id: string;
  actor: "LOCAL_USER";
  occurredAt: string;
  reason: string;
  sources: readonly MemorySourceLink[];
}>;

export type MemoryItem = Readonly<{
  id: string;
  projectId: string;
  type: MemoryItemType;
  content: string;
  curation: "USER_CURATED";
  validity: MemoryValidity;
  verification: MemoryVerification;
  confidence: MemoryConfidence;
  version: number;
  sources: readonly MemorySourceLink[];
  creationOperationId: string;
  createdBy: "LOCAL_USER";
  createdAt: string;
  updatedAt: string;
  supersedes: string | null;
  supersession: MemorySupersessionRecord | null;
  verifications: readonly MemoryVerificationRecord[];
  invalidation: MemoryInvalidationRecord | null;
}>;

export type AddMemoryInput = Readonly<{
  projectId: string;
  type: MemoryItemType;
  content: string;
  sourceEventIds: readonly string[];
}>;

export type ListMemoryQuery = Readonly<{
  projectId: string;
  type?: MemoryItemType;
  validity?: MemoryValidity;
  verification?: MemoryVerification;
  limit?: number;
  cursor?: string;
}>;

export type MemoryPage = Readonly<{
  items: readonly MemoryItem[];
  nextCursor: string | null;
}>;

export type VerifyMemoryInput = Readonly<{
  projectId: string;
  memoryId: string;
  sourceEventIds: readonly string[];
  note: string;
}>;

export type SupersedeMemoryInput = Readonly<{
  projectId: string;
  memoryId: string;
  content: string;
  sourceEventIds: readonly string[];
}>;

export type InvalidateMemoryInput = Readonly<{
  projectId: string;
  memoryId: string;
  sourceEventIds: readonly string[];
  reason: string;
}>;

export type SupersededMemory = Readonly<{
  previous: MemoryItem;
  replacement: MemoryItem;
}>;
