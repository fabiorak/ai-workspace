# Sprint 14 — Measure Continuity Disclosure Granularity

**Primary epics:** E0 — Product foundation; E6 — Context Optimization

**Milestone:** M4 controlled context beta, evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 13 completed

## Sprint goal

Measure whether explicit lower-detail, lossless-resolvable representations of
handoff continuity reduce exact-byte pressure enough to justify a later
progressive-disclosure design, without changing the Context Builder, GUI,
persistence, selection policy, or execution boundary.

## Evidence and problem statement

Sprint 13 found that a 4,096-byte continuity budget retains 72.27%, 54.17%,
and 12.13% of the compact, working, and extended synthetic profiles. That
experiment measured whole handoff sections but did not distinguish value size
from the repeated trust/provenance metadata that every section carries.

Before introducing progressive disclosure, the project must measure the byte
floor of preserving metadata and explicit resolution identity. A smaller
representation is useful evidence only if it remains tied to the same immutable
handoff section, exposes trust and complete source metadata, and verifies the
full value by exact-byte digest.

## User story

As a developer evaluating continuity granularity, I want deterministic
reference, outline, and full representations of the same immutable handoff
sections so that I can see whether lower detail actually improves budget fit
without confusing omission with relevance or losing provenance.

## Committed backlog

### S14-01 — Freeze disclosure levels and invariants

- define `REFERENCE`, `OUTLINE`, and `FULL` as experiment-only levels;
- keep the complete section metadata, trust, curation, verification,
  observation, and source array explicit at every level;
- bind every lower-detail value to handoff ID, section name, full-value exact
  bytes, and SHA-256 digest;
- make `FULL` byte-identical to the current Context Builder section content;
- replace only string leaves in `OUTLINE`, retaining object/array shape and
  non-string primitives;
- make no claim that a lower-detail representation is sufficient agent context.

### S14-02 — Implement bounded provider-neutral projections

- add dependency-free in-memory projection and measurement APIs to
  `@ai-workspace/context-builder` using only Node built-ins;
- enforce bounded IDs, values, nodes, depth, representation bytes, profiles,
  budgets, and corpus size;
- reject circular, unsupported, malformed, duplicate, or oversized values
  without echoing content;
- freeze outputs and sort report profiles and budgets deterministically;
- perform no I/O, resolution, persistence, retrieval, delivery, or execution.

### S14-03 — Reuse the unchanged synthetic continuity profiles

- reuse Sprint 13 compact, working, and extended handoffs byte-for-byte in
  logical content;
- compare each profile under constrained (64), standard (4,096), and generous
  (100,000) continuity budgets for nine observations;
- measure per-section metadata floor and all three representation sizes;
- publish exact differences from `FULL`, reduction percentages, and fit counts;
- retain representations that are larger or still fail the budget.

### S14-04 — Decide whether a later representation ADR is warranted

- publish method, exact results, limitations, and reproduction command;
- distinguish value-detail savings from repeated metadata/provenance overhead;
- accept only a recommendation for a later ADR when the measured tradeoff is
  material and lossless resolution remains credible;
- prefer `no change` when lower-detail representations do not improve the
  sampled boundary;
- do not enable disclosure levels in the production builder during this sprint.

### S14-05 — Close the evidence increment

- update package, development report, architecture, threat model, public design,
  README, roadmap, project plan, sprint index, and local handoff only after
  implementation and evidence gates pass;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, and isolated report reproduction;
- create one final Sprint 14 commit and perform no push.

## Out of scope

- changing Context Pack schema, builder candidates, ordering, budgets, GUI, API,
  persistence, handoff files, instruction composition, or active memory;
- automatic level selection, upgrades, fallback, retrieval, ranking, semantic
  search, summarization, deduplication, compression, or prompt caching;
- resolving a reference from storage, exporting or delivering a pack, model or
  agent execution, permissions, privacy routing, tools, or orchestration;
- tokenizers, token-based enforcement, model grading, live agents, private
  transcripts, real repository content, telemetry, or network access;
- claiming task sufficiency, relevance, quality, latency, cost, production
  distribution coverage, E6 completion, or M4 completion.

## GUI delivery exception

This sprint is a developer-only representation experiment and public report.
It adds no routine user capability and does not change the existing bilingual
GUI preview. Any accepted disclosure control or source resolution journey must
ship through the GUI in the later implementation sprint that enables it.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check

AI_WORKSPACE_DISCLOSURE_REPORT=1 \
  node packages/context-builder/test/continuity-disclosure-measurement.test.ts
```

## Definition of done

- `FULL` matches current section content byte-for-byte for all eight sections;
- every level retains identical metadata and a verifiable immutable resolver;
- fixed inputs and permuted corpus/budgets produce identical reports;
- size totals reconcile exactly to per-section measurements;
- the nine budget observations retain positive and negative results;
- malformed, circular, duplicate, inconsistent, or oversized input fails
  closed without content echo;
- evidence supports either a bounded later ADR or an explicit `no change`;
- no production builder, GUI, persistence, or execution behavior changes;
- clean-build, quality, audit, public-safety, and reproduction gates pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 13 complete
  -> S14-01 disclosure invariants
       -> S14-02 bounded projections and measurement
            -> S14-03 unchanged synthetic corpus
                 -> S14-04 evidence decision
                      -> S14-05 closure
```

## Risks and mitigations

| Risk                                             | Mitigation                                                    |
| ------------------------------------------------ | ------------------------------------------------------------- |
| A reference is mistaken for sufficient context   | Label experiment-only and report no quality claim             |
| Lower detail silently loses provenance           | Embed identical complete metadata at every level              |
| A digest is treated as content                   | Include explicit resolver identity and full-value byte length |
| Outline overhead exceeds the original            | Retain and publish negative results                           |
| Synthetic budgets manufacture a preferred result | Reuse all Sprint 13 continuity profiles and budgets unchanged |
| Experiment leaks into product behavior           | Separate API and explicit no-builder-change effect            |

## Planning decisions

- `REFERENCE` contains metadata plus immutable section resolution identity;
- `OUTLINE` adds value structure and string-leaf digests but not string content;
- `FULL` remains the current `JSON.stringify(section)` content;
- exact UTF-8 representation bytes are primary; token estimates are not needed
  because this sprint compares representations rather than model billing;
- a level fits only when all eight section representations fit the named budget;
- source metadata is intentionally repeated so the experiment measures the
  current safety floor rather than pre-authorizing provenance normalization;
- this commitment is preserved; execution evidence, review, and retrospective
  are appended instead of rewriting the planned claims.

## Execution log

### 2026-07-13

- S14-01 froze `REFERENCE`, `OUTLINE`, and byte-identical `FULL` levels with
  complete metadata and SHA-256-bound immutable section resolution identity.
- S14-02 added bounded, deeply immutable, provider-neutral projection and
  measurement APIs. They reject invalid IDs, duplicate profiles/budgets,
  excessive sources, depth, nodes, values, representations, circular data, and
  unsupported values without echoing content.
- S14-03 reused the unchanged compact, working, and extended continuity
  profiles and 64/4,096/100,000-byte budgets for nine observations. `FULL`
  matches all current Context Builder candidates exactly.
- S14-04 measured a constant 3,816-byte metadata-only encoding floor.
  `REFERENCE` measures 5,386/5,390/5,402 bytes, changing compact by -9.34%,
  working by +28.70%, and extended by +83.63% versus full. `OUTLINE` changes
  them by -86.09%, -72.31%, and +13.72% respectively.
- No level improves the sampled standard-budget boundary: each fits only the
  three generous observations. Production therefore accepts `no change`;
  reference and outline remain experiment-only and the GUI is unchanged.
- S14-05 passed clean install, clean composite build, format, lint, typecheck,
  build, 153 tests, audit with zero vulnerabilities, report reproduction,
  diff check, and public-path/credential scans.

## Sprint review

Sprint 14 separates value-detail savings from the safety metadata floor. The
reference representation materially reduces large memory-heavy sections, but
its approximately 5.4 KB total remains above the 4,096-byte standard budget.
For compact content it is larger than full because immutable resolution
identity costs more than the removed values.

The generic outline is not viable for these samples. Per-string digest and
structure overhead makes it 86.09% larger than compact full and 72.31% larger
than working full; even its 13.72% extended reduction does not change the fit
boundary. Publishing those regressions prevents progressive disclosure from
being accepted merely because it sounds directionally appropriate.

All production behavior remains unchanged. The experimental APIs perform no
storage resolution, selection, persistence, delivery, model call, or agent
execution and are not wired into the GUI or Context Builder candidates.

## Retrospective

What worked:

- exact byte identity against current candidates kept the baseline honest;
- reusing Sprint 13 profiles and budgets prevented post-result corpus tuning;
- repeating complete metadata exposed the actual safety floor instead of
  hiding it behind a prematurely normalized format;
- section-level negative results distinguished large-value wins from small-
  value regressions.

What changed during implementation:

- projection outputs now deep-freeze copied metadata and canonical sources;
- bounds cover source counts and serialized values in addition to corpus,
  budget, depth, node, and representation limits;
- no ADR was created because no representation was accepted for production.

Next-increment recommendation:

- plan an ADR comparing repeated section metadata, a packet-level lossless
  metadata/provenance table with explicit references, and `no change`;
- require permanent section trust, source navigation, deterministic encoding,
  malformed-reference rejection, and current builder compatibility;
- do not assume the persisted handoff v2 decision automatically applies to a
  temporary Context Pack;
- keep disclosure levels, retrieval, resolution, GUI controls, persistence,
  delivery, and execution outside that decision sprint unless separately
  accepted from evidence.
