# Roadmap

This roadmap summarizes the current design direction. Scope and ordering may
change as the architecture is validated.

Sprint 0 through [Sprint 12](docs/planning/sprints/SPRINT-012.md) are complete.
The foreground loopback GUI now covers the Core MVP journey, complete
active-memory and continuity cockpit workflows, English/Italian localization,
effective-instruction preview, and deterministic budgeted Context Pack preview.
[Sprint 13](docs/planning/sprints/SPRINT-013.md) completed Context Pack pressure
measurement over a deterministic 27-sample synthetic corpus before any new
optimization was selected. M4 remains open: agent and skill profiles, context
policies, broader retrieval, and execution are not implemented.

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
reports whole-item omissions. Synthetic pressure data recommends evaluating
continuity granularity and progressive disclosure next; it does not yet accept
that mechanism or a production optimization claim.

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
