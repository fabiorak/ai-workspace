import type { RegisteredProject, RepositoryInspection } from "./model.ts";

export type RepositoryInspector = Readonly<{
  inspect(path: string): Promise<RepositoryInspection>;
}>;

export type ProjectRegistryStore = Readonly<{
  load(): Promise<readonly RegisteredProject[]>;
  save(projects: readonly RegisteredProject[]): Promise<void>;
}>;

export type ProjectIdGenerator = () => string;

export type Clock = () => Date;
