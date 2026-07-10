# ADR-0010: Scope handoffs to Work Items within projects

**Status:** accepted
**Date:** 2026-07-10

## Context

The Core MVP must hand an active objective from one agent to another. The
existing Project Registry identifies a repository, while `packages/core`
already sketches a Work Item as an objective within a repository. Active
memory and historical evidence are intentionally project-scoped because they
can support more than one objective.

A handoff attached only to a project would require an implicit “current task.”
That becomes ambiguous as soon as a project has concurrent or completed
objectives, and it makes later handoff history difficult to attribute. Making
the first handoff project-only would therefore create a format that must be
reinterpreted when Work Items become persistent.

The alternative is to make the initial Work Item model cover every future code
and document workflow. The public design explores that eventual unified model,
but freezing its full shape during the Core MVP would pull document analysis,
agent orchestration, skills, cost accounting, and context optimization into
the first cross-agent slice.

## Decision

The Work Item is the aggregate root for operational objective state and
handoff history. Every Work Item belongs to exactly one registered project;
every handoff names both IDs and is generated for one explicit Work Item. The
CLI must never infer a current Work Item merely because a project has one
active candidate.

Project-scoped capabilities remain outside the aggregate:

- canonical sessions and historical evidence belong to the project;
- active decisions, constraints, and failures belong to the project;
- immutable artifacts belong to the workspace and retain source ownership;
- a Work Item and handoff reference selected project-scoped records without
  copying or changing them.

The first persistent Work Item slice is deliberately narrow: one software
project, a bounded user-curated objective, explicit lifecycle state, selected
source links, and additive handoff snapshots. The existing `repositoryId`
field is renamed to `projectId` before persistence so the domain and Project
Registry use one identifier vocabulary. Future repository types may extend
the aggregate through later decisions; they do not enlarge the Core MVP.

A handoff is an immutable, source-linked snapshot attached to a Work Item, not
mutable task state and not an automatically trusted prompt. Creating a newer
handoff does not rewrite an older one. Each section retains its own provenance
and trust metadata so `UNTRUSTED` evidence, `USER_CURATED` memory, explicit
verification records, and observed repository state cannot be flattened into
one trust label.

This ADR does not select the serialized handoff format or local persistence
representation. Sprint 5 must perform the controlled second-provider format
spike before accepting those decisions.

## Consequences

- multiple objectives and handoff histories can coexist without an implicit
  project-global current task;
- project memory remains reusable across Work Items without becoming embedded
  or automatically promoted into a handoff;
- the first Work Item contract stays smaller than the eventual unified model;
- handoff commands require an explicit Work Item ID in addition to project
  isolation checks;
- Work Item persistence and lifecycle become prerequisites for the first
  durable handoff workflow;
- future document Work Items and context packs require separate increments and
  cannot claim Core MVP completion merely by sharing the aggregate name.
