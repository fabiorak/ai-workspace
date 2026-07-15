# Sprint 23 — Capture and Find General Questions

**Primary epics:** E0 — Product foundation; E3 — Memory and Search

**Milestone:** M5-adjacent search usability increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 22 completed; ADR-0018 accepted

## Sprint goal

Let a user capture an extemporaneous question in an explicit `GENERAL` scope
and find it later through the primary bilingual GUI's bounded lexical search,
without falsely attributing it to the selected project, invoking a model,
promoting it to active memory, or introducing semantic/index infrastructure.

## Evidence and problem statement

The current canonical history is project-scoped. Sprint 16 made search global
across registered projects, but it still cannot represent a question that does
not belong to any repository. Saving such text under the open project would
corrupt provenance; dropping it would make later retrieval impossible.

ADR-0018 accepts `GENERAL` as a first-class conversation scope rather than a
synthetic project. It also retains bounded lexical retrieval until measured
misses or scale justify full-text indexing or hybrid semantic search. The ADR
does not select a persisted representation, authorize chat/model delivery, or
extend project-owned Work Items, memory, handoffs, profiles, and policies to
general scope.

Sprint 23 implements the smallest useful local slice: a General Inbox that
captures user-authored questions as inert historical evidence and includes
them in global lexical search. It deliberately does not present a model-less
capture as an AI response workflow.

## User story

As a user with an unrelated question while another project is open, I want to
save it explicitly to General and later retrieve it by remembered text, so
that its provenance remains truthful and I do not need to remember which
project happened to be selected.

## Committed backlog

### S23-01 — Decide persistence and freeze scope contracts

- write ADR-0019 before implementation to compare reusing project sessions,
  a separate bounded append-only general-conversation JSON store, and an
  indexed/database representation;
- require a separate project-free canonical store unless evidence overturns
  the ADR-0018 boundary; do not create a hidden Project Registry entry;
- define a provider-neutral scope union with `PROJECT(projectId)` and
  `GENERAL`, stable conversation/event identities, exact timestamps, explicit
  origin, verification/trust state, data classification, integrity hash, and
  source provenance;
- preserve every existing project event, ID, API, query, limit, and persisted
  schema without in-place migration;
- keep general evidence distinct from active memory, Work Items, handoffs,
  instructions, Context Packs, profiles, and model data policies;
- stop and re-plan if implementation requires a database, background process,
  model/embedding SDK, network service, encryption-key store, or destructive
  migration.

### S23-02 — Capture bounded general questions locally

- add a provider-neutral General Conversation use case that creates one
  explicit conversation and appends immutable `USER_MESSAGE` events; do not
  infer scope from the currently selected project;
- use `LOCAL_USER` attribution, `USER_AUTHORED` origin, `UNVERIFIED` evidence
  state, and default data class `CONFIDENTIAL` without treating any field as
  truth, instruction, or permission;
- assign opaque stable IDs and bind every event to exact UTF-8 content bytes
  and SHA-256, deterministic order, conversation scope, and creation time;
- bound title, content bytes, events per conversation, document bytes, and
  total documents scanned; reject empty, control-text, duplicate, stale,
  corrupt, cross-scope, noncanonical, and oversized input without echo;
- run the shared high-confidence restricted-data detector before persistence
  and retain only category plus generic recovery on rejection;
- implement the persistence selected by ADR-0019 with restrictive permissions,
  explicit schema version, locking, temporary write, flush, atomic rename,
  owner-token cleanup, and no edit/delete operation;
- keep failed writes from publishing partial conversations or events.

### S23-03 — Search project and general evidence together

- extend domain-owned search contracts compatibly so results identify either
  `PROJECT` plus project identity or `GENERAL` plus conversation identity;
- retain current case-insensitive literal matching over canonical full content,
  including Unicode exact-byte accounting, bounded snippets, match location,
  trust/state, hash, and source navigation;
- add explicit `ALL_SCOPES`, `GENERAL_ONLY`, and existing single-project search
  modes; a project query must never include General implicitly;
- make `ALL_SCOPES` search General even when no project is registered, merge
  every requested scope before the one global limit, and use deterministic
  scope/time/conversation/event tie-breaking;
- preserve existing all-project and CLI behavior as compatibility contracts;
  the CLI remains project-scoped unless a new explicit General command is
  separately committed;
- abort the whole all-scope result on unreadable, corrupt, cross-scope,
  oversized, or integrity-invalid General state; return no partial matches or
  rejected content;
- collect bounded evidence for conversation count, event count, scanned bytes,
  zero-result queries, and worst-case local latency without claiming ranking or
  semantic recall.

### S23-04 — Deliver the bilingual General Inbox journey

- add a GUI General Inbox available without selecting or registering a project;
- show the current destination before capture and require an explicit General
  action; changing project selection must not move an existing conversation;
- guide create conversation, append question, list conversations, inspect
  immutable events, copy a safe search phrase, and search General or all scopes;
- label capture as local persistence only: no model request, assistant answer,
  agent/tool execution, active-memory promotion, Context Pack inclusion, or
  delivery occurs;
- extend global results with non-color scope labels and provenance, keep the
  query and selected scope during General/project source navigation, and never
  expose a filesystem path;
- provide English/Italian prerequisites, effect, default `CONFIDENTIAL`
  handling, restricted-data recovery, empty states, corruption recovery, and
  lexical-search limitations inline;
- preserve loopback authentication, CSRF, Origin/Host checks, CSP, body bounds,
  inert `textContent` rendering, semantic labels, keyboard flow, focus,
  reduced motion, narrow viewport, and no external assets or requests.

### S23-05 — Prove compatibility and close the increment

- use repository-owned fictional fixtures only, including Unicode, repeated
  phrases, same timestamps, no-project startup, empty General, restricted
  canaries, and project/General collisions;
- cover ID and byte/hash determinism, append idempotency/conflict, ordering,
  locks, permissions, bounds, corruption, incomplete writes, source navigation,
  scope isolation, non-echoing errors, and existing project regression;
- prove global merge-before-limit, `GENERAL_ONLY`, project-only exclusion,
  no-project General search, literal case-insensitive matching, zero results,
  and fail-without-partials behavior;
- cover facade/HTTP, English/Italian copy, explicit destination, safe rendering,
  keyboard/focus, non-color status, viewport bounds, Host/Origin/CSRF, body
  limits, corrupt state, and absence of model/network calls;
- publish the bounded lexical evidence and keep decisions `no change` for FTS5
  and semantic retrieval unless predeclared triggers are actually observed;
- update architecture, threat model, data classification, public design,
  README, user guide, roadmap, project plan, sprint index, ADR implementation
  notes, and local handoff only after implementation gates pass;
- run clean install, clean composite build, full check, audit, isolated General
  capture/search reproduction, diff check, public scan, and unchanged loopback
  acceptance;
- create one final Sprint 23 commit and perform no push.

## Out of scope

- model/provider invocation, assistant replies, streaming, credentials,
  routing, billing, retry, prompt delivery, or response storage;
- semantic search, embeddings, vector databases, similarity scores, reranking,
  LLM query expansion, fuzzy matching, stemming, synonyms, or relevance claims;
- SQLite/FTS5, OpenSearch, a background indexer, service, framework, database,
  cloud dependency, or external search process;
- automatically associating General evidence with a project or copying it into
  active memory, Work Items, handoffs, instructions, profiles, Context Packs,
  policies, prompts, or execution;
- editing, deleting, retitling, merging, moving, exporting, or sharing General
  conversations after capture;
- importing provider transcripts into General or allowing agents/tools to write
  General events;
- changing project session schema, existing event IDs, Project Registry,
  project search limits, active-memory schema, Work Item/handoff scope, Context
  Pack schema, privacy policy schema, or Sprint 13–22 measurements;
- encryption at rest, remote access, multi-user permissions, telemetry, mobile,
  or synchronization.

## Architecture decisions

ADR-0018 is the accepted scope/retrieval direction. ADR-0019 is required before
code because a new persisted project-free evidence aggregate introduces
locking, atomicity, schema, integrity, corruption, and migration constraints.

The preferred implementation remains inside the modular monolith with a
provider-neutral domain package, a local filesystem adapter, the existing
historical-search domain, and the existing foreground loopback GUI. Any
database/index, model/embedding process, remote boundary, encryption/key
choice, or delivery path requires a later ADR.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

HTTP acceptance opens only `127.0.0.1` and may require execution outside the
sandbox. Reproduction must use an isolated temporary workspace and fictional
General/project values only.

## Definition of done

- ADR-0019 fixes a bounded local persistence representation before code;
- `GENERAL` is stored and displayed as a first-class scope, never a synthetic
  project or an implicit consequence of current project selection;
- one explicit user-authored question can be captured locally with immutable
  identity, provenance, state, classification, exact bytes, and SHA-256;
- the question is retrievable through `GENERAL_ONLY` and `ALL_SCOPES` literal
  search, including when no project exists;
- project-only search excludes General, existing project APIs and results
  remain compatible, and global limits are applied after scope merge;
- restricted input, malformed state, integrity failures, and partial writes
  fail closed without echo or partial search results;
- the primary English/Italian GUI explains destination, persistence, trust,
  privacy, recovery, and the absence of a model response without a manual;
- no model, semantic index, database, network service, promotion, delivery,
  permission, or execution path is introduced;
- clean-build, quality, audit, reproduction, public-safety, and loopback gates
  pass; documentation is synchronized; one final commit is created; no push is
  performed.

## Dependencies and sequencing

```text
ADR-0018 accepted
  -> S23-01 ADR-0019 + scope/event contracts
       -> S23-02 bounded General capture and atomic persistence
            -> S23-03 compatible all-scope lexical search
                 -> S23-04 bilingual General Inbox
                      -> S23-05 compatibility, evidence, and closure
```

## Risks and mitigations

| Risk                                             | Mitigation                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| General becomes a hidden catch-all project       | First-class tagged scope; no Project Registry entry or project ID                           |
| Current project silently owns unrelated text     | Explicit destination before capture; project selection cannot move a conversation           |
| Local capture is mistaken for AI chat            | Only `USER_MESSAGE`; visible no-model/no-answer effect; no model adapter                    |
| User-authored text becomes trusted instruction   | Inert `USER_AUTHORED`/`UNVERIFIED` evidence; no automatic promotion or context inclusion    |
| Restricted data enters the new store             | Shared high-confidence pre-persistence detector; fail closed without value echo             |
| Global results leak or confuse scope             | Scope label and provenance on every result; explicit filters; project-only excludes General |
| General corruption yields partial global results | Validate complete requested scope set before returning any match                            |
| Literal search is oversold as semantic retrieval | Document limitations; collect misses/scale evidence; make no relevance claim                |
| Persistence choice preempts a future index       | Canonical append-only source of truth behind ports; later index must be rebuildable         |
| Scope union breaks existing project consumers    | Additive APIs and regression fixtures; no in-place schema or event-ID migration             |

## Planning decisions

- user direction explicitly accepts a General scope for extemporaneous
  questions and lexical/full-content search before semantic retrieval;
- Sprint 23 captures user questions locally but does not fabricate assistant
  responses or broaden Sprint 22 into model delivery;
- a separate persistence ADR is required because ADR-0018 deliberately stopped
  at scope and retrieval direction;
- General is historical evidence, not a new active-memory or Work Item owner;
- all-scope lexical search is the concrete consumer that justifies the new
  aggregate while keeping FTS5 and semantic retrieval evidence-led;
- this commitment is preserved; execution evidence, review, retrospective,
  and final decisions will be appended without rewriting planned claims.

## Execution evidence

- ADR-0019 selected a separate schema-v1 canonical JSON document per General
  conversation, with bounded scans, restrictive modes, owner-token locks,
  flushed temporary files, atomic rename, exact-byte/hash validation, and no
  edit/delete API;
- `packages/general-conversation` owns provider-neutral capture contracts and
  `integrations/local-general-conversation` owns local paths and persistence;
- historical search gained additive `GENERAL_ONLY` and `ALL_SCOPES` APIs while
  existing project-only and CLI APIs remained unchanged;
- the loopback GUI can create, append, list, inspect, prepare a search phrase,
  and search General without a registered or selected project;
- synthetic tests cover Unicode bytes/hash, restricted rejection without echo,
  stale append, restrictive permissions, corruption/incomplete state,
  no-project capture/search, scope merge, and legacy project regression;
- the full repository check passed with 211 tests after loopback acceptance.

## Review and retrospective

The implementation stayed inside the planned modular monolith and introduced
no database, index, service, model SDK, external request, migration, or schema
change to project sessions. The synthetic corpus remained far below the
declared 1,000-document, 10,000-event, and 16-MiB General scan bounds; local
tests produced no latency or functional trigger for FTS5. Lexical known-item
cases passed, and no predeclared semantic miss corpus was introduced, so
decisions remain **no change** for FTS5 and semantic retrieval.

The next safe increment is an explicit additive association from General
evidence to a project, not ownership mutation or model delivery. Sprint 24
plans that work and requires ADR-0020 before code.
