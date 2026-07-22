# Anthropic Messages transport qualification corpus

**Frozen:** 2026-07-22, before ADR-0027 or any production Anthropic adapter

Sprint 35 qualifies documented Anthropic Messages semantics against the
single-use authorization boundary from Sprint 33. The executable corpus is
offline, test-only, and synthetic. It opens no socket, reads no credential,
invokes no model, and captures no provider response.

## Dated official evidence

The following official Anthropic sources were retrieved on 2026-07-22:

- [Messages API](https://platform.claude.com/docs/en/api/messages): Messages is
  a stateless create operation with required model, messages, and maximum-token
  fields; authentication uses `x-api-key` and requests declare
  `anthropic-version`.
- [Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming):
  SSE uses typed message, content-block, delta, stop, ping, and error events;
  an error may arrive after an HTTP 200 stream has started.
- [Errors](https://platform.claude.com/docs/en/api/errors): responses include a
  request identifier, rate limiting uses 429, overload uses 529, and large
  requests can fail after reaching the API edge.
- [Client SDKs](https://platform.claude.com/docs/en/api/client-sdks): official
  SDKs document automatic retries for selected connection, 408, 409, 429, and
  5xx failures by default.

The cited sources do not define a create idempotency key, exactly-once
acceptance, retrieval of an individual Message after a lost create response, or
cancellation of a synchronous Message. Provider request and message IDs are
therefore evidence identifiers, not duplicate-suppression guarantees.

## Candidate contract

Canonical attempt metadata contains only schema version, authorization and
attempt IDs, provider kind, evidence date, reviewed model, exact transformed
request and system-prompt digests, mapping schema version, fixed API version,
256-token bound, and zero tools. It contains no body, response, endpoint,
credential, header value, account identity, mapping content, or private path.

The transient serializer accepts exact digest-bound system and user strings,
then creates a bounded synthetic body with one user message and no tools. The
harness models only header names and retains only digests, counts, safe stop
classification, outcome, and retry disposition. Only failure before exposure
is safe to retry.

## Frozen cases and decision

The 19 cases cover schema-v1 and v2 success; forbidden tools, API version, and
output bounds; altered input/system text; missing credential capability;
pre-exposure failure; loss before and after message start; 429, 529, and
invalid-request errors; max-token and tool stops; reordered/malformed streams;
and duplicate create without idempotency.

Decision: `EVIDENCE_ONLY`.

Local serialization and parsing pass, but post-exposure acceptance remains
ambiguous and never automatically retryable. No ADR-0027, production HTTP
adapter, credential flow, endpoint, model call, response capture, provider
routing, fallback, delivery, or GUI action is added.
