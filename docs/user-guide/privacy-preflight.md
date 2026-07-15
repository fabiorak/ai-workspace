# Preview a model privacy policy

The bilingual local GUI can evaluate one exact profile-governed Context Pack
against one explicit model data policy before any future delivery exists.

## Prerequisites

Select a registered project, an active Work Item, and an immutable handoff.
Provide:

- one reviewed schema-v1 agent profile and optional lowercase SHA-256 pin;
- every instruction bundle declared by that profile;
- one explicitly selected model allowed by the profile;
- one same-project schema-v1 model data policy and optional lowercase SHA-256
  pin.

The policy names the exact model, maximum allowed class, and zero or more item
assertions. Each assertion binds a Context Pack item ID to the SHA-256 of its
exact UTF-8 content. Changed, duplicate, dangling, cross-project, cross-model,
malformed, noncanonical, or oversized input fails closed without echo.

## Read the result

Every included item shows identity, category, trust, source identity, exact
bytes, content hash, effective class, classification source, detector category
when applicable, decision, and a non-echoing reason. Omitted budget items are
listed as not evaluated. Counts and bytes distinguish item bytes, shared
schema-v2 source-table bytes, and omissions.

Classification order is `PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED`.
Unasserted items default to `CONFIDENTIAL`. The narrow high-confidence detector
for private keys, access/provider tokens, and assigned credentials always
overrides a lower declaration and blocks the item. `RESTRICTED` can never be a
policy maximum.

`BLOCKED` means at least one evaluated item exceeds policy or matches a
restricted pattern. Correct the source content or choose/review an appropriate
policy; never copy a detected value into logs or issues.
`REVIEWABLE_NOT_AUTHORIZED` means only that evaluated items fit the inspected
policy. It is not model availability, permission, routing, anonymization,
delivery, execution, or proof of complete secret/PII detection.

The preview is transient. It creates no policy registry, decision record,
audit record, pseudonymization mapping, network request, model call, or runtime
authority.
