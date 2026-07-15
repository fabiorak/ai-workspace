# Preview a reversible privacy transformation

The bilingual local GUI can replace explicitly reviewed spans in one exact
profile-governed Context Pack and persist the reversible mapping as separate
authenticated ciphertext. Nothing is sent to a model.

## Prerequisites

First run and inspect the model privacy preflight for the selected project,
Work Item, immutable handoff, profile, instruction sources, model, and policy.
The transformation form reuses those exact inputs.

For each value to transform, provide:

- the included Context Pack item ID;
- its exact lowercase content SHA-256;
- a non-empty start-inclusive/end-exclusive UTF-8 byte range;
- `PERSON`, `CUSTOMER`, `EMAIL`, `BUSINESS_IDENTIFIER`, or `OTHER`.

Also choose a new mapping-set identity and supply a volatile 32-byte key as 64
lowercase hexadecimal characters. The current alpha does not generate,
remember, recover, rotate, or synchronize this key. Losing it makes the
mapping unusable. Do not reuse production credentials or paste a real secret
into fixtures, logs, issues, or documentation.

## Read the result

Reviewed values become inert aliases such as
`[[AW_CUSTOMER_0123456789ABCDEF]]`. Equal values with the same entity type use
the same alias inside the mapping set. Unselected bytes remain unchanged.

The GUI returns transformed inert content, hashes, aliases, ranges, counts,
limitations, and confirmation that the encrypted mapping was saved and read
back for a complete byte-exact local restoration. It never returns selected
original values, mapping plaintext, the key, or a local path. The key field is
cleared after every attempt.

The separate mapping document uses AES-256-GCM authenticated encryption, a
fresh nonce, scope-bound metadata, private filesystem modes, owner locking,
flushed atomic publication, and bounded canonical validation. Wrong keys,
tampering, stale hashes, invalid Unicode boundaries, overlaps, unsafe modes,
temporary state, or cross-scope input fail closed without partial output.

## Important limitations

Spans are manually reviewed; there is no automatic or complete PII/secret
detection. Pseudonymized content remains `CONFIDENTIAL` and pseudonymization is
not anonymization, permission, model availability, delivery, or execution.
Canonical evidence and Context Packs are never modified.
