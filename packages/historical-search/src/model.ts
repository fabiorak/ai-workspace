import type {
  SessionEvent,
  SessionEventType,
  SourceReference,
} from "@ai-workspace/session-ingestion";
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
