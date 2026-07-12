# Sprint 11 — Localize the GUI and Preview Effective Instructions

**Primary epics:** E0 — Product foundation; E5 — Agent Instruction Manager

**Milestone:** local GUI alpha, bilingual inspection surface

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 10 completed

## Sprint goal

Let a first-time user complete the full local GUI journey in English or Italian
and inspect deterministic effective instructions with provenance before any
agent execution, without changing persisted domain data or requiring CLI
knowledge.

## Design alignment

The public design already exists in English and Italian, requires GUI-first
delivery, and treats effective instructions as inspectable derived state rather
than an opaque prompt. Sprint 11 adds a small localization boundary to the
existing dependency-free loopback GUI and exposes the read-only instruction
composition accepted in Sprint 7 through the typed GUI facade.

Localization belongs to presentation. Stable domain enums, IDs, persisted
documents, source content, hashes, commands, paths, and API contracts remain
language-neutral and byte-for-byte unchanged. Imported evidence and
user-authored content are displayed in their original language and never
translated automatically.

## User story

As an English- or Italian-speaking developer, I want to choose the GUI language
and inspect which instructions would apply, where they came from, and which
rules were excluded so that I can understand the local workspace before any
agent is allowed to execute.

## Guided demonstrable journey

```text
open the one-time local GUI
  -> choose English or Italiano from a keyboard-accessible control
  -> retain the preference locally across reloads
  -> complete project, evidence, memory, Work Item, and handoff journeys
     with localized interface guidance
  -> select a registered project and instruction context explicitly
  -> preview deterministic effective instructions read-only
  -> inspect precedence, provenance, inclusion/exclusion reasons, conflicts,
     non-enforcement, and source navigation
  -> switch language without changing persisted workspace state or user input
```

## Committed backlog

### S11-01 — Freeze the bilingual product-language contract

- inventory every user-visible static and dynamic GUI message, including
  labels, help, effects, prerequisites, statuses, errors, recovery, empty
  states, trust warnings, focus announcements, and capability-map text;
- define `en` as the canonical fallback locale and `it` as the first complete
  additional locale, with identical message-key coverage;
- keep `UNTRUSTED`, `USER_CURATED`, lifecycle enums, IDs, hashes, commands,
  paths, user content, and imported evidence stable where translation would
  alter a domain or source value;
- establish an Italian glossary for trust, provenance, verification,
  immutability, observed state, and non-execution before implementation;
- fail tests on missing, duplicate, empty, unused, or placeholder messages.

### S11-02 — Add a dependency-free localization boundary

- introduce typed message keys and immutable English/Italian catalogs inside
  `apps/web` without adding a framework, runtime, service, or external asset;
- resolve locale deterministically from an explicit local preference, then a
  supported browser language, then English fallback;
- persist only the locale code in browser-local state; never write it into
  projects, sessions, memory, Work Items, handoffs, or instruction bundles;
- provide safe interpolation that always reaches the DOM through inert text
  operations and rejects missing or unexpected parameters;
- keep the HTTP/API error schema language-neutral and localize only safe
  presentation-owned guidance at the browser boundary.

### S11-03 — Localize the complete existing GUI journey

- translate the shell, progress, projects, synthetic import, historical
  search, event/artifact inspection, active memory, Work Items, handoff builder,
  preview, history, drift validation, successor flow, and capability map;
- add a visible language selector named in both languages and available before
  project registration;
- switch language without reload where practical and without clearing selected
  project, evidence, memory, Work Item, handoff, filters, or entered form data;
- preserve deterministic focus, programmatic labels, live-region semantics,
  keyboard reachability, non-color statuses, reduced motion, and narrow
  viewport behavior in both locales;
- document that user-authored and imported content remains in its original
  language and no translation service or network request exists.

### S11-04 — Extend the typed GUI facade with instruction preview

- wire the existing instruction composer and local instruction-bundle reader
  through the in-process facade without importing CLI handlers;
- expose a bounded read-only view model for effective rules, source scope,
  precedence, inclusion/exclusion reason, provenance, digest, and warnings;
- require a registered project and explicit supported context; preserve the
  fail-closed behavior for malformed, changed, conflicting, cross-project, or
  oversized bundles;
- keep preview deterministic and non-persistent, with no agent, model, tool,
  command, imported instruction, or repository execution;
- add no instruction discovery, editing, registry, enforcement, or runtime
  permission behavior.

### S11-05 — Guide bilingual effective-instruction inspection

- add a localized instruction-preview screen and capability-map entry in both
  catalogs;
- explain at the point of use that previewed rules are source-linked derived
  data and are not enforced or executed by the GUI;
- render applicable rules, excluded rules, conflicts, precedence, source scope,
  digest, and navigation metadata inertly and without hiding stable values;
- preserve selected context and entered values after safe validation failures;
- provide actionable localized recovery for missing bundles, changed bytes,
  project mismatch, unsupported schema, ambiguity, and corruption.

### S11-06 — Prove locale parity and state neutrality

- contract-test exact message-key parity, interpolation parameters, glossary
  invariants, English fallback, browser-language resolution, and persisted
  explicit preference;
- acceptance-test the complete visible journey in English and Italian,
  including returning state, empty/error/recovery states, every mutation
  boundary, instruction preview, and mid-form locale switching;
- prove locale switching changes no server-side or domain persistence and
  produces no external request, telemetry, translation call, or remote asset;
- test inert rendering with localized controls around hostile or mixed-language
  evidence, terminal controls, long Italian labels, keyboard/focus behavior,
  screen-reader names, reduced motion, and narrow viewport layouts;
- prove unsupported or malformed locale values fall back safely to English.

### S11-07 — Close the bilingual inspection slice

- update the README and GUI journey guide with language selection and
  instruction-preview behavior in user-facing terms;
- synchronize architecture, security notes, capability maps, project planning,
  sprint review, retrospective, and operational handoff after final gates;
- run clean install, clean composite build with relevant `dist/` absent, full
  check, audit, diff check, public scan, and an isolated foreground demo in
  both locales;
- create one final Sprint 11 implementation commit and perform no push.

## Out of scope

- machine translation, translation APIs, remote fonts/assets, locale analytics,
  geolocation, account profiles, or cloud synchronization;
- automatic translation of evidence, user-authored memory/objectives/actions,
  repository content, paths, commands, identifiers, enums, or persisted data;
- pluralization framework adoption, right-to-left support, locale-specific
  date/number rewriting of canonical values, or languages beyond English and
  Italian;
- instruction discovery, authoring, editing, deletion, enforcement, execution,
  registry, runtime permissions, agent/model/tool invocation, or provider
  routing;
- E6 Context Builder, summarization, semantic search, embeddings, worktrees,
  orchestration, document Work Items, native packaging, or remote access;
- CLI localization; the CLI remains a stable English automation and diagnostic
  surface during this sprint.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check
```

The clean-build gate must not rely on ignored `dist/` output. The isolated GUI
demo uses a temporary `AI_WORKSPACE_HOME`, synthetic Git repository and
instruction fixtures, both supported locales, and no external network request.

## Definition of done

- English and Italian provide complete, key-equivalent coverage of the full
  visible GUI journey with deterministic English fallback;
- language can be selected before onboarding and changed without losing active
  selections or mutating persisted workspace/domain state;
- the GUI previews effective instructions, provenance, precedence, exclusions,
  conflicts, and non-enforcement without persistence or execution;
- stable domain/source values remain unchanged and all dynamic content renders
  inertly;
- presentation, localization contracts, facade, HTTP, accessibility, security,
  clean-build, and bilingual synthetic acceptance tests pass;
- documentation and handoff are synchronized only after final gates;
- one final Sprint 11 commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 10 complete
  -> S11-01 bilingual language contract
       -> S11-02 localization boundary + S11-04 instruction facade
            -> S11-03 complete journey localization
                 -> S11-05 bilingual instruction preview
                      -> S11-06 parity and neutrality acceptance
                           -> S11-07 final gates and closure
```

## Risks and mitigations

| Risk                                      | Mitigation                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Catalogs drift or silently fall back      | Typed exact-key parity and missing/unused-key tests                          |
| Translation changes domain meaning        | Fixed glossary; stable enums/source values are never translated             |
| Locale switch loses unfinished work       | Browser-side rerender contract preserves selections and form values         |
| Italian text breaks compact layouts       | Long-label, narrow-viewport, focus, and screen-reader acceptance             |
| Server errors become locale-dependent     | Stable API errors; presentation-owned localized guidance                     |
| Localization introduces injection         | Parameter validation and inert DOM text rendering only                       |
| Preview is mistaken for enforcement       | Persistent localized non-execution warning at the point of use               |
| Scope expands into instruction management | Read-only existing composer boundary; authoring and execution stay excluded |

## Planning decisions

- English remains the deterministic fallback because it is the current public
  GUI language and keeps returning installations compatible;
- Italian ships as complete parity, not a partially translated experiment;
- locale preference is presentation state and does not belong in local domain
  persistence;
- effective-instruction GUI parity and localization ship together because the
  result is one inspectable, usable bilingual surface rather than two partial
  infrastructure increments;
- no localization dependency is accepted without a separate ADR and evidence
  that the small typed catalog boundary is insufficient;
- review and retrospective remain empty until implementation evidence exists.

## Execution log

Not started.

## Sprint review

Pending implementation and final verification.

## Retrospective

Pending implementation and final verification.
