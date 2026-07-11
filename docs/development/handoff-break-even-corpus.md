# Synthetic handoff break-even corpus

**Date:** 2026-07-11  
**Sprint item:** S6-01  
**Decision method:** exact UTF-8 bytes

## Method

The deterministic corpus varies physical Claude-shaped record count
(`4/8/16/32/64`) and assistant text payload size (`32/256/1024` bytes). All
records are authored synthetic data with stable identifiers, timestamps, model
metadata, and LF-delimited JSONL encoding.

The comparison uses one fixed schema-v1 handoff with representative section
metadata and canonical source links. Its stable size is 7,642 bytes. The
implementation uses `TextEncoder` lengths and decides break-even only from
exact bytes. `ceil(bytes / 4)` token estimates are secondary.

## Results

|     Payload |     Last session smaller |     First session larger |
| ----------: | -----------------------: | -----------------------: |
|    32 bytes | 16 records / 4,325 bytes | 32 records / 8,741 bytes |
|   256 bytes |  8 records / 3,685 bytes | 16 records / 7,685 bytes |
| 1,024 bytes |  4 records / 3,989 bytes |  8 records / 9,061 bytes |

At these first sampled break-even points, the handoff is smaller by 1,099, 43,
and 1,419 bytes respectively. The full 15-sample matrix is reproduced by
`packages/handoff/test/measurement.test.ts`.

## Interpretation and limitations

Break-even depends on both record overhead and payload size. This does not
prove that a handoff is sufficient, faster, or cheaper for arbitrary work. The
corpus does not model private transcripts, tool distributions, memory growth,
or provider tokenization.

The packet still repeats full source links across section metadata. S6-02 will
attribute those bytes before S6-03 considers a normalized source table. No v2
format or context-optimization claim is accepted by this experiment.

## S6-02 byte attribution

The same fixed packet is decomposed into non-overlapping semantic categories.
Compact JSON bytes represent section values and metadata; all source
occurrences are split into one unique source set plus repeated occurrences.
The remaining exact bytes are envelope, keys, punctuation, indentation, and
structural wrappers. The categories sum to the exact 7,642-byte encoding.

| Category                         | Exact bytes | Share |
| -------------------------------- | ----------: | ----: |
| Envelope and structure           |       2,583 | 33.8% |
| Section content                  |         222 |  2.9% |
| Section metadata without sources |         984 | 12.9% |
| Unique provenance                |         429 |  5.6% |
| Repeated provenance              |       3,424 | 44.8% |

The packet contains nine source occurrences representing one unique canonical
source. Repetition is therefore the largest measured category. This is enough
evidence for S6-03 to compare normalized source references, but not permission
to remove source fields, weaken section-level trust, or write schema v2.

## S6-03 representation decision

[ADR-0013](../adr/0013-normalize-handoff-provenance-with-lossless-source-references.md)
accepts a packet-level source table with lossless section references for a
future schema v2. The alternatives were continued embedded links and no
change. Normalization was selected because repeated provenance is the largest
measured category and can be removed without removing any source field or
section-level trust metadata.

This decision does not enable v2 writes. S6-04 must first prove stable v1
backward reads, immutable v1 fixtures, lossless logical equivalence,
deterministic encoding, source-navigation equivalence, and fail-closed bounds
and reference validation. Existing v1 files will not be migrated in place.

## S6-04 persisted representation

The S6-04 contract suite now proves those preconditions. The logical
provider-neutral `Handoff` shape remains unchanged while a separate persisted
codec reads v1 and v2 and expands both into that shape. New local immutable
handoffs are written as v2 with a canonical source table and sorted unique
references; existing v1 files remain readable and are never rewritten.

The codec rejects unsupported versions, malformed source values, dangling or
duplicate references, duplicate or unreferenced table entries, noncanonical
ordering, oversized tables and references, and persisted scope mismatches.
Rejected creation leaves no partial file. Exact before/after corpus results
remain S6-06 work; S6-04 makes no general context or token-saving claim.

## S6-06 before/after result

The unchanged 15-sample corpus was rerun against both stable schema-v1 JSON
and the schema-v2 persisted codec. The fixed logical handoff is identical in
both cases; only its persisted provenance representation changes.

| Representation | Exact UTF-8 bytes | Change from v1 |
| -------------- | ----------------: | -------------: |
| Schema v1      |             7,642 |              — |
| Schema v2      |             3,551 |         -4,091 |

Schema v2 is 53.53% smaller for this fixed packet. The reduction is larger
than the isolated repeated-provenance category because normalization also
changes the surrounding JSON keys and structure. It does not remove any
logical source, section value, or trust field.

| Payload | First v1 break-even | First v2 break-even | Smallest sample remains negative |
| ------: | ------------------: | ------------------: | -------------------------------: |
|      32 |          32 records |          16 records |                  4 and 8 records |
|     256 |          16 records |           8 records |                        4 records |
|   1,024 |           8 records |           4 records |                             none |

At the new first sampled thresholds, v2 is smaller than the named session by
774, 134, and 438 bytes respectively. These are bounded synthetic results, not
a production distribution. The smallest 32-byte and 256-byte samples still
show negative savings, so normalization does not make every handoff smaller
than every session.

Reproduce the exact report after building with:

```bash
AI_WORKSPACE_DEMO_REPORT=1 node packages/handoff/test/measurement.test.ts
```

The contract suite also proves stable v1 reads, lossless v2 expansion,
deterministic bytes under permuted occurrences, unchanged human source
navigation and section trust, same-scope v2-to-v1 predecessor linkage,
cross-scope rejection, corruption and bound failures, terminal sanitization,
and evaluation through the local v2 store. No real transcript, provider call,
model grading, context budget, or E6 Context Builder participates.
