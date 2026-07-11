# Integrations

Provider- and tool-specific adapters live here. Integrations must preserve the
agent-agnostic core and expose capabilities through stable internal contracts.

Implemented adapters:

- `git/` inspects non-bare Git repositories through a constrained process
  boundary;
- `local-active-memory/` resolves project-scoped active-memory provenance from
  schema-validated canonical session events and owns the validated local
  operation-log codec, reducer, and atomic filesystem store;
- `local-project-registry/` persists the Project Registry in a local,
  schema-versioned JSON file;
- `local-session-ingestion/` persists canonical sessions and artifacts and
  exposes local historical-event reads.
- `local-work-items/` persists project-scoped Work Item operation logs with
  deterministic reduction, owner-token locking, and atomic replacement;

`claude-code/` remains an implementation scaffold. Its authored-from-scratch
fixture supports the offline Sprint 5 provider-boundary spike; no Claude Code
adapter or CLI support is implemented yet.
