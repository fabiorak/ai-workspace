export class TolerantRetrievalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TolerantRetrievalError";
  }
}
