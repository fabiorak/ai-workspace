/**
 * ADR-0051. Fixed in the request, not properties of the target. Every limit
 * is refused before or during the call, never truncated silently.
 */
export const LOCAL_MODEL_LIMITS = Object.freeze({
  timeoutMs: 900_000,
  requestBytes: 1024 * 1024,
  responseBytes: 1024 * 1024,
  answerBytes: 128 * 1024,
  maxTokens: 8192,
});
