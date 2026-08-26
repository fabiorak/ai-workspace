# ADR-0037: Compose restart summaries continuously and persist on confirmation

**Status:** accepted

**Date:** 2026-08-26

## Context

[ADR-0010](0010-scope-handoffs-to-work-items-within-projects.md) exists to hand
an active objective from one agent to another. That is the situation a person
actually meets when an agent exhausts its context window mid-task and the work
must continue with a different agent without re-explaining the project or
letting the new agent rediscover it.

Today that capability is reachable only through explicit CLI invocations that
require a project ID, a Work Item ID, and canonical source-event IDs. This
product is primarily a graphical interface: a capability reachable only by
typing a command is, for the person using it, absent.

The timing is worse than the ergonomics. An immutable packet must be created
_before_ the context is exhausted, because the agent that ran out of context can
no longer produce one. The moment when the packet is most needed is exactly the
moment when nobody remembers to ask for it.

Automatic creation is not available as a remedy.
[ADR-0012](0012-store-handoffs-as-immutable-json-files.md) makes every packet
immutable, so unrequested packets could not be cleaned up afterwards. More
decisively, the `nextAction` section carries `USER_INPUT` origin and
`USER_AUTHORED` observation. A system-generated next action under that metadata
would misrepresent provenance, and the receiving agent would treat uncurated
text as curated instruction. In a product that keeps `UNTRUSTED`,
`USER_CURATED`, and `OBSERVED` apart, that is the worst available defect.

Section 4 of the conversational shell design already assigns the restart summary
a destination: it stays at the end of the work conversation. What that table
does not decide is when the summary is composed and when the person is asked to
fix it.

`Handoffs.preview` already performs the same construction, validation, and
bounded repository capture as `Handoffs.create` but returns the packet without
persisting it. Composition and persistence are therefore already separable
without changing the domain.

## Decision

Separate composing a restart summary from persisting one.

Composition is continuous and writes nothing. The shell composes the restart
summary through the non-persisting preview path and shows it at the end of the
work conversation, expanded rather than collapsed. It is recomposed when the
conversation is opened and whenever continuous transcript import adds new
moments, so the visible summary is never stale.

The shell proposes fixing the restart point at three events, and a proposal
writes nothing:

- estimated context pressure, derived locally from accumulated imported
  transcript bytes for the work;
- a work conversation left aside, through inactivity or a move to other work,
  with unfixed material;
- the appearance of a session from a different assistant on the same work.

Persistence remains one deliberate confirmation. The next-action field is
prefilled with a draft composed from local material already present — the Work
Item objective and recent moments — and is marked as needing review. The draft
is composed by assembling existing local text; no model produces it, and
`ADR-0035` still governs any future model-written prose. The person sees and
confirms the exact text that will be persisted, as
[ADR-0034](0034-propose-a-complete-local-anonymization-for-one-approval.md)
already requires for an outbound operation, which is what makes the
`USER_CURATED` attribution true.

The open work conversation supplies the Work Item. This is not the inference
ADR-0010 forbids: the Work Item is declared by the person's act of opening that
conversation, not deduced from being the only active candidate. Project
attribution is never automatic, and the existing General-to-project linking
decisions continue to govern it.

Immutability is unchanged. Confirmation creates a successor; no existing packet
is refreshed, rewritten, or reverse-linked. The CLI commands remain available as
a technical surface.

## Consequences

- continuing work with a different agent no longer requires typing a command or
  knowing an identifier;
- the restart point is offered while it can still be fixed, instead of being
  remembered after the context is gone;
- no immutable packet is ever created without an explicit confirmation over the
  exact persisted next action;
- context pressure is a local byte estimate, not a provider token count: it
  warns early and approximately, and can be wrong in both directions;
- a prefilled draft reduces friction but adds a review obligation that the
  interface must keep visible;
- section provenance and trust metadata keep their existing meaning, and no new
  handoff schema version is introduced;
- no model is invoked, delivered to, or authorized, and no runtime, framework,
  database, or external dependency is added.
