# Sprint 33 — Decide the Enforceable Model-Delivery Authorization Boundary

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, delivery-authorization evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 32 completed; ADR-0017 and ADR-0021 through ADR-0026
accepted

## Sprint goal

Determine, from a frozen synthetic corpus, whether AI Workspace can bind one
explicit user authorization to one exact privacy-reviewed, pseudonymized model
request and make that authorization single-use at a future delivery boundary,
without adding a production provider, network request, model invocation,
response capture, routing, credentials, or execution.

## Evidence and problem statement

The current E7 chain can compose a Context Pack, evaluate one model policy,
record the valid preflight decision, transform exact reviewed spans, and restore
strict mapping-owned tokens in local output. Every result intentionally remains
not authorized or delivered. M5 additionally requires enforceable policy at
model access: a later transport must not be able to deliver stale, blocked,
unreviewed, differently transformed, replayed, or cross-scoped bytes.

A transient confirmation cannot survive the boundary between GUI and transport.
A reusable persisted grant creates replay and revocation problems. Persisting
the payload would duplicate sensitive content. Sprint 33 therefore freezes the
authorization and consumption problem before choosing a representation. It may
accept only a provider-neutral contract exercised by a synthetic in-memory
delivery adapter; it cannot add real delivery.

## Committed backlog

### S33-01 — Freeze the authorization corpus and invariants

- define canonical synthetic schema-v1 mapping and schema-v2 mapping journeys
  for English/Italian review before authorization code;
- include exact reviewable preflight event/hash, project, Work Item, handoff,
  profile, policy, model, Context Pack schema, transformed-request digest,
  mapping-set identity/schema, occurrence, expiry, and explicit user-confirmed
  intent candidates;
- cover blocked, missing-audit, stale-report, changed-policy, changed-profile,
  changed-handoff, wrong-model, wrong-mapping, raw/untransformed, altered
  transformed bytes, expired, duplicate, replayed, concurrent, crash/restart,
  and cross-project cases;
- freeze canonical bytes, permitted metadata, non-echo behavior, replay
  semantics, clock bounds, failure matrix, and deterministic reproduction;
- exclude Context Pack content, item hashes, detected values, mapping plaintext,
  keys, passphrases, prompts, responses, provider credentials, local paths, and
  real identities or project data.

### S33-02 — Compare authorization boundary candidates

- compare transient GUI confirmation, persisted reusable grants, and a
  transaction-coupled single-use authorization consumed by the delivery
  operation;
- require exact binding to the preflight audit event/hash and report digest,
  policy/profile/model/scope, transformed-request digest, and mapping identity;
- determine whether one store can publish and consume a bounded authorization
  without pretending to coordinate a network side effect it cannot roll back;
- document crash windows before send, during send, and after provider
  acceptance, including why exactly-once external delivery cannot be claimed;
- accept ADR-0027 only if the result prevents local replay and stale/cross-scope
  use without persisting request content or bearer-equivalent secrets;
- record `EVIDENCE_ONLY`, `REFINE`, or `NO_CHANGE` if safe production semantics
  cannot be demonstrated before a real transport contract exists.

### S33-03 — Exercise a provider-neutral authorization contract conditionally

- if the corpus passes, add a provider-neutral authorization-intent and
  consumption contract behind domain-owned ports;
- use only a deterministic synthetic in-memory delivery adapter that records
  aggregate test evidence and never opens a socket or invokes a model;
- make user confirmation explicit, exact-scope, bounded-time, and non-reusable;
- validate the complete authorization before exposing request bytes to the
  synthetic delivery port, and return only non-content receipt metadata;
- fail closed for stale, expired, blocked, altered, replayed, concurrent,
  incomplete, or cross-scoped state without partial authorization;
- add no production persistence or GUI authorization action unless the ADR
  demonstrates useful, non-misleading behavior without a real transport.

### S33-04 — Make evidence inspectable without implying delivery

- expose a development-only bilingual measurement report through the existing
  local GUI only if it helps review the frozen cases without accepting content,
  secrets, provider configuration, or network destinations;
- distinguish `REVIEWABLE_NOT_AUTHORIZED`, authorization intent, synthetic
  consumption, and external delivery in every state and effect label;
- cover first-run, empty, loading, success, warning, returning, error,
  accessibility, keyboard, narrow viewport, CSRF/Origin, body, scope, expiry,
  replay, and recovery contracts where a GUI surface is adopted;
- provide no model selector beyond the already reviewed profile/policy target,
  no endpoint field, API-key field, send button, retry-delivery action, or
  response display.

### S33-05 — Verify, document, and close

- test canonical bytes, v1/v2 mapping scope, valid authorization, blocked and
  stale preflight, exact transformed digest binding, expiry, replay,
  concurrency, crash windows, scope, and non-echoing failures;
- prove no socket, DNS, HTTP client, provider SDK, credential input, prompt,
  response, model execution, or production delivery consumer is introduced;
- prove permanent mapping v1, explicit mapping v2, custody-envelope v1,
  privacy audit, strict restoration, Context Pack, and detector contracts stay
  unchanged;
- update ADR or evidence-only decision, architecture, threat model, data
  classification, development documentation, planning, roadmap, and public
  design with the measured outcome;
- run clean build/check/audit, corpus reproduction, compatibility tests, diff
  check, and public-safety scan; create one commit without push only during a
  separately authorized implementation turn.

## Stop and re-plan triggers

- useful authorization requires storing request content, item hashes, mapping
  plaintext, keys, passphrases, credentials, prompts, responses, or a
  bearer-equivalent reusable secret;
- authorization cannot bind the exact bytes a transport would receive;
- a local grant can be replayed, widened, silently renewed, or used across
  project, Work Item, handoff, model, policy, profile, mapping, or audit scope;
- the design claims exactly-once external delivery, provider acceptance, or
  rollback without a real provider protocol supporting those guarantees;
- safe consumption requires distributed transactions, a database, service,
  network, provider SDK, credential manager, routing, or execution;
- a GUI authorization action would mislead users into believing a model was
  contacted or that future delivery is already safe;
- the evidence cannot distinguish a useful production contract from a mock-only
  abstraction; close with `EVIDENCE_ONLY` or `NO_CHANGE` instead.

## Out of scope

Production model adapters; network, DNS, HTTP, streaming, retries, provider
selection, routing, fallback, rate limits, billing, token accounting, API keys,
OAuth, credential storage, remote attestation, model availability, model
invocation, response capture, response persistence, delivery receipts claimed
as provider truth, automatic restoration, transformation/restoration audit,
audit retention/export, mapping migration, re-encryption, passphrase change or
reset, databases, services, frameworks, and external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The corpus command, exact canonical fixtures, permitted metadata, replay/expiry
rules, crash matrix, fake-adapter proof, and decision gates must be frozen in a
development document before ADR-0027 or production implementation. Fixtures
remain synthetic and contain no real policy, project, model, identity,
credential, endpoint, prompt, response, or security material.

## Definition of done

- authorization corpus, candidate schemas, exact-byte bindings, replay model,
  crash semantics, and failure gates precede ADR-0027 and implementation;
- the chosen decision is evidence-backed and explicitly distinguishes local
  authorization from external delivery and provider acceptance;
- any accepted contract binds one user-confirmed intent to one exact safe scope
  and transformed-request digest and rejects stale, altered, expired, replayed,
  concurrent, or cross-scoped use;
- no request content, item hashes, mapping plaintext, secrets, credentials,
  prompts, responses, or real private data are persisted or exposed in errors;
- no production provider, network, model, routing, delivery, response, or
  execution path exists at closure;
- existing E7 contracts and permanent v1 compatibility remain unchanged;
- full repository gates pass, documentation is synchronized, and no commit or
  push occurs during planning.

## Risks and mitigations

| Risk                                                    | Mitigation                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A local grant becomes a reusable bearer token           | Prefer transaction-coupled consumption; reject persistence if replay resistance cannot be proven             |
| Authorization is detached from delivered bytes          | Bind exact transformed-request digest plus complete immutable scope and audit provenance                     |
| Mock evidence overstates external guarantees            | State crash windows and exclude exactly-once/provider-acceptance claims                                      |
| Users interpret authorization as a completed model call | Keep effect labels explicit and add no endpoint, credential, send, retry, or response GUI controls           |
| Sensitive data enters a second state store              | Persist no request content, item hashes, mappings, secrets, prompts, responses, or reusable secret material  |
| Scope expands into provider integration                 | Stop at domain contract and synthetic adapter; require a later sprint and explicit authorization for network |

## Planning decisions

- Sprint 33 remains in E7 because M5 still lacks an enforceable boundary
  between local privacy review and future model delivery;
- actual model access is too material to infer from the existing read-only
  preview and requires separate evidence, user authorization, and an ADR;
- transaction and crash semantics must be understood before adding a persisted
  grant, send button, provider adapter, credential field, or network request;
- a measurement-only or no-change outcome is acceptable and preferable to a
  mock abstraction that cannot constrain a future transport;
- E8 tool-registry work remains next in the default epic order only after M5 is
  either completed or explicitly re-scoped.

## Outcome and retrospective

The corpus, intent schema, expiry/replay rules, and crash matrix were frozen
before the executable harness. Two deterministic complete runs produced corpus
SHA-256
`a5e856f6fca081341061e4c18e5ae76f51039d473c170d73d886bddf1ba70da6`,
22 of 22 expected cases, zero incorrect cases, exact v1/v2 binding, zero
exposure for every invalid case, and one successful exposure under replay and
concurrency pressure.

Transient confirmation and persisted reusable grants are rejected. The
transaction-coupled single-use candidate prevents local replay but cannot know
whether an external provider accepted bytes after a crash between exposure and
receipt. The sprint therefore closes `EVIDENCE_ONLY`; ADR-0027 is not created.
All executable authorization logic, state, and delivery behavior remains under
test only. No production store, package export, facade, API route, GUI action,
provider, credential, network, model call, response, routing, delivery, or
execution path was added.

The next model-access increment requires an explicitly chosen provider
protocol and predeclared idempotency, receipt, timeout, retry, cancellation, and
crash-recovery gates. M5 remains incomplete; it must not be declared complete
from synthetic adapter evidence.
