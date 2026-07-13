# ADR-0016: Use a source table for future Context Pack metadata

**Status:** accepted  
**Date:** 2026-07-13

**Implemented:** Sprint 17, 2026-07-13. Context Pack schema v2 satisfies the
rollout gates with explicit v1 compatibility, deterministic marginal
shared-byte accounting, lossless facade expansion, and bilingual GUI coverage.
Persistence, delivery, and execution remain absent.

## Context

Sprint 14 measured a 3,816-byte metadata-only floor across the eight current
continuity sections. Removing or outlining values could not fit any complete
representation into the 4,096-byte standard budget. That result left metadata
representation duplication as an explicit unknown.

Sprint 15 reused the unchanged compact, working, and extended handoffs and
budgets. It compared exact Context Pack content bytes for four decisions:

1. keep complete metadata embedded in every section;
2. share complete canonical sources in one packet-level table while retaining
   all other metadata inline;
3. share both sources and complete metadata identities in packet-level tables;
4. accept `no change` for future format direction.

The embedded baseline measured 4,926/7,560/33,000 bytes. The source-table
prototype measured 3,517/6,151/31,592, reductions of 1,409/1,409/1,408 bytes
or 28.60%/18.64%/4.27%. Compact gained the only new sampled fit, with 579 bytes
spare at the 4,096-byte standard budget.

The full metadata-table prototype measured 4,165/6,799/32,241. It saved only
761/761/759 bytes, was 648/648/649 bytes larger than the source table, and
changed no budget-fit boundary. Its additional indirection is not justified by
the evidence.

ADR-0013 is relevant prior evidence but governs immutable persisted handoffs.
Context Packs have a different temporary lifecycle, byte boundary, and future
consumer contract, so its decision was not copied automatically.

## Decision

Accept a bounded packet-level canonical source table as the representation
direction for a future Context Pack schema. Keep origin, trust, curation,
verification, and observation inline in every section. Replace only embedded
metadata `sources` arrays with deterministic references to complete canonical
source entries.

Source identity is the complete ordered tuple of event ID, session ID, event
type, trust, artifact ID, source position, and source record hash. IDs are
derived from SHA-256 of that complete canonical value. Entries and references
are ordered by ID independently of occurrence order. A source may appear at
most once in one section; duplicate references are malformed rather than an
implicit multiplicity signal.

This acceptance does not enable the representation. The current schema-v1
Context Pack preview, builder selection, whole-item budgets, omission order,
HTTP facade, and bilingual GUI remain unchanged. The Sprint 15 encoder and
decoder are experiment-only and in memory.

A later rollout sprint must introduce an explicit new Context Pack schema
version and pass these gates before changing the default writer or any reader:

- retain schema-v1 read compatibility and prove current embedded candidates
  byte-for-byte unchanged;
- dispatch explicitly by schema version and reject unsupported versions;
- prove lossless expansion to current logical section metadata and values;
- retain section-specific trust and complete source navigation identity;
- bind source tables to project, Work Item, and immutable handoff scope;
- keep deterministic IDs, entry ordering, reference ordering, and unique-set
  multiplicity under permuted occurrence input;
- enforce bounded item, table, source, and reference counts and exact bytes;
- reject dangling, duplicate, unreferenced, noncanonical, malformed,
  cross-scope, inconsistent, and oversized inputs without content echo;
- add facade and GUI contract/acceptance coverage before exposing any changed
  preview behavior;
- preserve the absence of persistence, delivery, or execution unless those
  capabilities receive separate decisions.

Reject the full metadata-table alternative. Its measured savings are smaller,
its decoder is more complex, and it changes no sampled boundary. Reject `no
change` as the future format direction because the source table produces a
material bounded reduction with complete lossless contracts. Retain `no
change` for current production behavior until the later gates pass.

## Consequences

- a later Context Pack can remove repeated provenance without removing or
  weakening trust/source fields;
- compact continuity can fit the sampled standard budget without changing
  values or selection policy;
- future readers must handle at least embedded schema v1 and a new normalized
  schema explicitly;
- packet-level validation becomes more complex and must fail closed;
- the decision adds no runtime, framework, database, service, dependency,
  persistence, network access, retrieval, disclosure, or execution path;
- the evidence remains synthetic and does not claim relevance, task success,
  provider token savings, or M4 completion.
