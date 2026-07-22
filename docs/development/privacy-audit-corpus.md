# Privacy decision audit corpus and gates

**Frozen:** 2026-07-22, before ADR-0026 and production persistence code

Sprint 32 uses only fictional identifiers and aggregate values. The corpus has
one `REVIEWABLE_NOT_AUTHORIZED` decision and one `BLOCKED` decision. Neither
fixture contains Context Pack content, item hashes, detected values, source or
policy paths, complete reports, mappings, keys, passphrases, prompts,
responses, or restored output.

## Schema-v1 candidate

One private per-project JSON document contains `schemaVersion`, a monotonic
`revision`, and an oldest-first `events` array. Each immutable event contains,
in canonical key order:

- `schemaVersion`, `eventId`, and an exact UTC `occurredAt` timestamp;
- `projectId`, `workItemId`, `handoffId`, and `modelId`;
- `policyId`, `policyVersion`, and `policyDigest`;
- `contextPackSchemaVersion`, `decision`, and aggregate `counts`;
- `preflightReportDigest`, `predecessorEventHash`, and `eventHash`.

`counts` contains evaluated, omitted, allowed, blocked, defaulted, and
restricted item counts plus evaluated-item, shared-source-table,
Context-Pack-included, and omitted byte counts. `eventHash` is SHA-256 over the
canonical compact JSON bytes of every event field except `eventHash`, including
the predecessor. The first predecessor is `null`.

The fixed bound is **1,000 events per project**. Page size is 1–100, defaults
to 25, and uses an opaque offset cursor over deterministic newest-first order.
Reaching the bound fails closed: there is no delete, overwrite, rollover,
compaction, archive, export, or implicit retention.

## Canonical fictional cases

`reviewable-a` occurs at `2026-07-22T09:00:00.000Z` for project `project-a`,
Work Item `work-a`, handoff `handoff-a`, model `model-a`, policy
`fictional-balanced-policy` version `1.0.0`, Context Pack schema 2. Its counts
are 3 evaluated, 1 omitted, 3 allowed, 0 blocked, 1 defaulted, and 0 restricted.

`blocked-b` occurs one second later in the same scope and chain. Its counts are
3 evaluated, 0 omitted, 2 allowed, 1 blocked, 0 defaulted, and 1 restricted.
All fixture digests are synthetic 64-character lowercase hexadecimal values.

## Acceptance and failure matrix

The measurement harness must reproduce identical canonical bytes and hashes
across repeated runs and input-object key order. It must distinguish the two
decisions, retain repeated evaluations as distinct events, and detect changed
fields, duplicate identities, gaps, reordering, cross-project replay,
noncanonical bytes, corrupt JSON, unknown fields, unsafe file modes, temporary
state, stale locks, revision mismatch, concurrent writers, and the event bound.

Append publication uses an owner-token exclusive lock, mode `0700` directories
and `0600` files, a flushed temporary file, atomic replacement, directory
flush, and reread validation. A valid decision is returned only after its exact
event is found on reread. Invalid requests and failures before evaluation append
nothing. Storage errors are generic and do not echo rejected input or paths.

Hash chaining detects internal corruption, gaps, and reordering. Without an
external anchor it is not evidence against privileged replacement or
truncation of the complete store.

The decision gate passes only when the bounded JSON design meets every corpus
case without retaining forbidden content and audit failure prevents report
return. Ordinary logs and complete-report persistence fail the minimization
gate and are not candidates for production.
