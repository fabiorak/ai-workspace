import type { RepositoryType } from "@ai-workspace/core";

export type RepositoryInspection = Readonly<{
  canonicalPath: string;
  name: string;
  branch: string | null;
  headCommit: string | null;
  remoteUrl: string | null;
  isDirty: boolean;
}>;

export type RegisteredProject = Readonly<
  RepositoryInspection & {
    id: string;
    repositoryType: RepositoryType;
    registeredAt: string;
    lastInspectedAt: string;
  }
>;
