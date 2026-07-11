# Packages

Reusable modules for the modular monolith live here. Initial domain boundaries
include core work items, project and session management, search, memory,
context building, privacy, model and agent adapters, tools, artifacts,
telemetry, instructions, policies, agents, and skills.

Implemented packages:

- `active-memory/` owns provider-neutral active-memory vocabulary, lifecycle
  use cases, and persistence and provenance ports;
- `core/` owns bounded Work Item objective state, additive lifecycle use cases,
  provenance, and optimistic persistence ports;
- `project-registry/` owns repository models, ports, and registration use
  cases;
- `session-ingestion/` owns canonical imported-session and event contracts;
- `historical-search/` owns read-only historical evidence search contracts and
  use cases.
- `handoff/` owns immutable provider-neutral handoff snapshots, section-level
  trust and provenance, stable rendering, persistence ports, and the
  backward-readable v1/v2 persisted codec with lossless normalized source
  references;
- `instruction-manager/` owns bounded provider-neutral instruction sources,
  rules, deterministic precedence, conflict decisions, and stable effective
  instruction output;

Other directories remain placeholders until their public contracts are defined
through implementation and ADRs.
