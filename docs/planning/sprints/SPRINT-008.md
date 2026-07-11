# Sprint 8 — Make the First Project Journey GUI-first

**Primary epics:** E0 — Product foundation; E1/E2/E3 — existing capability presentation

**Milestone:** post-M3 local GUI alpha, first vertical slice

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 7 completed

## Sprint goal

Deliver a local, self-explanatory GUI through which a first-time user can
register and inspect a project, import the reviewed synthetic session, search
historical evidence, and open its source without memorizing CLI commands or
reading a manual first.

## Product direction and problem statement

AI Workspace is intended to be used primarily through a graphical interface.
The CLI remains valuable for automation, diagnostics, tests, and advanced
workflows, but it is not the main onboarding or daily-use surface. A supported
routine workflow is incomplete when users must discover commands from a manual
or remember flags and object IDs unaided.

The repository already contains working domain and CLI slices for projects,
session ingestion, historical evidence, active memory, Work Items, handoffs,
and effective instructions. No GUI technology or local application boundary
has been selected. The public design still leaves desktop versus local web UI
open, and introducing a framework, HTTP server, daemon, browser capability, or
desktop runtime requires an evidence-led ADR.

Sprint 8 establishes the GUI product contract and delivers the first useful
vertical journey over existing use cases. It does not attempt complete GUI
parity in one sprint. Memory, Work Items, handoffs, and instruction preview
must remain visible in the product map as upcoming guided workflows and become
the priority parity tranche after this sprint; they must not be represented by
dead or misleading controls.

## Permanent GUI-first acceptance principle

For routine user workflows, the GUI is the primary product interface. Every
screen and action must be understandable at the point of use:

- buttons use action-oriented labels and explain their effect before mutation;
- first-run onboarding, empty states, examples, prerequisites, progress, and a
  clear next action are embedded in the interface;
- contextual help explains unfamiliar terms, trust labels, privacy effects,
  bounds, and recovery without requiring the manual;
- errors preserve user input where safe, state what happened, and offer a
  visible recovery action;
- status is never communicated by color alone, controls are keyboard
  reachable, labels are programmatically associated, and focus changes are
  predictable;
- documentation remains available for depth, while successful first use is
  tested without consulting it;
- new user-facing capabilities include a GUI delivery plan in the same sprint
  or record an explicit, temporary, reviewed exception.

## User story

As a first-time user, I want the application to show me what AI Workspace can
do, guide me through registering a project and importing safe sample evidence,
and give me documented buttons for searching and inspecting sources so that I
can become productive immediately without learning the CLI.

## Committed backlog

### S8-01 — Freeze the self-guiding GUI contract

- define first-run, returning-user, empty, loading, success, warning, error,
  and recovery states for the committed journey;
- inventory every user decision, field, action, trust label, and prerequisite
  currently exposed by the matching CLI flows;
- specify action labels, inline descriptions, examples, validation timing,
  progressive disclosure, and safe preservation of entered values;
- define keyboard, focus, screen-reader label, reduced-motion, contrast, and
  non-color status acceptance checks;
- require a visible product capability map that distinguishes available GUI
  workflows from explicitly upcoming ones.

### S8-02 — Decide the local GUI architecture before adding a runtime

- compare a local daemon plus browser UI, a desktop application, and a
  minimal built-in local web host;
- evaluate folder/file selection, packaging, update model, loopback exposure,
  origin and CSRF controls, DNS rebinding, local authentication, CSP, XSS,
  external assets, accessibility testing, and operational complexity;
- decide how the GUI calls application use cases without spawning or scraping
  the CLI;
- select testing and packaging boundaries and record triggers for revisiting
  the choice;
- accept an ADR before adding a framework, server, desktop runtime, API, or
  browser dependency.

### S8-03 — Establish a typed GUI application boundary

- expose the existing Project Registry, controlled session ingestion,
  historical search, event inspection, and artifact inspection use cases
  through a provider-neutral application facade;
- preserve existing project scope, trust, bounds, provenance, idempotency,
  integrity checks, and actionable domain errors;
- define stable view models that contain no absolute local path unless the
  user is actively selecting or inspecting that path;
- prevent the presentation layer from importing persistence internals or
  executing CLI subprocesses;
- keep imported evidence `UNTRUSTED` and render it as inert text, never HTML or
  instructions.

### S8-04 — Build the self-explanatory shell and project onboarding

- provide a welcome screen that explains local-first behavior, current
  capabilities, and the shortest safe first journey;
- make “Register a project” the documented primary action when no project
  exists, with inline requirements and a safe path/folder selection mechanism
  chosen by the ADR;
- show project list, selected project, repository type, Git state, and recovery
  for invalid, missing, duplicate, or inaccessible paths;
- retain a visible progress indicator and next recommended action;
- avoid blank dashboards, icon-only critical actions, hidden prerequisites,
  and controls that require CLI knowledge.

### S8-05 — Guide controlled session import

- explain that the initial importer is synthetic/pre-release and why private
  transcripts are not accepted yet;
- offer a documented “Import sample session” action using the reviewed bundled
  fixture and an explicit advanced file-selection path where safe;
- show selected project, provider subset, source filename, trust result,
  imported/unchanged counts, and idempotent re-import effect;
- show bounds and restricted-data failures without leaking rejected content;
- lead successful import directly to evidence search.

### S8-06 — Guide evidence search and source inspection

- provide a labeled search field, useful synthetic example, project scope,
  optional filters, limit guidance, and an informative empty state;
- render results with event type, session, time, visible `UNTRUSTED` status,
  provenance summary, and a documented “Inspect source” action;
- open canonical event details and integrity-verified artifact content only
  after explicit user action;
- render all imported content as bounded terminal/browser-safe text and make
  prompt-injection warnings visible near the content;
- provide back, refine-search, and recovery actions without losing the query.

### S8-07 — Prove first-use operability and close the GUI alpha slice

- run the complete journey in isolated local state using only visible GUI
  actions and the reviewed synthetic fixture;
- give the acceptance participant no manual and no CLI command list;
- prove keyboard-only completion, programmatic labels, deterministic focus,
  non-color statuses, safe content rendering, and narrow viewport behavior;
- cover first run, returning state, empty results, duplicate registration,
  idempotent import, corrupt state, restricted input, foreign project scope,
  artifact integrity failure, and terminal/browser control characters;
- verify no external network request, telemetry, remote asset, model call,
  agent execution, or instruction execution occurs;
- record time-to-first-search, observed user dead ends, inline-help usage, review,
  retrospective, and the next GUI parity recommendation without claiming broad
  usability from one synthetic evaluation.

## Out of scope

- GUI parity for active-memory transitions, Work Item lifecycle, handoff
  create/preview/validate/evaluate, and effective-instruction preview; these are
  the priority follow-up GUI tranche, not optional product work;
- agent or model execution, provider routing, tool execution, runtime
  permissions, E6 Context Builder, privacy gateway, orchestration, or plugins;
- real/private session import, live provider discovery, background scanning,
  telemetry, analytics upload, accounts, cloud sync, or remote hosting;
- visual agent/skill editors, document workspaces, marketplace, mobile UI, or
  production packaging;
- changing existing domain trust, provenance, storage, or lifecycle semantics
  merely to simplify presentation;
- adding a GUI framework, API framework, daemon, browser service, or desktop
  runtime before S8-02 accepts its ADR;
- requiring users to read README, user guides, sprint documents, or CLI help to
  complete the acceptance journey.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check
```

The accepted GUI architecture must add proportionate automated presentation,
accessibility, application-boundary, and security tests. The isolated GUI demo
uses a temporary `AI_WORKSPACE_HOME`, a synthetic Git repository, and reviewed
public fixtures. Network monitoring must show no external request. Public
assets must contain no credential, private transcript, identity, absolute
local path, runtime store, or generated user artifact.

## Definition of done

- an accepted ADR chooses the first GUI packaging, transport, and security
  boundary before implementation dependencies are added;
- a new user can complete register → sample import → search → source inspection
  through visible GUI actions without manuals or CLI knowledge;
- every committed action has inline purpose, effect, prerequisites, feedback,
  and recovery;
- the GUI reuses application/domain use cases and does not shell out to CLI;
- evidence remains visibly `UNTRUSTED`, inert, bounded, source-linked, and
  integrity checked;
- first-run, empty, error, returning, keyboard, focus, label, non-color, narrow
  viewport, and safe-rendering states are acceptance-tested;
- no external request, telemetry, model, agent, tool, or imported instruction
  execution occurs;
- the next GUI parity slice is prioritized from observed gaps;
- review and retrospective are appended without rewriting this commitment.

## Planning decisions

- GUI-first is a permanent product rule, not a temporary Sprint 8 theme;
- CLI remains supported for automation, diagnostics, tests, and advanced use,
  but routine flows must not depend on memorized commands;
- Sprint 8 delivers the first complete GUI journey over existing behavior
  rather than broad static mockups;
- unavailable GUI capabilities are labeled upcoming and never exposed as dead
  controls;
- documentation supplements inline guidance and is not an onboarding
  prerequisite;
- technology, framework, transport, and packaging remain undecided until the
  S8-02 ADR.

## Dependencies and sequencing

```text
Sprint 7 complete
  -> S8-01 interaction contract + S8-02 architecture ADR
       -> S8-03 typed application boundary
            -> S8-04 project onboarding
                 -> S8-05 guided sample import
                      -> S8-06 search and source inspection
                           -> S8-07 no-manual acceptance and next GUI parity plan
```

Interaction-state fixtures may be authored in parallel with the ADR, but no
runtime or framework implementation begins before the architecture and
security decision is accepted.

## Risks and mitigations

| Risk                                               | Mitigation                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A GUI shell is mistaken for an operational product | Definition of done requires the complete visible first journey                                |
| Users still need CLI knowledge                     | No-manual acceptance and inline action/recovery requirements                                  |
| Local web transport exposes private data           | ADR covers loopback, origin, CSRF, DNS rebinding, auth, CSP, and external requests            |
| Imported untrusted content becomes active markup   | Typed inert-text view models, escaping tests, CSP, and visible trust warnings                 |
| Framework choice creates premature lock-in         | Compare three packaging options and require an ADR before dependencies                        |
| Accessibility is deferred                          | Keyboard, focus, labels, non-color state, contrast, and viewport checks are sprint acceptance |
| Scope expands to all existing features             | Complete one journey and make the next GUI parity tranche explicit                            |
| GUI duplicates domain behavior                     | Typed facade reuses use cases and forbids CLI subprocess/scraping                             |

## Execution log

Append dated implementation evidence here. Add review and retrospective only
after the complete no-manual GUI journey and all final gates pass.
