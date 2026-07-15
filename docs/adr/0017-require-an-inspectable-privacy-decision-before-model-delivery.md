# ADR-0017: Require an inspectable privacy decision before model delivery

**Status:** accepted  
**Date:** 2026-07-15

## Context

AI Workspace can compose an exact, profile-governed Context Pack, but it has no
model-specific privacy decision at the future outbound boundary. The existing
ingestion screen blocks a narrow set of high-confidence credentials before
persistence; it is not a reusable outbound policy and its success is not proof
that content is free of sensitive data.

Privacy classification already defines `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`,
and `RESTRICTED`, with unknown content defaulting to `CONFIDENTIAL`. A future
delivery path must not infer permission from a profile, user-authored
classification, digest, or successful scan.

## Decision

Every future model delivery must consume an explicit, inspectable privacy
decision over the exact content and selected model before transmission. Sprint
22 implements only a read-only preflight and introduces no delivery consumer.

Classification uses the order `PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED`
and most-restrictive-wins whenever evidence conflicts. An item without an exact
policy assertion defaults to `CONFIDENTIAL`. A high-confidence restricted-data
detector result always sets the effective class to `RESTRICTED` and cannot be
downgraded. A model policy may allow at most `CONFIDENTIAL`; `RESTRICTED` is
never an allowable maximum.

The overall result is either `REVIEWABLE_NOT_AUTHORIZED` or `BLOCKED`. Item
results are `ALLOWED_BY_POLICY`, `BLOCKED_BY_POLICY`, or
`BLOCKED_RESTRICTED_PATTERN`. Reviewable means only that no evaluated item
exceeded the selected policy. It does not authorize or perform model
availability lookup, permission, routing, anonymization, delivery, execution,
or prove complete secret/PII detection.

Portable policy assertions bind an item ID to the SHA-256 of its exact UTF-8
content. User configuration is attribution, not verified truth or permission.
Validation and evaluation fail closed without echoing policy content,
restricted matches, or local paths.

## Consequences

- future delivery requires a later ADR and an accepted gate consumer;
- the first preflight is deterministic, provider-neutral, local, transient,
  model-specific, and inspectable;
- stale, extra, duplicate, cross-scope, cross-model, malformed, noncanonical,
  or oversized policy input is rejected;
- the narrow high-confidence detector can be shared with ingestion while its
  existing behavior remains regression-protected;
- semantic PII detection, pseudonymization, encrypted mappings, credentials,
  model SDKs, network access, permission enforcement, persistence, audit
  storage, routing, and execution remain outside this decision.
