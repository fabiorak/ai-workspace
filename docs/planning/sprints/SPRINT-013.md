# Sprint 13 — Measure Context Pack Budget Pressure

**Primary epics:** E0 — Product foundation; E6 — Context Optimization

**Milestone:** M4 controlled context beta, evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 12 completed

## Sprint goal

Measure how deterministic synthetic Context Packs behave across bounded
continuity, instruction, and budget profiles so that the next E6 mechanism is
selected from exact, reproducible evidence instead of assuming that retrieval,
deduplication, progressive disclosure, or compression is needed.

## Evidence and problem statement

Sprint 12 proved deterministic whole-item inclusion under separate exact-byte
budgets, but its three contract tests do not describe a workload distribution.
The project therefore cannot yet tell which category experiences pressure,
how often packs fully or partially fit, or whether omitted bytes are material
enough to justify another optimization mechanism.

The experiment measures content bytes that are candidates for model context.
It does not treat the serialized GUI preview envelope as model input and does
not claim provider token counts, quality, latency, cost, or task success.

## User story

As a developer evaluating the Context Builder, I want a public-safe corpus and
an exact-byte pressure report so that I can choose the next bounded experiment
without silently dropping provenance or manufacturing an optimization claim.

## Committed backlog

### S13-01 — Freeze measurement contracts and decision rules

- distinguish candidate, included, and omitted content bytes per category;
- report full, partial, and no-fit outcomes without assigning quality scores;
- summarize deterministic minimum, median, p90, and maximum included bytes;
- aggregate retention and samples-with-omissions for continuity and
  instructions separately;
- keep token values secondary and explicitly estimated with `ceil(bytes / 4)`;
- sort labels and dimension keys deterministically and reject malformed,
  duplicate, inconsistent, empty, or oversized corpus input.

### S13-02 — Add provider-neutral corpus measurement

- extend `@ai-workspace/context-builder` with an in-memory, dependency-free
  measurement function over already-built previews;
- verify preview schema, effect, category accounting, item identities, budgets,
  byte lengths, totals, and scope before reporting;
- expose a schema-versioned immutable report with exact-byte decision method;
- perform no retrieval, persistence, network access, model call, execution, or
  automatic policy change.

### S13-03 — Build a deterministic synthetic 3 × 3 × 3 corpus

- vary compact, working, and extended handoff content independently from none,
  focused, and broad effective-instruction profiles;
- apply constrained, standard, and generous category budgets to every content
  combination for 27 stable samples;
- author all identifiers, timestamps, paths, rules, and content from scratch;
- retain negative and partial-fit samples instead of tuning inputs to produce a
  preferred result;
- make the exact report reproducible from the automated test suite.

### S13-04 — Publish results and make only an evidence-supported recommendation

- publish the corpus construction, exact values, category pressure, fit counts,
  distributions, limitations, and reproduction command;
- state explicitly whether the evidence supports a narrower follow-up
  experiment or `no change`;
- require a later ADR before changing context selection, representation,
  persistence, runtime, or dependencies;
- do not implement the recommended mechanism in this sprint.

### S13-05 — Close the evidence increment

- update package, architecture, public design, project plan, sprint index,
  README, development documentation, and local handoff only after the report
  and gates pass;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, and the isolated report reproduction;
- create one final Sprint 13 commit and perform no push.

## Out of scope

- automatic retrieval or selection, historical or semantic search inside the
  builder, embeddings, ranking, summarization, deduplication, compression,
  progressive disclosure, diff-first context, prompt or response caching;
- Context Pack persistence, export, delivery, execution, model access, agent
  routing, permissions, privacy policy, tools, orchestration, or worktrees;
- tokenizers, token-based enforcement, model grading, live agents, real or
  private transcripts, telemetry, or network access;
- changing handoff, instruction, active-memory, or persisted storage schemas;
- claiming M4 completion or general production workload coverage.

## GUI delivery exception

This sprint adds a developer-facing measurement and public report, not a new
routine user capability. No GUI surface is added. The existing GUI Context Pack
preview remains unchanged and primary for the Sprint 12 user journey. Any
future user-facing selection or optimization control must include GUI delivery
in its committed sprint.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check

AI_WORKSPACE_CONTEXT_REPORT=1 \
  node packages/context-builder/test/context-builder-measurement.test.ts
```

## Definition of done

- the 27-sample corpus and report are byte-for-byte reproducible;
- every aggregate reconciles exactly to its sample measurements;
- input permutation does not change report ordering or values;
- malformed or inconsistent previews fail closed without echoing content;
- exact content bytes remain the decision unit and tokens remain estimates;
- results include full, partial, negative, and category-empty observations;
- documentation states limitations and does not pre-authorize an optimization;
- clean-build, quality, audit, public-safety, and reproduction gates pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 12 complete
  -> S13-01 measurement contracts
       -> S13-02 provider-neutral measurement
            -> S13-03 deterministic synthetic corpus
                 -> S13-04 evidence and recommendation
                      -> S13-05 closure
```

## Risks and mitigations

| Risk                                           | Mitigation                                                |
| ---------------------------------------------- | --------------------------------------------------------- |
| Synthetic inputs manufacture a desired answer  | Freeze orthogonal profiles and retain every combination   |
| Preview envelope is confused with sent context | Measure and label candidate content bytes only            |
| Exact bytes are confused with model tokens     | Keep tokens secondary and label the estimate method       |
| Omission rate is mistaken for context quality  | Report pressure, not relevance, sufficiency, or success   |
| Measurement silently becomes selection policy  | No builder behavior change; later ADR and sprint required |
| Developer tooling bypasses GUI-first direction | Record a bounded non-user-facing GUI exception            |

## Planning decisions

- exact UTF-8 content bytes are the primary measurement unit;
- corpus dimensions are content shape and explicit budgets, not provider or
  model identity;
- full fit means no candidate item was omitted; partial and no fit are purely
  mechanical budget outcomes;
- category retention is `included / candidate`, and is `null` when a category
  has no candidates;
- percentile selection uses deterministic nearest-rank values over sorted
  exact included-byte totals;
- this commitment is preserved; execution evidence, review, and retrospective
  are appended rather than rewriting the planned claims.

## Execution log

### 2026-07-13

- S13-01 froze exact candidate/included/omitted content-byte contracts,
  mechanical fit states, category aggregates, nearest-rank distributions,
  deterministic normalization, and explicitly estimated tokens.
- S13-02 added the dependency-free `measureContextPackCorpus` API over
  validated read-only previews. It rejects empty, duplicate, inconsistent,
  control-bearing, oversized, or malformed measurements without echoing item
  content and cannot change builder behavior.
- S13-03 built the authored synthetic 3 × 3 × 3 corpus. Its 27 samples produce
  9 full-fit, 9 partial-fit, and 9 no-fit outcomes without changing inputs
  after observation.
- S13-04 measured 409,374 continuity candidate bytes with 237,939 omitted and
  108,216 instruction candidate bytes with 61,008 omitted across all budget
  profiles. Standard-budget retention is 72.27%, 54.17%, and 12.13% for
  compact, working, and extended continuity; focused instructions retain 100%
  and broad instructions 18.72%.
- S13-04 recommends only a later bounded experiment on continuity granularity
  and progressive disclosure. No retrieval, ranking, summarization,
  deduplication, compression, policy, format, GUI, persistence, or execution
  change was accepted.
- S13-05 passed clean install, clean composite build, format, lint, typecheck,
  build, 146 tests, audit with zero vulnerabilities, report reproduction,
  diff check, and public-path/credential scans.

## Sprint review

Sprint 13 turns the first Context Builder boundary into a reproducible pressure
experiment. The public report distinguishes source content from report
envelopes, reconciles every aggregate, retains category-empty and no-fit
samples, and labels token estimates without using them as enforcement.

The standard profile shows materially different mechanical outcomes as content
grows: focused instructions fit while broad instructions do not, and extended
continuity omits 28,996 exact bytes under a 4,096-byte category budget. This is
evidence of granularity pressure, not evidence that omitted content is
irrelevant or that a task would succeed with the retained subset.

The builder and GUI remain unchanged. The measurement API is developer-facing,
in-memory, provider-neutral, deterministic, bounded, and non-executing.

## Retrospective

What worked:

- separating content bytes from serialized report bytes prevented an inflated
  context-cost claim;
- crossing orthogonal content and budget profiles retained positive, partial,
  negative, and empty-category observations;
- validating already-built previews kept measurement separate from selection;
- publishing exact standard-profile results made the next unknown concrete.

What changed during implementation:

- the report sorts both sample labels and dimension keys so corpus permutation
  cannot change output;
- runtime validation was extended to bound item bytes and budgets in addition
  to sample and item counts;
- no ADR was created because the sprint accepted no architecture or behavior
  change.

Next-increment recommendation:

- plan a bounded experiment comparing current whole continuity sections with
  explicit lossless lower-detail representations;
- preserve provenance, trust, deterministic ordering, visible omissions, and
  the current read-only GUI boundary;
- do not add historical retrieval, semantic ranking, summarization,
  deduplication, compression, delivery, or execution until separate evidence
  and an ADR justify them.
