# Sprint 10 — Manage Work Items and Handoffs in the GUI

**Primary epics:** E0 — Product foundation; E4 — Handoff and Cross-agent Resume

**Milestone:** local GUI alpha, continuity cockpit

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 9 completed

## Sprint goal

Let a first-time user define and manage one explicit software Work Item, build
and inspect a bounded source-linked handoff, and detect repository drift through
the primary GUI without CLI knowledge or agent execution.

## Design alignment

The public design makes the Work Item the central aggregate and identifies the
current objective, constraints, repository state, evidence, and handoff as the
minimum cross-agent continuity packet. The GUI-first principle requires this
routine workflow to explain actions, trust, effects, prerequisites, and
recovery inline.

Sprint 10 presents the already accepted Core MVP software boundary. It does not
adopt the later unified document Work Item, Context Builder, agent selection,
or orchestration concepts. Work Item state remains additive and handoffs remain
immutable snapshots scoped to one registered project and Work Item.

## User story

As a developer preparing to switch agents, I want the GUI to guide objective
state and handoff creation, show exactly what will be persisted and why, and
warn when repository state has drifted so that I can prepare a verifiable
continuity packet without memorizing commands.

## Guided demonstrable journey

```text
select project and canonical evidence
  -> create PROPOSED Work Item with a USER_CURATED objective
  -> activate, block, complete, or reopen only through valid visible actions
  -> select ACTIVE memory and current canonical sources explicitly
  -> preview bounded handoff sections, trust metadata, exact persisted bytes,
     Git snapshot, relevant files, tests, next action, and immutable effect
  -> create the handoff after explicit review
  -> inspect the persisted packet and source navigation
  -> validate current Git state read-only
  -> on drift, create a successor rather than mutate the old snapshot
```

## Committed backlog

### S10-01 — Freeze the continuity-cockpit interaction contract

- extend progress and capability maps with Work Item list/detail/lifecycle,
  handoff builder/preview/detail, and drift validation states;
- specify first-run, empty, loading, success, warning, error, returning, stale,
  terminal, and recovery behavior;
- explain `USER_CURATED`, `UNTRUSTED`, observed repository state, verification,
  immutability, predecessor links, and non-execution at the point of use;
- preserve entered objective, next action, files, tests, and selections after
  safe validation failures;
- require keyboard reachability, programmatic labels, deterministic focus,
  non-color statuses, reduced motion, and narrow viewport behavior.

### S10-02 — Extend the typed GUI facade with Work Item lifecycle

- wire `WorkItems`, `JsonWorkItemStore`, registered-project lookup, and the
  same-project canonical source reader without importing CLI handlers;
- expose bounded list/show/create/activate/block/complete/reopen view models;
- preserve deterministic ordering, optimistic versions, attribution, additive
  transitions, and actionable conflict/corruption recovery;
- never copy transcript payloads, active-memory bodies, Git diffs, or handoff
  packets into Work Item persistence.

### S10-03 — Add a bounded handoff history/read boundary

- add the smallest provider-neutral list contract needed to show handoff
  history for one project and Work Item;
- preserve immutable schema-v1 reads and deterministic schema-v2 writes;
- keep project and Work Item scope repeated and validated, deterministic order,
  bounded page size, and fail-closed malformed/cross-scope behavior;
- do not migrate, rewrite, delete, or silently repair existing handoff files;
- record an ADR only if implementation evidence requires a new persistence or
  runtime decision rather than a compatible port extension.

### S10-04 — Guide complete Work Item lifecycle

- create a Work Item only from an explicit objective and selected canonical
  evidence, beginning in `PROPOSED`;
- list and inspect objective, status, version, attribution, sources, and full
  transition history;
- show only valid lifecycle actions for the current state and require newly
  selected same-project evidence for every transition;
- explain additive effects before activate, block, complete, and reopen;
- recover visibly from missing/foreign sources, stale callers, corruption,
  invalid transitions, and project isolation failures.

### S10-05 — Build a transparent handoff preview

- require an `ACTIVE` Work Item, explicit next action, at least one canonical
  source event, and explicit optional active-memory selection;
- support bounded relevant paths and test observations without reading file
  contents, patches, unrestricted output, remotes, or credentials;
- show all eight handoff sections with origin, trust, curation, verification,
  observation, and navigable sources before persistence;
- show captured branch, HEAD, dirty state, ordered changed paths, exact
  persisted UTF-8 bytes, schema version, and any labeled token estimate;
- guarantee preview uses the same validation and deterministic persisted codec
  as create while producing no handoff file.

### S10-06 — Create, inspect, validate, and succeed immutable handoffs

- persist only after an explicit review action and show ID, timestamp, Work
  Item, project, predecessor, schema, byte size, and immutable effect;
- list and inspect prior handoffs with section-level trust and source
  navigation while rendering all content inertly;
- validate repository state read-only and display exact drift categories;
- when drift exists, guide a successor with the predecessor fixed to the old
  packet; never refresh or replace the immutable snapshot;
- reject dangling/foreign predecessors, inactive memory, wrong Work Item,
  corrupt storage, oversized inputs, and concurrent conflicts without partial
  files or sensitive echo.

### S10-07 — Prove the no-manual continuity journey

- acceptance-test project → evidence → Work Item create/lifecycle → memory
  selection → handoff preview/create/show → Git validation → successor;
- prove persistence across requests and a fresh foreground process using only
  visible GUI actions and synthetic fixtures;
- cover empty and returning state, every lifecycle branch, pagination/order,
  project isolation, source navigation, terminal/browser controls, corruption,
  stale Git state, CSRF/Origin/body bounds, inert rendering, keyboard/labels,
  focus, non-color status, reduced motion, and narrow viewport;
- verify preview creates no file and failed create leaves no partial packet;
- verify no external request, telemetry, model, agent, tool, imported
  instruction, command, or repository mutation occurs;
- run clean install, clean composite build with relevant `dist/` absent, full
  check, audit, diff check, public scan, and isolated foreground demo before
  documentation closure.

## Out of scope

- live agent/model invocation, provider routing, automatic handoff delivery,
  agent execution, orchestration, worktrees, tools, or runtime permissions;
- `handoff evaluate` GUI parity and synthetic second-agent grading; the existing
  CLI evaluation harness remains available for controlled experiments;
- automatic objective, memory, file, test, next-action, or predecessor
  selection; summarization; trust promotion; or confidence assessment;
- E6 Context Builder, category budgets, token optimization, semantic search,
  embeddings, privacy gateway, or model access;
- document/mixed Work Items, native packaging, remote access, private
  transcripts, external assets, telemetry, or GUI instruction preview;
- editing/deleting Work Items, transitions, memory, or handoff snapshots.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check
```

The clean-build gate must not rely on ignored `dist/` output. The isolated GUI
demo uses a temporary `AI_WORKSPACE_HOME`, synthetic Git repository, reviewed
session fixture, and no external network request.

## Definition of done

- the GUI completes the committed Work Item and handoff journey without manual
  or CLI knowledge;
- every mutation is explicit, source-linked, project-scoped, additive or
  immutable as appropriate, and protected by the existing loopback boundary;
- preview and persisted bytes are equivalent and deterministic for fixed input;
- drift validation is read-only and guides successor creation;
- trust, provenance, observation, verification, effect, bounds, and recovery
  remain visible at the point of use;
- facade, HTTP, persistence, presentation, accessibility-baseline, security,
  clean-build, and synthetic acceptance tests pass;
- documentation and handoff are synchronized only after final gates;
- one final Sprint 10 commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 9 complete
  -> S10-01 interaction contract
       -> S10-02 Work Item facade + S10-03 handoff history boundary
            -> S10-04 complete Work Item lifecycle
                 -> S10-05 deterministic handoff preview
                      -> S10-06 create/show/validate/successor
                           -> S10-07 isolated no-manual acceptance
```

## Risks and mitigations

| Risk                                        | Mitigation                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Cockpit becomes a broad static dashboard    | Definition of done requires one complete visible journey                  |
| GUI duplicates domain lifecycle rules       | Facade delegates to existing provider-neutral use cases                   |
| Preview differs from persisted packet       | Same input validation and persisted codec; byte-equivalence tests         |
| Immutable handoff is accidentally refreshed | Drift is read-only and recovery creates a successor                       |
| Automatic selection hides provenance        | Evidence, memory, files, tests, and predecessor stay explicit             |
| Clean CI differs from local builds          | Acceptance removes relevant ignored `dist/` before composite build        |
| Form density harms first use                | Progressive disclosure, inline examples, preserved input, and focus tests |
| Scope expands into execution                | Agent/model/tool execution and evaluation remain explicitly excluded      |

## Planning decisions

- Work Item and handoff ship together because the Work Item owns handoff
  history and the useful GUI outcome is continuity, not isolated forms;
- `handoff evaluate` remains a secondary experimental CLI workflow rather than
  routine cockpit parity;
- a compatible list/read port extension is preferred over a storage redesign;
- exact bytes are primary; token values, if shown, remain labeled estimates;
- unavailable execution capabilities are described as inactive, never exposed
  through dead controls;
- implementation documentation, review, retrospective, and operational
  handoff are updated only after all final gates pass.

## Execution log

Append dated implementation evidence, review, and retrospective only after the
complete committed journey and final gates pass.
