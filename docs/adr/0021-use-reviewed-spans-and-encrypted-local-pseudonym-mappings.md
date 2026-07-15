# ADR-0021: Use reviewed spans and encrypted local pseudonym mappings

**Status:** accepted  
**Date:** 2026-07-15

## Context

ADR-0017 requires an inspectable privacy decision before any future model
delivery. Its preflight deliberately does not alter content. A blocked or
confidential Context Pack therefore has no safe, reversible local correction
path, while automatic PII inference would introduce unmeasured false-positive
and false-negative risk.

Reversible mappings are sensitive derived data. Persisting them as ordinary
JSON, embedding a key beside them, or mutating canonical evidence would break
the local-first trust boundary.

## Decision

The first pseudonymization boundary consumes only explicitly reviewed,
item-scoped UTF-8 byte spans. Each selection binds the Context Pack item ID,
exact content SHA-256, entity type, and exact byte range. It is attribution of
a human review, not proof of complete detection or permission to transmit.

Pseudonyms are deterministic within one mapping set and key, derived with
HMAC-SHA-256 from the entity type and exact selected bytes. They use inert
ASCII tokens and are applied from the end of each item so byte ranges remain
stable. Empty, overlapping, split-code-point, stale-hash, duplicate,
cross-project, dangling, oversized, or noncanonical selections fail closed.
Canonical Context Packs and source evidence remain unchanged.

Mappings are stored separately from ordinary workspace state as bounded
schema-v1 encrypted documents. AES-256-GCM provides authenticated encryption;
each write uses a fresh random 96-bit nonce and binds schema, project, Work
Item, handoff, model, and mapping-set identity as additional authenticated
data. The integration receives an explicit 32-byte key in memory and never
creates, derives, logs, or persists that key. Documents and directories use
`0600` and `0700`, writes are flushed, atomic, owner-locked, and fail closed.

Restoration requires the same key, exact transformed item/hash identity, and
the complete authenticated mapping. It is demonstrated locally only. A
successful transformation or restoration is review evidence, never model
authorization, delivery, execution, or evidence that all sensitive data was
found.

The primary GUI may preview transformation metadata and transformed inert
content after explicit review, but must not display original selected values,
mapping plaintext, keys, or local paths.

## Consequences

- users can prove byte-exact reversible transformation without altering source
  evidence;
- deterministic aliases preserve repeated-entity consistency inside a mapping
  set, while fresh nonces prevent deterministic ciphertext;
- key custody remains an explicit caller responsibility; OS keychains,
  passwords, recovery, rotation, and sharing require later decisions;
- automatic entity detection, custom dictionaries, delivery, network access,
  provider SDKs, and runtime permission remain outside this ADR;
- encrypted mappings remain sensitive local state excluded from source
  control, logs, exports, and ordinary artifact search.
