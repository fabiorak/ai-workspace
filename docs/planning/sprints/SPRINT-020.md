# Sprint 20 — Measure Profile Context Selector Semantics

**Primary epics:** E0 — Product foundation; E5 — Instruction, Agent, and Skill Management; E6 — Context Optimization

**Milestone:** M4 controlled context beta, selector-evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 19 completed

## Sprint goal

Determine whether profile `include` and `exclude` declarations can safely and
usefully select existing handoff continuity sections through a bounded,
deterministic, read-only experiment before any production Context Builder or
policy behavior changes.

## Evidence and problem statement

Sprint 19 preserves profile context selectors but deliberately leaves them
descriptive. Treating arbitrary strings as paths, retrieval queries,
permissions, or Context Builder policy would create an implicit language with
unmeasured loss and authority.

Sprint 20 freezes one experiment-only `handoff.*` vocabulary, a non-excludable
safety floor, and exact candidate-byte measurements over the unchanged
synthetic continuity corpus. The existing Context Builder, Context Pack schema
v2, profile schema v1, historical reports, and GUI production preview remain
unchanged.

## User story

As a user reviewing a profile's context declarations, I want to see exactly
which existing handoff sections a proposed selector policy would retain or
exclude, why, and with what byte/budget effect so that no hidden retrieval or
loss policy is accepted without evidence.

## Committed backlog

### S20-01 — Freeze the experiment-only vocabulary and safety floor

- map exactly eight canonical selectors to the existing handoff sections:
  `handoff.objective`, `handoff.repository`, `handoff.selected_memory`,
  `handoff.known_failures`, `handoff.test_state`,
  `handoff.relevant_files`, `handoff.next_action`, and
  `handoff.source_references`;
- define `objective`, `repository`, `nextAction`, and `sourceReferences` as a
  non-excludable experimental safety floor;
- when `include` is empty, retain every optional section except explicit
  excludes; when non-empty, retain only explicitly included optional sections
  plus the safety floor; apply excludes only to optional sections;
- reject unknown, duplicate, overlapping, malformed, control-text, excessive,
  and attempts to exclude the safety floor without echo;
- state explicitly that selectors are not paths, globs, retrieval queries,
  tool permissions, availability declarations, or runtime policy.

### S20-02 — Project deterministic selector decisions

- project all eight sections into `SELECTED`, `EXCLUDED_NOT_INCLUDED`, or
  `EXCLUDED_BY_SELECTOR` decisions with selector, reason, trust, source count,
  exact candidate bytes, and SHA-256;
- prove selected content is byte-identical to existing Context Builder v1
  candidates and baseline ordering is unchanged;
- retain section provenance and a zero-loss safety-floor invariant;
- keep the projection in-memory and experiment-only, never valid Context
  Builder input.

### S20-03 — Measure the unchanged synthetic corpus

- cross compact, working, and extended handoffs with focused, risk-aware, and
  floor-only policies and constrained, standard, and generous budgets;
- report baseline/selected/excluded candidate bytes, byte difference,
  reduction percentage, fit before/after, section decisions, and safety-floor
  loss count;
- normalize case, selector, decision, and budget ordering deterministically;
- label exact bytes as serialized candidate content, not provider tokens,
  relevance, quality, or production Context Pack accounting;
- retain negative or no-change results and finish with accept/adapt/no-change/
  defer evidence.

### S20-04 — Deliver a bilingual read-only report

- add a typed facade method and authenticated project/Work-Item/handoff-scoped
  preview route over one explicit digest-pinned profile;
- use the profile's continuity budget and selectors without accepting caller
  budget or selector overrides;
- show safe profile identity/digest, canonical vocabulary, safety floor,
  selected/excluded sections, reasons, trust, sources, hashes, exact bytes,
  budget fit, measurement method, and experiment-only effect in English and
  Italian;
- preserve inert rendering, keyboard, semantic, narrow-viewport, body, CSRF,
  Origin, project-scope, path-privacy, and recovery contracts.

### S20-05 — Decide and close the increment

- cover byte identity, deterministic permutations, include/exclude semantics,
  safety floor, fit accounting, Unicode bytes, bounds, unknown legacy
  selectors, conflicts, corruption, scope, and non-echoing failures;
- cover facade and HTTP behavior, profile digest pinning, foreign handoff,
  English/Italian copy, no-manual guidance, and no persistence/policy change;
- record `accept`, `adapt`, `no change`, or `defer` from reproduced corpus
  evidence; write an ADR only if production semantics are accepted;
- update architecture, threat model, user guide, public design, README,
  roadmap, project plan, sprint index, and local handoff only after gates pass;
- run clean install, clean composite build, full check, audit, report
  reproduction, diff check, public scan, and isolated loopback acceptance;
- create one final Sprint 20 commit and perform no push.

## Out of scope

- changing `buildContextPack`, Context Pack schema v1/v2, candidate ordering,
  source-table accounting, persistence, delivery, or execution;
- interpreting arbitrary/legacy selector strings, paths, globs, repository
  contents, historical search, CodeGraph, semantic retrieval, or OpenSearch;
- automatic profile, handoff, source, model, agent, skill, or tool selection;
- profile schema migration, registry, install, signing, marketplace, editor, or
  remote package access;
- permission enforcement, sandbox configuration, model/tool availability,
  orchestration, behavioral grading, or network access;
- a new runtime, framework, database, service, cloud dependency, or package.

## Architecture decision

No ADR is planned before measurement. The experiment operates on immutable
in-memory handoff values and returns a measurement report. If evidence supports
production selector semantics, an ADR must separately decide vocabulary,
versioning, compatibility, safety floor, migration, and builder/GUI rollout.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The corpus reproduction uses only synthetic in-memory fixtures. HTTP acceptance
opens only `127.0.0.1` and may require execution outside the sandbox.

## Definition of done

- every accepted selector maps to exactly one existing handoff section;
- the safety floor cannot be excluded and has zero measured loss;
- projection decisions and exact candidate bytes are deterministic,
  provenance-preserving, and byte-identical to the unchanged baseline;
- corpus results compare baseline and experimental fit without production or
  relevance claims;
- arbitrary, legacy, conflicting, malformed, and oversized selectors fail
  closed without echo;
- the bilingual GUI exposes one profile-owned read-only report without caller
  policy overrides or full-path leakage;
- a documented evidence-led decision is made and production remains unchanged
  unless a separately accepted ADR authorizes rollout;
- clean-build, quality, audit, reproduction, public-safety, and GUI/HTTP gates
  pass;
- documentation is synchronized, one final commit is created, and no push is
  performed.

## Dependencies and sequencing

```text
Sprint 19 complete
  -> S20-01 vocabulary and safety floor
       -> S20-02 deterministic projection
            -> S20-03 corpus measurement
                 -> S20-04 bilingual report
                      -> S20-05 evidence-led decision and closure
```

## Risks and mitigations

| Risk                                               | Mitigation                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Arbitrary strings become hidden retrieval behavior | Accept only the explicit experiment-only `handoff.*` vocabulary                |
| Selector reduction removes resume-critical state   | Non-excludable safety floor plus zero-loss invariant                           |
| Byte savings are mistaken for context quality      | Label candidate bytes and report no relevance/quality claim                    |
| Experiment silently changes production             | Separate module/report; regression proving builder candidates unchanged        |
| Profile or local paths leak through GUI            | Reuse bounded reader; return safe filename/digest and generic errors           |
| Negative evidence is discarded                     | Preserve every profile/policy/budget observation and allow `no change`/`defer` |

## Planning decisions

- selectors map only to the eight handoff sections already owned by the
  continuity contract;
- safety-floor sections are objective, repository, next action, and source
  references because together they retain task identity, observed repository
  state, expected continuation, and provenance navigation for the experiment;
- exact bytes reuse current v1 candidate serialization because Sprint 13–15
  historical comparisons are intentionally based on byte-identical candidates;
- the profile continuity budget is the only GUI budget; corpus budgets remain
  fixed synthetic measurement inputs;
- the report is user-facing because selector loss must be inspectable, but it
  is explicitly not a production selection control;
- this commitment is preserved; execution evidence, review, retrospective, and
  the final decision will be appended without rewriting planned claims.

## Execution log

### 2026-07-13

- S20-01 froze eight exact `handoff.*` selectors and a four-section safety
  floor: objective, repository, next action, and source references. Empty
  include means all optional sections except excludes; non-empty include means
  named optional sections plus the floor. Unknown legacy strings, duplicates,
  overlaps, and floor exclusion fail with one non-echoing error.
- S20-02 added the experiment-only `projectContextSelectors` projection to
  `@ai-workspace/context-builder`. Every section records selector, selected or
  excluded status, reason, trust, source count, exact candidate bytes, and
  SHA-256. Tests prove byte identity with unchanged Context Builder v1
  candidates and zero floor loss.
- S20-03 crossed three unchanged handoff profiles with focused, risk-aware, and
  floor-only policies across three budgets: 9 cases and 27 observations.
  Ordering, permutations, bounds, Unicode bytes, corruption, circular values,
  conflicts, unknown selectors, and non-echo behavior are covered.
- Reproduced aggregate: 136,458 repeated baseline candidate bytes versus
  68,376 selected; 68,082 excluded, a 49.89% reduction. Fits increase from
  9/27 to 12/27. New standard fits are compact floor-only (2,536 bytes),
  compact focused (3,618), and working floor-only (3,074). Working focused is
  4,246 bytes; extended floor-only is 4,987 and neither fits standard.
- S20-04 added a typed facade, authenticated
  `POST /api/projects/:projectId/work-items/:workItemId/handoffs/:handoffId/context-selectors/preview`,
  and bilingual GUI report. The selected profile owns selectors and continuity
  budget; the caller cannot override them. Safe profile identity/digest,
  vocabulary, decisions, provenance, hashes, bytes, fit, interpretation, and
  experiment-only effect are visible without full paths.
- S20-05 decision is `adapt`. The deterministic vocabulary and projection are
  retained only for measurement. Production remains `no change`, no ADR is
  created, and profile selectors remain descriptive because byte/fit evidence
  does not establish relevance, correct resume quality, compatibility, or
  schema-v2 accounting.
- The pre-documentation quality gate passed format, lint, typecheck, composite
  build, 188 tests, report reproduction, and loopback HTTP acceptance.
- Final gates passed after `npm ci --ignore-scripts` and a clean composite
  build: format, lint, typecheck, build, 40 test files/188 tests, audit with
  zero vulnerabilities, isolated report reproduction, diff check, and public
  path/credential scan.

## Sprint review

Sprint 20 makes proposed selector loss inspectable without turning arbitrary
profile strings into hidden behavior. Exact one-to-one mapping and a visible
safety floor are simple to explain, deterministic under permutation, and
strict enough to reject legacy values rather than guessing their meaning.

The byte result is material but uneven. Focused selection creates a compact
standard fit, while working focused misses by 150 bytes and extended floor-only
still exceeds standard. Risk-aware policies save little because synthetic
memory/failure content dominates their profiles. Aggregate reduction repeats
handoffs across policies and cannot be treated as traffic savings.

Most importantly, the corpus measures representation and fit, not whether an
agent can resume correctly without excluded sections. Accepting production
semantics would therefore convert format evidence into an unsupported relevance
claim. The `adapt` decision preserves the experiment and report while leaving
the normal Context Builder untouched.

## Retrospective

What worked:

- reusing byte-identical historical candidates kept Sprint 13–15 comparisons
  reproducible and prevented accidental production changes;
- a non-excludable safety floor made task identity and provenance loss explicit
  and mechanically testable;
- profile-owned selectors and budget prevented the GUI report from becoming an
  undocumented policy editor;
- the bilingual report exposes negative and near-boundary cases rather than
  presenting aggregate reduction alone.

What changed during implementation:

- shared source-table bytes were deliberately excluded from the primary
  measurement to preserve historical comparability; the report labels this
  limitation instead of mixing v1 and v2 methods;
- existing profile fixture strings such as `git_diff` are rejected rather than
  adapted because they cannot be mapped losslessly to a handoff section;
- the result is `adapt`, not `accept`: no ADR or builder rollout was added.

Next-increment recommendation:

- design a bounded, model-free continuity-quality/answerability corpus that
  declares required facts or expected first actions before applying selectors;
- compare baseline and selector policies for retained required evidence before
  revisiting vocabulary or safety-floor semantics;
- include schema-v2 marginal source-table accounting only after the quality
  consumer is fixed, and require a separate ADR for any production rollout;
- keep historical/semantic retrieval, CodeGraph, permissions, and execution as
  independent evidence-led slices.
