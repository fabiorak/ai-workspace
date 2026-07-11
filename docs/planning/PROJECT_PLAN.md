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
9. **Self-guiding interfaces:** CLI, API, and future UI workflows include
   first-run guidance, contextual help, examples, actionable errors, and clear
   recovery steps. Documentation supports the interface but is not a
   prerequisite for discovering the supported workflow.

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

| Sprint   | Primary epics | Demonstrable outcome                                    |
| -------- | ------------- | ------------------------------------------------------- |
| Sprint 0 | E0            | Toolchain, CI, domain baseline, and foundational ADRs   |
| Sprint 1 | E0, E1        | Register and inspect one local Git repository           |
| Sprint 2 | E1, E2        | Import a representative session from the first agent    |
| Sprint 3 | E2, E3        | Search imported events and open their source artifacts  |
| Sprint 4 | E3            | Consolidate active decisions, constraints, and failures |
| Sprint 5 | E4            | Hand off and evaluate one synthetic cross-agent resume  |
| Sprint 6 | To refine     | Prioritize the next increment from Core MVP evidence    |
| Sprint 7 | To refine     | Continue the evidence-led post-M3 sequence              |

Planning after M3 will use Core MVP evidence to refine Sprint 6 onward and
prioritize E5 through E10. The default epic order remains E5, E6, E7, E8, E9,
and E10, but validated user needs may change it.

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
handoffs can exceed the full-session byte baseline; Sprint 6 will be refined
from that evidence. Document Work Items and E6 context packs remain later
scope.
