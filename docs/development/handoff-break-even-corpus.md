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
