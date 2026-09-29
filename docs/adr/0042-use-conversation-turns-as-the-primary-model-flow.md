# ADR-0042: Use conversation turns as the primary model flow

Status: proposed
Date: 2026-09-14

Implementation status: the turn composes this boundary with the existing context,
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

### Amendment: optional binding to a reviewed payload

The five required fields remain valid unchanged. An optional sixth field,
`reviewId`, names only an opaque server-created preparation, never a path or an
execution attempt. Exact-key validation accepts only those five fields plus this
UUID. The complete request, including `reviewId` when present, contributes to
the durable request digest; an absent field keeps the previous digest encoding.
The registry schema stays at v1 because its digest and scope envelope is unchanged.

The guarded `POST /api/conversations/:id/turn-preview` accepts optional boolean
`bindReview`. Ordinary previews remain consultative. With `bindReview: true`,
the response also contains the exact protected text, its digest, an opaque review
ID and expiry. Preparing a review may extend the stable local map but records no
audit or execution attempt and performs no delivery. A new-chat UI may first
create an empty local General conversation so the review has a canonical scope.

Preparations live only in server memory for five minutes, with at most 32 pending
payloads of 256 KiB each. Expired entries are removed on preparation; a full store
refuses new preparations rather than evicting valid ones. Restart invalidates all
pending reviews. Only the protected payload, request/binding digests and expiry
are retained here; no new disk store holds prompt text or pseudonym mappings.

A reviewed send consumes its review synchronously before asynchronous composition.
It binds exact draft, conversation/project, selected target and selection origin,
execution class, limits, policy, profile, instructions, source digests, mapping
and authoritative work/handoff or General relationships. Confirmation rereads
these inputs and checks expiry before the delivery exposure claim, including
after durable attempt preparation. Selection is reread after composition as well.
Any observed difference, missing review or unreadable input refuses exposure with
`REVIEW_INVALID`; stable confirmation passes the retained protected bytes to the
transport. Ordinary sends also revalidate target and scope before exposure.
These checks do not provide a cross-store transaction or filesystem-wide lock:
they compare bounded snapshots before claiming, not arbitrary future mutations.

One review cannot authorize another gesture. ADR-0048 still owns exact duplicate replay:
the same gesture returns its durable result even after review expiry or restart,
without consuming a second review or sending again. A crash after review
consumption does not restore authorization. Browser changes to draft, conversation,
target or protected terms invalidate the local review; refusal preserves the
draft. The UI keeps one `Send` action and an optional checkbox inside protection
details. No daily passphrase or mandatory preview is introduced.

This amendment remains proposed; offline verification does not authorize a live
provider or promote the decision to accepted.

### Coordination and composition

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
- the domain contract introduces no route, GUI change, provider transport, credential lookup, or
  external call;
- later increments must preserve drafts on pre-exposure refusal and must never
  automatically retry after possible exposure.
