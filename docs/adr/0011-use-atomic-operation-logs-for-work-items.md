# ADR-0011: Use atomic operation logs for Work Items

**Status:** accepted  
**Date:** 2026-07-11

## Context

Sprint 5 requires durable objective state and additive lifecycle history before
handoffs can reference a Work Item. Concurrent writers must not lose state and
corrupt, unsupported, or cross-project documents must fail closed. Work Item
state must not become another copy of evidence, active memory, diffs, or handoff
bodies.

## Decision

Persist one schema-versioned logical operation log per project. Operations are
`CREATE`, `ACTIVATE`, `BLOCK`, `COMPLETE`, and `REOPEN`; each repeats project
scope, attribution, canonical same-project source links, timestamp, sequential
document revision, and (for transitions) expected Work Item version.

The local adapter rewrites the complete bounded JSON document under an
exclusive owner-token lock using a mode-`0600` temporary file, flush, and
atomic rename. A deterministic reducer validates and reconstructs current
state. Unknown schemas or operations, malformed sequences, duplicate IDs,
cross-project data, stale versions, and invalid transitions fail closed with
recovery guidance. Project IDs select filenames only through a SHA-256 digest.

The Work Item stores only its bounded user-curated objective, lifecycle
operations, attribution, and provenance snapshots. Corrections require future
additive operations; there is no edit or delete in this slice.

## Consequences

- lifecycle history is inspectable and current state is reproducible;
- optimistic concurrency prevents lost updates;
- storage remains local and adds no dependency, runtime, service, or database;
- active memory, transcript payloads, repository diffs, and handoff bodies stay
  outside Work Item documents;
- scale-triggered indexed storage remains a later ADR.
