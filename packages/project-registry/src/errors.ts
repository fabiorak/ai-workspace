export class ProjectNotFoundError extends Error {
  public constructor(projectId: string) {
    super(`Project '${projectId}' is not registered`);
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectRegistryValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProjectRegistryValidationError";
  }
}
