# ADR-0013: Normalize handoff provenance with lossless source references

**Status:** accepted  
**Date:** 2026-07-11

## Context

The fixed schema-v1 handoff measured by Sprint 6 is 7,642 exact UTF-8 bytes.
Its nine source occurrences describe one unique canonical source. Repeated
provenance accounts for 3,424 bytes, or 44.8% of the packet, while the unique
source representation accounts for 429 bytes. Repetition is therefore a
material structural cost rather than section content or required safety
information.

Three choices were considered:

1. keep schema v1 and embed complete source links in every section;
2. introduce a packet-level source table and refer to its entries from each
   section;
3. make no schema change and accept the measured overhead.

Embedded links are simple and locally inspectable, but repeat identical fields
and make packet size depend strongly on source occurrence count. No change
avoids migration cost, but leaves the largest measured category untouched.
A source table removes representation duplication without dropping any source
field or section-level trust distinction. Its compatibility cost is justified
only because the exact-byte attribution found material repetition.

This is an E4 representation decision. It does not introduce summarization,
token budgets, retrieval, prompt construction, or an E6 Context Builder.

## Decision

Accept a schema-v2 persisted representation with one bounded packet-level
source table and bounded source references in section metadata and source
reference values. Every v1 `WorkItemSource` field remains present exactly once
in the table. Normalization may change JSON layout but not provenance meaning.

The v2 codec must satisfy these invariants before v2 writing is enabled:

- source identity is the complete canonical `WorkItemSource` value, not only
  an event ID or session ID;
- equal source values occupy one table entry and unequal values are never
  merged;
- table ordering and reference identifiers are derived deterministically from
  canonical source values, independent of insertion order;
- every section retains its own origin, trust, curation, verification, and
  observation fields; only its embedded `sources` array becomes references;
- reference order and multiplicity have an explicit canonical rule so encoding
  is stable and decoding cannot silently reorder provenance;
- decoding expands references to the existing logical section source shape,
  preserving source navigation and human rendering;
- dangling, duplicate, malformed, oversized, or out-of-scope references fail
  closed; unreferenced table entries also fail closed;
- packet, project, Work Item, predecessor, and immutable creation rules remain
  unchanged.

Schema migration is read compatibility, not file mutation. The reader must
dispatch explicitly on schema version and continue to validate and decode all
valid v1 handoffs. Existing v1 files are never rewritten, refreshed, or
deleted. A v2 successor may point to a v1 predecessor in the same project and
Work Item. Unsupported versions fail closed with the existing recovery model.

S6-04 must add contract fixtures and tests proving, before the first v2 write:

- stable v1 backward read and byte-for-byte immutability of the v1 fixture;
- lossless v1 logical value to v2 encode/decode equivalence;
- identical source-navigation commands and section trust metadata;
- deterministic v2 bytes under permuted source occurrence input;
- valid v2-to-v1 predecessor linkage within one project and Work Item;
- rejection of dangling, duplicate, cross-scoped, malformed, and over-bound
  tables or references;
- no partial file after rejected creation.

The default writer remains v1 until those contracts pass and S6-04 explicitly
changes it. No standalone bulk migration command is accepted.

## Consequences

- repeated provenance can be removed from the serialized packet without
  weakening inspectability or trust boundaries;
- readers become multi-version and the persisted codec must be separated from
  the logical handoff model;
- immutable v1 handoffs remain readable historical artifacts indefinitely;
- v2 implementation and measured before/after savings remain work for S6-04
  and S6-06, so this ADR alone makes no compactness claim;
- normalization adds validation complexity, but no runtime, database, service,
  framework, network access, or external dependency.
