# ADR-0047: Use explicit scopes for reduced conversation context

Status: proposed
Date: 2026-09-22

## Context

ADR-0042 permits ordinary turns in General and project conversations without a
Work Item or handoff. The first implementation screened restricted patterns and
protected stable pseudonyms, but its reduced branch did not load the configured
policy or compose profile instructions. Its budget loop silently removed earlier
events and memory. A local digest stood in for an audit event that did not exist.

The existing policy, profile, instruction and privacy-audit v1 formats require
project identity, and the audit additionally requires Work Item and handoff
identities. General must not impersonate a project to reuse those formats.

## Decision

Keep the v1 project formats, readers, encodings and audit chains unchanged.
Introduce additive scoped configuration v2 with an explicit owner:
`{kind: "GENERAL"}` or `{kind: "PROJECT", projectId}`. General has no project
identity. Scoped readers accept v1 only for the matching project, normalize to
the scoped representation, and reject General/project or cross-project reuse.
Instruction source ownership is separate from its precedence scope; General
does not admit PROJECT-precedence instructions. Reuse the existing precedence
and privacy classification algorithms rather than duplicating their decisions.

Reduced turns require a valid configured profile, exact instruction source set
and policy for the selected model. Missing or incompatible references fail
before exposure. There is no permissive default for an invalid configuration.
Conflicting non-overridable instructions block the turn. Policy covers all
outgoing text, including the user question and provenance envelope. Content is
confidential unless explicitly classified by the existing policy semantics;
restricted screening and automatic stable pseudonymization still apply.
Screen original string values before JSON serialization as well, so escaping a
quoted assigned credential cannot hide it. This early rejection, like invalid
configuration, creates no policy audit event; valid preflight decisions use
the scoped audit below.

For this increment the policy item is `conversation.payload`, the entire
serialized envelope before pseudonymization. This deliberately conservative
unit prevents an assertion about one source from declassifying the user question
or metadata. Assertions naming absent items are invalid. Profile instruction
and continuity budgets and the target input limit are hard ceilings: exceeding
them refuses composition, without silently truncating the final envelope.

Collect reduced evidence with declared bounds before artifact reads: at most
128 recent events, 16 KiB per source, 64 KiB of serialized readings, 20 active
notes per explicitly linked project and bounded aggregate memory and metadata.
Validate General links against the canonical event hash and registered target.
Preserve event/session/memory identity and trust. Report budget omissions with
reason and count; unknown omitted byte sizes stay unknown. Unreadable, corrupt
or cross-scope evidence fails closed instead of becoming an empty result.
Existing whole-document store reads retain their separately enforced bounds;
this does not claim a metadata-only storage engine.

Use an additive non-content turn audit v2 for General and reduced project turns,
under a separate local namespace from the historical v1 project audit. Events
name explicit scope and conversation, never fictional Work Items or handoffs.
Record policy identity/digest, evaluated counts, known omitted bytes and unknown
byte omissions, report and payload digests. Private permissions, owner locks,
bounded reads, atomic durable publication and verified reread precede delivery.
Preview may extend the stable pseudonym map but records no audit or attempt.

Reuse composition for preview and send; reread configuration during the existing
pre-claim revalidation so policy/instruction changes invalidate the prepared
input. This does not add durable browser-request deduplication or bind an older
consultative preview to a subsequent send: those are separate contracts (ADR-0048 and the ADR-0042 amendment).

## Consequences

- General and conversations without handoffs remain supported with explicit
  configuration and source-linked, inspectable context.
- Existing v1 files and handoff behavior remain readable without migration.
- Existing reduced-turn fixtures and setups with nonexistent configuration
  paths must supply valid scoped files; the GUI reports unavailable context
  instead of silently ignoring those paths.
- The browser preview must show new instruction, source and omission material;
  it must not drop fields that the application sends.
- No runtime dependency, new provider, credential access or live call is added.
- This decision remains proposed; implementation tests do not accept it
  implicitly or demonstrate provider quality.
