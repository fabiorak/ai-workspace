# Sprint 16 — Search Historical Evidence Across Projects

**Primary epics:** E0 — Product foundation; E3 — Memory and Historical Search

**Milestone:** M2 searchable project history, usability increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 15 completed

## Sprint goal

Let a user find literal historical evidence when they do not remember its
project, through the primary bilingual GUI, while retaining explicit project
identity, canonical source navigation, bounded local scans, and the existing
separation between `UNTRUSTED` history and active memory.

## Evidence and problem statement

E3 promises global historical search, but the implemented search boundary
requires a project ID before any query can run. A user who remembers a phrase
from an old chat but not its project must currently enumerate projects and
repeat the query manually. This is a product gap, not evidence that OpenSearch
is required.

The current local adapter already provides deterministic case-insensitive
literal search, integrity-verified artifact reads, project isolation, source
navigation, and a 1,000-session bound per project. Sprint 16 composes that
capability across registered projects before selecting an index or service.

## User story

As a user who remembers what was said but not where, I want to search all
registered project histories from one GUI form and see the owning project on
every result so that I can inspect the canonical source and deliberately enter
the correct project-scoped workflow.

## Committed backlog

### S16-01 — Freeze global-search semantics and bounds

- keep the existing literal, case-insensitive match semantics and optional
  canonical event-type filter;
- make search scope explicit as all registered projects or the selected
  project, with all projects as the useful no-memory default;
- accept only registered project IDs, sort them deterministically, reject
  duplicates, and bound one global query to 100 projects and 10,000 canonical
  events;
- retain the existing result limit of 1–100, default 20;
- report searched project and event counts without relevance or completeness
  claims;
- fail the whole query on corrupt, unreadable, oversized, or inconsistent
  project history rather than silently returning partial results;
- include project identity in every result but never expose registered paths.

### S16-02 — Add provider-neutral cross-project composition

- extend `@ai-workspace/historical-search` with a read-only global query over
  an explicit bounded project-ID set;
- reuse the existing event and artifact ports without adding a database,
  service, index, framework, network listener, or dependency;
- merge matches before applying the global result limit so project iteration
  order cannot bias results;
- preserve deterministic chronological/session/sequence ordering with project
  ID as a stable cross-project tie-break;
- retain `UNTRUSTED`, match location, event identity, and complete canonical
  source references;
- keep project-scoped search behavior backward compatible.

### S16-03 — Expose a safe global facade and HTTP route

- have the in-process GUI facade enumerate registered projects and enrich
  global results with safe project name and ID only;
- expose authenticated read-only `GET /api/search` with existing query, type,
  and limit validation;
- retain project-scoped event and artifact routes for inspection;
- require a result's explicit project ID when navigating to its event or
  source;
- never infer a project from event ID alone and never expose repository paths.

### S16-04 — Deliver the complete bilingual GUI journey

- make historical search available before a project is selected;
- default to all registered projects and allow explicit selected-project scope;
- explain literal matching, bounds, trust, effect, and OpenSearch non-use
  inline in English and Italian;
- show project name/ID, event type, trust, and inert snippet on every result;
- label the action that selects the owning project and inspects the source
  event, then continue through existing source and memory workflows;
- preserve query, filters, scope, and results while inspecting and returning;
- provide no-project, empty, limit, corrupt-state, and scale-trigger recovery.

### S16-05 — Prove acceptance and close the increment

- cover deterministic merge, global limit after merge, project-order
  permutation, filters, project identity, artifact-backed matches, and
  backward compatibility;
- cover duplicate, missing, excessive, corrupt, unreadable, cross-project, and
  oversized inputs without content echo or partial results;
- cover the no-manual GUI journey with no selected project, Italian copy,
  keyboard labels/focus, narrow viewport, inert rendering, and project-scoped
  event/source navigation;
- publish review, retrospective, limitations, and explicit OpenSearch triggers;
- update architecture, threat model, user guide, public design, README,
  roadmap, project plan, sprint index, and local handoff only after behavior
  and acceptance gates pass;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, and an isolated global-search demo;
- create one final Sprint 16 commit and perform no push.

## Out of scope

- OpenSearch, SQLite/FTS, another index, embeddings, semantic or vector search,
  fuzzy matching, stemming, ranking, summarization, or query expansion;
- indexing real or private transcripts, background crawlers, file watchers,
  telemetry, network services, remote access, or multi-user authorization;
- cross-project active memory, Work Items, handoffs, instruction composition,
  Context Packs, source mutation, or automatic evidence promotion;
- changing canonical session or artifact persistence formats;
- automatic project selection before the user chooses to inspect a result;
- agent, model, tool, delivery, permission, or execution behavior;
- the ADR-0016 Context Pack source-table rollout.

## Architecture decision

No ADR is planned. The slice extends the existing provider-neutral historical
search use case and loopback GUI through current ports and local storage. If
implementation requires an index, database, service, new listener, framework,
or dependency, stop and write a separate ADR before proceeding.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The HTTP acceptance requires loopback permission because it opens only
`127.0.0.1`. The isolated demo must use synthetic temporary state and remove it
after completion.

## Definition of done

- a user can search all registered histories without selecting or remembering
  a project;
- every result identifies its project and remains `UNTRUSTED` inert evidence;
- inspection switches to the named project only after explicit user action;
- event and source reads remain project-scoped and integrity checked;
- query/filter/scope state survives source inspection and return;
- merge ordering and limit are deterministic and independent of project input
  order;
- bounds and corrupt projects fail closed without partial result or content
  echo;
- project-scoped search remains backward compatible;
- OpenSearch remains deferred with measurable migration triggers;
- English and Italian GUI contracts and no-manual acceptance pass;
- clean-build, quality, audit, public-safety, and demo gates pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 15 complete
  -> S16-01 global contract and bounds
       -> S16-02 provider-neutral composition
            -> S16-03 facade and authenticated read-only route
                 -> S16-04 bilingual no-manual GUI
                      -> S16-05 acceptance and closure
```

## Risks and mitigations

| Risk                                      | Mitigation                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Global search leaks project data          | Enumerate registered IDs internally; return only safe name/ID and provenance |
| Early project exhausts the result limit   | Merge and sort all matches before applying the one global limit              |
| Corrupt project yields misleading partial | Fail the entire query with non-echoing recovery                              |
| Local scan becomes unbounded              | Cap projects, sessions per project, total events, and returned results       |
| Result is promoted across project scope   | Require explicit select-and-inspect action; keep mutations project-scoped    |
| OpenSearch is introduced by assumption    | Preserve ports and require measured triggers plus a later ADR                |

## Planning decisions

- global means all currently registered projects, never filesystem discovery;
- the GUI default is global because it solves the stated unknown-project case;
- selected-project scope remains available for precision and recovery;
- deterministic literal matching is preserved rather than marketed as ranked
  full-text or semantic search;
- a failure in any included project prevents a partial report;
- global results carry project identity, but repository paths remain private;
- source inspection and every mutation continue through existing project-bound
  routes;
- this commitment is preserved; execution evidence, review, and retrospective
  are appended without rewriting the planned claims.

## Execution log

### 2026-07-13

- S16-01 froze literal case-insensitive semantics, explicit `ALL`/`SELECTED`
  GUI scope, 1–100 results, at most 100 unique registered projects, and at most
  10,000 canonical events. Global reports fail instead of returning partial
  results.
- S16-02 added `HistoricalSearch.searchAcrossProjects`. Project IDs are
  validated and sorted, all matching events are merged before the global
  limit, and timestamp/project/session/sequence ordering is independent of
  caller project order. Existing project-scoped search remains compatible.
- Domain contracts cover project permutation, global-limit fairness, type
  filters, artifact-backed payloads, complete provenance, empty/duplicate/
  excessive project scope, excessive events, inconsistent adapter scope, and
  non-echoing failure after an earlier project matched.
- S16-03 added a facade method that internally enumerates registered projects,
  enriches results with safe project name/ID only, and exposes authenticated
  read-only `GET /api/search`. Event and source routes still require the owning
  project ID; repository paths never enter global responses.
- S16-04 makes search visible before project selection, defaults to all
  registered projects, retains selected-project scope, and shows one explicit
  action that selects the owning project before source inspection. Query,
  filters, scope, and result DOM remain intact on return. English and Italian
  catalogs explain literal bounds, `UNTRUSTED` evidence, effects, recovery,
  and the absence of OpenSearch/network access.
- S16-05 acceptance covers no-project recovery, unauthenticated access,
  global API results, foreign-project event rejection, semantic labels,
  narrow/reduced-motion styles, inert `textContent` rendering, catalog parity,
  and temporary synthetic state cleanup.
- Final gates passed after a clean install and clean composite build: format,
  lint, typecheck, build, 166 tests, audit with zero vulnerabilities, diff
  check, public path/credential scan, and isolated application/HTTP workflows.

## Sprint review

Sprint 16 closes the concrete usability gap that motivated the increment. A
user can start with remembered text rather than remembered project structure.
Every match remains visibly `UNTRUSTED`, names its owning project, and cannot
enter event, artifact, memory, Work Item, or handoff flows until the user
explicitly selects that project.

The implementation demonstrates that OpenSearch is not required for the
current scale boundary. It composes the existing replaceable reader and
integrity-checking artifact port, adds no dependency or persistence format,
and retains deterministic results. The global limit is applied only after all
bounded matches are merged, avoiding project-order bias.

The slice deliberately does not claim ranked full-text or semantic search.
Literal matching still requires the remembered substring, and a corrupt
included project aborts the global result. That fail-closed choice makes
incompleteness visible instead of presenting partial evidence as global.

## Retrospective

What worked:

- starting from the user's unknown-project scenario exposed an E3 promise that
  the project-scoped implementation had not yet delivered;
- composing provider-neutral ports kept OpenSearch, schema migration, and
  background indexing out of a usability fix;
- putting project identity in the result and project selection in the action
  preserved least privilege without forcing prior project memory;
- merging before limiting produced a simple deterministic fairness contract.

What changed during implementation:

- the GUI search section is now available before registration or project
  selection and reports actionable no-project recovery;
- global failures wrap adapter/artifact errors with non-echoing recovery so an
  earlier match can never escape as a partial report;
- the CLI remains project-scoped, which is now stated explicitly instead of
  implying that every surface provides global scope.

Next-increment recommendation:

- measure registered-project count, canonical-event count, worst-case local
  query latency, and common zero-result queries before selecting an index;
- consider fuzzy/semantic discovery only as a separate evidence-led slice;
- trigger an index/OpenSearch ADR when the 100-project, 10,000-event, latency,
  concurrency, ranking, or query-language boundaries become insufficient;
- reconsider ADR-0016 rollout, agent/skill profiles, and CodeGraph priority
  with the user rather than coupling them to global search.
