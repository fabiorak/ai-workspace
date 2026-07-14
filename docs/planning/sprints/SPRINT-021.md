# Sprint 21 — Measure Selector Continuity Evidence Retention

**Primary epics:** E0 — Product foundation; E5 — Instruction, Agent, and Skill Management; E6 — Context Optimization

**Milestone:** M4 controlled context beta, continuity-evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 20 completed

## Sprint goal

Determine whether the experiment-only `handoff.*` selector policies from
Sprint 20 preserve the exact evidence needed to answer predeclared continuity
questions and identify the expected first action, while measuring their real
Context Pack schema-v2 byte effect—without model grading, production policy,
delivery, or execution.

## Evidence and problem statement

Sprint 20 reduced repeated historical candidate bytes by 49.89% and improved
budget fit from 9/27 to 12/27 observations, but correctly stopped at `adapt`:
byte reduction does not prove that an agent can resume a task correctly. Its
v1-compatible candidate sum also excludes the marginal shared-source-table
cost used by the production schema-v2 builder.

Sprint 21 freezes a bounded synthetic consumer before applying selectors. Each
scenario declares exact answer anchors, supporting sections and source IDs, and
one expected first action. A deterministic evaluator then measures whether the
selected projection still contains that evidence byte-for-byte. This is an
evidence-retention proxy, not semantic understanding or behavioral quality.

## User story

As a product reviewer deciding whether selector semantics deserve an ADR, I
want reproducible evidence showing which predeclared continuity facts and
sources survive each policy, together with exact schema-v2 bytes, so that
format savings cannot be mistaken for safe task resumption.

## Committed backlog

### S21-01 — Freeze the model-free continuity manifest

- define an experiment-only schema for a scenario ID, pinned handoff digest,
  bounded exact-answer anchors, supporting section, required source IDs, and
  one expected first action;
- require every answer to occur exactly once in its declared section and not
  in any other section before selection is measured;
- require the expected first action to match the canonical `nextAction`
  content and every required source to be navigable through section metadata
  and `sourceReferences`;
- require at least one optional-section answer per scenario, cover every
  optional handoff section as both required and non-required across the corpus,
  and reject empty, duplicate, ambiguous, cross-scoped, stale-digest,
  malformed, control-text, or oversized manifests without echo;
- keep prompts and answers unequivocally synthetic and authored before policy
  projection.

### S21-02 — Evaluate exact evidence retention deterministically

- evaluate the unchanged baseline and each Sprint 20 selector projection
  without invoking a model, agent, tool, search, or heuristic matcher;
- report every anchor as `RETAINED` or `EXCLUDED_WITH_SECTION`, with section,
  selector decision, exact-answer SHA-256, source coverage, and non-echoing
  reason;
- report required-answer recall, expected-first-action retention, required
  source coverage, selected relevant-section count, selected excess-section
  count, and critical miss count using integer counts before percentages;
- treat a candidate policy as corpus-preserving only when required-answer,
  first-action, and required-source retention are all 100%, with zero digest
  mismatch and zero critical miss;
- label the result as exact evidence availability, never answer correctness,
  relevance ranking, comprehension, or resume success.

### S21-03 — Measure the bounded corpus and schema-v2 accounting

- author six distinct synthetic continuation scenarios covering diagnostic,
  regression, migration, refactor, security, and release intents;
- cross each scenario with the unchanged focused, risk-aware, and floor-only
  policies for 18 policy observations, alongside one full baseline per
  scenario;
- preserve the constrained, standard, and generous budgets for 54 policy
  budget observations and report both historical v1 candidate sums and exact
  schema-v2 serialized continuity bytes;
- account deterministically for the marginal canonical source-table union of
  the selected sections and prove lossless expansion, source navigation,
  ordering, byte counts, and SHA-256 identities;
- retain every negative, no-change, and near-boundary result and never rewrite
  the Sprint 20 corpus or its historical measurement method.

### S21-04 — Publish a reproducible development report

- expose one deterministic in-memory report and isolated reproduction command
  over repository-owned synthetic fixtures only;
- document scenario coverage, manifests, policy results, retained and missing
  evidence, first-action and source coverage, v1/v2 byte accounting, budget
  fit, limitations, and interpretation;
- make the report stable under scenario, anchor, source, selector, and budget
  permutations;
- keep the existing bilingual user-facing selector preview unchanged: this
  fixed evaluation corpus is development evidence, not a user control or a
  profile-quality score;
- introduce no persisted evaluation, local manifest reader, upload, API, GUI
  input, telemetry, or external fixture.

### S21-05 — Decide and close the increment

- cover exact-answer uniqueness, optional-section coverage, first action,
  source navigation, digest pinning, deterministic permutations, Unicode
  bytes, bounds, corruption, ambiguity, and non-echoing failures;
- record `accept candidate`, `adapt`, `no change`, or `defer` separately for
  evidence-retention semantics and schema-v2 fit; do not infer production
  authorization from a synthetic pass;
- write no rollout ADR in this sprint; if evidence supports a task-independent
  production policy, recommend a separate ADR for vocabulary/versioning,
  compatibility, safety floor, profile migration, and builder/GUI rollout;
- update architecture, threat model, development guide, public design, README,
  roadmap, project plan, sprint index, and local handoff only after gates pass;
- run clean install, clean composite build, full check, audit, report
  reproduction, diff check, public scan, and any unchanged loopback acceptance;
- create one final Sprint 21 commit and perform no push.

## Out of scope

- semantic, fuzzy, embedding, LLM, human, or agent grading of answers;
- claiming task success, comprehension, relevance, precision, recall beyond the
  declared exact anchors, or generalization outside the synthetic corpus;
- changing profile schema v1, Context Pack schema v1/v2, `buildContextPack`,
  production candidate order, selector behavior, safety floor, or GUI preview;
- automatic profile, handoff, policy, source, model, agent, skill, tool, or
  context selection;
- persistence, delivery, execution, orchestration, permissions, sandboxing,
  model/tool availability, registry, installation, signing, or marketplace;
- historical or semantic retrieval, CodeGraph, OpenSearch, summarization,
  compression, deduplication, network access, or private/real transcripts;
- a new runtime, framework, database, service, cloud dependency, or package.

## Architecture decision

No ADR is planned. The evaluator and schema-v2 accounting remain bounded,
in-memory measurement code over synthetic handoffs. Even a corpus-preserving
result is only evidence for a later decision; production vocabulary,
compatibility, policy, and rollout require a separate ADR.

If implementation requires a persisted schema, user-supplied manifest,
production builder change, runtime, dependency, network boundary, or execution
path, stop and re-plan rather than expanding this sprint implicitly.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The report reproduction uses repository-owned synthetic fixtures only. Existing
HTTP acceptance may open only `127.0.0.1` and can require execution outside the
sandbox.

## Definition of done

- six predeclared synthetic manifests are digest-pinned, bounded, unambiguous,
  source-navigable, and exercise every optional section as required and
  non-required;
- baseline and 18 selector-policy observations deterministically report exact
  evidence, first-action, source, selection, v1 candidate, and schema-v2 byte
  outcomes;
- corpus-preserving status requires 100% retention and zero critical or digest
  failure, with no weighted or model-derived score;
- schema-v2 accounting includes the exact marginal shared-source-table cost and
  expands losslessly without changing production code;
- negative results and measurement limitations remain visible and historical
  Sprint 20 evidence remains unchanged;
- no GUI, API, persistence, delivery, execution, or production selector change
  is introduced;
- clean-build, quality, audit, reproduction, public-safety, and regression
  gates pass;
- documentation is synchronized, one final commit is created, and no push is
  performed.

## Dependencies and sequencing

```text
Sprint 20 complete (`adapt`, production no change)
  -> S21-01 predeclared continuity manifests
       -> S21-02 deterministic evidence evaluator
            -> S21-03 corpus plus schema-v2 accounting
                 -> S21-04 reproducible development report
                      -> S21-05 evidence-led decision and closure
```

## Risks and mitigations

| Risk                                                   | Mitigation                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Ground truth is chosen after seeing policy output      | Pin manifests and handoff digests before projection                                  |
| Section retention is presented as actual understanding | Label exact evidence availability and prohibit behavioral claims                     |
| Safety floor makes every scenario trivially pass       | Require optional-section anchors and balanced required/non-required coverage         |
| Synthetic answers match the wrong section              | Require one exact occurrence in the declared section and zero elsewhere              |
| v1 and v2 byte methods are mixed                       | Report both separately and include marginal source-table bytes only in v2 accounting |
| A passing corpus silently enables production           | Require a later ADR and preserve normal selector/builder behavior                    |
| Real data or paths enter public fixtures               | Repository-owned synthetic canaries plus public path/credential scan                 |

## Planning decisions

- an anchor is an exact, uniquely located synthetic answer plus declared
  supporting section and required sources; it is intentionally not a semantic
  question-answer benchmark;
- the six intents force task-dependent relevance while keeping the corpus
  reviewable within one sprint;
- focused, risk-aware, and floor-only remain unchanged so Sprint 20 policy
  comparisons stay meaningful;
- baseline results are computed for each scenario but policy-quality counts
  use 18 observations; budget comparisons use 54 policy observations;
- schema-v2 accounting follows manifest freeze and evaluator validation so
  representation data cannot define the quality consumer retroactively;
- no GUI is planned because the fixed synthetic corpus is development
  evidence, not user-facing product behavior; the existing bilingual selector
  preview remains the user-visible boundary;
- this commitment is preserved; execution evidence, review, retrospective, and
  the final decision will be appended without rewriting planned claims.

## Execution log

### 2026-07-14

- S21-01 added six repository-owned synthetic handoffs and manifest schema v1
  for diagnostic, regression, migration, refactor, security, and release
  continuations. Each manifest pins the full handoff SHA-256, exact unique
  answers, supporting sections, canonical source IDs, and the exact first
  action before policy projection.
- Optional-section coverage is balanced: selected memory, known failures, test
  state, and relevant files are each required and non-required across the
  corpus. Stale digest, ambiguous answer, missing navigation, scope mismatch,
  controls, duplicate, malformed, circular, and oversized input fail closed
  without echo.
- S21-02 added deterministic baseline and selector evaluation. Six baselines
  retain 100% of answers, first actions, and sources. Across 18 policy
  observations, floor-only retains 0/9 answers and 0/15 sources, focused 5/9
  and 9/15, and risk-aware 7/9 and 13/15. All policies retain 6/6 first actions;
  critical misses are 24, 10, and 4 respectively. No policy is
  corpus-preserving and digest mismatch is zero.
- S21-03 preserves historical v1 candidate sums while measuring normalized
  schema-v2 section content plus the exact marginal source-table union. Six
  baselines total 60,071 v1 and 58,533 v2 bytes. The 18 policies total 139,298
  v1 and 138,310 v2 bytes. Baseline and policy fit are both 18/54 under both
  methods: only generous budgets fit.
- Contract tests prove exact agreement with production schema-v2 accounting
  for complete baselines, lossless expansion, source navigation, canonical
  SHA-256 IDs/order, Unicode byte counts, deterministic permutations, and
  non-echoing failures. Production builder, schemas, selector projection, and
  bilingual preview remain unchanged.
- S21-04 publishes the isolated in-memory reproduction and development report.
  There is no manifest reader, upload, API, GUI input, persistence, telemetry,
  model, agent, retrieval, delivery, or execution surface.
- S21-05 decisions are `no change` for evidence-retention semantics and `no
change` for schema-v2 fit. No rollout ADR is created.
- The pre-documentation gate passed format, lint, typecheck, composite build,
  41 test files/197 tests, report reproduction, and unchanged loopback HTTP
  acceptance outside the sandbox.
- Final gates passed after `npm ci --ignore-scripts` and a clean composite
  build: format, lint, typecheck, build, 41 test files/197 tests, audit with
  zero vulnerabilities, isolated report reproduction, diff check, and public
  path/credential scan.

## Sprint review

Freezing exact consumers before projection exposed the limitation that the
Sprint 20 byte experiment could not measure. The four-section floor preserves
every expected first action and the source-reference list, but cannot preserve
task-dependent evidence stored in optional sections. Focused is complete only
for the regression and release scenarios; risk-aware is complete for
diagnostic, refactor, security, and release. Neither generalizes across the six
predeclared intents.

Schema-v2 accounting also changes the interpretation of raw candidate savings.
Canonical sharing makes most projections smaller than embedded v1 candidates,
while floor-only is 534 bytes larger because packet-level source-table cost is
not free at narrow selections. Despite those differences, no sampled fit
boundary changes. The result supports keeping both accounting methods visible,
not accepting a production policy.

## Retrospective

What worked:

- digest pinning and exact-answer uniqueness prevented results from defining
  ground truth retroactively;
- balanced optional-section requirements made the safety-floor limitation
  observable rather than trivially passing;
- integer counts before percentages exposed answer and source misses clearly;
- comparison with the unchanged production builder verified v2 accounting
  without changing or invoking it for selector projection.

What changed during implementation:

- shared sources were included across section metadata to exercise real
  marginal table union and deduplication rather than a one-source toy case;
- every candidate policy failed corpus preservation, so evidence semantics use
  `no change` rather than `accept candidate` or `adapt`;
- v2 accounting changed exact bytes but not fit, producing an independent `no
change` fit decision.

Next-increment recommendation:

- do not tune another generic selector policy against this fixed corpus;
- if production selection remains a priority, first propose new
  task-independent policy semantics and predeclare a broader consumer corpus;
- require a separate ADR for selector vocabulary/versioning, compatibility,
  safety-floor behavior, profile migration, and builder/GUI rollout;
- keep retrieval, CodeGraph, semantic/OpenSearch, permissions, delivery, and
  execution as separate evidence-led slices.
