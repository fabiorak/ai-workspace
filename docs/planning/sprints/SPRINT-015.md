# Sprint 15 — Decide the Context Pack Metadata Envelope

**Primary epics:** E0 — Product foundation; E6 — Context Optimization

**Milestone:** M4 controlled context beta, architecture decision increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 14 completed

## Sprint goal

Decide, from exact reproducible evidence, whether temporary Context Pack
continuity should keep complete metadata embedded in every section or adopt a
lossless shared packet-level metadata/provenance envelope, without enabling a
new writer, disclosure policy, resolver, GUI control, or execution path.

## Evidence and problem statement

Sprint 14 measured a constant 3,816-byte metadata-only encoding across eight
continuity sections. Experiment-only resolvable references remained between
5,386 and 5,402 bytes and therefore did not fit the 4,096-byte standard budget,
even when large values were removed. Generic outlines were worse for compact
and working profiles. Production correctly accepted `no change`.

The remaining measured unknown is representation duplication. Every section
must retain origin, trust, curation, verification, observation, and complete
canonical source identity, but those facts need not necessarily be serialized
in full at every occurrence. ADR-0013 normalized persisted handoff provenance,
yet that E4 decision does not automatically apply to temporary E6 Context
Packs with different lifecycle, budget, and consumption boundaries.

## User story

As an architecture reviewer, I want exact before/after measurements and
lossless trust/source equivalence for each metadata-envelope alternative so
that I can accept a Context Pack representation deliberately or retain the
current format without weakening provenance.

## Committed backlog

### S15-01 — Freeze decision scope and invariants

- keep the logical handoff, Context Pack candidates, section order, budgets,
  trust vocabulary, source values, and Sprint 13/14 corpus unchanged;
- define canonical metadata identity as the complete origin, trust, curation,
  verification, observation, and ordered canonical source values;
- require lossless expansion to the current logical section shape;
- separate a temporary Context Pack representation from persisted handoff v2;
- preserve the existing builder and GUI until a later contract-gated rollout.

### S15-02 — Compare three bounded representation alternatives

- measure the current fully embedded metadata baseline;
- prototype a packet-level canonical source table while leaving section trust
  and other metadata inline;
- prototype a packet-level canonical metadata table whose entries retain all
  metadata fields and reference canonical source-table entries;
- use deterministic identifiers and ordering independent of input occurrence
  order;
- report exact UTF-8 bytes, change from baseline, standard-budget fit, table
  counts, and negative results for compact, working, and extended profiles;
- keep prototypes experiment-only and in memory.

### S15-03 — Prove lossless trust and provenance contracts

- expand every alternative back to the current logical section metadata and
  prove deep equality;
- preserve section-specific trust even when sources are shared;
- preserve complete `WorkItemSource` fields, navigation identity, order, and
  explicitly defined multiplicity;
- reject dangling, duplicate, unreferenced, noncanonical, malformed,
  cross-scope, inconsistent, and oversized table entries or references;
- prove stable bytes under permuted source occurrences and metadata input;
- fail closed without echoing source or section content.

### S15-04 — Record ADR-0016 before any production change

- compare embedded metadata, source-table normalization, full metadata-table
  normalization, and `no change`;
- accept an alternative only when exact evidence is material and all lossless,
  trust, navigation, determinism, scope, and corruption contracts are credible;
- document Context Pack schema/version implications and backward compatibility;
- if an alternative is accepted, freeze contract-test prerequisites for a
  later implementation sprint;
- leave the production builder/writer unchanged throughout Sprint 15.

### S15-05 — Close the decision increment

- publish method, exact results, ADR decision, limitations, review, and
  retrospective;
- update ADR index, package documentation, architecture, threat model, public
  design, README, roadmap, project plan, sprint index, and local handoff;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, and isolated comparison reproduction;
- create one final Sprint 15 commit and perform no push.

## Out of scope

- enabling a normalized Context Pack writer or reader in production;
- changing builder candidates, whole-item budgets, omission behavior, section
  order, handoff persistence, instruction composition, active memory, HTTP API,
  GUI, or CLI;
- enabling Sprint 14 `REFERENCE` or `OUTLINE` levels;
- automatic selection, disclosure upgrades, source resolution, historical or
  semantic retrieval, ranking, summarization, deduplication of user content,
  compression, diff-first context, or prompt/response caching;
- Context Pack persistence, export, delivery, model or agent execution,
  permissions, privacy routing, tools, orchestration, or worktrees;
- tokenizers, token-based enforcement, model grading, private transcripts,
  real repository content, telemetry, network access, or M4 completion.

## GUI delivery exception

Sprint 15 is an architecture-decision and developer-measurement increment. It
changes no routine user behavior, so the current bilingual GUI remains
unchanged. A later sprint that enables a new representation, disclosure, or
resolution behavior must include the complete GUI journey or record a new
reviewed exception.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check

# The exact isolated comparison command is frozen with S15-02 implementation.
AI_WORKSPACE_METADATA_ENVELOPE_REPORT=1 \
  node packages/context-builder/test/metadata-envelope-measurement.test.ts
```

## Definition of done

- all three representations use the unchanged logical inputs and corpus;
- exact-byte categories reconcile to each complete representation;
- every prototype expands losslessly to current metadata and source values;
- trust, source navigation, ordering, multiplicity, scope, and bounds are
  explicit and tested;
- permuted equivalent inputs produce byte-identical encodings;
- malformed or inconsistent references fail closed without content echo;
- ADR-0016 records one accepted alternative or an evidence-backed `no change`;
- production builder, GUI, persistence, delivery, and execution remain
  unchanged;
- clean-build, quality, audit, public-safety, and reproduction gates pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 14 complete
  -> S15-01 invariant and alternative freeze
       -> S15-02 exact-byte representation spike
            -> S15-03 lossless/adversarial contracts
                 -> S15-04 ADR-0016 decision
                      -> S15-05 closure
```

## Risks and mitigations

| Risk                                       | Mitigation                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Handoff v2 is copied without E6 review     | Treat it only as prior evidence; compare Context Pack alternatives independently |
| Normalization hides section trust          | Keep trust in canonical metadata identity and prove per-section expansion        |
| Shared tables weaken navigation            | Retain every source field and test logical/navigation equivalence                |
| Compact samples regress                    | Publish all profiles and allow `no change`                                       |
| ADR silently enables production            | Freeze later contract gates and leave current writer unchanged                   |
| Representation work expands into retrieval | Keep selection, disclosure, resolution, delivery, and execution out of scope     |

## Planning decisions

- exact UTF-8 representation bytes remain the primary decision unit;
- savings alone cannot justify a format without lossless trust/provenance
  equivalence and fail-closed decoding;
- source-only and full-metadata tables are distinct alternatives rather than
  implementation steps of one presumed solution;
- `no change` is a successful Sprint 15 outcome;
- a decision to normalize authorizes only later contract work, not rollout;
- no new dependency, runtime, service, database, network access, or persisted
  migration is planned;
- this commitment is preserved; evidence, decision, review, and retrospective
  are appended without rewriting the planned claims.

## Execution log

### 2026-07-13

- S15-01 froze the unchanged Sprint 13/14 logical handoffs, eight-section
  order, canonical source fields, trust vocabulary, and 64/4,096/100,000-byte
  budgets. Production builder candidates and GUI behavior remain unchanged.
- S15-02 added a dependency-free experiment-only in-memory API comparing exact
  current embedded candidates, a scope-bound source table, and a source plus
  full-metadata table. SHA-256 IDs and table/reference ordering derive from
  complete canonical values rather than occurrence order.
- The embedded baseline measures 4,926/7,560/33,000 bytes. Source-table results
  are 3,517/6,151/31,592, reductions of 1,409/1,409/1,408 bytes or
  28.60%/18.64%/4.27%. Compact gains the only new standard-budget fit with 579
  bytes spare.
- Full metadata-table results are 4,165/6,799/32,241. They save only
  761/761/759 bytes, remain 648/648/649 bytes larger than the source-table
  alternative, and change no sampled fit boundary.
- S15-03 proves current-candidate byte identity, lossless deep expansion,
  section-specific trust, complete source navigation, canonical unique-set
  multiplicity, permutation stability, exact reconciliation, and generic
  failure without content echo. Dangling, duplicate, unreferenced,
  noncanonical, malformed, cross-scope, inconsistent, and oversized cases are
  rejected.
- S15-04 records ADR-0016. It accepts the source table as a future versioned
  schema direction, rejects the full metadata table, and retains `no change`
  for current production behavior until later writer, reader, facade, and GUI
  compatibility contracts pass.
- S15-05 passed clean install, clean composite build, format, lint, typecheck,
  build, 160 tests, audit with zero vulnerabilities, isolated report
  reproduction, diff check, and public path/credential scans.

## Sprint review

Sprint 15 resolves the metadata-duplication unknown without borrowing the
persisted-handoff decision automatically. The source-table result is material
for compact and working continuity and changes one mechanical boundary while
retaining every trust and source field. Its percentage benefit falls to 4.27%
for extended content because section values, rather than metadata, dominate.

The full metadata table demonstrates a useful negative result. Five distinct
metadata identities across eight sections leave too little repetition to
repay its second table and longer section references. It adds decoder
complexity, saves less in every profile, and misses compact standard by 69
bytes.

No user behavior changes. The production builder still emits the embedded
schema-v1 candidates; the experiment performs no I/O, resolution, persistence,
delivery, model call, or execution and is not reachable from HTTP or the GUI.

## Retrospective

What worked:

- preserving byte identity with current candidates kept the baseline directly
  comparable to Sprints 13 and 14;
- category reconciliation exposed table overhead instead of reporting only
  favorable net savings;
- writing adversarial expansion contracts before ADR acceptance kept trust,
  navigation, scope, bounds, and failure behavior in the decision;
- retaining the full metadata-table negative result prevented a broader
  normalization from being selected by analogy with handoff v2.

What changed during implementation:

- multiplicity is explicitly a canonical unique set per section; duplicate
  references fail closed rather than being silently collapsed;
- source and metadata IDs use complete-value SHA-256 identities so occurrence
  permutation cannot influence output bytes;
- the future rollout gate now includes facade and GUI compatibility, not only
  a codec writer/reader change.

Next-increment recommendation:

- plan a separate rollout sprint only if the product priority still favors
  this bounded compact-fit improvement;
- retain schema-v1 reads and embedded candidate byte identity while adding an
  explicit new schema version and the complete ADR-0016 contract suite;
- do not combine rollout with progressive disclosure, retrieval, resolution,
  persistence, delivery, or execution.
