# ADR-0009: Use atomic operation logs for active memory

**Status:** accepted
**Date:** 2026-07-10

## Context

Sprint 4 introduces curated decisions, constraints, and failure records whose
current validity can change. Unlike imported evidence, active memory is
deliberately curated, but corrections must remain attributable and must not
erase the previous statement, provenance, or verification history.

The initial deployment is local and single-user, with small synthetic data.
A database would add an unjustified runtime dependency. Directly appending
JSONL operations would preserve history but could leave a partial trailing
record after a crash, while a mutable snapshot alone would make the audit
history and lifecycle invariants easier to lose.

## Decision

Store each project's active-memory history as a schema-versioned JSON document
below `AI_WORKSPACE_HOME/memory/`. The document is a complete ordered log of
domain operations, not a mutable collection of current items. The initial
operations create, verify, supersede, or invalidate an item.

The store is physically rewritten as a complete snapshot and logically
append-only. Every accepted commit must:

- acquire an exclusive per-project lock and reject a concurrent writer with
  actionable retry guidance;
- load and validate the complete existing document before use;
- require the caller's expected revision to match the stored revision;
- preserve the exact existing operation prefix and append one complete domain
  transition;
- reconstruct state deterministically and validate all lifecycle invariants
  before publishing it;
- write a complete temporary document and atomically rename it over the prior
  version;
- request directory mode `0700` and file mode `0600` where supported;
- remove its own lock in a `finally` path.

Active-memory operations are project-scoped, attributable to `LOCAL_USER` in
the initial single-user slice, timestamped, and linked to canonical source
events from the same project. Source payloads are not copied into the log.
Imported evidence remains separately stored and `UNTRUSTED`.

The allowed lifecycle is deliberately narrow:

- creation produces `ACTIVE`, `UNVERIFIED`, `UNASSESSED`, `USER_CURATED`;
- verification is allowed once and only while an item is active;
- supersession atomically appends one operation that creates an active
  replacement and changes the previous item to `SUPERSEDED`;
- invalidation changes an active item to `INVALIDATED` without a replacement;
- terminal items cannot transition again;
- replacements do not inherit verification or confidence.

Creation and supersession inputs cannot set confidence. New items and
replacements are always `UNASSESSED`; any future confidence change requires a
separate attributable domain operation and is outside Sprint 4.

Project-memory listing uses bounded keyset pagination. Items are ordered by
creation timestamp descending (newest first), then by opaque memory ID
ascending as a stable tie-break. A page returns at most the requested limit and
an opaque, exclusive cursor only when more matching items exist. The cursor is
bound to the project and complete filter set; changing either requires
restarting without a cursor. This keeps every item discoverable without an
offset whose meaning shifts when newer memory is created.

Memory IDs and operation IDs are opaque, content-independent UUIDs. Project
revision and item version are monotonic concurrency controls, not identity.
Schema migrations must preserve operation order, attribution, source links,
and the logical append-only prefix.

## Consequences

- current state and complete lifecycle history can be derived from one local,
  inspectable source of truth;
- corrections remain additive and auditable without a database;
- crash safety follows the existing temporary-write and atomic-rename pattern;
- concurrent commands fail instead of silently losing an update;
- read and write cost grows linearly with a project's operation count;
- initial listing still reconstructs and filters the full project log even
  though its public result is paginated;
- stale locks require manual recovery after confirming no writer is active;
- compaction cannot discard operations and requires a future ADR if scale
  measurements justify snapshots or another transactional store;
- an adapter may replace the JSON representation later while preserving the
  domain-owned lifecycle and optimistic-concurrency contract.
