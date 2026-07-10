export class ActiveMemoryError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ActiveMemoryError";
  }
}

export class MemoryItemNotFoundError extends ActiveMemoryError {
  public constructor(memoryId: string, projectId: string) {
    super(
      `Memory item '${memoryId}' was not found in project '${projectId}'. Run memory list for that project to find a valid ID.`,
    );
    this.name = "MemoryItemNotFoundError";
  }
}

export class ActiveMemoryConflictError extends ActiveMemoryError {
  public constructor(memoryId: string) {
    super(
      `Memory item '${memoryId}' changed during this operation. Reload it with memory show and retry using its current state.`,
    );
    this.name = "ActiveMemoryConflictError";
  }
}
