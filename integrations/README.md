# Integrations

Provider- and tool-specific adapters live here. Integrations must preserve the
agent-agnostic core and expose capabilities through stable internal contracts.

Implemented adapters:

- `git/` inspects non-bare Git repositories and captures bounded handoff resume
  metadata through a constrained read-only process boundary;
- `local-active-memory/` resolves project-scoped active-memory provenance from
  schema-validated canonical session events and owns the validated local
  operation-log codec, reducer, and atomic filesystem store;
- `local-general-conversation/` validates and atomically persists separate
  bounded schema-v1 General conversation documents with restrictive modes;
- `local-handoffs/` reads immutable schema-v1 handoffs, writes normalized
  schema-v2 handoffs as scoped JSON files, and records immutable deterministic
  evaluations with exclusive writes;
- `local-instructions/` reads only explicitly selected structured synthetic
  bundles, derives SHA-256 provenance from exact bytes, and performs no
  discovery, persistence, or execution;
- `local-project-registry/` persists the Project Registry in a local,
  schema-versioned JSON file;
- `local-privacy-policy/` reads one explicit bounded digest-pinned model data
  policy with fatal UTF-8, same-project validation, and safe basename output;
- `local-session-ingestion/` persists canonical sessions and artifacts and
  exposes local historical-event reads;
- `local-work-items/` persists project-scoped Work Item operation logs with
  deterministic reduction, owner-token locking, and atomic replacement;

`claude-code/` remains an implementation scaffold. Its authored-from-scratch
fixture now drives a narrow synthetic-only adapter for the reviewed Sprint 5
subset. No live discovery, broad format compatibility, or CLI support is
implemented.
