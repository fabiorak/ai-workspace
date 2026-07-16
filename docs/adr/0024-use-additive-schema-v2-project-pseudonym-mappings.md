# ADR-0024: Use additive schema-v2 project pseudonym mappings

**Status:** accepted  
**Date:** 2026-07-16

## Context

ADR-0021 fixed reviewed spans and encrypted mappings as strict schema-v1
documents. ADR-0023 later allowed transient exact `CUSTOMER` suggestions, but
rejected `PROJECT`: schema v1 cannot represent that meaning, extending its enum
would alter the accepted contract, and conversion to `OTHER` would discard the
user's review.

Sprint 30 froze and executed a synthetic compatibility corpus before this
decision. The corpus preserves exact current v1 review, mapping, transformed,
and restored bytes; produces deterministic explicit v2 `PROJECT` bytes; reads
and restores independent v1 and v2 mapping sets together; and rejects
unsupported versions, v2 through a v1-only path, version downgrade, mixed
identity, altered scope, and altered authenticated mapping-schema metadata.

## Decision

Add separate reviewed-span and pseudonym-mapping schema-v2 contracts.
Schema v2 retains every schema-v1 entity type and adds `PROJECT`. Schema-v1
types, canonical serialization, validation, HMAC domain, reading, and
byte-exact restoration remain permanent and unchanged. A v2 mapping uses the
domain-separated HMAC label `ai-workspace/pseudonym/v2`; it is never
reinterpreted as v1.

Writer selection is explicit and additive. A confirmed review containing any
`PROJECT` span must use schema v2. A review containing only entity types
representable in schema v1 continues to use schema v1. Existing state is never
rewritten, upgraded, deleted, or implicitly migrated. Mapping-set identities
are immutable and unique across versions; attempting to reuse one fails
closed.

Readers dispatch only on an exact top-level schema version, validate the whole
document before returning a result, and reject unsupported versions,
noncanonical bytes, entity/pseudonym disagreement, mixed scope or identity,
and downgrade attempts without partial output. Restoration dispatches by the
validated mapping version and requires transformed item hashes, ranges, and
complete authenticated entries from that same version.

The encrypted mapping store keeps legacy v1 document bytes and reads exactly
as they are. New v2 encrypted mapping documents retain AES-256-GCM and the
same private atomic storage boundary, while authenticating
`mappingSchemaVersion: 2` with the exact project, Work Item, handoff, model,
and mapping-set scope as additional data. No v1 ciphertext is re-encrypted.

ADR-0022 key custody is independent of entity type, so its schema-v1 envelope,
KDF, wrapping, recovery, and immutability contract remain unchanged. Backup
and offline recovery continue to require both encrypted directories and the
passphrase. Older v1-only software can continue reading v1 state but must fail
closed on v2; rollback guidance must preserve v2 ciphertext until compatible
software is restored.

Exact alias suggestions may now accept transient `CUSTOMER` and `PROJECT`
entries. Every suggestion remains case-sensitive, current-hash-bound,
non-echoing, unselected `SUGGESTED_NOT_REVIEWED` metadata. Individual
confirmation creates a schema-v2 review if any selected entry is `PROJECT`;
pseudonymization remains a separate action that revalidates current content.
The facade, authenticated loopback route, and bilingual GUI expose the chosen
review/mapping version and explicit entity label without exposing dictionary
values, matched text, original mapping values, keys, passphrases, or paths.

## Consequences

- project aliases retain their reviewed meaning and restore byte-exactly;
- schema-v1 fixtures and stored mappings remain permanently readable without
  migration or changed bytes;
- v1 and v2 coexist as separate immutable mapping sets under one unchanged
  custody mechanism;
- v2-aware backup and downgrade guidance becomes user-visible;
- validators and storage have an additional explicit dispatch path, but no new
  runtime, dependency, database, service, network, model, delivery, routing,
  permission, or execution authority is introduced;
- standard syntax detection, automatic transformation, dictionary
  persistence, correction learning, export, sharing, sync, escrow, cloud
  recovery, passphrase rotation, and re-encryption remain outside this ADR.
