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
- `local-general-project-link/` validates and atomically persists separate
  bounded schema-v1 immutable link documents with a store-wide owner-token
  lock, restrictive modes, and fail-closed duplicate/integrity checks;
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
- `local-privacy-mapping/` stores immutable reversible mappings only as
  bounded AES-256-GCM authenticated ciphertext with explicit in-memory keys,
  private modes, owner locking, and flushed atomic publication;
- `local-session-ingestion/` persists canonical sessions and artifacts and
  exposes local historical-event reads;
- `local-work-items/` persists project-scoped Work Item operation logs with
  deterministic reduction, owner-token locking, and atomic replacement;

`claude-code/` exposes two separate readers over the same integration boundary,
as recorded in ADR-0029:

- the original narrow adapter (`claude-code`) still reads only the reviewed
  authored-from-scratch synthetic subset, unchanged;
- a tolerant adapter (`claude-code-local`) reads a real local Claude Code JSONL
  transcript. It is tolerant about record and block shapes but strict about
  accounting: unrecognized blocks are preserved as `UNKNOWN` evidence, every
  record it does not convert is counted and reported by reason, and an
  unparsable record is accepted only as the last line of a live transcript.
  Skipping produces no event, so re-importing a grown transcript stays
  idempotent.

Discovery lists one directory the user names explicitly. It is not recursive, has
no default location, never guesses which project a transcript belongs to, and
returns only filesystem metadata, so listing cannot read a conversation. Reading
happens only when the user then imports one named file. Restricted-data screening
is unchanged and remains fail-closed.
