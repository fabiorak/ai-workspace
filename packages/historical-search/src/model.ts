import type {
  SessionEvent,
  SessionEventType,
  SourceReference,
} from "@ai-workspace/session-ingestion";

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

export type OpenedArtifact = Readonly<{
  id: string;
  byteLength: number;
  content: string;
}>;
