# Sprint 9 — Curate Verifiable Active Memory in the GUI

**Primary epics:** E0 — Product foundation; E3 — Memory and Historical Search

**Milestone:** local GUI alpha, second complete vertical slice

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 8 completed

## Sprint goal

Let a first-time user turn explicitly selected historical evidence into active
project memory and manage its complete additive lifecycle through the primary
GUI, without CLI knowledge, hidden trust promotion, or loss of provenance.

## Design alignment

The public design requires GUI-first routine use, verifiable memory, separation
between historical evidence and active knowledge, persistent decisions, and
explicit supersession. Sprint 9 implements that boundary over the existing
`DECISION`, `CONSTRAINT`, and `FAILURE` domain. It does not adopt the design
document's illustrative numeric confidence or broader semantic-memory types.

## Committed backlog

### S9-01 — Freeze the evidence-to-memory interaction contract

- extend the guided progress and capability map with active-memory browse,
  creation, detail, provenance, terminal state, and recovery states;
- explain `UNTRUSTED`, `USER_CURATED`, verification, validity, confidence, and
  additive effects inline;
- require explicit source-event selection before every mutation.

### S9-02 — Extend the typed GUI application boundary

- wire `ActiveMemory`, atomic local storage, and same-project source reader
  through the existing facade;
- expose bounded list/show/add/verify/supersede/invalidate view models;
- preserve active-only default, project scope, deterministic pagination,
  terminal transitions, and actionable safe errors.

### S9-03 — Add authenticated bounded HTTP routes

- add declared GET routes for memory listing/detail;
- add CSRF-protected JSON mutations for create and lifecycle transitions;
- validate enums, arrays, limits, identifiers, body bounds, and project scope
  before domain execution.

### S9-04 — Guide evidence selection and memory creation

- add an explicit action from canonical event detail to use that event as
  provenance;
- guide type and content entry while keeping evidence visibly untrusted;
- show the newly created `ACTIVE`, `UNVERIFIED`, `UNASSESSED`, `USER_CURATED`
  item and its source-navigation action.

### S9-05 — Guide browse and complete additive lifecycle

- list active items by default with explicit terminal filters and bounded
  pagination;
- show complete lifecycle, source links, actor, timestamps, and versions;
- provide explicit verify, supersede, and invalidate forms with effects and
  recovery; never edit or delete in place.

### S9-06 — Prove trust, provenance, safety, and persistence

- acceptance-test search → source selection → create → reload → verify and
  separate supersede/invalidate paths across requests;
- cover missing/foreign source, project isolation, invalid filters, terminal
  transition, corruption, body bounds, inert rendering, keyboard labels,
  narrow viewport, and no content echo on rejection;
- prove no external request, model, agent, tool, instruction execution, or
  automatic evidence promotion.

### S9-07 — Close the slice

- run clean install, full check, audit, diff check, public scan, and isolated
  foreground GUI demo;
- only after all gates pass, synchronize user, architecture, security,
  planning, roadmap, design-state notes, and operational handoff;
- record review, retrospective, and the next GUI parity recommendation.

## Out of scope

- Work Item/handoff GUI parity and effective-instruction GUI preview; these are
  the next recommended parity slices;
- confidence assessment, re-verification, editing, deletion, automatic
  promotion, generated summaries, or Context Builder behavior;
- model/agent/tool execution, runtime permissions, private transcripts, native
  packaging, remote access, telemetry, or external assets;
- changing persisted active-memory schemas or trust vocabulary.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check
```

## Definition of done

- the visible GUI completes evidence selection through every active-memory
  transition without CLI or manual knowledge;
- all mutations require explicit same-project canonical sources and preserve
  additive provenance;
- trust, curation, validity, verification, confidence, effect, and recovery are
  visible at the point of use;
- HTTP, facade, persistence, safety, and complete synthetic journey tests pass;
- documentation and handoff are updated only after final gates;
- one final commit is created and no push is performed.

## Execution log

### 2026-07-12

- S9-01 extended the self-guiding contract from six to eight steps with
  evidence selection, active-memory creation, detail, lifecycle, trust, effect,
  and recovery guidance.
- S9-02 wired the existing provider-neutral `ActiveMemory` domain and atomic
  local adapters into the in-process GUI facade without importing CLI code.
- S9-03 added authenticated bounded list/show/add/verify/supersede/invalidate
  HTTP routes with enum, array, limit, project, CSRF, Origin, and body checks.
- S9-04 and S9-05 delivered explicit event-as-source selection, create and
  filter forms, lifecycle detail, provenance, active-only default, and additive
  verify/supersede/invalidate actions with terminal controls.
- S9-06 acceptance proved the complete lifecycle across facade and HTTP,
  persistence across requests, same-project source enforcement, missing
  sources, invalid filters, terminal behavior, corrupt memory fail-closed,
  inert rendering, labels, reduced motion, and narrow viewport behavior.
- The pre-documentation gate passed format, lint, typecheck, build, and 130
  tests. No schema, runtime dependency, external request, model, agent, tool,
  instruction execution, or automatic evidence promotion was introduced.

## Sprint review

The GUI now supports a second complete routine journey: a user can inspect
historical evidence, explicitly select it, create `USER_CURATED` active memory,
reload and filter it, inspect provenance, and record every supported additive
lifecycle transition. The interface keeps `UNTRUSTED`, `USER_CURATED`,
verification, validity, and `UNASSESSED` distinct at the point of action.

This closes GUI parity for active memory only. Work Item/handoff and effective
instruction preview remain visible follow-up priorities; no dead controls or
partial lifecycle were added for them.

## Retrospective

- Reusing the domain boundary made GUI parity possible without duplicating
  lifecycle rules or weakening fail-closed persistence.
- Defining one complete journey kept a broad parity request bounded and
  testable while preserving the public design's conceptual separation.
- Next experiment: plan Work Item plus handoff as one continuity cockpit, but
  accept it only if create, lifecycle, packet inspection, drift validation, and
  recovery fit one independently demonstrable sprint.
