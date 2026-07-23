# Sprint 38 — Adopt Production Durable Attempt Evidence Storage

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, production persistence boundary

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 37 completed with decision
`ADOPT_TEST_ONLY_DURABLE_ATTEMPT_EVIDENCE`; ADR-0027 remains accepted; no
credential, network, provider adapter, model invocation, response, routing, or
delivery surface exists

## Sprint goal

Decide and implement the smallest production-quality, provider-neutral attempt
evidence contract and local adapter that preserve ADR-0027 ordering and the
Sprint 37 durable evidence gates without enabling model delivery.

The production boundary must remain separate from content, mappings, privacy
audit, historical evidence, active memory, and artifacts. It must expose no
route, CLI command, GUI action, credential read, network request, or provider
adapter.

## Evidence and problem statement

Sprint 37 proved that a dedicated dependency-free JSON candidate can atomically
publish and reread non-content exposure evidence before a fake adapter call.
The implementation remains under test ownership and is not a reusable
production contract. Promoting it directly would risk coupling domain
semantics, filesystem behavior, provider identity, and test harness concerns.

Sprint 38 separates those responsibilities:

1. a provider-neutral domain contract owns states, transitions, bounded
   metadata, validation, inspection, and recovery semantics;
2. a local adapter owns restrictive filesystem persistence, locking, atomic
   publication, reread, corruption handling, and capacity;
3. application composition can depend on the contract without gaining a send
   operation;
4. the frozen Sprint 36 and Sprint 37 evidence remains reproducible and
   unchanged;
5. no user-facing capability is claimed until a later GUI-first vertical slice
   provides the complete workflow.

## Committed backlog

### S38-01 — Decide the production boundary in ADR-0028

- compare keeping the contract inside the privacy gateway with a separate
  reusable model-attempt package;
- compare a dedicated local adapter with reuse of existing store
  infrastructure behind a separate namespace;
- require provider-neutral state semantics while retaining only explicitly
  qualified provider identifiers;
- preserve strict separation from content-bearing and audit stores;
- reject any candidate requiring a new runtime, framework, database, cloud
  service, or external dependency;
- record the selected contract, storage ownership, limits, integrity claims,
  and non-goals before production implementation.

### S38-02 — Extract the exact provider-neutral contract

- define versioned inputs, records, snapshots, inspection views, store
  interface, and bounded public errors;
- preserve `PREPARED`, `EXPOSURE_STARTED`, `ACKNOWLEDGED`, `COMPLETED`,
  `TERMINAL_REJECTED`, and `UNKNOWN_AFTER_EXPOSURE`;
- enforce one attempt identity per authorization, monotone revisions, maximum
  one exposure claim, and zero automatic retries;
- allow only opaque scope identifiers, digests, validated identifier digests,
  state, revision, chain metadata, and explicit non-authority effects;
- forbid content, bodies, mappings, keys, credentials, account data, endpoints,
  private paths, bearer-equivalent material, and raw provider identifiers.

### S38-03 — Implement the dedicated local adapter

- use restrictive local permissions, owner-token locking, atomic publication,
  file and directory synchronization, and verified reread;
- keep a fixed documented capacity and fail closed on exhaustion;
- reject unsupported schema versions, mixed scope, rollback, revision gaps,
  broken predecessor chains, noncanonical encoding, foreign files, transient
  artifacts, and unsafe permissions;
- recover unfinished exposure or acknowledgement as
  `UNKNOWN_AFTER_EXPOSURE` without resend;
- expose inspection and recovery only through the provider-neutral interface;
- do not expose an adapter invocation callback or model request method.

### S38-04 — Prove compatibility and production isolation

- retain the Sprint 37 frozen 29-case corpus and canonical digest unchanged;
- add contract and adapter tests for clean round trips, restart, concurrency,
  corruption, capacity, scope, permissions, and non-echoing errors;
- add a compatibility harness that compares production behavior with the
  accepted Sprint 37 outcomes without importing production code into the
  frozen evidence module;
- prove that application composition cannot obtain credentials, request bytes,
  network access, or a provider create function through the new interfaces;
- use synthetic opaque identifiers only.

### S38-05 — Document the next GUI-first boundary

- document the production store as internal infrastructure, not a completed
  user feature;
- keep the homepage and current GUI behavior unchanged in this sprint;
- make Sprint 39 the next planned increment for the graphical workspace
  dashboard;
- require any later model-delivery feature to expose configuration,
  authorization, duplicate-cost warning, uncertainty, inspection, recovery
  guidance, and errors through the maintained bilingual GUI;
- identify credential custody, live transport conformance, provider adapter,
  response handling, and delivery as still-separate approval boundaries.

## Stop and re-plan triggers

Stop and request a decision if:

- a production contract would change ADR-0027 or the frozen Sprint 37 outcomes;
- persistence requires a runtime, framework, database, cloud service, external
  dependency, or network access;
- the schema needs content, raw provider identifiers, secrets, endpoints,
  account data, or private paths;
- recovery could resend, infer provider truth, or erase uncertainty;
- the store cannot remain separate from privacy audit, mappings, memory, or
  artifacts;
- a route, CLI command, GUI action, credential read, or provider adapter becomes
  necessary to demonstrate the storage boundary.

## Out of scope

- live probes, DNS, sockets, HTTP, OpenAI calls, or model responses;
- credential configuration, discovery, custody, or authentication-state reads;
- provider adapters, request construction, delivery, routing, fallback,
  cancellation, reconciliation actions, or execution;
- response capture, restoration, or persistence;
- user-facing attempt creation, inspection, or recovery;
- GUI dashboard implementation, which is planned for Sprint 39;
- migration of test-owned evidence or existing runtime stores;
- changes to privacy policy, audit, mapping v1/v2, custody envelope v1,
  transformation, or strict output restoration.

## Verification plan

- ADR and public contract review before implementation;
- format, lint, type-check, clean composite build, and full test suite;
- Sprint 37 corpus reproduced twice with its unchanged canonical digest;
- production contract and local-adapter tests, including concurrency and
  filesystem failure injection;
- dependency-direction and package-export checks;
- forbidden-field and non-echoing scans;
- all deterministic measures from Sprints 31 through 38;
- dependency audit, diff review, staged-file review, and public-repository
  safety scan before commit.

## Definition of done

- ADR-0028 records the accepted production storage boundary;
- the provider-neutral contract and dedicated local adapter are exported from
  their intended production modules;
- durable publication and verified reread precede any hypothetical adapter
  eligibility;
- restart, replay, concurrency, corruption, and capacity remain fail-closed
  without resend;
- Sprint 37 outcomes and digest remain byte-identical;
- no content-bearing or bearer-equivalent material can enter the store;
- no credential, network, provider, response, route, CLI, GUI, delivery,
  routing, fallback, or execution surface is added;
- Sprint 39 remains documented as the next GUI-first increment.

## Planning decisions

- Sprint 38 adopts only the production persistence boundary.
- The core contract is provider-neutral and the local adapter is replaceable.
- No charting, GUI, network, credential, or provider dependency is introduced.
- Product completeness is not claimed: the store is internal infrastructure.
- The next planned increment is the graphical GUI homepage dashboard.

## Outcome and retrospective

ADR-0028 accepts a separate provider-neutral `model-attempts` contract and
replaceable `local-model-attempts` adapter. The contract owns exact schema-v1
non-content records, state transitions, validation, inspection, and recovery.
The adapter owns a restrictive `0700` directory, `0600` documents, owner-token
locking, fixed 64-record capacity, canonical JSON, predecessor integrity,
atomic rename, file and directory synchronization, and verified reread.

Production tests cover exact record validation, invalid transitions, restart
recovery, concurrent claims, and unsafe permissions without path disclosure.
The Sprint 37 corpus remains unchanged at 29/29 expected cases with digest
`4a60e9e260916a9f165ae7d82381f821a62a6a4daf348785ba4371e5f32992bd`.

No provider invocation interface, route, CLI command, GUI action, credential,
network request, response, routing, fallback, delivery, or execution was
introduced. The store is internal production infrastructure and does not make
M5 complete.
