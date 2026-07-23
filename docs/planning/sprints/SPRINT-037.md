# Sprint 37 — Qualify Durable Attempt Evidence Persistence

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, durable ambiguous-outcome evidence
increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 36 completed and ADR-0027 accepted; the bounded
at-most-once implementation remains test-only and no provider adapter,
credential access, network request, model invocation, or production delivery
surface exists

## Sprint goal

Determine whether AI Workspace can persist the minimum non-content attempt
evidence required by ADR-0027 before a future provider adapter is invoked, and
recover truthfully after process interruption without resending or converting
uncertainty into a false success or failure.

Freeze the persistence boundary, exact schema, crash points, corruption
behavior, concurrency rules, capacity limits, and decision gates before
choosing any production store or exposing model access.

## Evidence and problem statement

Sprint 36 proved the state machine and at-most-once application-level semantics
with a test-owned in-memory store. ADR-0027 requires the exposure claim to
become restart-visible before invoking a future provider adapter. The current
evidence does not prove that a local store can make that ordering durable,
private, bounded, and fail-closed across interrupted writes, lock loss,
corruption, or restart.

Sprint 37 evaluates a narrower persistence contract:

1. no fake provider create is eligible until the exposure claim is durably
   published and reread;
2. interruption before durable publication exposes zero request bytes;
3. interruption after durable publication preserves
   `UNKNOWN_AFTER_EXPOSURE` and never schedules a resend;
4. replay, concurrency, late callbacks, malformed records, corruption, and
   capacity failure fail closed;
5. persisted evidence contains only an exact allowlist of non-content metadata;
6. the persistence prototype remains replaceable and does not become a model
   delivery surface.

These are persistence qualification criteria, not current product behavior and
not a claim of provider exactly-once processing.

## Committed backlog

### S37-01 — Freeze the durable record and snapshot contracts

- define exact versioned record and inspection schemas before implementation;
- retain only opaque identifiers, state, revision, bounded timestamps or
  ordering values, digests, and validated provider identifier digests already
  permitted by ADR-0027;
- forbid request and response bodies, transformed content, mappings, keys,
  passphrases, credentials, account data, error bodies, endpoints, private
  paths, authorization bearer material, and raw provider identifiers;
- define project and attempt scope binding, predecessor integrity, monotone
  revisions, bounded field lengths, capacity, and unsupported-version failure;
- keep attempt evidence separate from privacy-decision audit, mappings,
  historical evidence, active memory, and artifact storage.

### S37-02 — Freeze crash, publication, and recovery semantics

- enumerate failures before write, during temporary write, before publication,
  after publication, during reread, before fake adapter invocation, after fake
  acknowledgement, and during terminal-state publication;
- require atomic publication and verified reread before returning a durable
  exposure claim;
- define restart recovery for unfinished `EXPOSURE_STARTED` and
  `ACKNOWLEDGED` records as `UNKNOWN_AFTER_EXPOSURE` without resend;
- reject rollback, revision gaps, internal reordering, mixed scope, malformed
  data, and unsupported schema versions;
- state explicitly that local integrity evidence cannot prove against
  privileged replacement or truncation of an entire store.

### S37-03 — Compare replaceable local persistence candidates

- compare a dedicated bounded JSON store, reuse of an existing storage
  primitive behind a separate namespace, and any other dependency-free
  candidate justified by the frozen contract;
- reject coupling attempt evidence to content stores or the privacy-decision
  audit;
- evaluate atomicity, restrictive permissions, locking, portability,
  inspectability, deterministic fixtures, and recovery behavior;
- do not add a runtime, framework, database, cloud service, or external
  dependency without a separate ADR and explicit approval;
- record the chosen candidate as test-owned unless the evidence independently
  justifies a later production proposal.

### S37-04 — Measure the contract with a frozen offline corpus

- freeze synthetic fixtures and expected outcomes before executable evidence;
- cover clean publication, all enumerated crash points, restart, replay,
  concurrent claim, lock contention, stale owner, malformed and unsupported
  records, corruption, revision gaps, capacity exhaustion, late callback, and
  manual inspection;
- run the corpus twice and require identical canonical output and SHA-256
  digest;
- assert zero fake creates before verified durable publication, at most one fake
  create per authorization, zero scheduled retries, and no content-bearing
  persisted fields;
- use only synthetic opaque identifiers and synthetic provider receipts.

### S37-05 — Decide the next boundary without enabling delivery

- document `ADOPT`, `REFINE`, `EVIDENCE_ONLY`, or `REJECT` against frozen gates;
- update the roadmap, project plan, sprint index, and any applicable ADR only
  after evidence supports the decision;
- if adopted, identify the next separately approved boundary among production
  persistence, credential custody, live transport conformance, provider
  adapter, response handling, or GUI workflow;
- preserve OpenAI Responses as the sole current model-transport candidate
  without adding routing or fallback;
- make no live request and read no credential or authentication state.

## Stop and re-plan triggers

Stop the sprint and request a decision if:

- durable-before-adapter ordering cannot be demonstrated without ambiguous
  writes or implicit resend;
- a candidate requires a new runtime, database, framework, external dependency,
  network service, or architecture decision;
- the schema needs content, raw provider identifiers, secrets, endpoints, or
  private paths;
- recovery would rewrite uncertainty into provider truth without conclusive
  evidence;
- attempt evidence cannot remain separate from audit, mapping, memory, or
  artifact stores;
- testing would require real credentials, a live provider, private data, or
  non-synthetic receipts.

## Out of scope

- live probes, DNS, sockets, HTTP, OpenAI calls, or model responses;
- credential discovery, authentication-state inspection, account selection, or
  secret storage;
- production provider adapters, delivery, routing, fallback, cancellation, or
  execution;
- GUI actions, end-user model configuration, or response restoration;
- changes to privacy policy, preflight, audit, mapping v1/v2, custody envelope
  v1, transformation, or strict output restoration;
- migration, re-encryption, passphrase change, export, sharing, synchronization,
  escrow, cloud recovery, or external anchoring;
- claims of provider idempotency, exactly-once processing, acceptance,
  completion, or response recoverability.

## Verification plan

- format, lint, type-check, clean composite build, and full test suite;
- deterministic corpus executed twice with an identical digest;
- explicit assertions for durable publication ordering, maximum one fake create
  per authorization, and zero retries;
- schema allowlist and forbidden-field scans over source, fixtures, snapshots,
  and generated evidence;
- regression measures for Sprints 31 through 36;
- dependency audit, diff review, staged-file review, and public-repository
  safety scan before any commit.

## Definition of done

- the frozen corpus and expected outcomes are documented before implementation;
- the candidate store is local, bounded, replaceable, restrictive, atomically
  published, and reread-verified;
- crash and restart behavior preserves truthful uncertainty without resend;
- all invalid, corrupt, cross-scope, concurrent, and capacity cases fail closed;
- persisted evidence passes the exact non-content schema and forbidden-field
  gates;
- deterministic runs and repository quality gates pass;
- the decision and remaining M5 boundaries are documented;
- no provider, credential, network, model, production delivery, routing,
  fallback, GUI, or execution surface is added.

## Risks and mitigations

- **False durability:** require publication plus reread and inject failures at
  every filesystem boundary represented by the chosen candidate.
- **Privacy leakage:** use an exact schema allowlist, synthetic fixtures, bounded
  digests, and forbidden-field scans.
- **Duplicate processing:** preserve the ADR-0027 claim-before-adapter order and
  prohibit every automatic or queued retry.
- **Store coupling:** keep the contract provider-neutral and the local adapter
  replaceable, with separate scope from audit and content stores.
- **Overclaiming integrity:** document that hash chains and atomic writes do not
  protect against privileged whole-store replacement or truncation.
- **Premature productization:** keep the executable candidate test-owned unless
  a later explicitly approved increment qualifies production persistence.

## Planning decisions

- Sprint 37 is offline, synthetic, and persistence-focused.
- It qualifies durable attempt evidence before credentials, network, adapter,
  response, GUI, or delivery work.
- It does not reopen Sprint 36 semantics or modify ADR-0027 guarantees.
- It introduces no runtime, framework, database, cloud service, or dependency.
- A live conformance probe remains a separate optional checkpoint requiring
  explicit approval.

## Outcome and retrospective

The exact schema, 64-record capacity, failure points, forbidden fields, case
matrix, and decision gates were frozen before executable evidence. The selected
candidate is a dedicated dependency-free JSON store kept entirely under test
ownership. It is separate from privacy-decision audit, mappings, historical
evidence, active memory, and artifacts.

The store uses a restrictive `0700` directory, `0600` documents, an owner-token
lock, bounded canonical schema-v1 records, monotone global revisions,
predecessor hashes, atomic temporary-file publication, file and directory sync,
and verified reread. A claim is visible on restart before the fake adapter can
be invoked. Interruption after rename or reread therefore becomes
`UNKNOWN_AFTER_EXPOSURE` without a create; interruption before publication
leaves `PREPARED`.

Two complete runs in reference and reversed case order produced 29 of 29
expected outcomes, zero incorrect cases, maximum one fake create per case, zero
fake creates across invalid pre-exposure cases, and zero scheduled retries. The
canonical corpus SHA-256 is
`4a60e9e260916a9f165ae7d82381f821a62a6a4daf348785ba4371e5f32992bd`.
The cases cover clean completion, timeout, acknowledgement loss, malformed and
mismatched receipts, terminal rejection, all frozen publication failure
points, restart from exposure and acknowledgement, replay, lock contention,
corruption, noncanonical encoding, revision and predecessor failure,
cross-project and unsupported documents, capacity, forbidden fields, unsafe
permissions, transient artifacts, concurrency, late callbacks, read-only
inspection, and duplicate authorization.

Decision `ADOPT_TEST_ONLY_DURABLE_ATTEMPT_EVIDENCE` accepts the persistence
candidate as evidence that ADR-0027 ordering can be represented locally. It
does not adopt a production store or authorize model delivery. Hash chaining
detects internal gaps, reordering, and corruption but does not prove against
privileged replacement or truncation of the complete store.

No live probe, credential or authentication-state read, DNS, socket, HTTP
request, OpenAI call, model invocation, response capture, production store,
provider adapter, route, GUI action, routing, fallback, delivery, or execution
was added. M5 remains incomplete. Before any future capability becomes
user-facing, its configuration, authorization, duplicate-cost warning,
`UNKNOWN_AFTER_EXPOSURE` state, inspection, recovery guidance, and errors must
be delivered through the maintained, curated, self-explanatory GUI rather than
through a CLI-only path.
