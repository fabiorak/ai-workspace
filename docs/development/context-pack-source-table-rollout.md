# Context Pack schema-v2 source-table rollout

**Sprint:** 17  
**Decision:** ADR-0016  
**Effect:** read-only, in memory, not persisted, delivered, or executed

## Production contract

Context Pack schema v2 replaces only repeated handoff-section
`metadata.sources` arrays. Every source is stored once in a packet-level table
bound to project, Work Item, and immutable handoff. Sections retain origin,
trust, curation, verification, observation, value, and sorted source IDs.
Instruction rules remain inline and unchanged.

The source ID is SHA-256 over the complete ordered tuple of event ID, session
ID, event type, trust, artifact ID, source position, and source record hash.
Table entries and section references are sorted by ID. Expansion restores the
logical schema-v1 section content, including complete navigation identity.

Schema v1 remains available through the explicit compatibility writer and the
version-dispatched expansion boundary. The Sprint 13–15 measurement corpus
continues to use v1 so its historical baseline remains byte-for-byte
reproducible.

## Shared-byte selection

Continuity sections retain their established order. For each candidate, the
builder computes:

```text
normalized section bytes
+ exact growth of the canonical table for the tentative included-source union
= marginal continuity bytes
```

The whole section is included only when that marginal total fits. The final
table contains exactly the union referenced by included sections. A section
with no sources adds no table bytes, and no table is emitted when the included
sections reference no sources. Omission records label their byte value as the
marginal content-and-new-shared-source cost at their deterministic selection
point.

`usedBytes.CONTINUITY` is exactly the sum of included normalized section bytes
and final source-table bytes. Instruction bytes are accounted independently as
before.

## Reproduced synthetic result

The production v2 implementation reproduces the accepted Sprint 15 source
table projection:

| Profile  | v1 bytes | v2 bytes | Reduction | Table entries | Table bytes |
| -------- | -------: | -------: | --------: | ------------: | ----------: |
| compact  |    4,926 |    3,517 |     1,409 |             1 |         551 |
| working  |    7,560 |    6,151 |     1,409 |             1 |         551 |
| extended |   33,000 |   31,592 |     1,408 |             1 |         552 |

These are exact UTF-8 content bytes over synthetic fixtures. They are not
provider token, relevance, task-success, latency, or cost claims.

## Validation and failure behavior

The complete packet is validated before expansion. Unsupported versions,
dangling or duplicate references, duplicate or unreferenced table entries,
noncanonical IDs/order, malformed content, scope mismatch, inconsistent exact
bytes, and oversized data fail closed with one recovery-oriented error that
does not echo rejected content.

The authenticated facade returns expanded logical item content plus only a
safe source-table summary: schema version, entry count, and shared exact bytes.
The browser does not resolve raw references and no Context Pack is persisted.
