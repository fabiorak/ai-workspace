# ADR-0008: Scan canonical session events for initial search

**Status:** accepted  
**Date:** 2026-07-10

## Context

Sprint 3 must prove that imported historical evidence can be found and opened
at its source. The current synthetic data set is small, local, and already
stored as validated per-session documents. Query volume, corpus size, ranking,
and operational requirements are not yet known.

Adding OpenSearch or another index now would introduce schema synchronization,
reindexing, service lifecycle, security, and migration work before the first
retrieval behavior is validated.

## Decision

Implement the first search behind domain-owned ports as a bounded read-only
scan of canonical session events:

- every query is scoped to one registered project;
- optional filters narrow by session ID and canonical event type;
- matching is a case-insensitive literal substring over canonical payload
  text, including artifact-backed event payloads;
- whole raw-session artifacts are not searched as duplicate content;
- ordering is deterministic by source timestamp, session ID, and sequence;
- results include bounded snippets, match reason, trust, and source reference;
- session count, document size, artifact size, and result count are bounded;
- source artifacts are resolved only through an explicit read operation and
  verified against their SHA-256 address before use.

The CLI default result limit is 20 and the maximum is 100. The local adapter
scans at most 1,000 session documents per query. These values are compatibility
constraints for this initial adapter, not product-wide scale targets.

## Consequences

- the first known-item workflow requires no new dependency or service;
- behavior remains easy to inspect, test, and replace;
- query latency grows linearly with session and payload volume;
- literal matching provides no stemming, fuzzy search, semantic similarity, or
  relevance ranking;
- corrupt canonical storage fails closed instead of being silently skipped;
- an indexed-store ADR becomes necessary when measured latency, corpus size,
  concurrent queries, ranking, richer query syntax, or background ingestion
  exceeds these bounds;
- a future index must remain rebuildable from canonical sessions and artifacts,
  which continue to be the source of truth.
