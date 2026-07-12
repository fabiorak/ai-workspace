# Sprint 12 — Preview a Bounded Context Pack

**Primary epics:** E0 — Product foundation; E6 — Context Optimization

**Milestone:** M4 controlled context beta, first read-only slice

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 11 completed

## Sprint goal

Let an English- or Italian-speaking user explicitly combine one immutable
handoff with reviewed effective instructions into a deterministic,
source-explainable Context Pack preview with category budgets, without
persisting the pack or executing an agent, model, tool, or instruction.

## Design alignment

E6 requires reproducible context packs, explicit budgets, explainable included
content, source links, and measured savings. This first slice uses only already
bounded and reviewed inputs: a persisted handoff and optional explicit local
instruction bundles. It establishes the provider-neutral pack contract and
budget semantics before retrieval, summarization, compression, caching, or
model access.

## User story

As a developer preparing an agent resume, I want to preview exactly which
handoff and instruction material fits within explicit category budgets so that
I can understand omissions and size before any execution occurs.

## Demonstrable journey

```text
choose English or Italiano
  -> select project, ACTIVE Work Item, and immutable handoff
  -> optionally select reviewed instruction bundles and explicit targets
  -> enter byte budgets for continuity and instructions
  -> preview deterministic Context Pack
  -> inspect included categories, exact bytes, labeled token estimate,
     provenance, omissions, and recovery
  -> change a budget and reproduce the same result for fixed inputs
```

## Committed backlog

### S12-01 — Freeze Context Pack and budget contracts

- define a schema-versioned immutable preview model with project, Work Item,
  handoff, categories, measurements, provenance, and omission records;
- use exact UTF-8 bytes as the enforced unit and label `ceil(bytes / 4)` only
  as a token estimate;
- require positive bounded budgets per category and deterministic category and
  item ordering;
- reject partial item truncation: an item is included whole or omitted with an
  explicit `BUDGET_EXCEEDED` reason;
- keep source trust, curation, verification, digest, and stable IDs unchanged.

### S12-02 — Implement the provider-neutral Context Builder

- add a dependency-free `packages/context-builder` module;
- accept one validated immutable handoff and optional effective instructions;
- map continuity and instruction items deterministically without repository or
  artifact reads;
- enforce category and total bounds, duplicates, scope equality, malformed
  input, and oversized content fail-closed;
- produce no file, database record, cache, event, or mutation.

### S12-03 — Extend the typed GUI facade and HTTP boundary

- resolve the selected handoff through existing project/Work-Item-scoped
  storage and compose optional explicit instruction bundles through the
  existing strict reader;
- expose one authenticated CSRF-protected preview endpoint with bounded body;
- never accept handoff packet bodies from the browser or infer a latest
  handoff, Work Item, memory item, bundle, model, agent, or task;
- preserve project isolation and actionable fail-closed recovery.

### S12-04 — Add the bilingual Context Pack preview journey

- add exact-parity English/Italian catalog messages and a thirteenth-to-
  fourteenth screen contract transition;
- require explicit persisted handoff selection and visible numeric budgets;
- display schema, category budgets/usage, exact total bytes, token estimate,
  included items, omitted items/reasons, trust, and source identity inertly;
- preserve inputs and locale switching after validation failures;
- state persistently that preview is not a prompt send, permission check,
  instruction enforcement, model call, or persisted artifact.

### S12-05 — Prove reproducibility, bounds, and neutrality

- unit-test fixed-input determinism, UTF-8 accounting, budget edges, ordering,
  omissions, scope mismatch, duplicates, and malformed/oversized inputs;
- facade/HTTP-test explicit selection, project isolation, optional instruction
  composition, corruption, and preview non-persistence;
- presentation-test English/Italian parity, labels, focus, non-color status,
  narrow viewport, reduced motion, inert mixed-language content, and preserved
  form values;
- prove no repository read beyond existing handoff validation, external
  request, telemetry, model, agent, tool, instruction, or command execution.

### S12-06 — Close the first E6 slice

- update README, user guide, architecture, threat model, project plan, sprint
  review, retrospective, and handoff only after final gates;
- run clean install, clean composite build, full check, audit, diff check,
  public scan, and isolated bilingual foreground demo;
- create one final Sprint 12 implementation commit and perform no push.

## Out of scope

- automatic retrieval or selection, historical search inside the builder,
  summarization, semantic ranking, embeddings, compression, deduplication
  beyond duplicate rejection, progressive disclosure, prompt/response caching;
- Context Pack persistence, editing, export, delivery, execution, model access,
  agent routing, permissions, sandboxing, tools, orchestration, or worktrees;
- tokenizers or token-based enforcement; token values remain estimates;
- file contents, diffs, artifact bodies, transcripts, remotes, secrets, private
  data, document Work Items, or languages beyond English and Italian;
- completing E5 Agent/Skill Registry or claiming M4 completion.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check
```

## Definition of done

- fixed handoff, instructions, and budgets produce byte-identical previews;
- every included or omitted item has category, reason, and source identity;
- exact-byte budgets are enforced without truncation or hidden selection;
- GUI completes the journey in English and Italian without persistence or
  execution;
- domain, facade, HTTP, localization, accessibility, security, clean-build,
  and isolated acceptance gates pass;
- one final implementation commit is created and no push is performed.

## Dependencies and sequencing

```text
Sprint 11 complete
  -> S12-01 contracts
       -> S12-02 provider-neutral builder
            -> S12-03 facade/HTTP
                 -> S12-04 bilingual GUI
                      -> S12-05 acceptance
                           -> S12-06 closure
```

## Risks and mitigations

| Risk                                  | Mitigation                                                         |
| ------------------------------------- | ------------------------------------------------------------------ |
| Byte budget is confused with tokens   | Enforce exact bytes; label tokens as an estimate only              |
| Builder silently selects context      | Require explicit persisted handoff and bundle paths                |
| Partial truncation changes meaning    | Whole-item inclusion or explicit omission                          |
| Preview becomes an execution boundary | No gateway/runtime dependencies; persistent non-execution warning  |
| Pack duplicates handoff persistence   | Immutable in-memory preview only                                   |
| E6 expands prematurely                | No retrieval, summarization, compression, caching, or model access |

## Planning decisions

- continuity and instructions are separate budget categories;
- handoff section values are atomic items and are never substring-truncated;
- exact persisted handoff/instruction values remain source data, not localized
  content;
- no ADR is needed unless implementation evidence requires persistence,
  external runtime, or a new dependency;
- review and retrospective remain pending until implementation evidence exists.

## Execution log

### 2026-07-12

- S12-01 froze schema-v1 preview, exact-byte budget, atomic inclusion, explicit
  omission, provenance, and labeled token-estimate contracts.
- S12-02 added dependency-free `@ai-workspace/context-builder`; fixed inputs
  produce deterministic previews and the builder performs no I/O.
- S12-03 resolves only an explicit persisted handoff and optional strict local
  instruction bundles through the existing facade and authenticated HTTP
  boundary.
- S12-04 added the fourteenth bilingual GUI screen with explicit continuity
  and instruction budgets, inert included/omitted detail, and persistent
  non-execution language.
- S12-05 covers determinism, UTF-8 accounting, budget edges, whole-item
  omissions, scope mismatch, facade resolution, HTTP preview, localization
  parity, and preview non-persistence.
- The progressive gate passed format, lint, typecheck, build, and 141 tests
  before documentation closure.

## Sprint review

The first E6 slice turns already reviewed continuity and instruction state into
an inspectable budgeted preview without introducing retrieval or execution.
Users can see exactly which atomic items fit, why others are omitted, their
source identity, exact included bytes, and a clearly labeled token estimate.

## Retrospective

- Starting from immutable handoffs avoided a premature retrieval policy while
  still proving deterministic budget semantics.
- Whole-item omission is easier to explain and safer than substring truncation.
- Next recommendation: measure real synthetic pack distributions before adding
  deduplication, progressive disclosure, or targeted retrieval.
