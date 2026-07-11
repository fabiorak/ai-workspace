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

Other directories remain placeholders until their public contracts are defined
through implementation and ADRs.
