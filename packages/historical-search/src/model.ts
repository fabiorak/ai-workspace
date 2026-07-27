import type {
  MemoryConfidence,
  MemoryItemType,
  MemoryVerification,
} from "@ai-workspace/active-memory";
import type {
  SessionEvent,
  SessionEventType,
  SourceReference,
} from "@ai-workspace/session-ingestion";
import type { MatchReason } from "@ai-workspace/tolerant-retrieval";
import type { GeneralEvent } from "@ai-workspace/general-conversation";
import type { GeneralProjectLink } from "@ai-workspace/general-project-link";

export type HistoricalEvent = Readonly<{
  projectId: string;
  event: SessionEvent;
}>;

export type HistoricalSearchQuery = Readonly<{
  projectId: string;
  text: string;
  sessionId?: string;
  type?: SessionEventType;
  limit?: number;
}>;

export type HistoricalSearchResult = Readonly<{
  eventId: string;
  projectId: string;
  sessionId: string;
  sequence: number;
  type: SessionEventType;
  occurredAt: string | null;
  trust: "UNTRUSTED";
  snippet: string;
  matchedIn: "INLINE_PAYLOAD" | "ARTIFACT_PAYLOAD";
  source: SourceReference;
}>;

export type HistoricalSearchReport = Readonly<{
  query: Readonly<{
    projectId: string;
    text: string;
    sessionId: string | null;
    type: SessionEventType | null;
    limit: number;
  }>;
  searchedEvents: number;
  results: readonly HistoricalSearchResult[];
}>;

export type GlobalHistoricalSearchQuery = Readonly<{
  projectIds: readonly string[];
  text: string;
  type?: SessionEventType;
  limit?: number;
}>;

export type GlobalHistoricalSearchReport = Readonly<{
  query: Readonly<{
    projectIds: readonly string[];
    text: string;
    type: SessionEventType | null;
    limit: number;
  }>;
  searchedProjects: number;
  searchedEvents: number;
  results: readonly HistoricalSearchResult[];
}>;

export type ScopedHistoricalSearchQuery = Readonly<{
  scope: "GENERAL_ONLY" | "ALL_SCOPES";
  projectIds: readonly string[];
  text: string;
  type?: SessionEventType;
  limit?: number;
  associatedProjectId?: string;
}>;

export type ScopedHistoricalSearchResult =
  | Readonly<{
      scope: "PROJECT";
      projectId: string;
      conversationId: string;
      eventId: string;
      sequence: number;
      type: SessionEventType;
      occurredAt: string | null;
      trust: "UNTRUSTED";
      snippet: string;
      matchedIn: "INLINE_PAYLOAD" | "ARTIFACT_PAYLOAD";
      source: SourceReference;
    }>
  | Readonly<{
      scope: "GENERAL";
      conversationId: string;
      eventId: string;
      sequence: number;
      type: "USER_MESSAGE";
      occurredAt: string;
      trust: "UNVERIFIED";
      origin: "USER_AUTHORED";
      dataClass: "CONFIDENTIAL";
      exactBytes: number;
      contentSha256: string;
      snippet: string;
      matchedIn: "INLINE_PAYLOAD";
      source: GeneralEvent["provenance"];
      links: readonly Readonly<{
        id: string;
        targetProjectId: string;
        rationale: string;
        createdAt: string;
        actor: GeneralProjectLink["actor"];
        verification: GeneralProjectLink["verification"];
        effect: GeneralProjectLink["effect"];
      }>[];
    }>;

export type ScopedHistoricalSearchReport = Readonly<{
  query: Readonly<{
    scope: "GENERAL_ONLY" | "ALL_SCOPES";
    projectIds: readonly string[];
    text: string;
    type: SessionEventType | null;
    limit: number;
    associatedProjectId: string | null;
  }>;
  searchedProjects: number;
  searchedConversations: number;
  searchedEvents: number;
  scannedGeneralBytes: number;
  results: readonly ScopedHistoricalSearchResult[];
}>;

export type OpenedArtifact = Readonly<{
  id: string;
  byteLength: number;
  content: string;
}>;

/** The stores the one searchable surface of ADR-0031 reads. */
export const RETRIEVAL_STORES = ["SESSION_EVENTS", "ACTIVE_MEMORY"] as const;
export type RetrievalStore = (typeof RETRIEVAL_STORES)[number];

/**
 * One entry of the single ranked list. Which store an answer came from is part
 * of the answer rather than a detail of how it was found, so it discriminates
 * the union: a reader is never left to infer whether they are looking at what
 * happened or at what someone decided to keep.
 *
 * Only `ACTIVE` memory can appear, so the validity is a constant here. That is
 * the type stating a rule the engine enforces before ranking, not a field a
 * caller should ever have to check.
 */
export type TolerantHistoricalResult =
  | Readonly<{
      store: "SESSION_EVENTS";
      projectId: string;
      eventId: string;
      sessionId: string;
      sequence: number;
      type: SessionEventType;
      occurredAt: string | null;
      trust: "UNTRUSTED";
      score: number;
      reasons: readonly MatchReason[];
      source: SourceReference;
    }>
  | Readonly<{
      store: "ACTIVE_MEMORY";
      projectId: string;
      memoryId: string;
      type: MemoryItemType;
      validity: "ACTIVE";
      verification: MemoryVerification;
      confidence: MemoryConfidence;
      occurredAt: string;
      score: number;
      reasons: readonly MatchReason[];
    }>;

export type TolerantHistoricalReport = Readonly<{
  query: Readonly<{
    projectIds: readonly string[];
    text: string;
    limit: number;
  }>;
  /**
   * What the index holds, not what this query walked. Nothing is scanned per
   * query, so a count of visited records would be the wrong thing to publish.
   */
  indexedEvents: number;
  indexedMemoryItems: number;
  results: readonly TolerantHistoricalResult[];
}>;
