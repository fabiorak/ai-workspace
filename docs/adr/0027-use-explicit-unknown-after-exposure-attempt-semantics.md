# ADR-0027: Use explicit unknown-after-exposure attempt semantics

**Status:** accepted
**Date:** 2026-07-22

## Context

ADR-0017 requires an inspectable privacy decision before model delivery.
Sprint 33 then proved local single-use authorization, but could not know whether
an external provider accepted a request after possible byte exposure. Sprint 34
confirmed that OpenAI Responses request identifiers support correlation and
provider investigation, not documented create idempotency or exactly-once
acceptance. Sprint 35 found the same unresolved boundary with Anthropic.

Retrying automatically after a timeout or crash can therefore duplicate model
processing and cost. Reporting a definite failure is also unsafe when the
provider may have accepted the request. Requiring exactly-once provider
semantics would block progress on a guarantee the qualified protocols do not
offer.

Sprint 36 froze 28 offline synthetic cases before its test-owned implementation.
Two complete deterministic runs produced digest
`fcb26fdf327786d4a4e381ef1c0f1c0dd197d2b7af3265808b71e31bc4aed721`,
28 expected outcomes, zero errors, no invalid pre-exposure create, at most one
application-level create per authorization, and zero scheduled retries across
replay, concurrency, crash, restart, malformed receipt, late callback, and
operator-inspection cases.

## Decision

Adopt explicit bounded at-most-once **application-level attempt semantics** for
a future OpenAI Responses prototype:

- one consumed authorization may claim at most one application-level create;
- the exposure claim must become restart-visible before the provider adapter is
  invoked;
- failure proved before that claim is `FAILED_BEFORE_EXPOSURE`;
- any inconclusive state after the claim is `UNKNOWN_AFTER_EXPOSURE` and never
  schedules an automatic or queued retry;
- provider/client request IDs and response IDs are correlation evidence only;
  they are not idempotency keys or proof of completion;
- restart converts unfinished `EXPOSURE_STARTED` or `ACKNOWLEDGED` evidence to
  `UNKNOWN_AFTER_EXPOSURE` without resending;
- manual reconciliation is inspection-only and cannot reuse authorization or
  mutate uncertain evidence into provider truth without new conclusive
  evidence;
- any deliberate later create requires a distinct authorization and attempt,
  plus explicit acceptance of a duplicate-processing and cost warning;
- attempt evidence uses an exact bounded allowlist of scope, state, revision,
  digests, and validated identifier digests. It excludes request/response
  bodies, content, mappings, keys, credentials, account data, error bodies,
  endpoints, and private paths.

The at-most-once statement applies only to AI Workspace create calls. It does
not claim network-packet uniqueness, provider exactly-once processing,
idempotency, delivery, acceptance, completion, or response recoverability.

This ADR accepts the semantic boundary and future prototype direction only.
The Sprint 36 implementation remains test-only. It authorizes no production
store, provider adapter, credential access, network request, model invocation,
response handling, GUI action, retry, routing, fallback, or execution. A later
increment must separately qualify and implement those boundaries before M5 can
be complete.

## Consequences

- safety is preferred over availability: a crash after the local exposure
  claim but before an actual send may leave a false-positive unknown attempt
  that is never retried automatically;
- users and operators must see uncertainty rather than a misleading success or
  failure;
- a new deliberate attempt can duplicate provider processing and cost, so it
  always requires fresh authorization and warning acceptance;
- future persistence must make the exposure claim durable before calling a
  provider without storing content or bearer-equivalent material;
- a happy-path live probe can validate transport conformance but cannot upgrade
  undocumented idempotency or crash-recovery guarantees;
- M5 remains incomplete and no production model access exists.
