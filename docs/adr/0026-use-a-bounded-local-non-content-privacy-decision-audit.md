# ADR-0026: Use a bounded local non-content privacy decision audit

**Status:** accepted  
**Date:** 2026-07-22

## Context

ADR-0017 makes one privacy-preflight decision inspectable but transient. The
policy-audit exit criterion requires prior valid decisions to remain visible,
while complete reports contain item hashes and correlation metadata that must
not be copied into an ordinary log. Transformation and restoration already
commit separate encrypted state and cannot safely share this increment without
cross-store consistency and retention decisions.

Sprint 32 froze two synthetic decision cases, schema and failure gates before
production code. The measurement reproduced 1,657 canonical bytes, both
decisions, a valid two-event predecessor chain, stable key-order-independent
encoding, zero forbidden event fields, and the fixed 1,000-event bound.
Ordinary logs fail scope and validation gates; complete-report persistence
fails data minimization.

## Decision

Record only successfully evaluated explicit privacy preflights in a separate
per-project schema-v1 JSON aggregate. Each event retains an ID and UTC time,
project/Work Item/handoff/model scope, policy ID/version/digest, Context Pack
schema, decision, aggregate counts, canonical preflight-report digest, and
predecessor/event hashes. It never retains content, item hashes, detected
values, paths, reports, mappings, secrets, prompts, responses, or restored
output.

Append uses a private directory and file, owner-token exclusive lock, bounded
canonical validation, monotonic revision, flushed temporary write, atomic
replacement, directory flush, and complete reread. A valid preflight report is
returned only after its exact event is appended and reread. Invalid input or a
failure before evaluation records nothing. At 1,000 events the preflight fails
closed; there is no deletion, overwrite, rollover, compaction, archive, export,
or implicit retention.

The authenticated loopback GUI exposes project-scoped read-only list and detail
routes with newest-first opaque-cursor pagination. It exposes no mutation,
search, export, or retention control. Transformation, mapping, custody,
alias-review, output restoration, model access, network, delivery, routing,
permission, and execution remain outside this audit.

Hash chaining detects internal corruption, gaps, reordering, duplicate identity,
and cross-project replay. Without an external anchor it cannot prove that a
privileged actor did not replace or truncate the complete store.

## Consequences

- every returned valid explicit preflight has one verified local audit event;
- repeated evaluations remain distinct even when their report digest matches;
- audit failure blocks report return without coordinating another committed
  aggregate;
- the event is useful for provenance inspection without becoming a second
  transcript;
- fixed capacity requires explicit operator recovery and a future ADR before
  any retention or archival behavior;
- local same-user or privileged file replacement and whole-store truncation
  remain residual risks;
- no result authorizes model access, disclosure, delivery, or execution.
