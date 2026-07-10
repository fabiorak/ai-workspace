# Packages

Reusable modules for the modular monolith live here. Initial domain boundaries
include core work items, project and session management, search, memory,
context building, privacy, model and agent adapters, tools, artifacts,
telemetry, instructions, policies, agents, and skills.

Implemented packages:

- `core/` defines initial Work Item vocabulary and pure validation;
- `project-registry/` owns repository models, ports, and registration use
  cases.

Other directories remain placeholders until their public contracts are defined
through implementation and ADRs.
