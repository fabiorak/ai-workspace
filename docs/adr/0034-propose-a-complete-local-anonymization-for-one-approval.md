# ADR-0034: Propose a complete local anonymization for one approval

**Status:** accepted

**Date:** 2026-08-17

## Context

[ADR-0021](0021-use-reviewed-spans-and-encrypted-local-pseudonym-mappings.md)
accepts only explicitly reviewed, item-scoped UTF-8 byte spans, and
[ADR-0023](0023-use-transient-exact-customer-alias-suggestions.md) adds
transient exact alias suggestions that are unselected by default and confirmed
one at a time. Both records place detection outside the boundary on purpose:
automatic inference had unmeasured false-positive and false-negative risk, and
a reviewed span is attribution of a human review rather than proof of complete
detection.

That boundary makes the software wait for work a person cannot do well. Preparing
one item requires an item ID, a 64-character content digest, and exact byte
offsets, so the primary surface asks for byte ranges and digests before it can
show anything. The review then happens over coordinates rather than over the text
that would leave the device, which is the artifact the decision is actually
about.

Reversing the roles does not weaken the original concern. Nothing leaves the
device until a person has inspected the exact outgoing text; inspecting a
rendered result is a stronger check than assembling offsets, because a missed
substitution is visible in the result and invisible in a list of ranges.

Two neighbouring records constrain how this can be done.
[ADR-0024](0024-use-additive-schema-v2-project-pseudonym-mappings.md) makes
review and mapping schemas v1 and v2 permanent and byte-identical, so the
`attribution` enum cannot be extended in place, and a third schema would add a
writer, a reader, a domain-separated HMAC label, and a compatibility corpus.
[ADR-0033](0033-qualify-rizzo-pii-behind-an-interchangeable-local-detection-port.md)
qualifies an interchangeable local detection port but adopts no detector; the
exact configured aliases and deterministic forms that ADR-0023 already ships are
in production today and are enough to compose a proposal.

## Decision

Amend ADR-0021 and ADR-0023 on three points. Both records remain accepted for
everything else; this record supersedes neither.

**1. The software composes the proposal; the person does not.** The boundary
still accepts only exact UTF-8 byte spans bound to an item ID and the current
content SHA-256, and every existing rejection still applies. Constructing those
spans becomes the software's responsibility. No user-facing surface asks for a
byte offset, a content digest, or hand-written selection input. Adding or
removing a substitution happens over the rendered text, and the product converts
that gesture into byte ranges, validating code-point boundaries, overlap,
ordering, scope, and hash freshness, and failing closed exactly as it does now.

**2. Proposed substitutions are applied by default, and one approval covers the
whole transformed text.** This reverses the unselected-by-default,
confirm-each-suggestion posture of ADR-0023. The unit of review is the exact text
that would leave the device, not the individual span. A person may remove a
proposed substitution or add a missed one before approving, and is never required
to construct one.

**3. Approving the anonymization is not a confirmation separate from approving
the outbound step.** When preparation serves an outbound purpose there is one
question, asked over the exact already-transformed text. An anonymization that
stays local requires no confirmation, and approval remains review evidence and
never model authorization, delivery, or execution.

**Attribution is unchanged.** `attribution: "USER_REVIEWED"` keeps the exact
meaning ADR-0021 gives it: attribution of a human review, not proof of complete
detection and not permission to transmit. Approving the exact transformed text is
that review. Review and mapping schemas v1 and v2 are not extended, reinterpreted,
or migrated, and no third schema is introduced.

**Candidate provenance is recorded outside the encrypted mapping.** Whether a
candidate originated from a detector or from a person is not represented in the
mapping document: restoration does not need it, and representing it would cost a
permanent schema. Aggregate counts belong to the bounded non-content audit of
[ADR-0026](0026-use-a-bounded-local-non-content-privacy-decision-audit.md), and
detector evidence stays within the limits of ADR-0033 — category, confidence,
evidence source, and versions, never the matched value.

**Incomplete coverage is stated once.** A proposal is incomplete by construction.
The existing contract limitation
`USER_REVIEWED_SPANS_ONLY_NOT_COMPLETE_PII_OR_SECRET_DETECTION` remains, and the
sentence that says so appears once beside the text awaiting approval rather than
on every screen.

**What composes a proposal today** is the exact configured aliases and
deterministic forms already in the product. A detector reaching production
through the ADR-0033 port later improves coverage without changing this approval
flow. A missing, unavailable, unsupported, or malformed detector reduces the
proposal to what is available and states that reduction; it does not block local
preparation, and it never authorizes untransformed content to leave the device.

Everything else is unchanged: local application from the end of each item;
deterministic HMAC pseudonyms within one mapping set and key; encrypted schema-v1
and schema-v2 mappings; passphrase-wrapped custody under
[ADR-0022](0022-use-passphrase-wrapped-local-mapping-keys.md); strict
all-or-nothing restoration under
[ADR-0025](0025-use-strict-local-pseudonymized-output-restoration.md);
fail-closed restricted-data screening under
[ADR-0030](0030-screen-restricted-data-per-record-in-the-tolerant-reader.md); the
inspectable privacy decision of
[ADR-0017](0017-require-an-inspectable-privacy-decision-before-model-delivery.md);
and unchanged canonical evidence. The primary GUI still shows no original
selected value, mapping plaintext, key, passphrase, or local path.

## Consequences

- effort moves from constructing coordinates to checking a result, which is the
  task a person performs well;
- the review happens over the artifact that matters, so a missed substitution is
  visible where the decision is made;
- applying proposals by default admits substitutions accepted through inertia.
  Its defence is that every substitution is evident in the approved text and can
  be removed there, not a second confirmation;
- one confirmation disappears from the complete path, and the remaining one is
  about what leaves the device;
- no migration, no third schema, and no new HMAC domain;
- the encrypted mapping cannot later distinguish a detector-found candidate from
  a person-found one; that distinction lives in the non-content audit;
- the ADR-0033 detection port becomes a coverage improvement rather than a
  precondition for the preparation experience;
- exact alias suggestions stop being a per-item confirmation surface and become
  one input among others to a single proposal;
- automatic detection remains assistance. Human inspection of the exact outgoing
  text, encrypted local mappings, strict restoration, and explicit external
  authorization remain the security boundary.
