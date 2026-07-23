# Sprint 39 — Introduce the Graphical Workspace Dashboard

**Primary epics:** E0 — Product foundation; E1–E7 — Workspace visibility

**Milestone:** GUI-first operational overview

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 38 completed; existing GUI remains local-only,
bilingual, authenticated, and self-contained

## Sprint goal

Turn the local GUI homepage into a curated, bilingual, accessible graphical
dashboard that explains the overall workspace state at a glance and provides
clear drill-down paths to existing workflows.

The dashboard must summarize only verified local state, define every metric,
show its coverage and limitations, and never expose private paths, content,
transcripts, mappings, secrets, or misleading model-delivery status.

## Product outcome

On opening AI Workspace, a user should immediately understand:

- whether the workspace is healthy and which areas need attention;
- how many projects are registered and whether their Git snapshots are fresh;
- the state of General Inbox, historical evidence, and active memory;
- the distribution and lifecycle of Work Items and handoffs;
- the privacy-preflight and non-content audit situation;
- which model-delivery boundaries are complete, evidence-only, unavailable, or
  awaiting explicit configuration;
- where to go next for every warning, empty state, or actionable condition.

“Overall state” means the bounded domains actually represented by current local
stores. It does not imply complete PII detection, provider truth, model
availability, or system-wide monitoring outside AI Workspace.

## Committed backlog

### S39-01 — Freeze dashboard information architecture and metric definitions

- inventory every current GUI domain and its authoritative local source;
- define cards, charts, status vocabulary, ordering, freshness, empty states,
  and drill-down destinations before implementation;
- distinguish counts, health checks, warnings, unavailable capabilities, and
  evidence-only decisions;
- define bounded aggregation limits and deterministic tie-breaking;
- exclude content snippets, private paths, raw identifiers, mappings,
  passphrases, credentials, provider receipts, and error bodies;
- review English and Italian information architecture together.

### S39-02 — Add a read-only dashboard summary contract

- create one application-level query that composes bounded aggregates from
  existing stores without changing them;
- isolate per-domain failures so the dashboard can show a precise unavailable
  card without inventing partial totals;
- include an as-of value, coverage description, source state, and explicit
  limitations for every aggregate;
- avoid persisting dashboard snapshots or introducing analytics, telemetry, an
  index, or a second source of truth;
- keep project scope and cross-project aggregation explicit.

### S39-03 — Build the graphical homepage with native local assets

- replace the current welcome-first homepage with a responsive overview while
  preserving onboarding for an empty workspace;
- use semantic HTML and CSS for status cards and simple bars;
- use local inline SVG only where a chart materially improves comprehension;
- provide an adjacent textual value or semantic table for every visual;
- never rely on color alone; use labels, values, icons or patterns, and status
  text;
- preserve the restrictive CSP, loopback-only host, no remote assets, and no
  telemetry.

The initial chart set should remain small:

1. Work Items by lifecycle state;
2. evidence and memory by trust or curation status;
3. recent privacy decisions by outcome over a bounded local window;
4. project and handoff freshness requiring attention.

Each chart must link to the relevant existing screen or a clearly explained
unavailable state.

### S39-04 — Make the dashboard curated and self-explanatory

- provide concise explanations, definitions, and “what to do next” guidance;
- cover empty, loading, complete, partial, stale, warning, corrupt-store, and
  unavailable states;
- distinguish product capability from planning or evidence status;
- show model delivery as unavailable until its separate boundaries are
  actually implemented;
- maintain complete English and Italian catalog parity;
- preserve user-authored content without translation.

### S39-05 — Validate accessibility, responsiveness, and truthful aggregation

- test keyboard navigation, focus order, landmarks, headings, link purpose,
  screen-reader labels, and reduced-motion behavior;
- test narrow, standard, and wide layouts without horizontal information loss;
- test high-count, zero-count, mixed-state, Unicode, stale, and partial-failure
  synthetic fixtures;
- prove displayed totals match deterministic application aggregates;
- extend interaction and localization contracts for every new visible state;
- update the GUI-first user guide and README screenshots or diagrams only if
  maintained repository-native assets are justified.

## Charting decision

Sprint 39 starts without a charting dependency. The current GUI can produce the
required bounded visuals with semantic HTML, CSS, and local SVG while preserving
offline operation, CSP, accessibility, small bundle size, and architectural
optionality.

Stop and propose a separate ADR before adding a chart library. That ADR must
compare at least:

- accessibility and non-visual equivalents;
- offline bundling and remote-asset behavior;
- CSP compatibility;
- bundle size and update surface;
- framework coupling and replaceability;
- localization and responsive behavior;
- maintenance and vulnerability burden.

A library is justified only if the frozen dashboard requirements cannot be met
clearly and accessibly with native primitives.

## Stop and re-plan triggers

Stop and request a decision if:

- a metric lacks an authoritative local source or truthful definition;
- aggregation would expose content, paths, identities, mappings, secrets, raw
  provider identifiers, or cross-project data outside its stated scope;
- a visual requires a new dependency, framework, remote asset, telemetry, or
  relaxed CSP;
- dashboard state would need persistence or become a competing source of truth;
- the GUI cannot provide full English and Italian parity;
- a chart cannot provide an equivalent textual representation;
- the scope expands into model delivery, credentials, routing, or execution.

## Out of scope

- model configuration, credentials, live probes, provider calls, responses, or
  delivery;
- attempt creation, resend, reconciliation mutation, routing, fallback, or
  execution;
- analytics, telemetry, remote monitoring, notifications, or background jobs;
- user-customizable dashboard layouts or arbitrary report builders;
- export, sharing, synchronization, cloud recovery, or external anchoring;
- complete secret or PII detection claims;
- a charting framework or new runtime dependency without a separate ADR.

## Verification plan

- deterministic aggregate contract tests for every card and chart;
- GUI application, server-route, interaction, and localization tests;
- accessibility-oriented structural assertions and reduced-motion checks;
- responsive synthetic fixture matrix;
- loopback acceptance journey from empty workspace through populated dashboard;
- format, lint, type-check, clean composite build, and full test suite;
- dependency audit, link check, diff review, staged-file review, and
  public-repository safety scan.

## Definition of done

- the homepage communicates bounded overall workspace state at a glance;
- every metric has an authoritative source, definition, coverage, and
  limitation;
- every visual has a readable textual equivalent and drill-down destination;
- empty, partial, stale, corrupt, and unavailable states are self-explanatory;
- English and Italian experiences are complete and equivalent;
- the dashboard is keyboard-accessible, responsive, reduced-motion safe, and
  color-independent;
- no private content, path, secret, mapping, raw receipt, or misleading
  provider state is exposed;
- no remote asset, telemetry, chart dependency, model, credential, delivery,
  routing, fallback, or execution surface is added;
- user-facing documentation reflects the new homepage.

## Planning decisions

- Sprint 39 follows Sprint 38 and is the next GUI-first product increment.
- Native HTML, CSS, and local SVG are the accepted starting point for charts.
- The dashboard is read-only and derives state on demand from authoritative
  stores.
- Visual polish, accessibility, localization, and explanatory states are part
  of completeness, not follow-up work.

## Outcome and retrospective

The GUI homepage now opens with a responsive read-only workspace overview. One
application query derives bounded aggregates on demand from the Project
Registry, General Inbox, active memory, Work Items, and privacy-decision audit.
Per-project read failures are counted as unavailable coverage rather than
silently converted to zero.

The dashboard shows project and Git attention, Work Item lifecycle, active
memory verification, privacy decisions, explicit coverage limits, drill-down
links, and a truthful model-delivery `UNAVAILABLE` state. It persists no
snapshot, exposes no content or private path, and uses no telemetry or network.

Cards use semantic HTML, CSS, printed values, and color-independent text. The
visual bars are decorative summaries with textual equivalents. English and
Italian catalog parity, refresh behavior, empty state, restrictive CSP,
reduced-motion support, application aggregation, and authenticated HTTP
delivery are covered by the existing GUI test layers.

No chart library, framework, remote asset, model, credential, delivery, routing,
fallback, or execution dependency was added. The user guide documents metric
meaning, coverage, and limitations.
