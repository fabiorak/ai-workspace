# AI Workspace Project Plan

## 1. Purpose

This document turns the product design into an executable delivery plan. It
defines the overall path, major epics, dependencies, milestones, and the agile
operating model used to evolve AI Workspace.

The plan is outcome-oriented. Epics describe durable product capabilities;
sprints deliver small, demonstrable vertical increments. An epic may span
multiple sprints, and a sprint may include work from more than one epic when
that is required to produce a usable increment.

## 2. Product objective

AI Workspace will provide a local-first, agent-agnostic control plane that
allows a user to preserve project knowledge, retrieve historical evidence,
build minimal task context, and move work between AI agents without replaying
entire sessions.

The first complete product journey is:

```text
Register a local repository
  -> import an agent session
  -> find previous work and evidence
  -> consolidate active decisions and state
  -> generate a neutral handoff
  -> resume the task with a second agent
  -> verify provenance and context
  -> measure time and tokens saved
```

This journey is the scope anchor for the initial MVP. Infrastructure work that
does not support it directly must be justified, time-boxed, or deferred.

## 3. Delivery principles

1. **Vertical increments:** every sprint should end with behavior that can be
   demonstrated through a realistic workflow.
2. **Local-first by default:** local data must not leave the workspace without
   explicit configuration and policy approval.
3. **Provider neutrality:** agent- and model-specific behavior belongs behind
   adapters and stable internal contracts.
4. **Provenance from the start:** memories, search results, summaries, and
   handoffs must retain links to their sources.
5. **Security as a continuous concern:** full privacy features may arrive in a
   later epic, but secrets handling, data classification, least privilege, and
   safe logging begin with the foundation.
6. **Decisions before lock-in:** material choices are recorded as Architecture
   Decision Records before they become expensive to reverse.
7. **Measure outcomes:** token reduction claims must identify a baseline, and
   product progress must be measured through real user workflows.
8. **Simple first architecture:** begin as a modular monolith and introduce
   independent services only when their operational boundary is justified.
9. **GUI-first, self-guiding product:** the GUI is the primary interface for
   routine onboarding and daily workflows. Buttons and fields explain purpose,
   effect, prerequisites, trust, progress, and recovery inline. First use must
   succeed without reading manuals or memorizing CLI commands. The CLI remains
   supported for automation, diagnostics, tests, and advanced workflows.
10. **GUI delivery accountability:** every new user-facing capability includes
    a GUI delivery plan in the same sprint or records an explicit, temporary,
    reviewed exception. Empty, loading, error, returning, accessibility, and
    no-manual onboarding states are product acceptance, not documentation work.

## 4. Planning horizons

### Horizon A — Foundation

Establish the product boundaries, engineering system, architectural baseline,
security posture, and contribution workflow.

### Horizon B — Core MVP: Cross-agent continuity

Deliver repository registration, session ingestion, historical search, active
memory, handoff generation, and task resumption with a second agent.

### Horizon C — Optimization and control

Add instruction and agent management, selective context construction, token
optimization, and the privacy gateway.

### Horizon D — Ecosystem and advanced workflows

Add reusable tools, multi-agent orchestration, document repositories, and a
trusted community package ecosystem.

## 5. Epic map

### E0 — Product and engineering foundation

**Outcome:** contributors can make safe, repeatable changes against an agreed
product and architecture baseline.

Scope:

- define initial personas and priority use cases;
- select the implementation toolchain and package strategy;
- establish automated build, formatting, linting, tests, and CI;
- record foundational ADRs;
- define data classification, trust boundaries, and the initial threat model;
- establish issue, pull request, release, and versioning conventions;
- define the initial domain vocabulary and module boundaries.

Exit criteria:

- a new contributor can set up and verify the repository from documentation;
- CI validates every change;
- foundational technology choices have accepted ADRs;
- sensitive local data and generated artifacts are excluded by default.

### E1 — Project Registry

**Outcome:** users can register, inspect, and update local software or document
repositories.

Scope:

- local directory discovery;
- Git repository, branch, remote, and worktree detection;
- project metadata and repository profiles;
- deterministic rescans and change detection;
- minimal API and CLI operations.

Exit criteria:

- at least two local repositories can be registered and listed;
- rescanning is idempotent;
- repository state links to the correct local source and Git metadata.

### E2 — Session and Artifact Ingestion

**Outcome:** a session from the first supported agent can be imported without
losing evidence or duplicating events.

Scope:

- append-only session event model;
- first agent adapter;
- messages, tool calls, commands, diffs, tests, and error ingestion;
- content-addressed artifact storage;
- source references, timestamps, and agent/model metadata;
- incremental and idempotent imports.

Exit criteria:

- a representative session can be imported twice without duplication;
- large payloads are stored as artifacts and referenced by events;
- every imported item identifies its source.

### E3 — Memory and Historical Search

**Outcome:** users can retrieve historical evidence and distinguish it from
active, consolidated project knowledge.

Scope:

- historical indexing and full-text search;
- project, session, type, date, and status filters;
- active memory items, decisions, constraints, and failure memory;
- validity, confidence, supersession, and provenance;
- navigation from results to source events and artifacts.

Exit criteria:

- users can locate a known decision, error, command, and solution;
- search results expose their original source;
- superseded knowledge is not presented as currently active.

### E4 — Handoff and Cross-agent Resume

**Outcome:** work performed with one agent can be resumed correctly with a
second agent using a neutral, verifiable task packet.

Scope:

- active objective and work-state consolidation;
- handoff and task packet generation;
- relevant files, decisions, changes, tests, failures, and next actions;
- second agent adapter;
- handoff validation against repository and test state;
- time-to-resume and baseline context measurements.

Exit criteria:

- two different supported agents complete a controlled handoff scenario;
- the second agent performs a correct first action without reading the full
  previous transcript;
- the handoff identifies its sources and any unverified claims;
- time and estimated context savings are reported against a stated baseline.

### E5 — Instruction, Agent, and Skill Management

**Outcome:** users can define and inspect portable, versioned behavior for an
agent execution.

Scope:

- hierarchical instruction discovery and composition;
- non-overridable constraints and scoped preferences;
- versioned agent and skill registries;
- tool permissions, model policies, and context profiles;
- effective-instruction preview and provenance;
- Markdown/YAML import and export.

Exit criteria:

- the effective instruction set is deterministic and inspectable;
- forbidden overrides and tool combinations are rejected;
- an agent and skill definition can be exported and re-imported unchanged.

### E6 — Context Optimization

**Outcome:** agents receive the minimum sufficient context within an explicit
budget.

Scope:

- Context Builder and context pack format;
- category-based token budgets;
- progressive disclosure and targeted retrieval;
- deduplication, compression, and diff-first context;
- prompt and response caching;
- token, cost, precision, and cache metrics.

Exit criteria:

- context packs are reproducible for a fixed repository state;
- budget limits are enforced;
- included content is explainable and linked to sources;
- savings are measured against a documented uncompressed baseline.

### E7 — Privacy Gateway

**Outcome:** data sent to a model complies with workspace and model-specific
privacy policies.

Scope:

- PII and secret detection;
- custom business-entity recognizers;
- deterministic reversible pseudonymization;
- encrypted local mapping storage;
- model data policies and routing constraints;
- privacy inspection, correction, and audit events.

Exit criteria:

- configured sensitive entities do not reach forbidden models;
- authorized responses can be safely deanonymized;
- mappings remain local, encrypted, and separate from ordinary logs;
- policy decisions are visible and auditable.

### E8 — Tool and Recipe Registry

**Outcome:** previously created automation can be found, trusted, and reused
instead of regenerated.

Scope:

- versioned tool manifests;
- discovery, tagging, and duplicate detection;
- declared inputs, outputs, dependencies, and capabilities;
- sandboxed execution and confirmation gates;
- test history and verification status;
- multi-step recipes.

Exit criteria:

- a verified tool can be discovered and safely rerun from its manifest;
- undeclared file or network access is denied;
- execution results and artifacts retain provenance.

### E9 — Multi-agent Orchestration

**Outcome:** specialized agents can collaborate through controlled roles,
isolated changes, and explicit verification.

Scope:

- planner, implementer, reviewer, and tester roles;
- routing, fallback, and model selection;
- isolated Git worktrees;
- task state transitions and approval gates;
- automatic handoff and result consolidation.

Exit criteria:

- a multi-step change can move through planning, implementation, review, and
  verification without conflicting writes;
- every action is attributed to its agent, model, instructions, and tools;
- destructive or externally visible operations require the configured
  approval.

### E10 — Document Workspaces

**Outcome:** users can search, annotate, compare, and resume work across large
document collections with source-level provenance.

Scope:

- document repository registry, parsing, and structural chunking;
- full-text and semantic retrieval;
- persistent annotations and observations;
- requirements extraction and traceability;
- structural and semantic version comparison;
- Document Graph and derived reports.

Exit criteria:

- supported documents can be searched by section and source location;
- annotations survive normal reopen and reindex workflows;
- generated findings cite document, version, page, and section;
- changed sources identify analyses that require review.

### E11 — Community Ecosystem

**Outcome:** agents and skills can be distributed and installed with explicit
provenance, compatibility, and trust information.

Scope:

- portable package format;
- checksum, signature, and source provenance;
- permission and dependency review;
- compatibility checks;
- install, update, disable, and remove workflows;
- trust levels and package validation.

Exit criteria:

- a signed package can be validated, installed, and updated;
- required capabilities are shown before activation;
- incompatible or tampered packages are rejected.

## 6. Dependencies and sequencing

```text
E0 Foundation
 |
 +--> E1 Project Registry
       |
       +--> E2 Session Ingestion
             |
             +--> E3 Memory and Search
                   |
                   +--> E4 Cross-agent Handoff  [Core MVP]
                         |
                         +--> E5 Instructions, Agents, Skills
                         |     |
                         |     +--> E6 Context Optimization
                         |           |
                         |           +--> E7 Privacy Gateway
                         |           +--> E9 Multi-agent Orchestration
                         |
                         +--> E8 Tool Registry
                         |
                         +--> E10 Document Workspaces
                               |
                               +--> E11 Community Ecosystem
```

This diagram shows the primary delivery order, not strict technical coupling.
Privacy controls, provenance, telemetry, and security testing remain
cross-cutting responsibilities from E0 onward.

## 7. Milestones

### M0 — Engineering baseline

E0 is complete. The repository is buildable, testable, documented, and ready
for incremental implementation.

### M1 — Local project catalog

E1 is complete. Users can register and inspect local repositories.

### M2 — Searchable project history

E2 and E3 are complete. A supported agent session can be imported and its
evidence retrieved with provenance.

### M3 — Core MVP alpha

E4 is complete. A task can be handed from one supported agent to another and
resumed without replaying the entire transcript.

### M4 — Controlled context beta

E5 and E6 are complete. Instructions, agent profiles, and context packs are
deterministic, inspectable, and budgeted.

### M5 — Privacy-ready beta

E7 is complete. Model access is governed by enforceable data policies and
reversible local pseudonymization.

### M6 — Extensible workbench

E8 and E9 are complete. Tools can be reused safely and agents can collaborate
through controlled workflows.

### M7 — Multi-repository workbench

E10 is complete. Code, document, and mixed workspaces share the Work Item,
search, context, provenance, and handoff model.

## 8. Initial sprint sequence

The default cadence is a two-week sprint. The sequence below is a forecast and
must be adjusted using evidence from completed increments.

| Sprint    | Primary epics | Demonstrable outcome                                    |
| --------- | ------------- | ------------------------------------------------------- |
| Sprint 0  | E0            | Toolchain, CI, domain baseline, and foundational ADRs   |
| Sprint 1  | E0, E1        | Register and inspect one local Git repository           |
| Sprint 2  | E1, E2        | Import a representative session from the first agent    |
| Sprint 3  | E2, E3        | Search imported events and open their source artifacts  |
| Sprint 4  | E3            | Consolidate active decisions, constraints, and failures |
| Sprint 5  | E4            | Hand off and evaluate one synthetic cross-agent resume  |
| Sprint 6  | E4            | Measure and normalize handoff representation overhead   |
| Sprint 7  | E5            | Preview deterministic effective instruction composition |
| Sprint 8  | E0, E1-E3     | Complete the first no-manual local GUI journey          |
| Sprint 9  | E0, E3        | Curate verifiable active memory through the local GUI   |
| Sprint 10 | E0, E4        | Manage Work Items and handoffs through a GUI cockpit    |
| Sprint 11 | E0, E5        | Localize the GUI and preview effective instructions     |
| Sprint 12 | E0, E6        | Preview a deterministic budgeted Context Pack           |
| Sprint 13 | E0, E6        | Measure synthetic Context Pack budget pressure          |
| Sprint 14 | E0, E6        | Measure continuity disclosure granularity               |
| Sprint 15 | E0, E6        | Decide the Context Pack metadata envelope               |
| Sprint 16 | E0, E3        | Search historical evidence across registered projects   |
| Sprint 17 | E0, E6        | Roll out the versioned Context Pack source table        |
| Sprint 18 | E0, E5        | Inspect portable agent and skill profiles               |
| Sprint 19 | E0, E5, E6    | Compose a profile-governed Context Pack preview         |
| Sprint 20 | E0, E5, E6    | Measure profile context selector semantics              |
| Sprint 21 | E0, E5, E6    | Measure exact selector evidence retention               |
| Sprint 22 | E0, E7        | Preview model privacy policy before delivery            |
| Sprint 23 | E0, E3        | Capture and find General questions                      |
| Sprint 24 | E0, E3        | Link General evidence to a project explicitly           |
| Sprint 25 | E0, E3        | Measure General link retrieval scale                    |
| Sprint 26 | E0, E7        | Preview reversible privacy transformation               |
| Sprint 27 | E0, E7        | Decide local mapping key custody                        |
| Sprint 28 | E0, E7        | Measure reviewed entity candidate discovery             |
| Sprint 29 | E0, E7        | Review exact alias suggestions explicitly               |
| Sprint 30 | E0, E7        | Add reviewed project aliases with schema v2             |
| Sprint 31 | E0, E7        | Validate safe pseudonymized output restoration          |

Planning after M3 will use Core MVP evidence to refine Sprint 6 onward and
prioritize E5 through E10. The default epic order remains E5, E6, E7, E8, E9,
and E10, but validated user needs may change it.

Sprint 6 evidence supported planning Sprint 7 as a narrow E5 boundary slice.
Sprint 7 completed deterministic, provenance-linked effective-instruction
preview. User direction made GUI delivery the next product priority ahead of
deeper E5 expansion. Sprint 8 completed the first operational GUI journey and
Sprint 9 completed active-memory GUI parity. Sprint 10 completed the next
bounded GUI parity slice: complete Work Item lifecycle plus transparent
handoff preview, immutable creation, inspection, drift validation, and
successors. Sprint 11 completed English and Italian GUI parity plus read-only
effective-instruction preview. Localization remains presentation-only and does
not translate persisted or source data. The next increment should follow
observed bilingual usability evidence before another locale or E6 scope.
Sprint 12 then delivered the first E6 boundary: deterministic read-only Context
Pack preview from an explicit immutable handoff and optional effective
instructions with exact-byte category budgets and whole-item omissions. At that
point M4 remained incomplete; retrieval, agent profiles, context policies, and
execution were future work.
Sprint 13 measures that boundary across 27 deterministic synthetic combinations
of continuity, instructions, and budgets. It reports exact candidate, included,
and omitted content bytes without changing selection behavior. The evidence
recommends a later bounded experiment on continuity granularity and progressive
disclosure before broader retrieval or compression.
Sprint 14 compares full continuity sections with immutable resolvable
references and generic string-leaf outlines over the unchanged synthetic
profiles and budgets. Neither lower-detail level improves the sampled standard
fit boundary, so production behavior remains unchanged. The measured
3,816-byte repeated metadata floor supports a later ADR comparison of shared
metadata/provenance envelopes before any disclosure implementation.
Sprint 15 completed that bounded decision increment. The source table reduces
compact/working/extended content by 1,409/1,409/1,408 bytes and creates the
only new standard-budget fit. ADR-0016 accepts it as a future schema direction;
the full metadata table changes no fit boundary, and no production writer or
GUI behavior is enabled.
Sprint 16 completed the next user-priority correction to E3. It composes
the existing literal local search across registered projects, returns explicit
project identity, and preserves project-scoped source inspection without
introducing OpenSearch or another index.
Sprint 17 completed the bounded ADR-0016 compatibility increment. Explicit
Context Pack schema v2 retains schema-v1 reads and exact baseline candidates,
accounts deterministically for shared source-table bytes, and exposes an
expanded read-only bilingual preview without persistence, delivery, execution,
profiles, CodeGraph, or new infrastructure.
Sprint 18 completed the read-only E5 profile-contract increment. One explicit
project-scoped JSON bundle describes one agent and exactly its enabled skills,
validates model/tool/context/confirmation relationships, round-trips
canonically, and remains uninstalled, unselected, unenforced, and unexecuted.
Sprint 19 completed the read-only E5/E6 composition increment. One explicit
profile, its exact declared instruction sources, an explicitly selected
allowed model, and one immutable handoff now produce effective instructions
and an unchanged schema-v2 Context Pack. Agent target and exact-byte budgets
come only from the profile; selector semantics, availability, persistence,
permissions, delivery, and execution remain deferred.
Sprint 20 completed the evidence-led selector experiment. Eight exact
`handoff.*` strings map to existing continuity sections under a four-section
safety floor. Nine cases and 27 budget observations improve fit from 9 to 12
and reduce repeated historical candidate bytes by 49.89%, but measure no
relevance or resume quality. Decision `adapt` leaves schemas, selectors, and
Context Builder production behavior unchanged.
Sprint 21 completed the predeclared exact-evidence follow-up. None of the three
generic policies preserves all required answers and sources, and exact
schema-v2 accounting changes no sampled fit. Both decisions are `no change`;
M4 closes on deterministic inspectable profiles and Context Packs without
claiming retrieval, privacy, permission, delivery, or execution.
Sprint 22 completed the first E7/M5 boundary. It adds an ADR-gated,
read-only privacy preflight over one explicit profile-governed Context Pack and
one digest-pinned model data policy. Unknown items default to `CONFIDENTIAL`
and high-confidence `RESTRICTED` patterns always block. The bilingual GUI
exposes decisions and recovery without model access, pseudonymization,
encrypted mappings, persistence, routing, or execution.
Sprint 23 added bounded project-free General question capture and literal
search without model response. Sprint 24 added immutable explicit General-to-
project provenance links, and Sprint 25 measured their canonical scan path;
the resulting `NO_CHANGE` decision retained bounded JSON without an index.
Sprint 26 added exact reviewed-span pseudonymization, separate authenticated
encrypted mappings, and byte-exact local restoration without delivery.
Sprint 27 selected passphrase-wrapped random mapping keys after a frozen
cross-platform custody comparison, retired raw hexadecimal key entry, and
preserved mapping schema-v1 compatibility. Sprint 28 measured deterministic
entity candidates development-only: exact aliases passed as
`ADOPT_FOR_REVIEW`, while standard syntax and the union remain `REFINE` because
telephone precision fell to 50% on source-code-like text. Sprint 29 accepted
ADR-0023 and rolled out exact customer-alias suggestions only, kept
`SUGGESTED_NOT_REVIEWED` until explicit current-hash confirmation creates the
unchanged `USER_REVIEWED` contract. Sprint 30 then accepted ADR-0024 after an
executable compatibility corpus and added explicit project spans through
mapping schema v2 with permanent v1 reads. Neither increment adds delivery
authority.

Sprint 31 completed the evidence-first output-restoration safety increment.
The frozen synthetic bilingual corpus accepted strict whole-token,
all-or-nothing restoration and rejected the known-only baseline for production
after it produced two partial anomaly cases. ADR-0025 enables only a bounded
bilingual local inspector. Model access, delivery, response capture, routing,
permission, execution, audit persistence, migration, and re-encryption remain
outside the increment.

## 9. Agile operating model

### Cadence

- two-week sprints;
- sprint planning at the start of each sprint;
- backlog refinement at least once during the sprint;
- a working-product review and demonstration at sprint end;
- a retrospective producing no more than two concrete process experiments;
- roadmap review at every milestone.

For a single-maintainer phase, these events can be lightweight written
checkpoints rather than meetings. The artifacts and decisions still need to be
recorded.

### Sprint goal

Every sprint has one outcome-based goal. Stories that do not contribute to the
goal should normally remain outside the sprint.

### Backlog hierarchy

```text
Product objective
  -> Horizon
    -> Milestone
      -> Epic
        -> Capability or user story
          -> implementation task
```

Tasks should not be used as roadmap units. The roadmap describes outcomes;
implementation tasks are created only when their parent story is ready.

### Definition of Ready

A story is ready when:

- the user or system outcome is clear;
- acceptance criteria are testable;
- dependencies and relevant risks are known;
- required product or architecture decisions are resolved or time-boxed as a
  spike;
- the story is small enough to complete within one sprint.

### Definition of Done

A story is done when:

- acceptance criteria pass;
- automated tests cover the relevant behavior and failure paths;
- formatting, linting, type checks, and security checks pass where applicable;
- telemetry and safe error handling are included where required;
- documentation and ADRs are updated;
- provenance and privacy requirements are satisfied;
- the increment is demonstrated in a representative workflow;
- no unresolved critical defect is introduced.

### Capacity guidance

Plan no more than approximately 80% of expected capacity. Keep the remaining
capacity for integration, defects, review feedback, and uncertainty. Spikes
must be time-boxed and finish with a decision, evidence, or a reduced unknown;
they do not automatically authorize production implementation.

## 10. Quality gates

Every milestone must satisfy these gates:

- reproducible local setup;
- automated acceptance path for the milestone workflow;
- migration and compatibility strategy for persisted data;
- no known critical security issue;
- sensitive fixtures and logs are synthetic and sanitized;
- source provenance is preserved through the delivered workflow;
- observable errors and recovery guidance;
- updated user and contributor documentation;
- declared performance and token baselines where savings are claimed.

## 11. Success metrics

### Core MVP metrics

- percentage of imported session events linked to a source;
- search success rate for a known historical item;
- handoff validation success rate;
- time from opening a project to the first correct agent action;
- estimated context tokens sent compared with the full-session baseline;
- number of repeated failed attempts avoided;
- import idempotency and recovery success rate.

### Later-stage metrics

- context precision and compression ratio;
- prompt and response cache hit rate;
- token and cost savings by project and model;
- privacy-policy block and correction rates;
- verified tool reuse rate;
- multi-agent workflow success rate;
- stale-memory and invalidated-analysis detection rate.

Metrics must include the measurement method and baseline. Estimated values
must be labeled as estimates.

## 12. Principal risks and responses

| Risk                                                 | Response                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Scope expands before the first usable workflow       | Keep the cross-agent resume journey as the MVP scope anchor              |
| Agent transcript formats are unstable or unavailable | Use adapters, retain raw artifacts, and start with controlled fixtures   |
| Infrastructure complexity delays validation          | Use a modular monolith and time-box infrastructure spikes                |
| Search returns outdated or unsafe instructions       | Separate active memory from history and preserve validity and provenance |
| Sensitive data enters indexes or logs                | Classify data early, sanitize by default, and test forbidden paths       |
| Token-saving claims are not credible                 | Record explicit baselines and publish the measurement method             |
| Handoffs describe stale repository state             | Validate against Git state, files, tests, and source references          |
| Provider coupling leaks into the domain              | Enforce adapter boundaries and test with a second provider early         |
| Premature plugin execution creates security exposure | Defer execution until capability controls and sandboxing exist           |
| Document support dilutes the code MVP                | Reuse core abstractions, but schedule document workflows after M3        |

## 13. Governance and plan maintenance

- This document is the delivery-level source of truth.
- `ROADMAP.md` remains the concise public summary.
- Detailed product and architectural design remains in the public design
  documents.
- Accepted technical decisions belong in `docs/adr/`.
- Sprint plans and reviews belong in `docs/planning/sprints/` once execution
  begins.
- Local session continuity is recorded in `.ai-workspace/HANDOFF.md`, which is
  intentionally excluded from Git.
- Update this plan when milestone scope, epic ordering, or the delivery model
  changes; do not rewrite completed history to match a new forecast.

## 14. Current execution state

Sprint 0 established the engineering baseline and Sprint 1 delivered the first
Project Registry vertical slice. Both sprint records are complete and retain
their review and retrospective.

[Sprint 2](sprints/SPRINT-002.md) completed the first E2 vertical slice. It
imports an explicitly selected, synthetic Codex JSONL session for an existing
project, preserves source evidence in a content-addressed artifact store, and
proves unchanged and incremental import idempotency through the CLI.

[Sprint 3](sprints/SPRINT-003.md) completed project-scoped retrieval of imported
events and explicit integrity-verified source opening. The bounded local scan
validated query and guidance contracts without introducing a search engine.

[Sprint 4](sprints/SPRINT-004.md) completed M2 by adding explicit active
decisions, constraints, and failures with same-project canonical provenance,
additive lifecycle history, atomic local persistence, safe active-only
listing, and guided CLI operations. Canonical sessions and artifacts remain
unchanged and imported evidence remains `UNTRUSTED`.

[Sprint 5](sprints/SPRINT-005.md) completed M3 with explicit software Work
Items, immutable source-linked handoffs, bounded Git validation, a narrow
synthetic Claude Code adapter, and deterministic first-action evaluation
without live model execution. Its small fixture showed that provenance-rich
handoffs can exceed the full-session byte baseline. Document Work Items and E6
context packs remain later scope.

[Sprint 6](sprints/SPRINT-006.md) completed the evidence-led E4 hardening
slice. It measured break-even and overhead, accepted normalized provenance via
ADR-0013, retained permanent v1 reads, enabled deterministic lossless v2
writes, and exposed exact pre-creation size preview. The fixed packet fell from
7,642 to 3,551 bytes, while small negative corpus samples remained visible.

[Sprint 7](sprints/SPRINT-007.md) completed the first E5 boundary slice with
provider-neutral structured rules, deterministic constraint/preference
composition, exact-byte source provenance, controlled explicit local bundles,
and read-only effective-instruction preview. It introduced no discovery,
registry, execution, runtime permission, E6 Context Builder, model, or GUI.

[Sprint 8](sprints/SPRINT-008.md) completed the first GUI-first product slice.
ADR-0015 selected a foreground loopback Node host with no new dependency; the
typed in-process facade and self-guiding UI now deliver register → synthetic
import → search → event → integrity-verified source without manual or CLI
knowledge. Security and presentation acceptance cover local authentication,
Host/Origin/CSRF and body bounds, inert rendering, project scope, recovery,
keyboard and label baselines, narrow viewport behavior, and corrupt artifacts.

[Sprint 9](sprints/SPRINT-009.md) completed GUI parity for active memory as one
bounded journey. Users explicitly select historical evidence, create
`USER_CURATED` decisions, constraints, or failures, browse active and terminal
state, inspect provenance, and verify, supersede, or invalidate additively.
[Sprint 10](sprints/SPRINT-010.md) completed Work Item and handoff GUI parity as
one continuity cockpit: lifecycle, transparent preview, immutable creation,
section-level inspection, read-only Git drift validation, and successor
guidance. [Sprint 11](sprints/SPRINT-011.md) completed English/Italian GUI
localization plus read-only effective-instruction preview. `handoff evaluate`,
agent/model execution, Context Builder, document
Work Items, instruction authoring/enforcement, and automatic translation remain
outside the slice.

[Sprint 12](sprints/SPRINT-012.md) completed the first E6 slice with an
in-memory provider-neutral Context Builder and a bilingual GUI preview over one
explicit immutable handoff and optional reviewed effective instructions.
Separate exact-byte budgets include or omit whole items deterministically; the
preview is neither persisted nor delivered or executed.

[Sprint 13](sprints/SPRINT-013.md) completed the evidence-led follow-up. Its
bounded synthetic corpus measures category pressure and distributions without
adding a user-facing control or accepting retrieval, deduplication,
compression, or a new context representation.

[Sprint 14](sprints/SPRINT-014.md) completed the next representation experiment.
Full, reference, and outline levels preserve complete metadata and immutable
resolution identity, but the lower-detail levels do not improve the standard
budget-fit boundary and remain excluded from the production builder.

[Sprint 15](sprints/SPRINT-015.md) completed the follow-up architecture
decision. Exact prototypes and lossless adversarial contracts preceded
ADR-0016, which accepts the source table for a future schema. The normalization
remains disabled until later writer, reader, facade, and GUI compatibility
contracts pass.

[Sprint 16](sprints/SPRINT-016.md) closed the global-search gap in
the primary GUI. A bounded all-project scan must merge before the result limit,
identify every owning project, and fail without partial results; indexed search
remains deferred to measured scale triggers and a later ADR. The GUI defaults
to all registered projects; the CLI remains explicitly project-scoped.

[Sprint 17](sprints/SPRINT-017.md) rolled out ADR-0016 through explicit Context
Pack schema v2. Lossless source-table expansion, deterministic marginal
shared-byte budgeting, schema-v1 compatibility, and bilingual GUI inspection
now precede every read-only v2 preview; persistence, delivery, and execution
remain absent.

[Sprint 18](sprints/SPRINT-018.md) added the first portable agent and skill
profile boundary. Strict provider-neutral contracts, digest-pinned local
import, canonical re-import, and bilingual GUI inspection now precede any
future registry, selection, permission, delivery, or execution work.

[Sprint 19](sprints/SPRINT-019.md) connected that profile boundary to existing
instruction and Context Pack composition without changing either persisted
schema or Context Builder policy. Exact instruction-source closure, explicit
allowed-model selection, derived agent target, profile-owned byte budgets, and
safe profile/source provenance are now inspectable in the bilingual GUI. The
result remains transient and non-executable.

[Sprint 20](sprints/SPRINT-020.md) measured an experiment-only interpretation
of profile context selectors. Deterministic section decisions, a
non-excludable safety floor, byte-identical historical candidates, bounded
corpus results, and a bilingual report make proposed loss visible. The `adapt`
decision accepts no production policy; continuity-quality evidence and
schema-v2 accounting must precede any ADR or rollout.

[Sprint 21](sprints/SPRINT-021.md) completed that bounded evidence step. Six
digest-pinned synthetic continuation manifests predeclare nine exact answers,
supporting sections and 15 unique required-source observations, plus six first
actions. Floor-only, focused, and risk-aware retain 0, 5, and 7 answers; none is
corpus-preserving. All retain first action, but source coverage remains 0%,
60%, and 86.67%. Separate historical-v1 and exact schema-v2 accounting both
fit 18/54 budget observations, creating no new boundary. Evidence semantics
and schema-v2 fit are both `no change`; production builder, selector semantics,
GUI, delivery, and execution remain unchanged and no ADR was created.

[Sprint 22](sprints/SPRINT-022.md) completed the first privacy-gateway
vertical slice. ADR-0017 fixes a fail-closed preflight boundary before code.
One portable project/model-scoped policy binds classifications to exact
Context Pack item IDs and SHA-256 values; unasserted content defaults to
`CONFIDENTIAL`, while shared high-confidence restricted detection overrides
all declarations. The existing explicit profile/context composition feeds a
bilingual read-only report, not a network, model, permission, pseudonymization,
mapping, delivery, or execution path.

[Sprint 23](sprints/SPRINT-023.md) completed the first implementation of
ADR-0018 and ADR-0019. It adds an explicit project-free `GENERAL` conversation scope,
bounded immutable local capture of user-authored questions, and compatible
literal search across General plus registered projects. ADR-0019 must decide
the separate atomic persistence representation before code. The bilingual
General Inbox does not invoke a model, create assistant responses, promote
evidence, add a database/index, or claim semantic retrieval.

[Sprint 24](sprints/SPRINT-024.md) completed ADR-0020 with a separate immutable
General-to-project provenance-link aggregate. Exact hash binding, explicit
target and rationale, bounded atomic persistence, fail-closed validation,
retrieval annotations/filtering, and a bilingual confirmation journey preserve
the original scopes and bytes without promotion or execution.

[Sprint 25](sprints/SPRINT-025.md) completed deterministic General/link
validation and scan measurement against predeclared thresholds. Two complete
REFERENCE runs retained identical counts and zero known-item misses while all
latency and bound-pressure gates passed. Decision `NO_CHANGE` adds no index or
ADR; semantic retrieval retains its separate lexical-miss evidence gate.

[Sprint 26](sprints/SPRINT-026.md) completed the second E7/M5 boundary. Exact
user-reviewed UTF-8 spans are bound to Context Pack item hashes and transformed
into deterministic inert aliases without changing canonical evidence. A
separate adapter persists only AES-256-GCM authenticated ciphertext with fresh
nonces, scope-bound metadata, restrictive modes, owner locking, and atomic
publication. The bilingual GUI verifies byte-exact restore locally; it returns
no mapping plaintext, key, or path and creates no delivery authority.

[Sprint 27](sprints/SPRINT-027.md) completed the local custody decision. A
predeclared cross-platform corpus rejected raw volatile import and OS
credential stores, then accepted ADR-0022's dependency-free passphrase-wrapped
boundary after two deterministic synthetic runs. The GUI now generates one
random key per mapping set and persists it only inside a separate authenticated
custody envelope; schema-v1 mapping ciphertext remains migration-free. Offline
recovery requires both encrypted directories and the passphrase. Network
recovery, export, delivery, models, execution, and real credentials remain
excluded.

[Sprint 28](sprints/SPRINT-028.md) completed the development-only entity
candidate measurement. Two deterministic runs over eight synthetic bilingual
items and 12 exact spans gave exact aliases 4 TP, 0 FP, and 0 FN, earning
`ADOPT_FOR_REVIEW`. Standard syntax and the union remain `REFINE` because a
valid telephone-shaped source-code literal reduced `PHONE` precision to 50%.
No recognizer, facade, GUI, persistence, transformation, or delivery boundary
was added by that measurement.

Sprint 29 accepted ADR-0023 and delivered transient exact `CUSTOMER` alias
suggestions only. Responses are non-echoing and remain
`SUGGESTED_NOT_REVIEWED`; the bilingual GUI requires individual current-hash
confirmation into unchanged schema-v1 reviewed spans before the separate
pseudonymization action. `PROJECT` remains excluded because schema v1 cannot
represent it without a contract change. Sprint 30 is planned to freeze v1/v2
compatibility evidence before ADR-0024 and any explicit project-alias schema-v2
writer, while retaining permanent v1 reads and no implicit migration.

Sprint 30 completed that compatibility increment. The frozen synthetic corpus
preceded ADR-0024 and production changes, retained exact schema-v1 review,
mapping, transformation, and restoration bytes, and fixed deterministic v2
project bytes plus downgrade and authentication gates. Confirmed project spans
now use explicit schema v2; customer-only reviews remain v1. Both versions use
distinct immutable mapping-set identities and the unchanged schema-v1 custody
envelope without migration, re-encryption, delivery, network, or execution.

[Sprint 31](sprints/SPRINT-031.md) completed that separate local
output-restoration contract. Thirteen frozen v1/v2 cases produced three exact
restores, nine complete integrity blocks, one no-token result, zero incorrect
cases, and zero partial blocked outputs. ADR-0025 adds a bounded bilingual
inspector with authenticated mapping custody and no model, network, delivery,
response capture, routing, permission, or execution path.
