# Integrations

Provider- and tool-specific adapters live here. Integrations must preserve the
agent-agnostic core and expose capabilities through stable internal contracts.

Implemented adapters:

- `git/` inspects non-bare Git repositories through a constrained process
  boundary;
- `local-active-memory/` resolves project-scoped active-memory provenance from
  schema-validated canonical session events;
- `local-project-registry/` persists the Project Registry in a local,
  schema-versioned JSON file;
- `local-session-ingestion/` persists canonical sessions and artifacts and
  exposes local historical-event reads.
