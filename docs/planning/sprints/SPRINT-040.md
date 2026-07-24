# Sprint 40 — Read Provider Credentials from the Environment Only

**Primary epics:** E0 — Product foundation; E7 — Privacy and security gateway

**Milestone:** M5 — Privacy-ready beta

**Status:** planned

**Cadence:** scope-bounded increment (no timebox)

**Dependency:** Sprint 39 completed; production attempt evidence exists behind
ADR-0028; the multi-page local GUI shell is available in `2c7cdd2`

## Sprint goal

Give AI Workspace a provider-neutral way to know **whether** a model-provider
credential has been supplied, without ever holding one.

A credential is supplied only as a process environment variable, set by the user
before starting AI Workspace. AI Workspace reads its presence, never persists it,
never encrypts it, never writes it anywhere, never accepts it through the
browser, and never uses it for authentication, network access, model delivery,
routing, fallback, or execution.

This sprint deliberately replaces the earlier plan for a custody comparison
between environment variables, passphrase-wrapped local files, and
operating-system credential stores. That comparison was the wrong shape of work
for this point in the project: it would have produced a frozen corpus, an ADR, a
new persistent secret format, and a new adapter in order to decide how to store
something that nothing yet consumes. The narrow answer is available for free —
hold nothing — and it can be replaced later without migration, because there is
no stored state to migrate.

## Why no custody ADR

The delivery model requires an ADR before a material choice becomes expensive to
reverse. Environment-only supply is the absence of such a choice:

- it introduces no persisted format, so there is no schema to keep readable;
- it introduces no cryptography, so there is no key, scope, or envelope to
  freeze;
- it introduces no dependency, native build surface, or platform coupling;
- it introduces no recovery, backup, or workspace-move semantics, because nothing
  survives the process;
- it can be superseded by any future custody mechanism with no migration, since a
  later mechanism only has to supply the same in-memory value.

The decision that _is_ material — persisting a long-lived provider secret locally
— is therefore not taken in this sprint. It requires evidence that a stored
credential is actually needed, and that evidence cannot exist until a credential
is consumed by a real provider request. It therefore belongs to the increment
that introduces provider transport, which requires separate explicit approval.

## Product outcome

From the Settings area, a user can see which provider credential slots AI
Workspace recognizes, whether each slot's environment variable is present in the
current process, and exactly what to do to supply one. The panel states plainly
that AI Workspace stores no credential and that nothing on the page contacts a
provider.

A present variable proves only that a non-empty value of an accepted shape was
visible to this process. It does **not** prove provider identity, account
ownership, authorization scope, balance, model availability, endpoint
reachability, or successful authentication. The status vocabulary must make that
impossible to misread.

No real credential is required or permitted in tests, fixtures, documentation,
measurements, logs, screenshots, or committed artifacts.

## Committed backlog

### S40-01 — Define the environment credential boundary

- classify provider secrets as `RESTRICTED` and state that AI Workspace is not
  their custodian in this increment;
- enumerate the exposure paths that remain even without persistence: process
  environment visibility to other processes of the same user, `/proc` inspection,
  crash dumps, shell history, process listings, inherited child environments, and
  container or supervisor configuration;
- state explicit non-goals: persistence, encryption, keychains, browser input,
  account discovery, OAuth, managed login, provider validation, rotation, and
  recovery;
- require that no code path reads a credential value except the presence check
  defined in S40-02, and that no code path copies it into a domain object, log,
  error, response, cache, or artifact;
- update the public threat model with the residual risks of environment-based
  supply and with the truthful statement that AI Workspace cannot protect a
  secret that the operating system exposes to the user's own processes.

### S40-02 — Add a provider-neutral credential presence contract

- introduce a provider-neutral credential-slot identity and a bounded status
  contract in a provider-neutral package;
- expose exactly one query: for each known slot, its identity, the provider kind,
  the environment variable name, and one status value;
- define the status vocabulary as `ABSENT`, `PRESENT_NOT_VALIDATED`, and
  `PRESENT_BUT_UNUSABLE`, where the last covers an empty, whitespace-only,
  over-long, or non-printable value;
- return no secret, secret prefix or suffix, length, hash, reversible derivative,
  authentication header, environment dump, or provider account data — presence
  and usability shape only;
- keep the value out of the returned object entirely, so that no caller can
  accidentally serialize it;
- answer the question a user actually has — "does AI Workspace see my key?" — and
  nothing more.

### S40-03 — Implement the environment reader adapter

- implement a replaceable local adapter that reads only the declared variable
  names from the process environment at query time;
- perform the shape check without retaining the value beyond the check and
  without branching on its content;
- treat an unset, empty, or unusable variable as a normal state, not an error;
- add no file, directory, database, keychain, encryption, HTTP client, provider
  SDK, DNS, socket, live probe, model request, or response handling;
- add no external runtime dependency.

### S40-04 — Deliver the GUI-first credential status panel

- add a dedicated Credentials panel under Settings with complete English and
  Italian parity;
- show every recognized slot with its status, its meaning, and its consequence;
- **accept no secret input in the browser**: the panel explains how to set the
  environment variable and restart AI Workspace, because a browser field would
  create exactly the exposure this design avoids;
- state before anything else that AI Workspace stores no credential, that the
  value lives only in the process environment, and that presence proves nothing
  about the provider;
- provide accessible status announcements, keyboard-safe focus, and responsive
  layout consistent with the existing shell;
- keep the Dashboard and System status truthful: model delivery remains
  `UNAVAILABLE`.

### S40-05 — Verify non-disclosure and public safety

- cover contract, adapter, application, authenticated route, CSRF, localization,
  interaction, and missing-variable cases;
- use synthetic, deliberately provider-invalid canary values exclusively,
  injected through the test process environment;
- assert that every canary is absent from status responses, error messages, logs,
  rendered HTML, persisted documents, generated artifacts, and test output;
- assert that no file is created and no existing document is modified by any
  credential code path;
- update README, architecture, threat model, security guidance, Settings guide,
  project plan, roadmap, sprint index, and local handoff;
- run formatting, lint, typecheck, clean composite build, full tests, npm audit,
  Markdown link checks, and public-repository safety scans.

## Decision gates

The increment can be accepted only if:

1. no credential value is written to any file, document, log, response, or
   artifact;
2. status output contains no secret-derived material of any kind, including
   length;
3. the GUI never receives or transmits a secret value;
4. an unset or unusable variable produces a clear, non-echoing status rather than
   a failure;
5. no external runtime dependency, network access, or provider call is added;
6. the documentation states honestly what environment-only supply does not
   protect against;
7. every case is exercisable with synthetic values and without network access.

## Stop and re-plan triggers

Stop and request a decision if:

- persisting a credential appears necessary to complete the increment;
- a provider-specific credential shape, account lookup, OAuth flow, managed
  login, key validation, or external call becomes necessary;
- the GUI cannot explain configuration and its limits completely in English and
  Italian without accepting a secret;
- scope expands into request construction, credential consumption, transport,
  authorization, model delivery, response handling, routing, fallback, or
  execution.

## Out of scope

- any persistence of a credential: files, databases, keychains, operating-system
  credential stores, encrypted envelopes, or browser storage;
- passphrase wrapping, key derivation, custody schemas, and recovery material;
- a custody candidate comparison corpus and a custody ADR;
- browser or CLI input of secret values;
- environment, keychain, browser, shell-history, or credential-file discovery
  beyond the explicitly declared variable names;
- provider authentication, account or organization lookup, quota or billing;
- DNS, sockets, HTTP, live probes, model calls, request or response bodies;
- provider adapters, authorization consumption, attempt creation, delivery,
  retries, routing, fallback, or execution;
- OAuth, managed login, browser redirects, device flows, refresh tokens, or token
  renewal;
- synchronization, export, sharing, cloud backup, recovery escrow, or remote
  secret managers;
- claims of secure deletion, since nothing is written.

## Verification plan

- provider-neutral contract tests for every status value;
- adapter tests for unset, empty, whitespace-only, over-long, non-printable, and
  accepted synthetic values;
- assertion that no filesystem write occurs during any credential operation;
- GUI application, authenticated loopback route, CSRF, interaction, localization,
  accessibility, and responsive tests;
- secret-canary non-disclosure checks across success, error, logs, status,
  rendered output, persisted documents, generated artifacts, and test output;
- full repository quality gate, dependency audit, link check, diff review,
  staged-file review, and public safety scan.

## Definition of done

- provider credentials can be supplied only through the process environment;
- AI Workspace persists, encrypts, and transmits nothing;
- the status contract exposes presence and usability shape and nothing else;
- the bilingual GUI explains configuration, its meaning, and its limits without
  accepting a secret;
- Dashboard and System status continue to report model delivery as unavailable;
- no real credential, provider call, network access, model request, response,
  routing, fallback, or execution path exists;
- public documentation states truthfully that AI Workspace is not a credential
  custodian and what environment supply does not protect against.

## Planning decisions

- Sprint 40 is limited to environment-only credential presence and its status.
- No credential is persisted, so no custody ADR and no custody corpus are
  produced.
- Local credential custody is deferred until a credential is actually consumed,
  which is the only point at which evidence about its required lifetime can
  exist.
- The GUI is the primary surface for the capability, but it is read-only with
  respect to secrets by design.
- All fixtures are synthetic and deliberately provider-invalid.
- The next provider request-construction or live-transport increment requires a
  new plan and explicit user approval.
