# ADR-0043: Use app-managed keys for stable local pseudonym maps

Status: proposed
Date: 2026-09-14

## Context

Project pseudonyms must remain stable across conversation turns, model changes,
and application restarts. ADR-0022 deliberately requires a passphrase-wrapped key
per immutable mapping-set identity. That recovery-oriented design removes raw key
handling, but the GUI must still ask for a passphrase during routine protection
and restoration. The evaluated continuation flow showed that this custody step is
not workable as part of every question.

AI Workspace's default deployment is local and single-user. Its immediate privacy
goal is to keep original values away from external model providers, not to defend
against a process or operating-system user that can already read the complete
workspace home. Filesystem permissions and authenticated encryption still protect
against accidental disclosure, partial writes, and undetected corruption.

## Decision

For the default local single-user profile, maintain one stable pseudonym map per
project and one separate map for General scope. Generate its random 32-byte key in
the application and persist that key in a separate, versioned local custody file.
The custody directory uses mode `0700`; key and mapping files use mode `0600`.
Writes remain bounded, locked, flushed, atomic, schema-validated, and
authenticated. Mapping plaintext, keys, original values, and local paths never
enter logs, audit records, transcripts, model requests, or commits.

The application resolves map and key identities from authoritative conversation
scope. The browser receives neither identity, key, mapping, nor filesystem path.
The stable map reuses the same typed readable placeholder for the same original
value and type. Collision, conflicting type, unsafe permissions, corrupt state,
unknown placeholder, or scope mismatch fails before external delivery or withholds
an unrestorable response.

This replaces ADR-0022's mandatory passphrase wrapping only for newly managed
default maps. ADR-0022 remains accepted for existing immutable mapping sets and
their custody envelopes, and its passphrase path remains available for legacy
migration and a future explicit export, backup, or high-protection mode. Existing
files are never rewritten or deleted during upgrade. Migration lists legacy
records without reading their content, asks for the old passphrase in Settings at
first use, validates and imports atomically, verifies a round trip, and retains the
source until a separate explicit removal.

Settings must state the residual threat plainly: app-managed custody does not
protect mappings from a process or account that can read the entire local
workspace home. No operating-system credential store, cloud service, runtime,
database, or third-party dependency is introduced by this decision.

## Consequences

- routine conversation turns require no passphrase and can reuse pseudonyms after
  restart or model changes;
- compromise of the complete local workspace home can expose both ciphertext and
  its app-managed key, an intentional limit of the default threat model;
- legacy passphrase-wrapped custody remains readable and migration is additive;
- implementation needs a new versioned custody format and explicit migration
  tests before the default changes;
- external delivery remains subject to ADR-0017, ADR-0036, ADR-0040, and strict
  restoration; key management alone grants no model or network authority.
