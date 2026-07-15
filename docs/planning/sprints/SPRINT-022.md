# Sprint 22 — Preview Model Privacy Policy Before Delivery

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, privacy-preflight increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 21 completed

## Sprint goal

Let a user preview, through the primary bilingual GUI, whether one explicitly
composed profile-governed Context Pack is compatible with one explicit,
digest-pinned model data policy, using conservative deterministic
classification and non-echoing restricted-data detection—without sending data
to a model, pseudonymizing content, persisting decisions, or granting runtime
authority.

## Evidence and problem statement

M4 established deterministic instructions, portable profiles, exact source
closure, and inspectable budgeted Context Packs. Sprint 21 then rejected all
three generic selector policies as insufficient continuity evidence and found
no new schema-v2 fit. Another selector experiment would tune a fixed corpus
without addressing the next product risk.

E7 is now the next planned epic. The current ingestion boundary already blocks
a narrow set of high-confidence credential patterns before persistence, but
that integration-owned throw-only screen is not a reusable outbound privacy
decision. Context Pack preview can still contain confidential or restricted
content, and no model-specific data policy can be inspected before any future
delivery boundary exists.

Sprint 22 creates only that preflight boundary. Unknown content defaults to
`CONFIDENTIAL`; exact user-configured classifications are attribution rather
than truth; high-confidence `RESTRICTED` detection always overrides a less
restrictive declaration. The result is review evidence, never delivery
authorization or a claim that undetected content is safe.

## User story

As a user reviewing a future model interaction, I want to compare the exact
profile-governed Context Pack against the selected model's explicit privacy
policy before anything leaves my machine, so that blocked items, default
classification, policy provenance, and recovery are visible without exposing
the detected restricted value.

## Committed backlog

### S22-01 — Decide the privacy-preflight boundary

- write ADR-0017 before implementation to decide that every future model
  delivery must be preceded by an explicit, inspectable privacy decision, while
  this sprint implements only a read-only preflight;
- preserve the existing data classes `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, and
  `RESTRICTED`, with most-restrictive-wins ordering and unknown content defaulting
  to `CONFIDENTIAL`;
- define overall results `REVIEWABLE_NOT_AUTHORIZED` and `BLOCKED`, and item
  results `ALLOWED_BY_POLICY`, `BLOCKED_BY_POLICY`, and
  `BLOCKED_RESTRICTED_PATTERN`;
- state that a successful preview is not model availability, permission,
  routing, anonymization, delivery, execution, or proof that the content is
  free of sensitive data;
- stop and re-plan if implementation requires a network gateway, model SDK,
  secret store, encrypted mapping persistence, background service, or external
  dependency.

### S22-02 — Freeze the portable model data-policy contract

- add provider-neutral schema v1 for policy ID/version, project scope, exact
  model ID, maximum allowed data class, exact item-classification assertions,
  attribution, author, and license;
- bind every classification assertion to Context Pack item ID and exact content
  SHA-256 so changed content cannot inherit a stale lower classification;
- normalize set-like values and require exact closure: assertions must identify
  one current item, while items without an assertion deterministically default
  to `CONFIDENTIAL`;
- make `RESTRICTED` unallowable by policy and reject duplicate, dangling,
  conflicting, stale-hash, cross-project, cross-model, malformed, control-text,
  noncanonical, or oversized policies without content echo;
- retain `USER_CONFIGURED` as attribution only; it is neither verified truth nor
  permission to transmit data.

### S22-03 — Evaluate exact Context Pack privacy preflight

- add a provider-neutral privacy-gateway module that consumes one validated
  policy, the explicitly selected model, and the immutable expanded Context
  Pack emitted by the existing profile-governed composition contracts;
- centralize the existing high-confidence private-key, provider-token, access
  key, and assigned-credential patterns behind one pure bounded detector, while
  retaining the current ingestion adapter behavior through regression tests;
- scan every included continuity and instruction item, let `RESTRICTED`
  detection override declarations, apply exact assertions, default remaining
  items to `CONFIDENTIAL`, and compare each effective class with the model
  policy maximum;
- report only item identity, category, trust, source identity, exact bytes,
  content SHA-256, classification source, detector category, decision, and
  non-echoing reason; never return the detected match, surrounding text, or a
  raw policy path;
- keep omitted Context Pack items visible as not evaluated and reconcile item,
  byte, allowed, blocked, defaulted, and restricted counts exactly.

### S22-04 — Deliver the bilingual privacy-preflight journey

- add one controlled local JSON policy reader with fatal UTF-8 decoding, a
  256-KiB bound, optional lowercase SHA-256 pinning, canonical round trip,
  same-project validation, and safe basename-only results;
- extend the typed facade and add an authenticated
  project/Work-Item/handoff-scoped route that reuses explicit profile,
  instruction-source, selected-model, and handoff inputs from the existing
  profile-governed preview plus one explicit privacy-policy path/digest;
- require the policy model to equal the explicitly selected profile-allowed
  model; accept no caller override for agent, budgets, classifications, or
  policy maximum;
- show policy identity/digest, model, classification legend, unknown default,
  item decisions, hashes, counts, blocked recovery, detector limitations, and
  the read-only/no-delivery effect in English and Italian;
- preserve inert rendering, semantic labels, keyboard flow, non-color status,
  narrow viewport, body bounds, CSRF, Origin, project scope, path privacy, and
  no-manual guidance.

### S22-05 — Prove the boundary and close the increment

- use only repository-owned synthetic policy and Context Pack fixtures with
  fictional public, internal, confidential, and restricted canaries;
- cover most-restrictive-wins, unknown-to-confidential, exact hash binding,
  restricted override, source/trust preservation, Unicode bytes, deterministic
  permutations, bounds, corruption, stale digest, changed content, model/scope
  mismatch, and non-echoing failures;
- prove the ingestion screen retains its existing blocked categories and error
  behavior after detector centralization;
- cover facade/HTTP behavior, safe filenames, English/Italian copy, inert DOM,
  blocked and reviewable states, and absence of persistence, network, model,
  delivery, deanonymization, or execution;
- update architecture, threat model, data classification, public design,
  README, user guide, roadmap, project plan, sprint index, and local handoff only
  after gates pass;
- run clean install, clean composite build, full check, audit, isolated
  preflight reproduction, diff check, public scan, and unchanged loopback
  acceptance;
- create one final Sprint 22 commit and perform no push.

## Out of scope

- sending any prompt, Context Pack, instruction, file, or metadata to a model or
  external service;
- model/provider availability lookup, credentials, routing, billing, token
  exchange, retry, streaming, response handling, or execution;
- automatic model, profile, skill, tool, policy, handoff, instruction, or
  context selection;
- semantic/ML/LLM PII detection, fuzzy matching, confidence scoring, human
  identity inference, or claiming complete secret/PII coverage;
- pseudonymization, deanonymization, reversible mappings, encryption keys,
  correction rules, custom dictionaries, false-positive persistence, or audit
  event persistence;
- changing Context Pack schema v1/v2, builder order, budgets, selector behavior,
  profile schema v1, instruction precedence, or Sprint 13–21 measurements;
- permission or sandbox enforcement, agent/tool execution, CodeGraph,
  OpenSearch, semantic retrieval, telemetry, or background processing;
- a new framework, database, service, cloud dependency, model SDK, or network
  listener.

## Architecture decision

ADR-0017 is required before code because the preflight result, classification
ordering, default handling, and future delivery gate form a security boundary.
The ADR may require future delivery to consume an accepted privacy decision,
but it must not authorize delivery in Sprint 22.

The implementation remains inside the modular monolith, in memory except for
one explicit read-only policy file. It may add a dependency-free
provider-neutral package and reuse it from the existing local ingestion
adapter. Any encrypted mapping store, secret-management choice, provider
protocol, remote boundary, or persistent audit schema requires a later ADR.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

HTTP acceptance opens only `127.0.0.1` and may require execution outside the
sandbox. Reproduction uses synthetic in-memory values and explicit repository
fixtures only.

## Definition of done

- ADR-0017 fixes the read-only preflight and future-delivery-gate boundary
  without authorizing model access;
- one portable digest-pinned policy is canonical, project/model-scoped,
  bounded, and binds assertions to exact item hashes;
- every included Context Pack item receives one deterministic effective class
  and decision, with unknown content defaulting to `CONFIDENTIAL` and detected
  `RESTRICTED` content always blocked;
- counts and bytes reconcile, restricted values never echo, and policy/profile/
  model/source provenance remains inspectable;
- the primary bilingual GUI explains prerequisites, effects, limitations,
  blocked recovery, and why a reviewable result is not authorization;
- current ingestion protection remains behaviorally unchanged;
- no persistence, pseudonymization, encrypted map, network, model invocation,
  delivery, permission, or execution path is introduced;
- clean-build, quality, audit, reproduction, public-safety, and loopback gates
  pass;
- documentation is synchronized, one final commit is created, and no push is
  performed.

## Dependencies and sequencing

```text
Sprint 21 complete (`no change` selector semantics and fit)
  -> S22-01 ADR-0017 privacy-preflight boundary
       -> S22-02 portable exact-hash model data policy
            -> S22-03 deterministic Context Pack preflight
                 -> S22-04 bilingual read-only GUI journey
                      -> S22-05 acceptance and closure
```

## Risks and mitigations

| Risk                                                      | Mitigation                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Preview success is mistaken for safe delivery             | Name result `REVIEWABLE_NOT_AUTHORIZED`; add no delivery adapter                             |
| User classification downgrades restricted content         | High-confidence restricted detection always overrides policy assertions                      |
| Changed content inherits a stale classification           | Bind every assertion to item ID plus exact content SHA-256                                   |
| Unknown content is silently treated as public             | Default every unasserted item to `CONFIDENTIAL`                                              |
| Detector output leaks the secret it found                 | Return only detector category, item/hash identity, and generic recovery                      |
| Existing ingestion protection changes during reuse        | Preserve adapter contract and add regression equivalence before facade work                  |
| Fixed patterns are presented as complete PII protection   | Document narrow high-confidence coverage and residual false-negative/false-positive risks    |
| Policy file or GUI becomes a permission mechanism         | Keep `USER_CONFIGURED` attribution and read-only effect; no runtime consumer or transmission |
| E7 scope expands into encrypted mappings or provider SDKs | Stop and require later ADRs for storage, keys, model protocols, routing, or delivery         |

## Planning decisions

- Sprint 22 begins E7 rather than tuning selector policies after Sprint 21's
  task-dependent negative result;
- the first privacy slice evaluates already-composed exact Context Pack items,
  so it has a concrete outbound consumer without adding model delivery;
- exact item ID plus content digest is chosen for classification assertions to
  make staleness visible and avoid path or substring policy languages;
- `CONFIDENTIAL` is the unknown default from the existing data-classification
  contract; `RESTRICTED` is never policy-allowable;
- deterministic high-confidence credential scanning is shared first, while PII
  heuristics and custom business recognizers remain later evidence-led slices;
- GUI delivery is included because privacy review is user-facing and must be
  understandable without CLI or manual knowledge;
- this commitment is preserved; execution evidence, review, retrospective, and
  final decisions will be appended without rewriting planned claims.

## Execution evidence

- S22-01 accepted ADR-0017 before implementation, fixing the conservative
  ordering, unknown default, non-authorizing result, restricted override, and
  future delivery-gate requirement.
- S22-02 added canonical model data policy schema v1 with exact keys, bounded
  values, normalized assertions, project/model scope, non-restricted maximum,
  item ID plus content SHA-256 binding, and `USER_CONFIGURED` attribution.
- S22-03 added `@ai-workspace/privacy-gateway`, exact per-item decisions and
  reconciled accounting. The five existing high-confidence detector categories
  moved behind one pure detector; ingestion regression tests preserve category
  and error behavior.
- S22-04 added the fatal-UTF-8 bounded digest-pinned local policy reader, typed
  facade, authenticated scoped HTTP route, and inert English/Italian GUI
  journey. Agent, budgets, classifications, and policy maximum remain derived
  from reviewed inputs and cannot be overridden by the caller.
- S22-05 uses only fictional synthetic values. Contract, facade, HTTP,
  localization, reader, detector, and ingestion tests cover conservative
  classification, hash staleness, scope/model mismatch, canonical permutation,
  Unicode bytes, bounds, non-echo, path privacy, and reviewable/blocked states.

## Review

The increment provides an inspectable privacy decision without creating a
delivery mechanism. It preserves Context Pack schema v1/v2, builder ordering
and budgets, profile schema, instruction precedence, and selector experiments.
`REVIEWABLE_NOT_AUTHORIZED` remains deliberately awkward and explicit: it is
evidence for human review, not a success token consumable by a model adapter.

The narrow detector reuse reduced duplicate security logic without widening
patterns or changing ingestion. Semantic PII/business-entity coverage remains
unproven and is not implied by a clean scan.

## Retrospective

- Exact item hashes provide a small, deterministic stale-classification gate
  without inventing a path or substring policy language.
- Separate provider-neutral policy/evaluation and local file-reader boundaries
  kept path privacy and runtime authority out of the core contract.
- The next M5 slice must be planned independently. Pseudonymization, encrypted
  mappings, permissions, provider protocols, and delivery each still require
  evidence and architecture decisions; none is implicitly authorized here.

## Final verification

After a clean composite build, format, lint, typecheck, build, all 205 tests,
and loopback HTTP acceptance pass. The dependency audit reports zero
vulnerabilities. The synthetic preflight reproduction, diff check, and public
safety scan pass. No model, external network, persistence, delivery, or
execution path was introduced.
