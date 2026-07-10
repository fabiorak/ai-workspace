import type {
  ArtifactReference,
  ImportedSession,
  SessionSource,
} from "./model.ts";

export type SessionSourceAdapter = Readonly<{
  sourceType: string;
  read(filePath: string): Promise<SessionSource>;
}>;

export type RestrictedDataScreen = Readonly<{
  assertAllowed(content: Uint8Array, location: string): void;
}>;

export type ArtifactStore = Readonly<{
  put(content: Uint8Array): Promise<ArtifactReference>;
}>;

export type SessionStore = Readonly<{
  load(sessionId: string): Promise<ImportedSession | null>;
  append(session: ImportedSession, expectedEventCount: number): Promise<void>;
}>;

export type ProjectLookup = Readonly<{
  exists(projectId: string): Promise<boolean>;
}>;

export type Clock = () => Date;
