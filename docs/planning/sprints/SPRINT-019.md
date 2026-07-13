# Sprint 19 — Compose a Profile-Governed Context Preview

**Primary epics:** E0 — Product foundation; E5 — Instruction, Agent, and Skill Management; E6 — Context Optimization

**Milestone:** M4 controlled context beta, profile-composition increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 18 completed

## Sprint goal

Let a user explicitly select one reviewed agent/skill profile, its complete
reviewed instruction sources, one allowed model, and one immutable handoff to
preview the resulting effective instructions and budgeted Context Pack with
profile and source provenance—without installing, activating, delivering to,
or executing any declared capability.

## Evidence and problem statement

Sprint 18 made portable profiles inspectable but deliberately did not connect
them to the deterministic instruction composer or Context Builder. Users must
currently copy agent targets and byte budgets between separate previews, and
the system cannot prove that the selected instruction bundles exactly satisfy
the profile declarations.

Sprint 19 closes only that read-only composition gap. It reuses schema-v1
profiles, instruction composition, Context Pack schema v2, explicit local file
readers, and immutable handoffs. The result is an inspection envelope, not a
new persisted packet or runtime configuration.

## User story

As a user reviewing a portable agent configuration, I want to explicitly
compose it with its declared instruction sources and an immutable handoff so
that I can inspect compatibility, provenance, omissions, and exact budget use
before any future installation or execution boundary exists.

## Committed backlog

### S19-01 — Freeze the profile selection contract

- add a provider-neutral read-only selection function over validated profile
  and instruction bundles;
- require same-project scope, one explicitly selected allowed model, the
  profile agent ID as the composition target, and exact closure of all agent
  and enabled-skill instruction-source IDs;
- reject missing, extra, duplicate, cross-project, incompatible, or
  noncanonical selections without treating declarations as availability;
- preserve the selected profile identity/version, enabled skills, model,
  source IDs, context selectors, budgets, attribution, and non-executable
  effect in an immutable result.

### S19-02 — Compose effective instructions deterministically

- compose only after the profile selection contract passes;
- derive the AGENT target from the reviewed profile and accept no caller
  override;
- pass the explicit allowed model and optional explicit task to the existing
  precedence composer;
- retain every rule's source digest, trust, scope, status, reason, and content;
- interpret context include/exclude values as descriptive selectors only in
  this increment, not paths, retrieval queries, or permission rules.

### S19-03 — Build a profile-governed Context Pack preview

- read one explicit immutable handoff and build schema-v2 through the existing
  Context Builder;
- use continuity and instruction exact-byte budgets from the validated profile
  without caller-provided overrides;
- return an application-level envelope containing safe profile source
  metadata, profile selection, effective instructions, and expanded Context
  Pack;
- do not change Context Pack selection order, schema, persistence, delivery,
  execution, or historical measurement baselines.

### S19-04 — Deliver the bilingual GUI journey

- add a typed facade method and authenticated project/Work-Item/handoff-scoped
  preview route;
- require explicit profile path, optional pinned profile digest, instruction
  bundle paths, and selected model;
- show profile identity/version/digest, selected model and agent, exact source
  closure, enabled skills, descriptive selectors, profile budgets, effective
  rules, shared-source summary, included/omitted items, exact bytes, and all
  non-runtime effects in English and Italian;
- preserve inert rendering, keyboard, semantic, narrow-viewport, body, CSRF,
  Origin, project-scope, path-privacy, and recovery contracts.

### S19-05 — Prove acceptance and close the increment

- cover deterministic selection, source closure, model compatibility, target
  derivation, profile budgets, rule provenance, Context Pack accounting, and
  immutability;
- cover missing/extra/duplicate/foreign sources, disallowed model,
  cross-project data, changed digest, corrupt input, foreign handoff, and
  invalid bounds without content or full-path echo;
- cover facade and HTTP behavior, English/Italian copy, no-manual workflow,
  inert rendering, and no persistence/delivery/execution;
- update architecture, threat model, user guide, public design, README,
  roadmap, project plan, sprint index, and local handoff only after gates pass;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, and isolated loopback acceptance;
- create one final Sprint 19 commit and perform no push.

## Out of scope

- profile registry, discovery, persistence, installation, activation, signing,
  marketplace, editor, package resolution, or migration;
- model/tool/instruction-source availability checks, permissions, sandboxing,
  orchestration, delivery, execution, or behavioral grading;
- automatic profile, skill, model, task, handoff, instruction, or context
  selection;
- interpreting include/exclude selectors as retrieval, file access, or policy;
- Context Pack schema v3, changed selection policy, summarization, ranking,
  compression, CodeGraph, OpenSearch, semantic search, or network access;
- a new runtime, framework, database, service, cloud dependency, or package.

## Architecture decision

No ADR is planned. The slice composes existing provider-neutral contracts and
returns a transient application envelope. If implementation requires a new
persisted schema, installation, signing, permission enforcement, resolution,
execution, runtime, dependency, or network boundary, stop and write a separate
ADR.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

HTTP acceptance opens only `127.0.0.1` and may require execution outside the
sandbox. Fixtures and demos must remain synthetic and temporary.

## Definition of done

- one explicit profile can govern deterministic instruction and Context Pack
  preview from reviewed local inputs and one immutable handoff;
- exact instruction-source closure and allowed-model selection fail closed;
- the profile supplies the agent target and both byte budgets;
- profile/source provenance and all read-only effects remain visible;
- selectors remain descriptive and no runtime availability or permission is
  implied;
- existing Context Pack schema, selection behavior, and measurements remain
  unchanged;
- clean-build, quality, audit, public-safety, and GUI/HTTP gates pass;
- documentation is synchronized, one final commit is created, and no push is
  performed.

## Dependencies and sequencing

```text
Sprint 18 complete
  -> S19-01 profile selection contract
       -> S19-02 effective-instruction composition
            -> S19-03 profile-governed Context Pack envelope
                 -> S19-04 bilingual GUI
                      -> S19-05 acceptance and closure
```

## Risks and mitigations

| Risk                                                    | Mitigation                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A declaration is mistaken for installed availability    | Exact internal closure plus explicit unresolved/non-runtime effect             |
| Caller silently changes agent or budgets                | Derive agent and budgets only from the validated profile                       |
| Extra instruction source gains influence                | Require exact source-ID closure before composition                             |
| Profile provenance disappears inside Context Pack v2    | Return a transient envelope with safe profile digest/name and selection report |
| Selector semantics expand into retrieval or permissions | Keep selectors descriptive and do not pass them to a resolver                  |
| New flow changes historical Context Pack evidence       | Reuse the existing builder unchanged and add regression coverage               |

## Planning decisions

- the result is an application envelope rather than Context Pack schema v3;
- the selected model is mandatory and must belong to the profile's allowed
  models; preference order remains visible but does not select automatically;
- the agent target is derived from the profile and cannot be overridden;
- instruction bundles must contain exactly the union of agent and enabled-skill
  instruction-source IDs, preventing both missing declarations and undeclared
  influence;
- profile context selectors are preserved for inspection but remain
  descriptive until a separate consumer and semantics are accepted;
- this commitment is preserved; execution evidence, review, and retrospective
  will be appended without rewriting the planned claims.

## Execution log

### 2026-07-13

- S19-01 added `composeProfileInstructions` to the provider-neutral
  instruction-manager package. It validates the existing profile and
  instruction schemas, requires one explicitly selected allowed model, derives
  the AGENT target, and rejects missing, extra, duplicate, incompatible, or
  cross-project source selections with a generic non-echoing error.
- The selection report records profile ID/version/trust, selected model and
  optional task, enabled skills, exact unique source closure, every agent/skill
  declaration owner, descriptive include/exclude selectors, profile-owned
  budgets, and an explicit non-runtime effect.
- S19-02 reuses the existing precedence composer unchanged. Every effective
  rule retains source digest, trust, scope, content, status, reason, and
  superseding reference. No caller can override the profile agent target.
- S19-03 added a transient facade envelope over the controlled profile reader,
  controlled instruction reader, immutable handoff store, instruction
  composer, and Context Builder. It builds and expands the existing schema-v2
  packet with the profile's 16,384-byte continuity and 4,096-byte instruction
  budgets in the synthetic acceptance fixture; no Context Pack schema or
  selection policy changed.
- S19-04 added the authenticated
  `POST /api/projects/:projectId/work-items/:workItemId/handoffs/:handoffId/profile-context/preview`
  route and bilingual self-guiding GUI form. The response includes safe profile
  filename/digest/bytes, full logical selection and instruction provenance,
  Context Pack accounting, and no full local path.
- S19-05 acceptance covers deterministic/shared declaration provenance, exact
  source closure, allowed-model selection, derived target/budgets, facade path
  privacy, project/handoff scope, profile digest pinning, missing sources,
  localization, interaction guidance, inert JSON rendering, HTTP controls, and
  non-persistence/delivery/execution.
- The pre-documentation quality gate passed format, lint, typecheck, composite
  build, and 182 tests including 16 loopback HTTP journeys.
- Final gates passed after `npm ci --ignore-scripts` and a clean composite
  build: format, lint, typecheck, build, 39 test files/182 tests, audit with
  zero vulnerabilities, diff check, and public path/credential scan.

## Sprint review

Sprint 19 closes the manual-copy gap between profile inspection, effective
instructions, and Context Pack preview. The user still chooses every local
input and the model explicitly, while the domain now proves that no undeclared
instruction source can influence the result and no declared source is missing.

The transient envelope avoided an unnecessary Context Pack schema v3. Profile
digest and declaration ownership sit beside the unchanged expanded schema-v2
packet, while historical Sprint 13–15 measurements and builder behavior remain
comparable. Agent identity and budgets have a single reviewed source of truth:
the profile.

This is selection for inspection, not runtime activation. Model membership is
validated but availability is unresolved; context selectors are displayed but
not interpreted; tools and skills remain declarations. No data reaches a model
or execution adapter.

## Retrospective

What worked:

- exact source-set closure provided a small, testable least-privilege boundary
  without adding a registry or dependency resolver;
- returning an application envelope preserved profile provenance without
  changing the Context Pack wire schema or measurement baselines;
- deriving agent and budgets from the validated profile eliminated ambiguous
  duplicate GUI inputs;
- reusing existing readers, composer, handoff store, and builder kept the slice
  dependency-free and provider-neutral.

What changed during implementation:

- shared instruction sources are represented once with a sorted list of every
  declaring agent or skill rather than being rejected as duplicate intent;
- model selection is mandatory and may use any allowed model; preferred-model
  order remains descriptive and never triggers automatic selection;
- the existing standalone instruction and Context Pack previews remain
  available for direct diagnosis, while the new journey adds the stricter
  profile-governed contract.

Next-increment recommendation:

- measure whether descriptive include/exclude selectors have a concrete,
  bounded consumer before defining retrieval or context-policy semantics;
- require an ADR before profile persistence, installation, signing,
  availability resolution, permission enforcement, delivery, or execution;
- keep CodeGraph and semantic/OpenSearch retrieval separate until a measured
  consumer and scale trigger justify them.
