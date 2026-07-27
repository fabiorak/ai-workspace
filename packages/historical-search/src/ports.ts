import type { MemoryItem } from "@ai-workspace/active-memory";
import type { ProjectLookup } from "@ai-workspace/session-ingestion";
import type { GeneralConversation } from "@ai-workspace/general-conversation";
import type { GeneralProjectLink } from "@ai-workspace/general-project-link";

import type { HistoricalEvent } from "./model.ts";

export type HistoricalEventReader = Readonly<{
  list(
    projectId: string,
    sessionId?: string,
  ): Promise<readonly HistoricalEvent[]>;
  find(projectId: string, eventId: string): Promise<HistoricalEvent | null>;
}>;

export type ArtifactResolver = Readonly<{
  read(artifactId: string): Promise<Uint8Array>;
}>;

/**
 * Reading side of the active memory of a project. The shape is the one
 * `ActiveMemoryStore` already publishes, so an existing store satisfies it
 * without an adapter; it is narrowed to `list` here because retrieval reads and
 * never writes.
 */
export type ActiveMemoryReader = Readonly<{
  list(projectId: string): Promise<readonly MemoryItem[]>;
}>;

export type HistoricalSearchDependencies = Readonly<{
  events: HistoricalEventReader;
  artifacts: ArtifactResolver;
  projects: ProjectLookup;
  general?: Readonly<{ list(): Promise<readonly GeneralConversation[]> }>;
  links?: Readonly<{ list(): Promise<readonly GeneralProjectLink[]> }>;
  /**
   * Absent means a deployment that has no active memory yet, not an error: the
   * tolerant index then covers events alone.
   */
  memory?: ActiveMemoryReader;
}>;
