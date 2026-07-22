# Sprint 32 — Record Privacy Preflight Decisions Locally

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, policy-audit increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 31 completed; ADR-0017 and ADR-0021 through ADR-0025
accepted

## Sprint goal

Make every valid, explicitly requested privacy-preflight decision locally
visible and auditable through a separate bounded append-only non-content store,
using a frozen synthetic corpus before any ADR or production persistence,
without model access, delivery, routing, permission, or execution.

## Evidence and problem statement

Sprint 22 makes one policy decision inspectable but deliberately transient.
Sprints 26–31 add reversible transformation and strict local restoration while
preserving that non-persistent boundary. The E7 exit criterion requires policy
decisions to be visible and auditable, yet the current application cannot show
whether a prior preflight was `REVIEWABLE_NOT_AUTHORIZED` or `BLOCKED`, which
policy governed it, or whether its report has changed.

Persisting complete reports would copy item hashes and sensitive correlation
metadata into an ordinary log. Auditing transformation or restoration would
also require coordinating already committed encrypted state with a second
store. Sprint 32 therefore covers only successfully evaluated preflight
decisions and records the minimum provenance and aggregate evidence needed to
inspect them later.

## Committed backlog

### S32-01 — Freeze the audit corpus, schema, and safety gates

- define canonical synthetic `REVIEWABLE_NOT_AUTHORIZED` and `BLOCKED` events
  for English/Italian GUI journeys before persistence code;
- bind each event to event ID, UTC occurrence time, project, Work Item,
  immutable handoff, model, policy identity/version/digest, Context Pack schema,
  overall decision, aggregate counts, canonical preflight-report digest, and
  predecessor event hash;
- exclude Context Pack content, item hashes, detected values or surrounding
  text, policy paths, full reports, mappings, keys, passphrases, candidate or
  restored output, prompts, responses, and local paths;
- freeze chain, ordering, canonical-byte, append, pagination, corruption,
  truncation limitation, bounds, concurrency, scope, non-echo, and deterministic
  replay gates;
- set one explicit per-project event bound and require fail-closed recovery at
  the bound; add no deletion, compaction, rollover, or implicit retention.

### S32-02 — Decide audit persistence before production changes

- compare a separate per-project schema-v1 append-only JSON audit document with
  reusing ordinary application logs or persisting complete preflight reports;
- define private modes, owner-token locking, flushed atomic replacement,
  monotonic revisions, predecessor hashes, canonical validation, pagination,
  and incomplete-write recovery;
- document that hash chaining detects internal corruption, gaps, and reordering
  but cannot prove that a privileged actor did not replace or truncate the
  entire store without an external anchor;
- accept ADR-0026 only if minimum non-content provenance remains useful and
  audit failure can block report return without leaving other committed state;
- record `NO_CHANGE` if safe bounded persistence or usable recovery cannot be
  demonstrated.

### S32-03 — Record valid preflight decisions fail-closed

- add a provider-neutral audit-event contract and a local adapter behind a
  domain-owned port; introduce no runtime, framework, database, service, or
  external package;
- after a preflight evaluates successfully, append exactly one audit event for
  either `REVIEWABLE_NOT_AUTHORIZED` or `BLOCKED` before returning the report;
- return no preflight report if audit validation, locking, bounds, publication,
  or reread verification fails;
- keep malformed requests and failures before a valid decision out of this
  decision-audit contract; expose only generic operational errors;
- never audit transformation, mapping creation, custody actions, output
  restoration, or delivery in this increment.

### S32-04 — Expose a bounded bilingual audit viewer

- update preflight copy and interaction contracts to state that valid decisions
  are recorded locally and that `REVIEWABLE_NOT_AUTHORIZED` still grants no
  permission or delivery authority;
- add authenticated project-scoped list and detail routes with deterministic
  newest-first pagination and explicit Work Item/handoff navigation;
- show safe provenance, policy identity/version/digest, decision, counts,
  report/event/predecessor hashes, occurrence time, limitations, and recovery;
- cover first-run, empty, loading, success, warning, returning, error,
  accessibility, keyboard, narrow viewport, inert rendering, CSRF/Origin, body,
  pagination, scope, and no-manual English/Italian states;
- provide no delete, edit, correction, export, search, or retention controls.

### S32-05 — Verify, document, and close

- test canonical bytes, both decisions, repeated evaluations as distinct
  events, hash chaining, ordering, pagination, bounds, concurrency, corruption,
  incomplete state, unsafe modes, foreign scope, and non-echoing failures;
- prove audit append failure prevents report return and that invalid requests
  create no event;
- prove existing policy, Context Pack, mapping v1/v2, custody, transformation,
  output restoration, and Restricted-detector contracts remain unchanged;
- update ADR, architecture, threat model, data classification, user/developer
  documentation, planning, roadmap, and public design with the actual decision;
- run clean build/check/audit, corpus reproduction, v1/v2 compatibility, diff
  check, and public-safety scan; create one commit without push.

## Stop and re-plan triggers

- useful audit requires content, item hashes, detected matches, paths, mapping
  plaintext, keys, passphrases, prompts, responses, or real private data;
- preflight report return cannot fail closed when its audit append fails;
- the design implies transactional coordination with mapping, custody,
  transformation, restoration, delivery, or another persisted aggregate;
- bounded storage requires silent deletion, overwrite, compaction, rollover,
  export, or an unreviewed retention policy;
- chain or canonical validation cannot distinguish internal corruption,
  reordering, duplicate identity, or cross-project replay;
- implementation requires a database, service, network, model, provider SDK,
  routing, permission enforcement, execution, or external dependency.

## Out of scope

Auditing malformed requests or operational failures before a valid policy
decision; transformation, mapping, custody, alias-review, and output-restoration
events; audit deletion, editing, correction, export, sharing, sync, search,
indexing, compaction, archival, rollover, retention automation, external
anchoring, signatures, telemetry, or remote collection; false-positive memory,
automatic entity detection, model/agent invocation, response capture, delivery,
routing, permissions, execution, migration, re-encryption, passphrase change or
reset, databases, services, frameworks, and external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The corpus command, event bound, exact canonical fixtures, failure matrix, and
decision gates must be frozen in a development document before ADR-0026 or
production implementation. Fixtures remain synthetic and contain no real
policy, project, model, identity, or security material.

## Definition of done

- corpus, schema candidate, canonical bytes, event bound, chain semantics, and
  failure gates precede ADR-0026 and production code in that order;
- every returned valid preflight has exactly one verified local audit event,
  including both reviewable and blocked decisions;
- audit events retain minimum decision provenance and aggregate counts without
  copying content, item hashes, reports, secrets, mappings, paths, or responses;
- append, validation, and reread are bounded, canonical, private, atomic,
  project-scoped, chain-checked, and fail closed without partial return;
- the bilingual GUI can list and inspect events with provenance, limitations,
  pagination, and recovery but cannot mutate or export them;
- no result authorizes model access, delivery, routing, permission, execution,
  or complete privacy/PII claims;
- full repository gates pass, documentation is synchronized, one commit is
  created, and no push is performed.

## Risks and mitigations

| Risk                                                 | Mitigation                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Audit metadata becomes a second sensitive transcript | Store only minimum scope/provenance, aggregate counts, and digests; forbid content and item hashes       |
| A returned decision has no durable audit evidence    | Append and reread the event before returning the preflight report                                        |
| Hash chaining is mistaken for tamper proofing        | Document that it detects internal inconsistency but not privileged whole-store replacement or truncation |
| Bounds force silent history loss                     | Fail closed at the frozen bound and add no deletion, rollover, or retention behavior                     |
| Repeated evaluation is silently deduplicated         | Give every explicit valid evaluation a unique event identity/time while allowing the same report digest  |
| Auditability is mistaken for delivery authority      | Preserve non-authorizing effects and add no model, network, routing, permission, or delivery consumer    |

## Outcome and retrospective

The frozen two-case corpus preceded ADR-0026 and production code. Its reference
run produced 1,657 canonical bytes, both valid decisions, a deterministic
two-event hash chain, zero forbidden event fields, and decision
`ADOPT_SEPARATE_BOUNDED_JSON_AUDIT` at the fixed 1,000-event project bound.

The implementation adds a provider-neutral audit contract, separate private
atomic JSON adapter, verified fail-closed preflight recording, authenticated
project-scoped list/detail routes, and a bilingual read-only viewer. Existing
transformation, mapping v1/v2, custody, alias, and strict output-restoration
paths remain outside the audit. Hash-chain limitations and fixed-capacity
recovery are explicit. Repository gates passed before the single closure
commit; no push was performed.

## Planning decisions

- Sprint 32 advances the explicit E7 auditable-policy criterion without
  crossing the model-delivery boundary;
- only valid preflight decisions are in scope because they have no other state
  commit and can therefore fail closed on audit persistence;
- audit events are a separate aggregate, not ordinary logs, active memory,
  history, artifacts, mappings, or telemetry;
- transformation and restoration audit remain deferred until cross-store
  consistency and retention have separate evidence;
- GUI delivery is conditional on a passing frozen corpus and accepted ADR-0026;
  otherwise the sprint closes with evidence and `NO_CHANGE`.
