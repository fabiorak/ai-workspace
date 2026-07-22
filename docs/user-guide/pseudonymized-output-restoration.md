# Restore pseudonyms in bounded local output

The bilingual GUI can inspect one bounded local text containing AI Workspace
pseudonyms and restore exact values from one existing encrypted mapping. This
action is local, user-triggered, and separate from Context Pack transformation.
It does not invoke a model, capture a response, send data, or authorize delivery.

## Prerequisites

- open the exact originating project, Work Item, and immutable handoff;
- retain both encrypted mapping and key-custody directories;
- know the immutable mapping-set identity and its custody passphrase;
- paste no more than 30,000 characters into the loopback GUI form.

The model and mapping schema come from the authenticated mapping. The form does
not allow them to be overridden.

## Strict validation

Every construct beginning with `[[AW` in any ASCII case is validated before any
restored content is constructed. Exact known whole tokens may be repeated,
reordered, or placed in new English/Italian text. Every other UTF-8 byte is
preserved.

An unknown, foreign, truncated, lower-cased, nested, extra-bracket, wrong-type,
or otherwise malformed placeholder blocks the complete result. The GUI returns
`BLOCKED_INTEGRITY_FAILURE` and no restored content. Text without a pseudonym
returns `NO_PSEUDONYMS` and no restored content.

On success, `RESTORABLE_LOCAL_EVIDENCE` returns the restored text plus hashes,
byte/token counts, schema version, and limitations. The passphrase field is
cleared after every attempt.

## Privacy and recovery

Candidate and restored text remain transient browser/process values. They are
not stored as memory, history, artifacts, audit events, mappings, or responses,
and errors do not echo them. A local process with the same user privileges may
still inspect process memory, so close the page after review and avoid real
sensitive material unless the local environment is trusted.

If validation fails, preserve both encrypted directories unchanged. Verify the
originating scope, mapping-set identity, passphrase, and placeholder integrity.
There is no passphrase reset, mapping/key export, cloud recovery, implicit
migration, or re-encryption.

This inspector validates exact mapping ownership only. It is not complete PII
or secret detection, anonymization, privacy-policy approval, model permission,
response authenticity, delivery, routing, or execution.
