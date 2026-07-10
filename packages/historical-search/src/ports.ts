import type { ProjectLookup } from "@ai-workspace/session-ingestion";

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

export type HistoricalSearchDependencies = Readonly<{
  events: HistoricalEventReader;
  artifacts: ArtifactResolver;
  projects: ProjectLookup;
}>;
