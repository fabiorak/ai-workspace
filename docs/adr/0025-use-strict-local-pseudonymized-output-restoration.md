# ADR-0025: Use strict local pseudonymized output restoration

**Status:** accepted  
**Date:** 2026-07-22

## Context

ADR-0021 and ADR-0024 define permanent schema-v1 and explicit schema-v2
mapping contracts. Their existing restore functions prove byte-exact recovery
only for unchanged transformed Context Pack items using recorded item hashes
and byte positions. Arbitrary output can repeat, reorder, omit, invent, or
alter placeholders and therefore cannot use that positional contract safely.

Sprint 31 froze a bilingual synthetic corpus before implementation. Across 13
cases and stable case/mapping-entry permutations, strict whole-token validation
produced three exact restores, nine complete integrity blocks, one no-token result, zero
incorrect restores, and zero partial blocked outputs. A known-only baseline
constructed partially restored results in two anomaly cases.

## Decision

Add a separate provider-neutral local output-restoration contract. It accepts
one bounded UTF-8 candidate output and one authenticated mapping selected by
immutable mapping-set identity. Project, Work Item, handoff, mapping-set, and
model scope must match before scanning; the model is taken from the mapping,
not a caller override.

The production policy is `STRICT_WHOLE_TOKEN`. A suspicious construct begins
with `[[AW` in any ASCII case. Every suspicious construct must be one complete,
canonical token for an entity allowed by the selected mapping schema and must
resolve to exactly one original value in that mapping. Unknown, malformed,
case-altered, truncated, extra-bracket, conflicting, cross-mapping, or
cross-scope input blocks the complete output. Validation finishes before any
restored content is constructed or returned.

Known exact tokens may be repeated, reordered, or embedded in new bounded text.
Every non-token UTF-8 byte is preserved exactly. A candidate with no pseudonym
returns `NO_PSEUDONYMS` and no restored content. The permissive
`KNOWN_ONLY_BASELINE` remains measurement-only and has no GUI or facade
consumer.

Readers dispatch explicitly through the permanent mapping-v1 or mapping-v2
validator. Mapping documents, encrypted storage, HMAC domains, custody-envelope
schema v1, existing positional restoration, and canonical Context Packs remain
unchanged. The loopback inspector unlocks and reads one existing encrypted
mapping through normal passphrase custody, never accepts mapping plaintext,
never persists candidate or restored output, and clears passphrase fields after
each attempt.

The inspector returns restored content only after complete success. Metadata is
limited to scope, schema version, decisions, reason codes, hashes, byte/token
counts, limitations, and a non-authorizing effect. Failures are generic and do
not echo output, originals, mapping plaintext, keys, passphrases, or paths.

## Consequences

- users can inspect exact mapping-owned pseudonyms in arbitrary local text
  without pretending it is an unchanged Context Pack item;
- altered or foreign placeholders cannot produce a misleading partial result;
- schema v1 and v2 mappings coexist under one separate output contract without
  migration or re-encryption;
- candidate and restored output are transient GUI values, not audit, memory,
  history, response, or artifact records;
- the result is local inspection evidence, never proof of complete output
  safety, privacy-policy approval, model authorization, or delivery;
- model/agent invocation, response capture, streaming, delivery, routing,
  permissions, execution, audit persistence, export, sharing, sync, escrow,
  cloud recovery, passphrase change, and new dependencies remain outside this
  decision.
