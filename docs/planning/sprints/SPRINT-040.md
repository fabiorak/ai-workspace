# Sprint 40 — Establish Local Provider Credential Custody

**Primary epics:** E0 — Product foundation; E7 — Privacy and security gateway

**Milestone:** M5 — Privacy-ready beta

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 39 completed; production attempt evidence exists behind
ADR-0028; the multi-page local GUI shell is available in `2c7cdd2`

## Sprint goal

Establish a provider-neutral, local, least-privilege boundary for configuring
and holding model-provider credentials without using them for authentication,
network access, model delivery, routing, fallback, or execution.

The sprint must decide custody from frozen synthetic evidence before adopting
an implementation. It must keep secret values separate from ordinary
configuration and domain state, expose only non-secret status in the GUI, and
fail closed without echoing or persisting rejected input.

## Product outcome

From the Settings area, a user can understand which provider credential slots
are supported, whether a slot is unconfigured or locally configured, how its
custody and recovery work, and the exact effect of create, replace, and remove
operations.

Configuration proves only that AI Workspace accepted a syntactically valid
secret into the selected local custody mechanism. It does not prove provider
identity, account ownership, authorization scope, balance, model availability,
endpoint reachability, or successful authentication.

No real credential is required or permitted in tests, fixtures, documentation,
measurements, logs, screenshots, or committed artifacts.

## Committed backlog

### S40-01 — Freeze the credential threat model and custody requirements

- classify provider secrets as `RESTRICTED` and enumerate exposure paths across
  browser fields, loopback requests, process memory, errors, logs, backups,
  filesystem metadata, crash artifacts, tests, and support workflows;
- define supported foreground, headless, cross-platform, workspace-move,
  backup, replacement, removal, and loss scenarios before implementation;
- define explicit non-goals for account discovery, OAuth, managed login,
  provider validation, credential rotation at the provider, and recovery
  escrow;
- require bounded secret length, exact accepted encoding, non-echoing errors,
  private permissions, atomicity, concurrency control, and zero secret material
  in status responses;
- update the public threat model with residual risks and local-process
  limitations.

### S40-02 — Compare custody candidates with a frozen synthetic corpus

- compare at minimum environment-only ephemeral input, passphrase-wrapped local
  custody, and operating-system credential stores;
- include cross-platform and headless behavior, dependencies, native build
  surface, label privacy, backup and workspace move, unattended use,
  replacement, removal, process exposure, failure recovery, and user burden;
- use only generated synthetic canaries with no provider-valid shape or value;
- exercise wrong secret, corruption, truncation, unsafe permissions,
  unsupported platform, concurrent writer, stale owner lock, interrupted
  publication, oversized input, and rollback cases;
- publish deterministic aggregate results and a decision of `ADOPT`,
  `REFINE`, or `NO_CHANGE`.

### S40-03 — Record the custody decision before production code

- write a new ADR before adding a package, native adapter, OS integration, or
  persistent secret format;
- state why ADR-0022 mapping-key custody is reusable or insufficient for
  long-lived provider credentials rather than extending it implicitly;
- freeze schema, algorithm, permissions, identity, scope, bounds, replacement,
  removal, recovery, and compatibility semantics;
- keep non-secret provider configuration and secret custody in separate
  contracts and stores;
- stop the sprint if no candidate satisfies the frozen gates without an
  unacceptable dependency or recovery tradeoff.

### S40-04 — Add provider-neutral configuration and custody contracts

- introduce a provider-neutral credential-slot identity and a versioned
  non-secret configuration contract;
- expose only bounded status such as slot identity, provider kind, configured
  state, custody kind, schema version, and safe timestamps where justified;
- never return a secret, secret prefix or suffix, reversible derivative,
  authentication header, environment value, private path, or provider account
  data;
- make create, replace, and remove explicit operations with concurrency and
  stale-state protection;
- ensure a removed or replaced value cannot be recovered through the ordinary
  application interface while documenting storage-media limitations truthfully;
- keep credential retrieval inaccessible to GUI queries, ordinary logs, CLI
  listing, dashboard aggregates, and model-attempt inspection.

### S40-05 — Implement the accepted local custody adapter

- implement only the mechanism accepted by S40-03 and keep it replaceable
  behind the provider-neutral contract;
- enforce restrictive directory and document permissions, bounded canonical
  state, owner-token locking, complete temporary publication, atomic rename,
  sync, and verified reread where the selected mechanism uses files;
- clear browser inputs after every attempt and minimize secret lifetime in
  process memory within Node.js limitations;
- make corruption, permission drift, incomplete state, and unsupported custody
  versions fail closed with non-secret recovery guidance;
- add no credential consumer, HTTP client, provider SDK, DNS, socket, live
  probe, model request, or response handling.

### S40-06 — Deliver the complete GUI-first credential workflow

- add a dedicated Credentials panel under Settings with complete English and
  Italian parity;
- show `UNCONFIGURED`, `CONFIGURED_LOCAL_NOT_VALIDATED`, `UNAVAILABLE`, and
  error states with textual meaning and recovery;
- explain before submission where the secret is held, what is persisted, what
  backup or recovery is possible, and what cannot be inferred from configured
  status;
- use non-echoing password inputs, deliberate replace and remove confirmations,
  keyboard-safe focus, accessible status announcements, and responsive layout;
- keep the Dashboard and System status truthful: model delivery remains
  `UNAVAILABLE`.

### S40-07 — Verify privacy, failure behavior, and public safety

- cover contract, adapter, application, authenticated route, CSRF,
  localization, interaction, restart, concurrency, corruption, permissions,
  replacement, removal, and recovery cases;
- use synthetic credentials exclusively and scan test output, errors, generated
  state, Git diff, and staged files for every canary;
- prove status and failure responses contain no secret-derived material;
- update README, architecture, threat model, security guidance, Settings guide,
  project plan, roadmap, sprint index, ADR index, and local handoff;
- run formatting, lint, typecheck, clean composite build, full tests, npm audit,
  Markdown link checks, and public-repository safety scans.

## Custody decision gates

A candidate can be adopted only if it:

1. has an explicit foreground and headless behavior;
2. does not expose secrets through routine status, errors, logs, paths, labels,
   test output, or browser persistence;
3. fails closed on corruption, permissions, concurrency, unsupported versions,
   and incomplete writes;
4. defines replacement, removal, backup, workspace-move, and irrecoverable-loss
   semantics honestly;
5. preserves local-first operation and least privilege;
6. has an acceptable dependency, portability, maintenance, and vulnerability
   surface recorded in an ADR;
7. can be exercised completely with synthetic input and without network
   access.

## Stop and re-plan triggers

Stop and request a decision if:

- the selected mechanism requires a new runtime, native dependency, framework,
  daemon, cloud service, privileged helper, or relaxed browser boundary;
- portable recovery and OS-bound protection cannot both be satisfied and the
  product priority is unclear;
- headless use would require storing plaintext secrets or silently weakening
  the interactive custody contract;
- a provider-specific credential shape, account lookup, OAuth flow, managed
  login, key validation, or external call becomes necessary;
- deletion would be described as secure erasure without evidence from the
  underlying filesystem or operating-system store;
- the GUI cannot provide complete configuration, replacement, removal, loss,
  and recovery guidance in English and Italian;
- scope expands into request construction, credential consumption, transport,
  authorization, model delivery, response handling, routing, fallback, or
  execution.

## Out of scope

- real credentials or provider-valid fixture values;
- environment, keychain, browser, shell-history, or credential-file discovery;
- provider authentication, account or organization lookup, quota or billing;
- DNS, sockets, HTTP, live probes, model calls, request or response bodies;
- provider adapters, authorization consumption, attempt creation, delivery,
  retries, routing, fallback, or execution;
- OAuth, managed login, browser redirects, device flows, refresh tokens, or
  token renewal;
- synchronization, export, sharing, cloud backup, recovery escrow, or remote
  secret managers;
- claims of secure deletion from storage media;
- reusing mapping custody formats or keys without explicit evidence and ADR
  scope.

## Verification plan

- frozen deterministic custody-candidate corpus with two identical runs;
- provider-neutral contract and canonical round-trip tests;
- local adapter permission, atomicity, restart, concurrency, corruption,
  replacement, removal, and bounded-capacity tests;
- GUI application, authenticated loopback route, CSRF, interaction,
  localization, accessibility, and responsive tests;
- secret-canary non-disclosure checks across success, error, logs, status,
  persisted documents, generated artifacts, and test output;
- clean workspace-move or OS-bound recovery cases according to the accepted
  decision;
- full repository quality gate, dependency audit, link check, diff review,
  staged-file review, and public safety scan.

## Definition of done

- one custody decision is supported by frozen synthetic evidence and an
  accepted ADR;
- secret and non-secret configuration have separate versioned boundaries;
- the accepted local adapter fails closed and exposes no secret-derived status;
- create, replace, remove, restart, loss, and recovery semantics are explicit;
- the bilingual GUI completes the workflow without CLI knowledge and clears
  secret fields after every attempt;
- Dashboard and System status continue to report model delivery as unavailable;
- no real credential, provider call, network access, model request, response,
  routing, fallback, or execution path exists;
- public documentation describes guarantees, limitations, and recovery without
  overstating authentication or secure deletion.

## Planning decisions

- Sprint 40 is limited to credential configuration and custody.
- Candidate comparison precedes the ADR, and the ADR precedes production code.
- Provider-neutral configuration and secret custody remain separate.
- All evidence and fixtures are synthetic and deliberately provider-invalid.
- GUI parity is part of the same increment.
- The next provider request-construction or live-transport increment requires a
  new plan and explicit user approval.
