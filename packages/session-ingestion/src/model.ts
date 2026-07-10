export const SESSION_EVENT_TYPES = [
  "USER_MESSAGE",
  "AGENT_MESSAGE",
  "TOOL_CALL",
  "TOOL_RESULT",
  "COMMAND_RESULT",
  "FILE_CHANGE",
  "TEST_RESULT",
  "ERROR",
  "UNKNOWN",
] as const;

export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];

export type ArtifactReference = Readonly<{
  id: string;
  byteLength: number;
}>;

export type EventPayload =
  | Readonly<{ kind: "INLINE_TEXT"; text: string }>
  | Readonly<{
      kind: "ARTIFACT";
      artifact: ArtifactReference;
      mediaType: "application/json" | "text/plain";
    }>;

export type SourceReference = Readonly<{
  artifactId: string;
  sourceType: string;
  sourceSessionId: string;
  position: number;
  recordHash: string;
}>;

export type SessionEvent = Readonly<{
  id: string;
  sessionId: string;
  sequence: number;
  type: SessionEventType;
  occurredAt: string | null;
  trust: "UNTRUSTED";
  payload: EventPayload;
  source: SourceReference;
}>;

export type ImportedSession = Readonly<{
  id: string;
  projectId: string;
  sourceType: string;
  sourceSessionId: string;
  agent: string;
  model: string | null;
  startedAt: string | null;
  createdAt: string;
  lastImportedAt: string;
  latestSourceArtifact: ArtifactReference;
  events: readonly SessionEvent[];
}>;

export type SessionImportReport = Readonly<{
  session: ImportedSession;
  addedEvents: number;
  existingEvents: number;
  totalEvents: number;
}>;

export type SourceEvent = Readonly<{
  position: number;
  type: SessionEventType;
  occurredAt: string | null;
  payload: string;
  rawRecord: Uint8Array;
}>;

export type SessionSource = Readonly<{
  sourceType: string;
  sourceSessionId: string;
  agent: string;
  model: string | null;
  startedAt: string | null;
  rawContent: Uint8Array;
  events: readonly SourceEvent[];
}>;
