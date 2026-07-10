import type { RegisteredProject } from "./model.ts";
import type {
  Clock,
  ProjectIdGenerator,
  ProjectRegistryStore,
  RepositoryInspector,
} from "./ports.ts";
import {
  ProjectNotFoundError,
  ProjectRegistryValidationError,
} from "./errors.ts";

export type ProjectRegistryDependencies = Readonly<{
  inspector: RepositoryInspector;
  store: ProjectRegistryStore;
  generateId: ProjectIdGenerator;
  clock?: Clock;
}>;

export class ProjectRegistry {
  readonly #inspector: RepositoryInspector;
  readonly #store: ProjectRegistryStore;
  readonly #generateId: ProjectIdGenerator;
  readonly #clock: Clock;

  public constructor(dependencies: ProjectRegistryDependencies) {
    this.#inspector = dependencies.inspector;
    this.#store = dependencies.store;
    this.#generateId = dependencies.generateId;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  public async register(path: string): Promise<RegisteredProject> {
    const inspection = await this.#inspector.inspect(path);
    const projects = [...(await this.#store.load())];
    const existingIndex = projects.findIndex(
      (project) => project.canonicalPath === inspection.canonicalPath,
    );
    const inspectedAt = this.#clock().toISOString();

    if (existingIndex >= 0) {
      const existing = projects[existingIndex];

      if (existing === undefined) {
        throw new ProjectRegistryValidationError(
          "The project registry returned an invalid project index",
        );
      }

      const refreshed = Object.freeze({
        ...existing,
        ...inspection,
        lastInspectedAt: inspectedAt,
      });
      projects[existingIndex] = refreshed;
      await this.#store.save(projects);
      return refreshed;
    }

    const projectId = this.#generateId().trim();

    if (projectId.length === 0) {
      throw new ProjectRegistryValidationError(
        "The project id generator returned an empty identifier",
      );
    }

    if (projects.some((project) => project.id === projectId)) {
      throw new ProjectRegistryValidationError(
        `The generated project id '${projectId}' already exists`,
      );
    }

    const project = Object.freeze({
      id: projectId,
      repositoryType: "SOFTWARE" as const,
      ...inspection,
      registeredAt: inspectedAt,
      lastInspectedAt: inspectedAt,
    });

    await this.#store.save([...projects, project]);
    return project;
  }

  public async inspect(projectId: string): Promise<RegisteredProject> {
    const projects = [...(await this.#store.load())];
    const existingIndex = projects.findIndex(
      (project) => project.id === projectId,
    );
    const existing = projects[existingIndex];

    if (existingIndex < 0 || existing === undefined) {
      throw new ProjectNotFoundError(projectId);
    }

    const inspection = await this.#inspector.inspect(existing.canonicalPath);
    const refreshed = Object.freeze({
      ...existing,
      ...inspection,
      lastInspectedAt: this.#clock().toISOString(),
    });

    projects[existingIndex] = refreshed;
    await this.#store.save(projects);
    return refreshed;
  }

  public async list(): Promise<readonly RegisteredProject[]> {
    const projects = [...(await this.#store.load())];
    return projects.sort((left, right) =>
      left.name === right.name
        ? left.canonicalPath.localeCompare(right.canonicalPath)
        : left.name.localeCompare(right.name),
    );
  }
}
