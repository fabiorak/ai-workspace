# Roadmap

This roadmap summarizes the current design direction. Scope and ordering may
change as the architecture is validated.

Sprint 0 through [Sprint 31](docs/planning/sprints/SPRINT-031.md) are complete.
Sprint 30 accepted ADR-0024 after an executable compatibility corpus and added
reviewed `PROJECT` aliases through explicit schema-v2 mappings with permanent
byte-identical v1 reads and no implicit migration.
Sprint 31 accepted ADR-0025 after frozen synthetic v1/v2 output-integrity
evidence. Strict whole-token validation now restores exact mapping-owned values
in a bounded local inspector and blocks the complete result on unknown or
altered placeholders. It introduces no model access, response capture,
delivery, routing, permission, or execution.
The foreground loopback GUI now covers the Core MVP journey, complete
active-memory and continuity cockpit workflows, English/Italian localization,
effective-instruction preview, and deterministic budgeted Context Pack preview.
[Sprint 13](docs/planning/sprints/SPRINT-013.md) completed Context Pack pressure
measurement over a deterministic 27-sample synthetic corpus before any new
optimization was selected. [Sprint 14](docs/planning/sprints/SPRINT-014.md)
then measured resolvable reference and outline granularity without enabling
either representation: neither improves the sampled standard-budget fit
boundary. [Sprint 15](docs/planning/sprints/SPRINT-015.md) then accepted a
future packet-level source table in ADR-0016 after an exact lossless comparison
created one new compact standard-budget fit. Sprint 17 rolled that source table
out as explicit schema v2 with schema-v1 compatibility and lossless expanded
GUI inspection. Sprint 18 added the first portable agent/skill profile
contract. Sprint 19 composes one explicitly selected profile, its exact
instruction-source closure, one allowed model, and one immutable handoff into
effective instructions and an unchanged schema-v2 Context Pack. M4's
deterministic inspection and budgeting boundary is complete. Selector-driven
retrieval, enforceable runtime permissions, delivery, and execution remain
later boundaries rather than implicit M4 behavior.
Sprint 20 measured an experiment-only one-to-one `handoff.*` selector
vocabulary and safety floor. The result is `adapt`: fit improves from 9 to 12
of 27 observations and repeated candidate bytes fall 49.89%, but no
continuity-quality evidence or schema-v2 accounting supports production
rollout. Normal selectors and Context Builder behavior remain unchanged.
Sprint 21 froze six synthetic, digest-pinned continuity manifests before
selection. None of the three policies preserves the corpus: exact required
answer recall is 0%, 55.56%, and 77.78% for floor-only, focused, and risk-aware.
All retain first action, but source coverage is also incomplete. Exact
schema-v2 accounting creates no new fit. Both decisions are `no change`, with
production and GUI behavior unchanged.
Sprint 22 starts the M5/E7 privacy boundary with an ADR-gated, read-only model
data-policy preflight over one exact profile-governed Context Pack. Unknown
content defaults to `CONFIDENTIAL`, high-confidence `RESTRICTED` detection
always blocks, and the bilingual GUI exposes only hashes, categories, counts,
reasons, and recovery. No content is sent to a model and no pseudonymization,
mapping persistence, encryption key, routing, permission, or execution path is
introduced.

[Sprint 16](docs/planning/sprints/SPRINT-016.md) completed the E3 usability
increment: bounded literal search across all registered projects from the
primary bilingual GUI, with project identity and project-scoped source
navigation on every result. It adds no index or OpenSearch dependency.

[Sprint 17](docs/planning/sprints/SPRINT-017.md) completed the bounded ADR-0016
rollout. Explicit Context Pack schema v2 uses a canonical source table,
deterministic marginal shared-byte accounting, schema-v1 compatibility, and
lossless read-only inspection in the bilingual GUI. Persistence, delivery,
execution, CodeGraph, profiles, and new infrastructure remain outside the
increment.

[Sprint 18](docs/planning/sprints/SPRINT-018.md) completed the next M4 boundary:
strict portable schema-v1 agent and skill profiles, controlled local
digest-pinned import, canonical round-trip export, and bilingual read-only
inspection. It adds no registry persistence, installation, permission
enforcement, model/tool access, selection, delivery, or execution.

[Sprint 19](docs/planning/sprints/SPRINT-019.md) completed the read-only
profile-composition boundary. Exact declared instruction-source closure and an
explicit allowed-model selection are required; the agent target and exact-byte
budgets come only from the reviewed profile. The transient result retains
profile digest and declaration provenance alongside effective rules and an
expanded Context Pack. It adds no registry, availability resolution,
persistence, delivery, permission, or execution path.

[Sprint 20](docs/planning/sprints/SPRINT-020.md) completed the selector-evidence
increment. Eight explicit selectors map to existing handoff sections while a
four-section safety floor remains non-excludable. The bilingual report is
measurement-only. Decision `adapt` defers vocabulary versioning and production
policy until continuity-quality evidence exists.

[Sprint 21](docs/planning/sprints/SPRINT-021.md) completed that bounded
measurement. Predeclared exact-answer anchors show task-dependent optional
sections are lost by every candidate policy. Historical v1 candidate sums and
exact schema-v2 bytes remain separate; neither accounting method improves the
18/54 fit count, and production behavior stays unchanged.

[Sprint 22](docs/planning/sprints/SPRINT-022.md) completed the first E7
vertical slice. It defines a portable digest-pinned model data policy,
centralizes the existing narrow high-confidence restricted detector, and
exposes a non-echoing privacy preflight for an explicitly composed Context Pack. A
`REVIEWABLE_NOT_AUTHORIZED` result remains local review evidence, never model
delivery authorization.

[Sprint 23](docs/planning/sprints/SPRINT-023.md) implements ADR-0018/0019. A General Inbox captures explicit local
user-authored questions without false project attribution and make them
available to General-only and all-scope bounded literal search through a
separate atomic JSON store. Model replies, semantic retrieval,
embeddings, FTS5, databases, automatic promotion, delivery, and execution
remain outside the slice.

[Sprint 24](docs/planning/sprints/SPRINT-024.md) completed the additive
provenance-link increment through ADR-0020. Selected exact General evidence can
be linked explicitly to one registered project in a separate immutable atomic
store; retrieval explains and filters the link while preserving `GENERAL`
scope and project-only isolation.

[Sprint 25](docs/planning/sprints/SPRINT-025.md) completed a development-only
scale and integrity measurement of canonical General/link validation. Two
REFERENCE runs produced identical counts, zero known-item misses, sub-threshold
latency and less than 2.4% pressure on every production bound. Decision
`NO_CHANGE` retains JSON scans and creates no index ADR.

[Sprint 26](docs/planning/sprints/SPRINT-026.md) completed the next bounded E7
slice. Exact-hash user-reviewed UTF-8 spans produce deterministic inert aliases
while preserving all unselected bytes. A separate local adapter stores only
AES-256-GCM authenticated ciphertext with fresh nonces, private modes, owner
locking, atomic publication, and explicit volatile key custody. The bilingual
GUI verifies byte-exact restoration without changing evidence or authorizing
network, model, delivery, permission, or execution behavior.

[Sprint 27](docs/planning/sprints/SPRINT-027.md) completed passphrase-wrapped
local custody for random per-mapping keys while retaining mapping schema-v1 and
byte-exact recovery. [Sprint 28](docs/planning/sprints/SPRINT-028.md) then
measured deterministic entity candidates without a production consumer. Exact
aliases achieved 100% precision and recall on the frozen corpus and are
recommended only for explicit review; standard syntax and the union remain
`REFINE` after a telephone false positive in source-code-like text. That result
required every future match to remain `SUGGESTED_NOT_REVIEWED` until explicit
current-hash confirmation, with no automatic transformation or delivery.

Sprint 29 accepted ADR-0023 and rolled out only exact `CUSTOMER` aliases through
a transient, non-echoing `SUGGESTED_NOT_REVIEWED` boundary. The bilingual GUI
leaves every current-hash range unselected until individual confirmation into
the unchanged schema-v1 review form; pseudonymization remains a separate
action. `PROJECT` is rejected rather than coerced to `OTHER`. Sprint 30 must
freeze v1/v2 compatibility evidence before ADR-0024 or any v2 production code,
retain permanent v1 reads, and perform no implicit migration.

Sprint 30 froze those compatibility gates before ADR-0024 and production code.
Exact `CUSTOMER` and `PROJECT` dictionaries now produce non-echoing unreviewed
suggestions; confirmation selects schema v2 only when a `PROJECT` span is
present. Mapping v1 remains byte-identical and permanently readable, mapping
v2 authenticates its exact schema and scope, and both versions coexist under
distinct immutable mapping-set identities with the unchanged custody-envelope
schema v1. No migration, delivery, model, network, or execution path was added.

Sprint 31 treats arbitrary output as a new integrity boundary rather than
reusing position-based Context Pack restoration. The frozen corpus produced
three exact restores, nine complete blocks, one no-token result, zero errors,
and zero partial blocked outputs. ADR-0025 authorizes only strict local
inspection; v1/v2 mapping and custody contracts remain unchanged.

## 1. Project Memory

- repository discovery and registry;
- Git metadata and session acquisition;
- project instructions, handoffs, summaries, and decision log;
- historical indexing and global search;
- minimal UI and MCP search interface.

**Outcome:** resume earlier work with a different agent without replaying the
complete session.

## 2. Instruction and Agent Management

- hierarchical, inspectable instruction composition;
- versioned agent and skill registries;
- permission and policy enforcement;
- UI selection and portable Markdown/YAML definitions.

## 3. Context Optimization

- Context Builder and category-based token budgets;
- progressive disclosure, deduplication, and compression;
- code graph, artifact store, caching, and savings metrics.

The current implementation enforces exact UTF-8 content-byte budgets and
reports whole-item omissions. Synthetic granularity data rejects generic
string-leaf outlines and leaves resolvable references experiment-only.
ADR-0016 accepts a source table, not a full metadata table. Schema v2 now
implements it with explicit v1 compatibility, canonical fail-closed expansion,
and builder/GUI contracts. Broader retrieval, compression, delivery, and
execution remain future decisions.

## 4. Privacy Proxy

- sensitive-entity detection and reversible pseudonymization;
- encrypted local mappings and per-model data policies;
- privacy inspector and audit trail.

## 5. Tool Registry

- reusable script manifests and recipes;
- discovery, versioning, testing, and sandboxed execution;
- automatic suggestions for previously verified automation.

## 6. Multi-agent Orchestration

- planner, implementer, reviewer, and tester roles;
- provider-neutral agent adapters and handoffs;
- isolated worktrees, routing, and fallback behavior.

## 7. Community Registry

- portable agent and skill packages;
- signatures, provenance, compatibility, and trust metadata;
- installation and update workflow.

## Document workflows

Document repositories evolve alongside the core roadmap, beginning with local
registration, parsing, full-text search, annotations, and provenance. Later
increments add semantic search, requirements traceability, structured version
comparison, a Document Graph, OCR, and mixed code/document workflows.
