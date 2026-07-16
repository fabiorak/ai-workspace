# Privacy mapping schema-v2 compatibility corpus

This frozen, synthetic corpus is the pre-ADR evidence gate for Sprint 30. It
does not authorize production schema-v2 behavior. The executable contract is
`packages/privacy-gateway/test/privacy-schema-v2-compatibility.test.ts`.

## Fixed inputs

- mapping key: 32 bytes, each with the synthetic value `0x07`;
- scope: `project-synthetic`, `work-synthetic`, `handoff-synthetic`, and
  `model-synthetic`;
- v1 mapping set: `mapping-v1-synthetic`;
- v2 mapping set: `mapping-v2-synthetic`;
- v1 content: `Customer Cedar uses marker Amber.`;
- v2 content: `Customer Maple works on Project Quartz.`.

The v1 review contains exact `CUSTOMER` and `OTHER` spans. The v2 review
contains exact `CUSTOMER` and `PROJECT` spans. Names are deliberately
synthetic and must not be replaced with real customer or project data.

## Frozen gates

1. The existing schema-v1 validator, writer, mapping bytes, pseudonyms,
   transformed bytes, and byte-exact restore remain unchanged.
2. Schema v2 has a separate canonical review and mapping document, a distinct
   mapping-set identity, and an HMAC domain separated as
   `ai-workspace/pseudonym/v2`.
3. A schema-v2 mapping represents `PROJECT` explicitly. It is never accepted
   by a v1-only reader and is never converted to `OTHER`.
4. Version dispatch accepts only exact schema versions 1 and 2. Unsupported,
   mismatched, mixed-identity, and downgrade cases fail closed without partial
   results.
5. v1 and v2 mappings can be read and restored in one process while remaining
   separate documents with separate identities.
6. The encrypted mapping document authenticates the exact mapping schema in
   AES-GCM additional data. Changing the declared version or scope fails
   authentication. The independent key-custody envelope remains schema v1 and
   is outside this mapping-format change.
7. Canonical mapping bytes are one compact JSON object followed by `\n`.
   Schema-v1 bytes are compared to the frozen current output; schema-v2 bytes
   are deterministic for the fixed input.

If any gate cannot be retained by production code, ADR-0024 must record
`NO_CHANGE` and production remains schema-v1 `CUSTOMER`-only.
