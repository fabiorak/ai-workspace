import type {
  ArtifactReference,
  DiscoveredSessionFile,
  ImportedSession,
  SessionSource,
} from "./model.ts";

export type SessionSourceAdapter = Readonly<{
  sourceType: string;
  read(filePath: string): Promise<SessionSource>;
}>;

/**
 * Lists candidate transcript files inside one directory that the user named
 * explicitly. Discovery is never automatic, never recursive beyond the declared
 * layout of the source type, and never opens a candidate: it returns filesystem
 * metadata only, so that listing a directory cannot read a transcript.
 */
export type SessionFileDiscovery = Readonly<{
  sourceType: string;
  discover(directoryPath: string): Promise<readonly DiscoveredSessionFile[]>;
}>;

export type RestrictedDataScreen = Readonly<{
  assertAllowed(content: Uint8Array, location: string): void;
}>;

/**
 * Reports which high-confidence restricted-data category a candidate carries,
 * or `null` when it carries none. It classifies instead of throwing, so a
 * tolerant adapter can exclude one record and account for it rather than losing
 * the whole transcript. The category is a stable detector-defined name and never
 * carries the matched value, a fragment of it, or its position inside a record.
 */
export type RestrictedDataClassifier = Readonly<{
  classify(content: Uint8Array): string | null;
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
