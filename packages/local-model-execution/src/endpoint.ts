export type LoopbackEndpoint = Readonly<{
  host: "127.0.0.1" | "::1";
  port: number;
  /** The origin with no path, query or credentials, safe to show. */
  origin: string;
}>;

export class LocalModelError extends Error {
  public readonly code: string;

  public constructor(code: string) {
    super(code);
    this.name = "LocalModelError";
    this.code = code;
  }
}

const ENDPOINT = /^http:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})\/?$/;

/**
 * ADR-0051. Accepts only a numeric loopback address with an explicit port, so
 * no name is ever resolved. Anything else is refused, not normalized: a short
 * form, a name, a userinfo, a path or a query never reaches the network.
 */
export function parseLoopbackEndpoint(value: unknown): LoopbackEndpoint {
  const match = typeof value === "string" ? ENDPOINT.exec(value) : null;
  const port = match ? Number(match[2]) : 0;
  if (!match || port > 65535) throw new LocalModelError("INVALID_ENDPOINT");
  const host = match[1] === "127.0.0.1" ? "127.0.0.1" : "::1";
  return Object.freeze({
    host,
    port,
    origin:
      host === "::1" ? `http://[::1]:${port}` : `http://127.0.0.1:${port}`,
  });
}
