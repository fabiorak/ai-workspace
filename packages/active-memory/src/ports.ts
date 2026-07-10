import type {
  ProjectLookup,
  SessionEvent,
} from "@ai-workspace/session-ingestion";

import type {
  MemoryInvalidationRecord,
  MemoryItem,
  MemorySupersessionRecord,
  MemoryVerificationRecord,
  SupersededMemory,
} from "./model.ts";

export type ActiveMemoryStore = Readonly<{
  list(projectId: string): Promise<readonly MemoryItem[]>;
  find(projectId: string, memoryId: string): Promise<MemoryItem | null>;
  create(item: MemoryItem): Promise<MemoryItem>;
  verify(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    record: MemoryVerificationRecord,
  ): Promise<MemoryItem>;
  supersede(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    replacement: MemoryItem,
    record: MemorySupersessionRecord,
  ): Promise<SupersededMemory>;
  invalidate(
    projectId: string,
    memoryId: string,
    expectedVersion: number,
    record: MemoryInvalidationRecord,
  ): Promise<MemoryItem>;
}>;

export type MemorySourceEventReader = Readonly<{
  find(projectId: string, eventId: string): Promise<SessionEvent | null>;
}>;

export type MemoryIdGenerator = () => string;
export type MemoryClock = () => Date;

export type ActiveMemoryDependencies = Readonly<{
  store: ActiveMemoryStore;
  sourceEvents: MemorySourceEventReader;
  projects: ProjectLookup;
  ids: MemoryIdGenerator;
  clock: MemoryClock;
}>;
