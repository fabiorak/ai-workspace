# ADR-0006: Use atomic append-only session documents

**Status:** accepted  
**Date:** 2026-07-10

## Context

Sprint 2 must retain canonical session events across CLI processes, reject a
source whose previously imported prefix changed, and recover safely from an
interrupted write. The initial data set is local and small. A database would
add an unjustified runtime dependency, while appending directly to JSONL can
leave a valid prefix followed by a partial record after a crash.

Events are append-only domain evidence even though session import metadata,
such as the latest source artifact and import timestamp, changes as a source
file grows.

## Decision

Store each imported session as one schema-versioned JSON document below
`AI_WORKSPACE_HOME/sessions/`. The document contains immutable session
identity, mutable import metadata, and the complete ordered event prefix.

Updates must:

- acquire an exclusive lock file for the session and fail with recovery
  guidance if another writer holds it;
- validate the existing schema and all persisted values before use;
- require the caller's expected event count to match current storage;
- preserve every existing event at the data-model level and add only a new
  suffix;
- reject truncation, reordering, replacement, or changed session identity;
- write a complete temporary document and atomically rename it over the prior
  version;
- request directory mode `0700` and file mode `0600` where supported;
- remove its own lock in a `finally` path.

Stable session identity is a SHA-256 digest of the provider type and provider
session identity. Stable event identity also includes source position and the
SHA-256 hash of the exact source record. Import timestamps and local input
paths never participate in identity.

The store is physically snapshot-based but logically append-only: an accepted
write may change import metadata and append events, never rewrite historical
events. Schema migrations must preserve that invariant.

## Consequences

- a crash before rename leaves the previous complete document readable;
- users can inspect and back up the local format without a database service;
- rewrite cost grows with a session and must be measured before large real
  transcripts are supported;
- concurrent writers do not silently lose updates, but one fails immediately
  and may retry after the active command finishes;
- a lock left by process termination must be removed manually after confirming
  that no importer is active;
- cross-session transactions and automatic stale-lock recovery are deferred;
- a future transactional store can implement the same domain-owned port.
