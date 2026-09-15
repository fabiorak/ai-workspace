# ADR-0042: Use conversation turns as the primary model flow

Status: proposed
Date: 2026-09-14

Implementation status: U3 composes this boundary with the existing context,
privacy, `ModelDelivery`, durable attempt and conversation-writing services. The
standard host uses a local simulated transport; no real provider is activated.
For General conversations, this decision amends ADR-0019 with an additive
model-generated event variant and an atomic two-event append; it does not change
manual General capture.

## Context

The existing continuation path proves that AI Workspace can compose bounded
context, review privacy transformations, coordinate at-most-once delivery, restore
an answer, and retain it in the same conversation. Its GUI exposes those stages as
separate tasks. A person must understand handoffs, context packages, mappings,
passphrases, and delivery authorization before asking one question. The assisted
browser evaluation therefore rejected the flow even though its offline backend
journey passed.

ADR-0037 and ADR-0038 make restart summaries conversation-scoped, immutable, and
explicitly confirmed. Those properties remain necessary when a person chooses to
keep a curated restart point, but a restart summary is not a suitable prerequisite
for every model message. ADR-0040 and ADR-0041 already separate delivery and
current evidence behind provider-neutral boundaries, but their proposed GUI flow
still begins with manual continuation preparation and review.

## Decision

Make one conversation turn the primary model interaction. Its public input is
limited to `conversationId`, claimed `projectId` or `null`, `targetId`, exact
`userText`, and `clientRequestId`. The server resolves the authoritative
conversation scope, target configuration, context sources, optional Work Item and
optional handoff. A claimed project that differs from the authoritative scope is
rejected. The browser cannot select Work Item, handoff, mapping, policy,
instruction source, artifact, or attempt identifiers.

The provider-neutral `conversation-turn` boundary validates that input, resolves
scope before execution, and binds an idempotency claim to the conversation and
`clientRequestId`. The claim also carries a digest of the exact request, so reuse
of the identity with different content fails closed. Its idempotency port must
serialize concurrent claims, execute the operation once, and return the first
result to exact duplicates. This suppresses duplicate clicks before exposure; it
does not authorize a retry after an uncertain external outcome.

A conversation without a Work Item or handoff is valid. Those records enrich
context when present; their absence selects a reduced context from the
conversation, explicitly linked project material, active memory, and repository
observations that are available. General conversations remain project-free unless
an explicit existing link resolves otherwise. No scope is inferred from a single
candidate.

The application will compose the existing Context Builder, privacy preflight,
mapping, audit, ModelDelivery, attempt store, output restoration, and conversation
writer behind the turn boundary. Model responses remain untrusted conversation
evidence. ADR-0017's exact-content privacy decision, ADR-0040's durable claim
before exposure and zero automatic retry, and ADR-0041's bounded current evidence
remain in force. ADR-0040 and ADR-0041 stay proposed; this record does not change
their status.

The ordinary GUI will show one composer and one `Send` action. Technical context
and protection details remain inspectable but are not separate authorization
steps. Explicit restart-point persistence under ADR-0037 and ADR-0038 remains a
different local action. The legacy continuation workflow may remain temporarily
for migration but is no longer the target primary GUI.

## Consequences

- changing model target does not change conversation or require a handoff;
- duplicate client requests have a provider-neutral at-most-once boundary before
  the later delivery boundary applies;
- missing handoffs reduce available context instead of blocking ordinary turns;
- server-side resolution and exact request digests prevent browser-selected scope
  and identity reuse with changed content;
- U0 introduces no route, GUI change, provider transport, credential lookup, or
  external call;
- later increments must preserve drafts on pre-exposure refusal and must never
  automatically retry after possible exposure.
