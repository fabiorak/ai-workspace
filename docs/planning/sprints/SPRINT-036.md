# Sprint 36 — Decide Bounded At-Most-Once OpenAI Attempt Semantics

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, ambiguous-outcome reconciliation
evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 35 completed; OpenAI Responses remains the primary
model-transport candidate; Sprint 33 authorization and Sprint 34 transport
qualification remain `EVIDENCE_ONLY`; no ADR-0027 or production delivery
surface exists

## Sprint goal

Determine whether AI Workspace can safely constrain one future OpenAI
Responses create operation to at most one application-level exposure attempt,
make uncertain post-exposure outcomes explicit and reconcilable without an
automatic retry, and require a fresh warned authorization before any deliberate
new attempt. Freeze the state model, permitted metadata, crash/restart
semantics, operator recovery, and decision gates before any production adapter,
credential access, live request, model response, persistence, or GUI action.

## Evidence and problem statement

Sprint 33 prevents local replay, concurrent consumption, stale authorization,
and altered request bytes before exposure. Sprint 34 confirms that OpenAI
Responses can bind and parse a bounded synthetic request, but documented
request identifiers support correlation and provider investigation rather than
idempotent create. Sprint 35 finds the same unresolved boundary with Anthropic,
so changing providers does not remove the problem.

After request bytes may have reached a provider, a timeout, lost connection, or
local crash can leave two externally different situations locally
indistinguishable: the provider may not have accepted the create, or it may
have accepted and processed it while the receipt or response was lost. An
automatic retry can therefore duplicate processing and cost. Treating the
operation as a definite failure would also be false.

Sprint 36 evaluates a narrower product contract:

1. AI Workspace may initiate at most one application-level exposure for one
   consumed authorization.
2. Failure proved before exposure may permit a separately authorized future
   attempt; possible exposure never permits automatic retry.
3. Missing conclusive evidence after possible exposure becomes
   `UNKNOWN_AFTER_EXPOSURE`, not success or failure.
4. Reconciliation uses only bounded non-content metadata and never changes an
   unknown outcome into provider truth without evidence.
5. Any deliberate new create requires a new authorization and an explicit
   duplicate-processing and cost warning.

These are candidate semantics to measure, not current product behavior or a
claim of exactly-once provider processing.

## Committed backlog

### S36-01 — Freeze the attempt lifecycle and truth boundaries

- define exact candidate states for prepared, proved-not-exposed,
  exposure-started, provider-acknowledged, completed, terminally rejected, and
  unknown-after-exposure outcomes;
- distinguish local intent, byte exposure, transport receipt, provider request
  identity, response completion, and operator reconciliation without treating
  one as proof of another;
- define permitted transitions, terminal states, restart behavior, clock
  bounds, and invalid or contradictory state combinations;
- state explicitly that the at-most-once property applies to AI Workspace
  application-level create attempts, not to network packets or provider-side
  exactly-once execution;
- retain exact binding to the consumed authorization, privacy-audit event/hash,
  provider and transport version, reviewed model, policy/profile, project,
  Work Item, handoff, mapping identity/schema, request digest, and attempt ID.

### S36-02 — Compare failure and reconciliation candidates

- compare automatic retry, definite-failure-after-timeout, reusable
  authorization, in-memory-only attempt state, and bounded durable non-content
  attempt evidence against the frozen crash and privacy gates;
- reject any candidate that resends automatically after possible exposure,
  silently renews authorization, or labels an uncertain outcome as definitely
  sent, failed, accepted, or completed;
- define the minimum metadata needed for safe restart and investigation,
  including digests and provider/client request identifiers only when their
  provenance and meaning are validated;
- persist no request or response body, transformed text, item hash, mapping
  plaintext, key, passphrase, credential, header value, endpoint override,
  account identity, error body, or private path;
- define a manual recovery contract that can inspect and annotate evidence but
  cannot mutate provider truth, reuse the consumed authorization, or trigger a
  resend;
- require a fresh explicit authorization and prominent duplicate/cost warning
  before any future deliberate new create after an unknown outcome;
- create ADR-0027 only if the corpus supports a useful bounded contract without
  implying provider idempotency, automatic recovery, or production readiness.

### S36-03 — Measure the bounded at-most-once candidate offline

- freeze a deterministic synthetic v1/v2 corpus before executable code, using
  OpenAI Responses with `store:false`, one reviewed model, bounded output, and
  zero tools;
- cover invalid and stale authorization, changed bytes, failure before
  exposure, partial or possible exposure, acknowledgement loss, malformed or
  mismatched receipt, response completion, stream truncation, caller timeout,
  cancellation, local crash at every state boundary, restart, duplicate
  callback, replay, concurrency, clock skew, and corrupted attempt evidence;
- prove that all pre-exposure invalid cases expose zero bytes and that one
  authorization can cause no more than one application-level create call in
  every replay, restart, and concurrency case;
- prove that possible exposure without conclusive completion always closes as
  `UNKNOWN_AFTER_EXPOSURE` and schedules no retry;
- test manual inspection and fresh-authorization warnings without implementing
  a provider call or user-facing resend action;
- return only canonical synthetic labels, digests, state/count aggregates, and
  adoption evidence; normal tests must open no socket, resolve no DNS, read no
  credential, and invoke no model.

### S36-04 — Gate a separately authorized live conformance probe

- define an optional one-attempt runbook only after all offline cases pass;
- require a new explicit user approval naming the exact provider, model,
  synthetic input, maximum input/output, worst-case cost, timeout, credential
  injection method, sanitization, and cleanup before any live execution;
- accept only process-scoped credential injection supplied explicitly for the
  probe; prohibit credential discovery, auth-file inspection, keychain reads,
  repository configuration, logging, or persistence;
- perform no automatic retry, deliberate duplicate, induced ambiguous charge,
  provider fault injection, or real customer/project request;
- retain only sanitized aggregate evidence and validated identifier digests,
  leaving no prompt, response, credential, account data, runtime store, or
  generated artifact in the repository;
- treat a successful happy-path probe only as transport conformance evidence;
  it cannot prove idempotency or resolve every post-exposure failure window;
- keep the probe optional and outside ordinary checks; this sprint plan does
  not authorize it.

### S36-05 — Decide and document without exposing model access

- predeclare `ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE`, `EVIDENCE_ONLY`, and
  `REJECT` as the only final decisions;
- adopt for prototype only if one consumed authorization can cause at most one
  application-level create attempt, uncertain outcomes remain explicit across
  restart, metadata stays non-content and bounded, and recovery cannot resend;
- keep M5 incomplete unless a later increment supplies an enforceable
  production transport, credential boundary, response handling, restoration,
  and truthful user workflow;
- keep the GUI unchanged and record the reviewed exception because there is no
  authorized send, retry, response, reconciliation, or credential action;
- update architecture, threat model, data classification, development
  evidence, planning, roadmap, and public design with the measured result;
- run clean build/check/audit, deterministic reproduction, Sprint 31–35
  regressions, v1/v2 compatibility, diff check, and public-safety scan before
  any implementation commit.

## Stop and re-plan triggers

- OpenAI documentation no longer supports the frozen request, storage, receipt,
  cancellation, or identifier assumptions;
- safe restart or reconciliation requires request/response content,
  credentials, unrestricted headers, account data, mapping plaintext, keys,
  passphrases, or private paths;
- any path automatically retries, queues a retry, reuses authorization, or
  hides possible exposure behind a definite failure;
- one authorization can cause multiple application-level create calls under
  concurrency, crash, restart, callback duplication, or operator action;
- a provider request ID, client request ID, HTTP status, stream event, or local
  write would be presented as stronger proof than its documented semantics;
- manual recovery requires a send/retry button, production provider adapter,
  credential flow, response store, routing, fallback, or model execution;
- a credential, paid call, DNS, socket, HTTP request, model invocation, or
  provider account access would occur without the separate live-probe approval;
- useful behavior would require claiming exactly-once delivery or provider
  acceptance that the protocol cannot prove.

## Out of scope

Production OpenAI access; live calls without separate approval; API-key
provisioning or storage; Codex, Anthropic, Claude, local-model, or third-party
fallbacks; automatic or queued retry; provider routing; endpoint overrides;
prompt caching; background mode; batches; files, images, tools, web search, or
computer use; response persistence or restoration; streaming GUI; model or
credential selector; send/retry/reconcile buttons; billing and quota systems;
mapping migration, re-encryption, passphrase change/reset; databases, services,
frameworks, and new external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

Implementation must add one deterministic offline measurement command that
executes the frozen corpus twice and compares complete canonical reports.
Ordinary verification remains credential-free, network-free, cost-free, and
deterministic. Any live probe is separately approved, opt-in, excluded from
`npm run check`, and must leave no repository or runtime artifact.

## Definition of done

- the state model, candidate schemas, permitted metadata, corpus, failure
  windows, and decision gates are frozen before executable implementation;
- every local state has a precise evidence meaning and never overstates
  provider acceptance, completion, failure, or idempotency;
- invalid pre-exposure cases expose zero bytes and no replay, concurrency,
  restart, or callback case produces more than one application-level create;
- every inconclusive post-exposure case remains bounded
  `UNKNOWN_AFTER_EXPOSURE` candidate evidence across simulated restart, with no
  automatic retry;
- inspection cannot send, retry, reuse authorization, or disclose content;
- a deliberate future new attempt requires a fresh authorization and explicit
  duplicate/cost warning in the contract;
- no production provider, credential, network, model invocation, response,
  GUI, routing, fallback, delivery, or execution surface is added;
- mapping v1/v2, custody v1, strict restoration, privacy audit, and Sprint
  33–35 evidence remain unchanged;
- full repository gates pass, documentation is synchronized, and no commit or
  push occurs during planning.

## Risks and mitigations

| Risk                                                 | Mitigation                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| “At most once” is mistaken for provider exactly-once | Name the application-level boundary everywhere and preserve `UNKNOWN_AFTER_EXPOSURE`                                |
| Timeout is shown as definite failure                 | Require evidence-backed states and fail validation for unsupported certainty                                        |
| Retry duplicates processing or cost                  | Permit no automatic resend after possible exposure and consume the authorization permanently                        |
| Attempt evidence becomes a content or identity store | Freeze an allowlist of bounded digests/statuses and reject all bodies, credentials, account data, and private paths |
| Manual recovery becomes a hidden send path           | Keep it inspection-only; a new create requires a separate later workflow and fresh authorization                    |
| Happy-path live evidence overstates safety           | Treat the optional probe as conformance evidence, never idempotency or crash-recovery proof                         |
| Provider-specific work creates premature routing     | Keep OpenAI Responses as the sole candidate and add no provider-neutral production abstraction                      |

## Planning decisions

- remain in E7/M5 rather than re-scope the incomplete privacy milestone;
- use OpenAI Responses as the sole Sprint 36 candidate because Sprint 34 keeps
  it primary and its identifiers can support bounded correlation, not
  idempotency;
- evaluate one automatic application-level exposure plus explicit
  `UNKNOWN_AFTER_EXPOSURE` instead of pretending exactly-once or retry safety;
- require fresh authorization and a duplicate/cost warning for any deliberate
  future new attempt after an unknown outcome;
- keep the committed sprint offline and synthetic; a live probe remains an
  optional later checkpoint requiring separate explicit approval;
- defer production persistence, adapter, credentials, GUI, response handling,
  restoration, routing, fallback, and execution;
- accept another evidence-only or reject outcome if the bounded contract cannot
  remain truthful, private, restart-safe, and non-retrying.

## Outcome and retrospective

The state vocabulary, exact allowlisted record/snapshot schemas, 28 cases,
forbidden fields, and decision gates were frozen before executable evidence.
The test-owned store claims exposure before calling the fake adapter, converts
unfinished exposure or acknowledgement to `UNKNOWN_AFTER_EXPOSURE` on
simulated restart, rejects every replay or late transition, and exposes only an
inspection-only non-content view.

Two complete deterministic runs produced corpus SHA-256
`fcb26fdf327786d4a4e381ef1c0f1c0dd197d2b7af3265808b71e31bc4aed721`,
28 of 28 expected cases, zero incorrect cases, zero invalid pre-exposure calls,
at most one fake create per authorization, and zero scheduled retries. A fresh
candidate after an unknown result remains merely eligible, not sent, and
requires a distinct authorization plus explicit duplicate/cost warning.

Decision `ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE` accepts ADR-0027. The decision
is deliberately narrower than model delivery: it establishes truthful local
attempt semantics and preserves the documented lack of provider idempotency,
exactly-once acceptance, and post-exposure outcome knowledge. M5 remains
incomplete.

No live probe, credential read, auth inspection, DNS, socket, HTTP request,
OpenAI call, model invocation, response capture, production store, provider
adapter, route, GUI, retry, reconciliation action, routing, fallback, delivery,
or execution was added.
