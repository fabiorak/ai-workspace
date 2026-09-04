# ADR-0038: Keep restart actions conversation-scoped and explicit

**Status:** accepted

**Date:** 2026-09-04

## Context

[ADR-0037](0037-compose-restart-summaries-continuously-and-persist-on-confirmation.md)
separates the continuously composed restart summary from the immutable packet a
person deliberately keeps. It does not record the decisions needed to make that
gesture truthful in the conversational shell, nor how an imported conversation
that has no Work Item stops being a dead end.

Those choices affect permanent attribution. A client-provided project, Work Item,
predecessor, or evidence selection could attach an immutable packet to work other
than the conversation being read. Persisting a composition that changed after it
was shown would keep evidence nobody reviewed. Deriving a Work Item automatically
would violate [ADR-0010](0010-scope-handoffs-to-work-items-within-projects.md).

## Decision

Restart actions remain inside the open conversation and the server resolves their
scope from authoritative links.

Keeping a restart point is a `POST` on that conversation's restart-point route.
The client sends an opaque mark of the composition it read, the reviewed next
action, and at most one optional test observation. The server recomposes the point,
rejects a stale mark without writing, chooses the newest predecessor for that Work
Item, and creates a successor rather than rewriting anything. The conversation
states the predecessor, or its absence, before confirmation.

The optional test observation contains command, outcome, and an optional time. An
empty observation writes nothing. A command may be offered again from the latest
kept packet; an outcome is never preselected, and an omitted execution time is not
replaced with confirmation time.

The latest kept packet can be reread in the conversation as a dated photograph.
It has no composition mark, present Work Item state, or confirmation control. Its
cited moments are resolved from the evidence it recorded; missing evidence is
declared rather than silently replaced.

An imported work-session conversation without a linked Work Item offers one
explicit action that accepts an objective written by the person. The server cites
the same recent meaningful moments the restart summary shows, creates the Work
Item, and marks it active as the two domain writes behind one stated gesture. It
does not infer an objective, project, Work Item, or evidence selection. A partial
outcome states that the Work Item was created but not activated.

## Consequences

- the ordinary path asks for no identifiers and gives the client no authority to
  choose immutable scope;
- a packet always represents the exact composition a person reviewed;
- confirmation, test observation, and Work Item creation remain explicit local
  writes protected by the existing mutation guard;
- a kept photograph never claims to be current state;
- the CLI remains a technical surface, and no schema, model, dependency, or
  automatic persistence is added.
