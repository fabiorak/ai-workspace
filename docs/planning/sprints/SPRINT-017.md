# Sprint 17 — Roll Out the Context Pack Source Table

**Primary epics:** E0 — Product foundation; E6 — Context Optimization

**Milestone:** M4 controlled context beta, compatibility increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 16 completed; ADR-0016 accepted

## Sprint goal

Roll out the ADR-0016 source-table representation as an explicit Context Pack
schema v2 in the read-only bilingual preview, while preserving lossless source
navigation, schema-v1 compatibility, deterministic whole-item budgeting, and
the absence of persistence, delivery, or agent execution.

## Evidence and problem statement

Sprint 15 measured repeated provenance as a material part of Context Pack
continuity bytes. Its source-table prototype reduced the compact, working, and
extended samples by 1,409/1,409/1,408 bytes and created the only new fit under
the sampled 4,096-byte standard budget. ADR-0016 therefore accepted a bounded
packet-level canonical source table as the future format direction, but kept
production schema v1 unchanged until compatibility, budgeting, facade, and GUI
contracts could be proven together.

The experiment encoded complete profiles. The production builder can omit
individual sections as a budget fills, so shared table bytes cannot be charged
by copying the experimental total. Sprint 17 must define deterministic
incremental accounting and ensure the final table contains exactly the sources
referenced by included sections.

## User story

As a user previewing a bounded Context Pack, I want repeated source provenance
represented once without losing trust or navigation details so that more useful
continuity can fit the same explicit byte budget and the preview remains fully
inspectable before any future delivery.

## Committed backlog

### S17-01 — Freeze schema-v2 and shared-byte budgeting contracts

- define schema v2 independently from the logical expanded Context Pack view;
- retain v1 decoding and prove the current v1 encoder candidates byte-for-byte
  unchanged;
- normalize only handoff-section `metadata.sources`; keep origin, trust,
  curation, verification, observation, values, and instruction rules inline;
- bind the canonical source table to project, Work Item, and immutable handoff;
- derive source IDs from the complete ADR-0016 canonical source identity and
  sort table entries and per-section references by ID;
- select continuity sections in the existing order using their normalized
  section bytes plus the exact marginal byte delta of the canonical table for
  the tentatively included source union;
- charge the final canonical table and included normalized sections to the
  continuity budget exactly once; keep instruction budgeting unchanged;
- emit no table when no continuity section fits and include only entries used
  by included sections;
- define omission byte reporting and exact reconciliation without claiming
  provider tokens or relevance.

### S17-02 — Implement versioned encode, decode, and validation

- add production schema-v2 types, builder output, and a schema-dispatched
  lossless expansion boundary to `@ai-workspace/context-builder`;
- reuse validated source canonicalization from the Sprint 15 experiment where
  contracts match, but keep experiment report types outside production APIs;
- freeze returned packets and expanded views and preserve deterministic output
  under permuted source occurrence input;
- preserve complete source event, session, type, trust, artifact, position,
  and record-hash navigation identity for every expanded section;
- enforce explicit item, table, source, reference, identifier, content-byte,
  and packet-byte bounds;
- reject unsupported versions, dangling or duplicate references, duplicate or
  unreferenced entries, noncanonical ordering/IDs, malformed JSON, inconsistent
  byte claims, cross-scope data, and oversized input;
- fail closed with recovery guidance and without echoing rejected content.

### S17-03 — Preserve compatibility and measurement integrity

- keep a supported v1 encode/decode path for existing in-process consumers and
  fixtures while making the read-only preview writer emit schema v2;
- prove v1 and v2 expand to the same logical continuity metadata and values;
- prove v1 candidate content remains byte-identical to the Sprint 12–15
  baseline and keep historical reports reproducible;
- adapt corpus measurement to explicit schema handling rather than silently
  interpreting v2 as v1;
- reconcile category used bytes, included content, source-table bytes, omitted
  items, and total measurement for full, partial, and no-fit budgets;
- record the observed v2 deltas without generalizing beyond the synthetic
  corpus.

### S17-04 — Expose an inspectable bilingual v2 preview

- update the in-process facade and authenticated Context Pack route to return
  the explicit schema version and safe normalized provenance summary;
- render expanded logical section values and trust rather than asking the GUI
  to interpret raw reference JSON;
- show source-table entry count and exact shared bytes in English and Italian;
- retain included/omitted status, exact category budgets, estimate labeling,
  immutable handoff identity, and read-only effect at the point of use;
- keep source navigation project-scoped and require existing explicit user
  actions before opening canonical evidence;
- provide actionable unsupported-version, corrupt-packet, no-fit, and
  oversized recovery without content echo;
- add no authoring, persistence, delivery, execution, or automatic agent
  selection control.

### S17-05 — Prove acceptance and close the increment

- cover deterministic IDs/order, shared and section-unique sources, repeated
  sources, marginal-budget boundaries, full/partial/no fit, and instruction
  coexistence;
- cover v1 compatibility, v1/v2 logical equivalence, canonical source
  navigation, and the unchanged historical measurement corpus;
- cover every ADR-0016 adversarial rejection class, including failures through
  facade and HTTP boundaries without content echo;
- cover the no-manual English/Italian GUI journey, semantic labels, keyboard
  operation, narrow viewport, inert rendering, and explicit read-only effect;
- update architecture, threat model, user guide, public design, README,
  roadmap, project plan, sprint index, and local handoff only after behavior
  and acceptance gates pass;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, corpus reproduction, and an isolated schema-v2 preview demo;
- create one final Sprint 17 implementation commit and perform no push.

## Out of scope

- Context Pack persistence, delivery to a model, execution, prompt assembly,
  model/provider adapters, telemetry, or background processing;
- relevance retrieval, ranking, semantic/fuzzy search, embeddings, CodeGraph,
  OpenSearch, caching, summarization, compression, or query expansion;
- agent profiles, skill profiles, policy enforcement, instruction authoring,
  tool permissions, or automatic selection;
- source mutation, history mutation, active-memory promotion, or changes to
  handoff/session/artifact persistence formats;
- the rejected full-metadata table, generic outlines, lossy references, or a
  schema-v1 in-place semantic change;
- new runtime, framework, database, service, network access, or dependency.

## Architecture decision

ADR-0016 already authorizes this bounded source-table direction and defines its
gates. No new ADR is planned. Stop and write a separate ADR if implementation
requires persistence, a new dependency, a service, a network boundary, a
different selection policy, lossy data, or delivery/execution behavior.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The HTTP acceptance requires loopback permission because it opens only
`127.0.0.1`. Corpus reproduction and the isolated preview demo must use only
synthetic inputs and leave no runtime state or generated artifact behind.

## Definition of done

- the default read-only Context Pack preview emits explicit schema v2;
- a bounded canonical source table replaces only repeated section source
  arrays and contains exactly the sources referenced by included sections;
- shared table bytes and normalized sections reconcile exactly with the
  continuity budget for full, partial, and no-fit cases;
- schema v1 remains readable and its current candidates remain byte-identical;
- v1 and v2 expand losslessly to the same logical continuity view with trust
  and complete source navigation intact;
- unsupported, malformed, noncanonical, cross-scope, inconsistent, dangling,
  duplicate, unreferenced, and oversized packets fail closed without echo;
- the bilingual GUI explains schema, shared bytes, trust, bounds, omissions,
  and read-only effect without exposing raw reference mechanics as user work;
- no persistence, delivery, execution, new dependency, or new runtime exists;
- clean-build, quality, audit, public-safety, corpus, and demo gates pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 16 complete + ADR-0016 accepted
  -> S17-01 v2 and marginal-byte contracts
       -> S17-02 versioned codec and validator
            -> S17-03 compatibility and measurement
                 -> S17-04 facade and bilingual GUI
                      -> S17-05 acceptance and closure
```

## Risks and mitigations

| Risk                                      | Mitigation                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Shared bytes make selection ambiguous     | Specify canonical marginal table deltas before implementing the writer         |
| Omitted sections leave unused table rows  | Build the final table from the included-section source union and reject extras |
| v2 silently breaks existing consumers     | Dispatch by explicit version and retain tested v1 encode/decode compatibility  |
| Normalization weakens source inspection   | Expand to the complete logical source identity and test project-scoped opening |
| Corrupt references expose partial content | Validate the whole packet first and return one non-echoing failure             |
| Savings become an execution claim         | Label exact synthetic bytes only; retain read-only, not-delivered effect       |
| Scope expands into broader E6 work        | Exclude retrieval, profiles, CodeGraph, delivery, execution, and new runtimes  |

## Planning decisions

- Sprint 17 is the ADR-0016 rollout because it converts completed measurement
  and an accepted decision into a bounded compatibility increment before new
  E5/E6 discovery fronts are opened;
- schema v2 is explicit; schema v1 is not reinterpreted or overwritten;
- the public builder writes v2 only after v1 compatibility and adversarial
  contracts pass in the same increment;
- shared provenance is budgeted by exact canonical marginal table growth,
  preserving the existing continuity section order and whole-item omissions;
- consumers receive an expanded logical view for inspection, while raw v2
  references remain a transport representation rather than GUI domain work;
- CodeGraph, agent/skill profiles, and fuzzy/semantic discovery are reassessed
  after this bounded rollout instead of being coupled to it;
- this commitment is preserved; execution evidence, review, and retrospective
  are appended without rewriting the planned claims.

## Execution log

### 2026-07-13

- S17-01 froze explicit schema v2, retained the exact schema-v1 writer, and
  defined continuity selection as normalized section bytes plus the exact
  canonical table delta for the tentative included-source union. Source-free
  sections add no table bytes, and omitted items label their marginal method.
- S17-02 added the production v2 writer and version-dispatched expansion
  boundary. SHA-256 IDs cover the complete canonical source tuple; tables and
  references are canonical, bounded, scope-bound, immutable, and losslessly
  expanded with section-specific trust and navigation intact.
- Whole-packet validation rejects unsupported versions, inconsistent bytes,
  malformed content, dangling/duplicate references, duplicate/unreferenced
  rows, noncanonical IDs/order, cross-scope values, and oversized content with
  one generic non-echoing recovery error.
- S17-03 keeps Sprint 13–15 reports on the explicit v1 writer. Reproduction
  remains 4,926/7,560/33,000 v1 bytes; production v2 yields
  3,517/6,151/31,592, reductions of 1,409/1,409/1,408 bytes. Table size is
  551/551/552 bytes for one synthetic source.
- S17-04 makes the authenticated facade expand the packet before presentation.
  The bilingual GUI reports schema 2, shared source count and exact bytes, and
  renders logical content rather than requiring raw reference interpretation.
  Context Packs remain in memory and read-only.
- S17-05 acceptance covers full, exact-boundary, and no-fit budgets; one shared
  source; v1 byte identity; v1/v2 logical equivalence; adversarial packet
  rejection; facade, route, localization, semantic contract, and loopback GUI
  journey behavior.
- Final verification passed: format, lint, typecheck, build, all 36 test files,
  the 14-case HTTP acceptance outside the restricted sandbox, audit with zero
  vulnerabilities, exact corpus reproduction, isolated in-memory preview,
  diff check, and public path/credential scan.

## Sprint review

Sprint 17 converts the accepted ADR-0016 direction into a production read-only
format without expanding the execution boundary. Context Pack schema v2 shares
complete source provenance once and preserves the logical view expected by
users and consumers. The production result exactly reproduces the Sprint 15
source-table measurements, including the compact standard-budget fit.

The rollout makes compatibility explicit instead of changing schema v1 in
place. Historical corpus reports continue to use byte-identical v1 candidates,
while the current preview writer emits v2. Consumers that inspect content use
one validating expansion boundary; the browser receives only logical items and
a safe table summary.

Shared-byte budgeting is now defined for partial packs, the production case
that the all-sections experiment did not exercise. The final table contains
only referenced sources, and each selection decision accounts for the exact
table growth caused at that point. This keeps whole-item semantics and exact
budget reconciliation without attributing shared bytes more than once.

## Retrospective

What worked:

- carrying the explicit ADR rollout gates into the sprint prevented an
  experiment-only encoder from becoming an implicit production contract;
- preserving a v1 writer made historical evidence reproducible while allowing
  the primary preview to move forward;
- resolving references in the facade kept transport mechanics out of the GUI
  and created one fail-closed validation boundary;
- reproducing the exact Sprint 15 numbers showed that implementation and
  decision evidence describe the same representation.

What changed during implementation:

- source arrays may legitimately be empty on source-free handoff sections, so
  schema v2 permits empty per-section reference lists and emits no table until
  an included section actually references a source;
- omission bytes are explicitly the marginal content-and-new-shared-source
  cost at the deterministic selection point, not an additive standalone packet
  size claim;
- the existing synthetic measurement APIs stay schema-v1-specific instead of
  silently mixing historical and current formats.

Next-increment recommendation:

- reassess agent/skill profiles as the remaining M4 product boundary before
  broader Context Builder retrieval or execution;
- keep CodeGraph as a separate evidence-led E6 slice with an explicit consumer
  and scale baseline;
- keep fuzzy/semantic historical discovery separate from Context Pack work and
  measure zero-result queries before selecting it;
- retain the Sprint 16 OpenSearch triggers and require a dedicated ADR if an
  index, service, database, concurrency model, or query language is needed.
