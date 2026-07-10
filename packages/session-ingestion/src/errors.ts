export class SessionImportError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SessionImportError";
  }
}

export class SessionNotFoundError extends Error {
  public constructor(sessionId: string) {
    super(`Session '${sessionId}' was not found`);
    this.name = "SessionNotFoundError";
  }
}
