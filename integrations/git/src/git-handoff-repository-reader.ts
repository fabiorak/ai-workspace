import type { RepositorySnapshot } from "@ai-workspace/handoff";
import type { RegisteredProject } from "@ai-workspace/project-registry";
import {
  GitRepositoryInspector,
  RepositoryInspectionError,
} from "./git-repository-inspector.ts";

export type RegisteredProjectReader = Readonly<{
  find(projectId: string): Promise<RegisteredProject | null>;
}>;
export class GitHandoffRepositoryReader {
  readonly #projects: RegisteredProjectReader;
  readonly #inspector: GitRepositoryInspector;
  public constructor(
    projects: RegisteredProjectReader,
    inspector = new GitRepositoryInspector(),
  ) {
    this.#projects = projects;
    this.#inspector = inspector;
  }
  public async capture(projectIdValue: string): Promise<RepositorySnapshot> {
    const projectId = projectIdValue.trim();
    if (!projectId)
      throw new RepositoryInspectionError("Project ID cannot be empty.");
    const project = await this.#projects.find(projectId);
    if (project === null || project.id !== projectId)
      throw new RepositoryInspectionError(
        `Project '${projectId}' is not registered. Register or list projects and retry.`,
      );
    return this.#inspector.captureHandoffState(project.canonicalPath);
  }
}
