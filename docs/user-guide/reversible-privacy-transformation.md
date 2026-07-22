# Preview a reversible privacy transformation

The bilingual local GUI can replace explicitly reviewed spans in one exact
profile-governed Context Pack and persist the reversible mapping as separate
authenticated ciphertext. Nothing is sent to a model.

## Prerequisites

First run and inspect the model privacy preflight for the selected project,
Work Item, immutable handoff, profile, instruction sources, model, and policy.
The transformation form reuses those exact inputs.

The GUI can first propose exact, case-sensitive synthetic `CUSTOMER` and
`PROJECT` aliases. Enter one typed case variant per line, for example
`CUSTOMER: Cedar Demo` or `PROJECT: Quartz Demo`. The dictionary is used only
for that request and is never persisted. Every match starts
`SUGGESTED_NOT_REVIEWED`, remains unselected by default, and shows its current
item/hash-bound UTF-8 range. Select and confirm individual matches to populate
the reviewed-span form; transformation still requires the separate action
below. A customer-only review remains schema v1; confirming any `PROJECT` span
selects schema v2 explicitly.

For each value to transform, provide:

- the included Context Pack item ID;
- its exact lowercase content SHA-256;
- a non-empty start-inclusive/end-exclusive UTF-8 byte range;
- `PERSON`, `CUSTOMER`, `EMAIL`, `BUSINESS_IDENTIFIER`, or `OTHER` in schema
  v1; schema v2 also accepts `PROJECT`.

Also choose a new mapping-set identity and enter a custody passphrase containing
16 through 1,024 UTF-8 bytes. The local process generates an independent random
32-byte mapping key; raw hexadecimal key material is never shown. Do not reuse
a production credential or place a real passphrase in fixtures, logs, issues,
or documentation.

Back up both `privacy-mappings` and `privacy-key-custody` through your approved
private local backup process and retain the passphrase separately offline.
Both encrypted directories plus the passphrase are required after a workspace
move. Losing either the envelope or passphrase is irrecoverable. There is no
cloud recovery, export, synchronization, passphrase reset, or recovery from
ciphertext alone.

Schema-v1 and schema-v2 mappings use distinct immutable mapping-set identities
and can coexist. Older v1-only software must fail closed on v2 state: preserve
both encrypted directories without rewriting them and return to compatible
software. There is no automatic upgrade, downgrade, migration, or
re-encryption.

## Read the result

Reviewed values become inert aliases such as
`[[AW_CUSTOMER_0123456789ABCDEF]]`. Equal values with the same entity type use
the same alias inside the mapping set. Unselected bytes remain unchanged.

The GUI returns transformed inert content, hashes, aliases, ranges, counts,
limitations, and confirmation that the encrypted mapping was saved and read
back for a complete byte-exact local restoration. It never returns selected
original values, mapping plaintext, the mapping key, passphrase, or a local
path. The passphrase field is cleared after every attempt.

An existing mapping can later be used in the separate
[strict local output inspector](pseudonymized-output-restoration.md). That
inspector validates arbitrary text as a new all-or-nothing boundary; it does
not reuse this exact position-based Context Pack restore contract.

The separate mapping document uses AES-256-GCM authenticated encryption, a
fresh nonce, scope-bound metadata, private filesystem modes, owner locking,
flushed atomic publication, and bounded canonical validation. Wrong keys,
tampering, stale hashes, invalid Unicode boundaries, overlaps, unsafe modes,
temporary state, or cross-scope input fail closed without partial output. The
separate custody envelope uses scrypt and AES-256-GCM with fresh salt and nonce,
authenticated mapping-set scope, private modes, immutable atomic publication,
and bounded canonical validation. A wrong passphrase or altered envelope
returns no key and leaves existing encrypted state untouched.

## Important limitations

Customer and project suggestions are review assistance, not verified identity.
Standard syntax, automatic selection, correction memory, and complete
PII/secret detection are not implemented. Pseudonymized content remains
`CONFIDENTIAL` and pseudonymization is
not anonymization, permission, model availability, delivery, or execution.
Canonical evidence and Context Packs are never modified.

Rotation is additive: use a new mapping-set identity to create a new key,
envelope, and mapping. Existing mapping re-encryption, passphrase changes, key
or mapping export, and sharing are not implemented.
