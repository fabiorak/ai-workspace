# OpenAI Responses transport qualification corpus

**Frozen:** 2026-07-22, before ADR-0027 or any production OpenAI adapter

Sprint 34 qualifies documented OpenAI Responses API semantics against the
single-use authorization boundary from Sprint 33. The executable corpus is
offline, test-only, and synthetic. It opens no socket, loads no credential,
invokes no model, and captures no provider response.

## Dated official evidence

The following OpenAI sources were retrieved on 2026-07-22:

- [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses):
  Responses is recommended for new projects, response objects are stored by
  default, `store: false` disables ordinary storage, output is a typed item
  array, and streaming uses typed events.
- [Background mode](https://developers.openai.com/api/docs/guides/background):
  background responses support polling and cancellation; repeated cancellation
  is idempotent, while response data is temporarily stored for asynchronous
  execution even with `store: false`.
- [Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses):
  streams use semantic SSE events including `response.created`, text deltas,
  completion, failure, and error events.
- [API overview and request IDs](https://developers.openai.com/api/reference/overview):
  bearer credentials are secrets; `x-request-id` identifies a provider request;
  a caller-supplied `X-Client-Request-Id` can support investigation after a
  timeout when no response header arrived.

The cited sources do not document `X-Client-Request-Id` as an idempotency key,
do not promise that duplicate create requests collapse into one operation, and
do not establish exactly-once external acceptance. Those guarantees are
therefore frozen as absent rather than inferred.

## Candidate contract

Canonical attempt metadata contains only schema version, authorization and
attempt IDs, provider kind, evidence date, reviewed model ID, exact transformed
request digest, mapping schema version, and the fixed safety settings
`store:false`, `background:false`, and zero tools. It contains no request body,
response body, endpoint override, credential, authorization header, account or
project identity, mapping content, prompt, or private path.

The transient serializer accepts the exact transformed string only after its
digest matches the authorization. It creates a bounded synthetic body with the
reviewed model, no tools, no background mode, and storage disabled. The adapter
retains only digests, aggregate counts, synthetic response/request ID digests,
outcome, and retry classification.

## Frozen cases and gates

The 13 cases cover successful synchronous schema-v1 and streamed schema-v2
requests; forbidden storage, background, and tools; altered input; missing
credential capability; failure before exposure; connection loss after exposure
and after a created event; explicit terminal provider failure; malformed
receipt; and duplicate create without documented idempotency.

Only failure before exposure is classified safe to retry. Any loss, malformed
receipt, or duplicate after possible exposure is `AMBIGUOUS` and
`NEVER_AUTOMATIC`. A successful synthetic completion proves only local parsing.
It does not prove provider acceptance, retention behavior, retry safety, or
exactly-once delivery.

## Decision

Decision: `EVIDENCE_ONLY`.

Responses API remains the primary OpenAI transport candidate, but the current
documented protocol does not close Sprint 33's after-exposure ambiguity. No
ADR-0027, production HTTP adapter, credential flow, endpoint, model call,
response capture, retry, routing, delivery, or GUI action is added.
