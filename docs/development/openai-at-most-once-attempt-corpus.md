# OpenAI bounded at-most-once attempt corpus

**Frozen:** 2026-07-22, before executable Sprint 36 evidence
**Scope:** development-only, offline OpenAI Responses attempt semantics
**Input:** synthetic pseudonymized mapping-v1/v2 requests only

**Reference result:** 28/28 expected cases, zero incorrect cases, SHA-256
`fcb26fdf327786d4a4e381ef1c0f1c0dd197d2b7af3265808b71e31bc4aed721`,
decision `ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE`.

## Question

Can one consumed authorization cause at most one AI Workspace
application-level OpenAI Responses create attempt while every inconclusive
post-exposure outcome remains explicit across replay, concurrency, crash, and
restart?

This corpus does not test provider exactly-once execution. It tests only the
local boundary that decides whether AI Workspace may initiate a create call.

## Frozen candidate

The candidate uses a canonical schema-v1 non-content attempt record. It binds
one authorization and attempt identity to the reviewed provider, transport
evidence date, model, privacy/profile/policy/audit scope, transformed-request
digest, mapping identity and schema, revision, state, exposure count, and
optional validated provider identifier or output digests.

Permitted states are:

- `PREPARED` — validated locally; no exposure claimed;
- `FAILED_BEFORE_EXPOSURE` — failure is proved before the create boundary;
- `EXPOSURE_STARTED` — the single application-level create right is consumed
  before invoking the adapter; this is not proof that bytes reached OpenAI;
- `ACKNOWLEDGED` — a bounded provider receipt was validated; this is not proof
  of completion or idempotency;
- `COMPLETED` — one bounded synthetic completion was validated;
- `TERMINAL_REJECTED` — a conclusive non-retryable rejection was validated;
- `UNKNOWN_AFTER_EXPOSURE` — possible exposure has no conclusive terminal
  provider evidence.

`EXPOSURE_STARTED` is written before the adapter is called. On restart,
`EXPOSURE_STARTED` and `ACKNOWLEDGED` recover conservatively to
`UNKNOWN_AFTER_EXPOSURE`. This can abandon a request that never reached the
provider, but it prevents a second automatic application-level create.

No state after `EXPOSURE_STARTED` permits a retry. A deliberate future create
requires a distinct authorization and attempt plus explicit acceptance of a
duplicate-processing and cost warning. The corpus validates that contract but
does not expose a send action.

## Forbidden fields and effects

Attempt records and reports must contain none of:

- request or response bodies, prompts, transformed text, item hashes, mapping
  plaintext, original values, restored output, or arbitrary provider payloads;
- credentials, authorization headers, cookies, API-key values, account or
  organization identifiers, endpoint overrides, error bodies, or auth state;
- local paths, repository contents, runtime-store paths, or unrestricted log
  text;
- automatic/queued retry, authorization reuse, provider routing, fallback,
  model invocation, production persistence, GUI delivery, or execution.

## Frozen cases

| ID  | Case                                                     | Expected                           | Create calls |
| --- | -------------------------------------------------------- | ---------------------------------- | -----------: |
| 01  | complete synthetic v1                                    | `COMPLETED`                        |            1 |
| 02  | complete synthetic v2                                    | `COMPLETED`                        |            1 |
| 03  | malformed attempt metadata                               | `BLOCKED`                          |            0 |
| 04  | altered transformed bytes                                | `BLOCKED`                          |            0 |
| 05  | changed reviewed model                                   | `BLOCKED`                          |            0 |
| 06  | changed mapping identity                                 | `BLOCKED`                          |            0 |
| 07  | stale privacy-audit hash                                 | `BLOCKED`                          |            0 |
| 08  | proved failure before exposure                           | `FAILED_BEFORE_EXPOSURE`           |            0 |
| 09  | timeout after possible exposure                          | `UNKNOWN_AFTER_EXPOSURE`           |            1 |
| 10  | crash after the local exposure claim                     | `UNKNOWN_AFTER_EXPOSURE`           |            0 |
| 11  | acknowledgement followed by loss                         | `UNKNOWN_AFTER_EXPOSURE`           |            1 |
| 12  | malformed receipt after exposure                         | `UNKNOWN_AFTER_EXPOSURE`           |            1 |
| 13  | conclusive terminal rejection                            | `TERMINAL_REJECTED`                |            1 |
| 14  | replay after completion                                  | `BLOCKED`                          |      1 total |
| 15  | replay after unknown outcome                             | `BLOCKED`                          |      1 total |
| 16  | concurrent consumption                                   | one `COMPLETED`, one `BLOCKED`     |      1 total |
| 17  | duplicate completion callback                            | `COMPLETED` unchanged              |      1 total |
| 18  | completed snapshot restart                               | `COMPLETED` unchanged              |      1 total |
| 19  | unknown snapshot restart                                 | `UNKNOWN_AFTER_EXPOSURE` unchanged |      1 total |
| 20  | corrupt snapshot                                         | `BLOCKED`                          |        0 new |
| 21  | snapshot with an extra field                             | `BLOCKED`                          |        0 new |
| 22  | mismatched provider receipt identity                     | `UNKNOWN_AFTER_EXPOSURE`           |            1 |
| 23  | manual inspection of unknown evidence                    | inspection-only                    |        0 new |
| 24  | fresh authorization with explicit duplicate/cost warning | eligible, not sent                 |        0 new |
| 25  | fresh authorization without the warning                  | `BLOCKED`                          |        0 new |
| 26  | late callback after unknown outcome                      | `UNKNOWN_AFTER_EXPOSURE` unchanged |      1 total |
| 27  | expired authorization                                    | `BLOCKED`                          |            0 |
| 28  | oversized canonical candidate                            | `BLOCKED`                          |            0 |

Cases are ordered by ID in the canonical report. Object insertion order and
input case order must not change canonical bytes or the final SHA-256 digest.

## Adoption gates

`ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE` requires all of:

- 28 of 28 cases match and zero cases are incorrect;
- every invalid pre-exposure case makes zero create calls;
- replay, concurrency, restart, late callback, and inspection never increase
  one authorization above one create call;
- every inconclusive post-exposure path becomes
  `UNKNOWN_AFTER_EXPOSURE` and schedules zero retries;
- snapshot validation is exact, bounded, canonical, non-content, and
  fail-closed;
- a fresh future attempt requires a new authorization plus the explicit
  duplicate/cost warning;
- no network, DNS, credential read, OpenAI request, model call, response,
  production store, GUI action, routing, fallback, or execution is added.

Any local duplicate call, automatic retry, content-bearing attempt evidence,
or unsupported certainty closes `REJECT`. Missing proof of restart safety,
canonical bounded evidence, or warning enforcement closes `EVIDENCE_ONLY`.

## Live-probe boundary

The ordinary corpus is credential-free, network-free, cost-free, and
deterministic. A live conformance probe is neither required nor authorized by
this corpus. It can occur only after a separate explicit approval that fixes
the exact model, synthetic input, input/output bounds, worst-case cost,
one-attempt timeout, process-scoped credential injection, sanitization, and
cleanup. A successful live probe cannot change an undocumented idempotency or
post-exposure guarantee into provider truth.
