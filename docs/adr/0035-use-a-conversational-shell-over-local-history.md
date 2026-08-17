# ADR-0035: Use a conversational shell over local history

**Status:** accepted

**Date:** 2026-08-17

## Context

[ADR-0015](0015-use-a-loopback-built-in-web-host-for-the-first-gui.md) chose a
foreground loopback host with server-rendered semantic HTML and a first journey
that begins with project registration. That transport and its security boundary
have held. The interaction shape built on top of them has not.

The shell served today carries nine navigation entries, twenty-four sections,
twenty-two forms, fifty-six input controls, forty buttons, twenty-three advisory
panels, and fourteen declared-effect lines in one document. Its unit of
interaction is the form, so reaching a result requires knowing which area holds a
capability, which form inside that area performs it, and in which order forms
depend on each other. Several of those dependencies exist only in a status
sentence: the Context Pack forms require an inspected handoff, and the
transformation form requires an executed preflight. The product is a control
panel for people who already know its vocabulary.

The target is the opposite: a person who has read nothing resumes previous work
without opening a menu. That target is already declared with observable criteria,
and the retrieval engine it depends on is delivered — a tolerant local index
under [ADR-0031](0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)
and [ADR-0032](0032-index-one-merged-token-set-over-text-extracted-outside-the-engine.md),
answering within an interactive budget of 150 ms, with every result stating why
it matched.

One tension must be resolved rather than inherited. A text field at the centre of
a screen implies that something answers. No model is connected: no delivery
surface exists, and the product says so. Borrowing the shape without the
substance would create the largest expectation the product can fail.

## Decision

Replace the control-panel shell with a conversation over local history. The
transport, authentication, CSRF, header, and rendering rules of ADR-0015 are
unchanged; this record changes the interaction shape and the order of the first
journey, not the security boundary.

**What answers is the person's own history.** A question in ordinary language is
answered from what is already stored — moments of past conversations, decisions,
constraints, failures not to repeat — composed locally, each line carrying its
provenance and the reason it matched. Wording must not promise an external
assistant. A local generative model may later restate that answer in prose as an
optional, degrading layer, but only under its own ADR: the citation answer stays
the base level, the prose stays beside the cited material rather than replacing
it, and the 150 ms budget is not raised to accommodate inference.

**A work is a conversation.** The left-hand list holds conversations — imported
work sessions and project-free notes — most recent first, grouped by time.
Ordering uses the latest moment in a conversation, not its creation, because the
purpose is resuming. A session imported from a transcript has no
person-written title, so the product derives one from the first question that
person wrote in it; a generated summary is subject to the local-model decision
above. Where a Work Item is linked, its state appears beside the title: the Work
Item lifecycle of [ADR-0010](0010-scope-handoffs-to-work-items-within-projects.md)
and [ADR-0011](0011-use-atomic-operation-logs-for-work-items.md) is unchanged and
becomes a visible attribute instead of a navigation entry. No new domain object is
introduced; a work spanning several sessions appears as several rows.

**Writing does not require a registered project.** The first thing written lives
without a project, using the project-free scope and immutable project links of
[ADR-0018](0018-add-a-general-conversation-scope-with-lexical-search-first.md),
[ADR-0019](0019-use-separate-atomic-general-conversation-documents.md), and
[ADR-0020](0020-use-separate-immutable-general-project-links.md). Registration
remains available and explicit, and it is no longer the first step of the journey.
Project membership is never inferred: a wrong attribution would let a person
search the right place and find nothing, which for a memory product is worse than
asking. Scope stays visible wherever it determines which history is read.

**The dashboard remains and is no longer the entry page.** Opening the product
shows the person's own work. The bounded on-demand aggregates and inline SVG
charts are unchanged and remain reachable for whoever inspects overall state.

**The shell decomposes while it is rebuilt.** Presentation is separated by
responsibility, following the dependency direction of
[ADR-0003](0003-module-boundaries-and-dependency-direction.md): transport and
request validation know nothing of view composition; routes declare method, body
shape, and one facade call; the application facade is split per domain area and
still may not import persistence internals; view composition is pure functions
over view models, testable without HTTP; user-facing text is split per area with
both languages beside each key; client behaviour is split per zone and still never
uses `innerHTML`. The operative rule is that the three oversized presentation
modules may not grow: every addition lands in a new module, and their line counts
are asserted by test as non-increasing ceilings.

**Delivery proceeds in phases, with the not-yet-redesigned reachable in the
technical view.** The first phase must answer "where was I" without a menu: the
conversation list, the search field, the composed answer, opening a moment with
its integrity-verified source, and carrying the work to another assistant. It
excludes the preparation surfaces, the audit, the profiles, and the instruction
previews, which stay reachable in the technical view and are declared as in
transit rather than final. The technical view itself is not optional: every screen
keeps an explicit way to see provenance, integrity verification, exact state, and
original vocabulary.

**The declared interaction contract survives the change.** Screens keep declared
states, focus targets, status text, keyboard reachability, programmatic labels,
colour independence, and reduced-motion safety, and its journey vocabulary shrinks
with the sections it describes. A conversation that grows on its own must announce
result counts in a polite live region, must not move focus by itself, and must
expose each answer as a reachable heading.

Unchanged: loopback-only binding, `default-src 'none'`, zero runtime
dependencies, no telemetry, inert rendering of imported content, every result
stating why it matched, no visible relevance score, `UNTRUSTED` and
`CONFIDENTIAL` kept verbatim, no domain constant in the ordinary view, no fixed
widths and no text inside charts, and the command line retaining its capabilities
while every user capability exists in the GUI.

## Consequences

- resuming becomes the default path instead of a capability to locate, which is
  the criterion the experience target states;
- the product answers with material it can prove, so the shape stays honest while
  no model is connected, and gaining one later adds an interlocutor without
  contradicting anything a person learned;
- the left-hand list is populated at first run because imported sessions arrive on
  their own, which a list of hand-created Work Items would not be;
- refusing to infer project membership keeps one explicit choice in the path; the
  cost is accepted deliberately over silent misfiling;
- twenty-two forms lose their status as the unit of interaction, and the
  dependencies between them stop being knowledge a person must hold;
- the technical view temporarily hosts raw forms that are not its final shape, and
  saying so is required rather than optional;
- decomposing during the rebuild avoids reorganising code destined to disappear,
  but the module boundaries must be fixed before the oversized modules are
  touched, or the work is paid for twice;
- phased delivery keeps each step verifiable and lets the design be corrected by
  use rather than by argument;
- visual design, model delivery, repository-type decisions, the time dimension in
  the dashboard, and the first-use guide are consequences of this record and are
  not decided by it.
