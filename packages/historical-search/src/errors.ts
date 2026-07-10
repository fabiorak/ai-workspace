export class HistoricalSearchError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "HistoricalSearchError";
  }
}

export class HistoricalEventNotFoundError extends Error {
  public constructor(eventId: string, projectId: string) {
    super(
      `Event '${eventId}' was not found in project '${projectId}'. Run history search for that project to find a valid event ID.`,
    );
    this.name = "HistoricalEventNotFoundError";
  }
}
