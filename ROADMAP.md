# Roadmap

This roadmap summarizes the current design direction. Scope and ordering may
change as the architecture is validated.

Sprint 0 through [Sprint 9](docs/planning/sprints/SPRINT-009.md) are complete.
The repository now includes the M3 cross-agent handoff, normalized measurable
handoff persistence, deterministic effective-instruction preview, and the
first GUI-first local journeys. The foreground loopback GUI guides project
registration, synthetic import, evidence search, integrity-verified source
inspection, and complete source-linked active-memory lifecycle without CLI
knowledge. Work Item/handoff and effective-instruction GUI parity remain the
leading product recommendations; no later sprint is committed yet.

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
