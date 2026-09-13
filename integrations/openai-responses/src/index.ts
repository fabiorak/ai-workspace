export type ResponsesTransportInput = Readonly<{
  model: string;
  text: string;
  maxOutputTokens: number;
  timeoutMs: number;
}>;
export type ResponsesUsage = Readonly<{
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
}>;
export type ResponsesTransportResult =
  | Readonly<{
      kind: "COMPLETED";
      text: string;
      requestId: string;
      responseId: string;
      usage: ResponsesUsage;
    }>
  | Readonly<{ kind: "REJECTED" }>
  | Readonly<{ kind: "UNKNOWN" }>;
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export class OpenAIResponsesError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OpenAIResponsesError";
  }
}
const ENDPOINT = "https://api.openai.com/v1/responses";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const bounded = (value: string, max: number) =>
  value.trim().length > 0 &&
  value.length <= max &&
  ![...value].some(
    (c) => (c.codePointAt(0) ?? 0) < 32 || (c.codePointAt(0) ?? 0) === 127,
  );
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const readJsonBounded = async (
  response: Response,
  maxBytes: number,
): Promise<unknown | null> => {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) return null;
    if (parsedLength > maxBytes) return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
};
const textOf = (value: unknown): string | null => {
  if (!object(value) || !Array.isArray(value.output)) return null;
  const parts: string[] = [];
  for (const item of value.output)
    if (object(item) && Array.isArray(item.content))
      for (const content of item.content)
        if (
          object(content) &&
          content.type === "output_text" &&
          typeof content.text === "string"
        )
          parts.push(content.text);
  const text = parts.join("");
  return text.length > 0 && Buffer.byteLength(text) <= MAX_OUTPUT_BYTES
    ? text
    : null;
};
const usageOf = (value: unknown): ResponsesUsage => {
  if (!object(value) || !object(value.usage))
    return { inputTokens: null, cachedInputTokens: null, outputTokens: null };
  const usage = value.usage;
  const inputTokens =
    typeof usage.input_tokens === "number" &&
    Number.isInteger(usage.input_tokens)
      ? usage.input_tokens
      : null;
  const outputTokens =
    typeof usage.output_tokens === "number" &&
    Number.isInteger(usage.output_tokens)
      ? usage.output_tokens
      : null;
  const details = usage.input_tokens_details as
    Record<string, unknown> | undefined;
  const cachedInputTokens =
    details &&
    typeof details.cached_tokens === "number" &&
    Number.isInteger(details.cached_tokens)
      ? details.cached_tokens
      : null;
  return { inputTokens, cachedInputTokens, outputTokens };
};

/** Fixed endpoint, non-streaming and no provider tools. The key is read only by
 * the process that constructs the adapter and is never returned or logged. */
export class OpenAIResponsesTransport {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #endpoint: string;
  constructor(
    dependencies: Readonly<{
      apiKey?: string;
      fetch?: FetchLike;
      endpoint?: never;
    }>,
  ) {
    const apiKey = dependencies.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey || !bounded(apiKey, 512))
      throw new OpenAIResponsesError(
        "The OpenAI API key is absent or malformed.",
      );
    this.#apiKey = apiKey;
    this.#fetch = dependencies.fetch ?? fetch;
    this.#endpoint = ENDPOINT;
  }
  async send(
    input: ResponsesTransportInput,
  ): Promise<ResponsesTransportResult> {
    if (
      !bounded(input.model, 256) ||
      !input.text.trim() ||
      !input.text.isWellFormed() ||
      Buffer.byteLength(input.text) > 262144 ||
      !Number.isInteger(input.maxOutputTokens) ||
      input.maxOutputTokens < 1 ||
      input.maxOutputTokens > 16384 ||
      !Number.isInteger(input.timeoutMs) ||
      input.timeoutMs < 1 ||
      input.timeoutMs > 120000
    )
      throw new OpenAIResponsesError(
        "The bounded Responses request is invalid.",
      );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          input: input.text,
          max_output_tokens: input.maxOutputTokens,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500
      )
        return response.status === 401 || response.status === 403
          ? { kind: "REJECTED" }
          : { kind: "UNKNOWN" };
      if (!response.ok) return { kind: "REJECTED" };
      const value = await readJsonBounded(response, MAX_RESPONSE_BYTES);
      if (value === null) return { kind: "UNKNOWN" };
      const text = textOf(value);
      if (
        !text ||
        !object(value) ||
        value.status !== "completed" ||
        typeof value.id !== "string" ||
        !bounded(value.id, 256)
      )
        return { kind: "UNKNOWN" };
      const requestId =
        response.headers.get("x-request-id") ??
        response.headers.get("request-id");
      if (!requestId || !bounded(requestId, 256)) return { kind: "UNKNOWN" };
      return {
        kind: "COMPLETED",
        text,
        requestId,
        responseId: value.id,
        usage: usageOf(value),
      };
    } catch (error) {
      if (error instanceof OpenAIResponsesError) throw error;
      return { kind: "UNKNOWN" };
    } finally {
      clearTimeout(timer);
    }
  }
}
