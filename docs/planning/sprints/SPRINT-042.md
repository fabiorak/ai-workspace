# Sprint 42 — Screen Restricted Data per Record and Chart the Dashboard

**Primary epics:** E0 — Product foundation; E2 — Session ingestion; E1–E7 —
Workspace visibility

**Milestone:** M5 — Privacy-ready beta

**Status:** completed

**Cadence:** scope-bounded increment (no timebox)

**Dependency:** Sprint 41 completed; tolerant `claude-code-local` reader
available; multi-page local GUI shell available in `2c7cdd2`; ADR-0029 records
the reversal of the synthetic-only ingestion posture

## Sprint goal

Make the product usable on the history of the project that builds it, and make
the local state readable at a glance instead of only countable.

Sprint 41 delivered real transcript ingestion, and the first real dogfooding
attempt failed immediately: the import was refused with
`Restricted data detected in session source (private-key); import blocked`. No
real key existed. The detector looks for the literal
`-----BEGIN PRIVATE KEY-----`, which this repository quotes as a synthetic
canary in its own security tests. Screening was per file and fail-closed on the
whole import, so every session that had ever read those tests — that is, every
session that had done the work — was permanently unimportable. A false positive
of meaning is still a true positive of pattern, so the answer could not be to
weaken the detector.

The same increment closed the other half of the dogfooding gap. The Sprint 39
dashboard reported the workspace as four numbers and four decorative bars. The
numbers were correct and unreadable: nothing showed proportion, and nothing let
a user act on what a number said.

## Delivery order

Delivered as one sprint in two commits. Screening came first because it was
blocking: without it the project could not read its own sessions, so no evidence
about the dashboard's usefulness could be gathered from real use. The charts
came second, on top of the state the first commit made reachable.

## Product outcome

A real transcript that quotes a credential pattern imports. The record that
carries the pattern does not: it produces no event, is left out of the source
content the reader returns, and is counted by category in the import report, on
its own line in the CLI and in its own bilingual notice in the GUI. If every
convertible record is excluded, the import fails and writes nothing.

The dashboard shows the same authoritative values as charts: project health, the
Work Item lifecycle, active memory verification, and privacy decisions. Every
chart states its own numbers in text and repeats them in a table, so no
information exists only as a shape or only as a colour. Where a chart counts a
subset — projects that need attention, blocked Work Items — its link opens the
destination page already filtered to exactly that subset.

## Scope

### S42-01 — Classify restricted data per record in the tolerant reader

- classify each record before converting it, so exclusion is a property of the
  record and not of the file;
- exclude per line, because a pattern can straddle two blocks of one record and
  the line is the unit of provenance;
- count the exclusion as `RESTRICTED_DATA:<category>` from a closed set of
  detector names that collapses unknown names to `other`;
- keep the matched value out of every artifact, event, reason, error message,
  and log;
- fail the import with a dedicated message, writing nothing, when every
  convertible record is excluded;
- leave the provider-neutral core fail-closed on whatever it receives: a second
  port reports a category instead of throwing, and both shapes read the same
  overlapping window scan;
- keep the narrow synthetic reader failing the whole import closed.

### S42-02 — Report the exclusion where it cannot be missed

- report exclusion on its own line in the CLI and in its own bilingual notice in
  the GUI, because an import that is partial for a security reason must be
  impossible to overlook;
- keep telling the user on both surfaces to rotate anything that was real, since
  a discarded record is not a rotated credential;
- record the decision in ADR-0030, amending ADR-0029 on the screening point
  only.

### S42-03 — Generate accessible charts as pure functions

- render inline SVG from pure functions in `apps/web/src/charts.ts`, with no
  chart library and no new runtime dependency;
- give every chart `role="img"` with a title and description referenced through
  `aria-labelledby`, never `aria-hidden`;
- state every value in the visible legend and repeat every series in a table, so
  the figure is never the only carrier of the information;
- express every colour through a `chart-tone-*` class bound to a CSS variable,
  never a literal colour, so both themes and forced-colour modes stay legible;
- add no animation that a reduced-motion preference cannot disable.

### S42-04 — Serve the charts as a presentation fragment

- render the fragment on the server from the same authoritative dashboard the
  JSON endpoint reports, so the browser holds no chart geometry and no second
  copy of the wording;
- serve it from `GET /view/dashboard-charts?locale=…` behind the same session
  cookie as every other read, resolving an unsupported or absent locale to `en`;
- leave the Content-Security-Policy unchanged;
- insert the fragment with `DOMParser` and `replaceChildren`, never `innerHTML`,
  so nothing a response carries can become behaviour.

### S42-05 — Make the drill-down real

- parse the query out of the hash route before the path, so a filtered
  destination names a page instead of failing back to the dashboard;
- filter the projects page on the same predicate the dashboard counts, and the
  Work Items page on the item status;
- show an explicit indicator of the active filter with a control that removes
  it, and state plainly when the filter leaves nothing;
- offer a filtered link only when it would match something.

## Decision gates

The increment could be accepted only if:

1. a record carrying a high-confidence pattern is excluded whole and counted,
   while the rest of the transcript still imports;
2. no matched value reaches an artifact, an event, a reason, an error, or a log;
3. the provider-neutral core and the narrow synthetic reader are unchanged in
   posture;
4. an import whose every convertible record is excluded writes nothing;
5. every chart carries a textual and a tabular equivalent;
6. no chart depends on colour alone and none animates against a reduced-motion
   preference;
7. the fragment is authenticated, locale-resolved, and inserted without
   `innerHTML`;
8. the Content-Security-Policy is unchanged;
9. a filtered link opens a destination that really shows the counted subset;
10. no new runtime dependency, network access, or remote asset is added.

## Stop and re-plan triggers

Work stopped for a decision if:

- correct ingestion appeared to require relaxing a detector or introducing an
  allowlist;
- a real credential had to be committed to verify screening;
- a chart could not be made understandable without colour;
- a filtered destination could only show part of the counted subset;
- the scope expanded into a chart library, a client-side framework, or any
  network access.

## Out of scope

- user acknowledgement of an excluded record, and any per-record override;
- looser detectors, allowlists, or redaction of a matched value in place;
- filtered drill-down into active memory and the privacy audit. Both lists are
  paginated by the server — memory in pages of twenty, audit in pages of one
  hundred per project — so a filter applied to the loaded page would present a
  subset as if it were the total. Their links open the page unfiltered, and both
  pages already carry their own filter controls;
- charting anything the dashboard does not already report;
- historical series, trends, or any stored measurement over time;
- export, printing, or image rendering of a chart;
- model delivery, which remains unavailable by construction.

## Test strategy

- reader tests over a synthetic transcript that quotes each detector category,
  asserting the surviving events, the exact skip accounting, and the absence of
  the matched value from every output;
- a test that an import whose every convertible record is excluded writes
  neither artifact nor session;
- pure-function chart tests over the geometry: full turn, empty series,
  single-slice, and rounding behaviour;
- fragment tests asserting four `role="img"` figures, no `<script>`, the table
  equivalents, locale resolution for `it`, `de`, empty, and absent, and the
  unchanged security headers;
- an authentication test that the fragment is refused without a session cookie;
- a drill-down test that lifts the shipped route parser out of the served script
  and runs it against the links the fragment actually emits, so the link and the
  parser cannot drift apart;
- assertions that the served stylesheet expresses chart tone through variables
  only, and that the served script never assigns `innerHTML`;
- full repository quality gate, dependency audit, link check, diff review, and
  public safety scan.

## Definition of done

- a real transcript that quotes a credential pattern imports, minus the records
  that carry it, with the exclusion counted and shown on both surfaces;
- no matched value is stored, reported, or logged anywhere;
- the dashboard states the local workspace as charts that are readable without
  colour, without motion, and without sight of the figure;
- every counted subset can be opened and really is filtered;
- no new dependency, remote asset, or network access exists;
- the security policy and the authentication boundary are unchanged.

## Planning decisions

- Screening moved to per-record granularity inside the tolerant adapter rather
  than into the provider-neutral core, because tolerance is an ingestion
  property and the core must keep failing closed on whatever it receives.
- The detector set was not relaxed. A canary in a security test is a true
  pattern match, and a project that weakens its own detectors to read its own
  history has traded a real guarantee for a convenience.
- Exclusion is per line rather than per block, because a pattern can straddle
  two blocks of one record and provenance is recorded by line.
- Charts are pure functions producing inline SVG rather than a library, because
  a dashboard is not worth a runtime dependency, a remote asset, or a second
  rendering model inside a page served under a strict policy.
- The charts are rendered by the server and fetched as a fragment so that the
  wording, the number formatting, and the geometry exist once, in tested code,
  instead of twice in two languages.
- The drill-down was made real rather than decorative: a link that opens an
  unfiltered page after the user clicked a specific number is a worse experience
  than no link, because it silently changes the question being asked.
- Memory and privacy were excluded from the filtered drill-down deliberately.
  Filtering only the loaded page of a server-paginated list would show a subset
  as a total, which is the exact failure the accounting elsewhere in this
  project exists to prevent.

## Outcome and retrospective

The tolerant reader now classifies before it converts. A record that carries a
high-confidence pattern is excluded whole, counted by a closed category name,
and never contributes to an artifact, an event, a reason, or a message. The
project can read its own history: the sessions that quote the repository's
synthetic canary import, minus the lines that quote it. What was excluded is
stated on its own line in the CLI and in its own notice in the GUI, and both
surfaces still say that a discarded record is not a rotated credential.

The dashboard is now four charts rendered from pure functions and served as an
authenticated presentation fragment. Each figure carries a title, a description,
a legend that states every number, and a table that repeats every series, so the
information survives without colour, without motion, and without the figure. The
served stylesheet expresses every tone through a variable, which is what lets
the dark theme lighten the palette without touching a single chart. The single
serving asset was split into markup, style, and behaviour, because three
languages with three reasons to change had been sharing one template literal.

The drill-down is the part worth keeping. The hash router used to read the page
name from the whole fragment, so `#/work?state=BLOCKED` named no page at all and
fell back to the dashboard. The query is now split before the path and exposed,
and the destination pages filter on the same fields the charts count. A test
lifts the shipped parser out of the served script and runs it against the links
the fragment really emits, so the two cannot drift. Memory and privacy stayed
out on purpose: their lists are paginated by the server, and a filter over one
page would have shown a subset as a total.
