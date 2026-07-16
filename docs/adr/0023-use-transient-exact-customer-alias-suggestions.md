# ADR-0023: Use transient exact customer-alias suggestions

**Status:** accepted  
**Date:** 2026-07-16

## Context

ADR-0021 accepts only explicitly reviewed schema-v1 UTF-8 spans and keeps
automatic entity discovery outside its boundary. Sprint 28 subsequently
measured deterministic standard syntax, exact configured aliases, and their
union against a frozen bilingual corpus. Exact aliases passed the review-only
gate; standard syntax and the union remain `REFINE` because telephone precision
fell to 50% on source-code-like text.

The current reviewed-span schema accepts `CUSTOMER` but not `PROJECT`.
Silently converting a project suggestion to `OTHER` would discard reviewed
meaning, while adding `PROJECT` to schema v1 would change its accepted enum and
break the promised compatibility boundary.

## Decision

Add production review assistance for exact configured `CUSTOMER` aliases only.
Each invocation receives an explicit bounded transient dictionary and one exact
profile-governed Context Pack. Matching is byte-exact and case-sensitive with
Unicode-aware token boundaries; every desired case variant is a separate entry.

Suggestions are deterministic `SUGGESTED_NOT_REVIEWED` metadata bound to
project, Work Item, handoff, model, item ID, current content SHA-256, entity
type, and exact UTF-8 byte range. Responses contain no dictionary value,
matched text, Context Pack content, local path, mapping, key, passphrase, or
recovery material. Duplicate aliases, malformed Unicode, controls, invalid
boundaries, conflicting overlaps, excessive bounds, stale composition, and
cross-scope input fail closed without partial output.

The dictionary exists only for the current request. It is not persisted,
logged, indexed, learned, exported, or added to canonical evidence. The GUI
keeps every suggestion unselected by default and requires explicit individual
confirmation. Confirmation creates only the existing transient schema-v1
`USER_REVIEWED` `CUSTOMER` selection; pseudonymization remains a separate
explicit action that revalidates the current item hash and range.

`PROJECT` suggestions are not exposed by this production boundary. A future
ADR must design schema v2 with permanent schema-v1 reads, explicit v2
writer/reader/facade/GUI compatibility, and no implicit migration before
project aliases can be confirmed.

## Consequences

- exact customer aliases can reduce manual range discovery without becoming
  verified identity, complete PII coverage, or automatic transformation;
- mapping schema v1, custody envelope schema v1, canonical Context Packs, and
  byte-exact restoration remain unchanged and migration-free;
- standard syntax, combined candidates, project aliases, correction memory,
  dictionary persistence, model/network access, delivery, routing, permission,
  and execution remain outside the boundary;
- the Sprint 28 harness remains development evidence; production code lives in
  `packages/privacy-gateway` and is regression-checked against the frozen
  customer-alias subset;
- schema-v2 project support is authorized for planning only, not implementation
  or rollout in Sprint 29.
