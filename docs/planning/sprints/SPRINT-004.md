# Sprint 4 — Consolidate Active Project Memory

**Epic:** E3 — Memory and Historical Search
**Milestone:** M2 — Searchable project history
**Status:** planned
**Cadence:** two-week timebox

## Sprint goal

Allow a first-time user to turn selected historical evidence into explicit,
project-scoped active decisions, constraints, and failure records; inspect
their provenance and verification state; and replace stale knowledge without
silently rewriting history.

## User story

As a developer resuming previous agent work, I want to curate the small set of
decisions, constraints, and failures that still matter, with links to their
source evidence and clear lifecycle state, so that current project knowledge
is distinguishable from untrusted session history.

## Guided demonstrable workflow

```text
ai-workspace history search "synthetic runtime constraint" \
  --project <project-id>
  -> find relevant UNTRUSTED historical evidence
  -> suggest how to create a source-linked memory item

ai-workspace memory add --project <project-id> \
  --type constraint \
  --content "Synthetic example: keep runtime support on Node.js 24" \
  --source-event <event-id>
  -> create an ACTIVE, UNVERIFIED, USER_CURATED item
  -> explain that curated does not mean verified or trusted

ai-workspace memory list --project <project-id>
  -> show active items by default with type, validity, verification, and source

ai-workspace memory show <memory-id> --project <project-id>
  -> show the complete item, lifecycle, and copyable source-inspection command

ai-workspace memory verify <memory-id> --project <project-id> \
  --source-event <verification-event-id> \
  --note "Synthetic verification performed against the recorded test result"
  -> append an attributable verification record without changing evidence

ai-workspace memory supersede <memory-id> --project <project-id> \
  --content "Synthetic example: support Node.js 24 and 26" \
  --source-event <replacement-event-id>
  -> create a replacement and link the previous item as SUPERSEDED
```

The exact command grammar may be refined during implementation, but the review
must preserve this discoverable journey and its trust language. A user must
not need the user guide to understand the effect of any write.

## Product language fixed before implementation

- **Historical evidence** is immutable imported material. It remains
  `UNTRUSTED` and is never promoted or executed automatically.
- **USER_CURATED** means a local user explicitly wrote or accepted the memory
  statement. It does not mean that the statement is true, safe, or verified.
- **Validity** describes whether an item is currently applicable:
  `ACTIVE`, `SUPERSEDED`, or `INVALIDATED`.
- **Verification** describes an explicit recorded check: `UNVERIFIED` or
  `VERIFIED`. Verification records who/what performed the check, when, how,
  and against which source evidence; it does not change source trust.
- **Confidence** is an optional human assessment, not a calculated truth score:
  `UNASSESSED`, `LOW`, `MEDIUM`, or `HIGH`.
- **Supersession** creates a new item and links the old and new records. It
  never overwrites the statement or provenance of the previous item.
- **Invalidation** records that an item should no longer be treated as valid
  without claiming that a replacement exists.

Human output must present these meanings at the point of use. JSON output must
use stable machine-readable fields rather than collapsing the concepts into a
single status.

## Committed backlog

### S4-01 — Define active-memory language and lifecycle invariants

Turn trust, curation, validity, verification, confidence, and supersession into
domain vocabulary and user-facing rules before implementing persistence.

Acceptance criteria:

- active memory and historical evidence are different domain objects and
  storage concerns;
- item types for this slice are exactly `DECISION`, `CONSTRAINT`, and
  `FAILURE`;
- validity, verification, confidence, and curation are separate fields;
- new items default safely to `ACTIVE`, `UNVERIFIED`, `UNASSESSED`, and
  `USER_CURATED`;
- only active items are returned by the default list operation;
- superseded and invalidated items remain inspectable through explicit status
  filters or exact lookup;
- terminology is included in contextual help and human output, not only docs.

### S4-02 — Define provider-neutral active-memory contracts

Create an `@ai-workspace/active-memory` capability with domain-owned lifecycle
operations and persistence ports.

Acceptance criteria:

- every operation requires an existing project ID;
- item creation requires a type, non-empty bounded content, and at least one
  canonical source event from the same project;
- records include opaque identity, project, type, content, curation, validity,
  verification, confidence, version, timestamps, and immutable source links;
- source links retain enough event and artifact provenance to navigate back to
  canonical evidence without copying raw payloads into active storage;
- verification is an attributable append-only record with a bounded note and
  at least one same-project source event;
- supersession atomically creates the replacement and links both directions;
- invalidation is explicit, attributable, source-linked, and distinct from
  supersession;
- contracts do not depend on filesystem layout, CLI types, a database, an
  agent, or a model provider.

### S4-03 — Record local persistence and lifecycle decisions

Add an ADR before storage implementation that selects the initial local
active-memory representation and mutation strategy.

Acceptance criteria:

- the ADR compares an append-only operation journal with atomic snapshots or
  another minimal local representation;
- it defines schema versioning, deterministic reconstruction, atomic writes,
  locking, restrictive permissions, corruption handling, and migration
  triggers;
- it explains how corrections remain additive and attributable;
- it keeps active memory physically and logically separate from canonical
  sessions, artifacts, and historical-search adapters;
- it introduces no database, framework, service, network dependency, or
  background process.

### S4-04 — Implement project-scoped local active-memory storage

Implement the chosen local adapter behind the domain port.

Acceptance criteria:

- stored documents or journal entries are schema-validated before use;
- IDs are opaque and content-independent;
- reads and writes cannot cross project boundaries;
- concurrent writes do not silently lose updates;
- malformed, unsupported, truncated, or inconsistent state fails closed with
  cause and recovery guidance that does not disclose stored content;
- supersession and invalidation invariants are enforced at the persistence
  boundary and survive reload;
- failures cannot partially expose a new active state;
- local files use restrictive permissions and remain outside Git.

### S4-05 — Validate and resolve source provenance

Connect active-memory operations to canonical historical events through a
read-only source-validation port.

Acceptance criteria:

- every referenced event exists in the requested registered project;
- event IDs from another project are rejected without leaking foreign event
  content or metadata;
- source references preserve event ID, session ID, event type, position,
  record hash, and source artifact ID where available;
- verification and replacement sources are independently retained;
- opening source evidence remains an explicit `history show` or
  `artifact show` action;
- active-memory writes never modify sessions or artifacts and never interpret
  evidence as executable instructions.

### S4-06 — Expose a self-guiding memory CLI

Add guided commands for creating, listing, inspecting, verifying,
superseding, and invalidating memory items.

Acceptance criteria:

- root and contextual help explain the history-to-memory path with copyable
  synthetic examples;
- every write previews or clearly states its effect, resulting lifecycle
  state, and source relationship;
- safe defaults never mark a new item verified or hide stale records;
- list supports project scope plus bounded type, validity, verification, and
  result-limit filters, with active-only as the human default;
- show exposes the complete lifecycle and suggests exact commands to inspect
  sources or perform the next valid transition;
- verify requires a bounded method/note and source evidence;
- supersede creates a replacement rather than editing the old item;
- invalidate requires a bounded reason and source evidence;
- all commands support stable JSON output and terminal-safe human output;
- usage, missing-source, cross-project, duplicate-transition, stale-state, and
  corrupt-storage failures are distinct and actionable.

### S4-07 — Verify the active-memory journey and security boundaries

Exercise the slice with synthetic imported evidence and isolated local state.

Acceptance criteria:

- acceptance tests register, import, search, add each supported memory type,
  list, show, verify, supersede, invalidate, and inspect sources across
  independent CLI invocations;
- tests cover bounds, type/status filters, deterministic ordering, empty state,
  unknown IDs, project isolation, invalid transitions, corruption, concurrent
  writes, terminal controls, and stable JSON;
- default list output never presents superseded or invalidated knowledge as
  active;
- verification does not alter the trust label or bytes of source evidence;
- supersession leaves the old content, sources, and audit history unchanged;
- active-memory operations leave canonical sessions and artifacts byte-for-byte
  unchanged;
- `npm ci`, `npm run check`, dependency audit, and an isolated demo pass.

### S4-08 — Document behavior and close M2

Update product, architecture, security, planning, and user guidance alongside
the delivered workflow.

Acceptance criteria:

- README and a focused user guide cover the complete guided journey;
- architecture and threat model describe the active-memory trust boundary,
  mutation model, project isolation, and residual risks;
- project plan, roadmap, sprint index, ADR index, and handoff agree on status;
- documentation explains validity versus verification, curation versus trust,
  supersession versus invalidation, and historical evidence versus memory;
- limitations and migration triggers are explicit;
- review and retrospective preserve this original commitment;
- M2 is marked complete only after historical retrieval and active-memory exit
  criteria both pass.

## Out of scope

- automatic extraction, summarization, classification, verification, or
  promotion by an agent or model;
- active objective, task progress, repository-state snapshots, next actions,
  handoff packets, context packs, or second-agent resume;
- direct editing or deletion of existing memory statements or audit records;
- facts, procedures, preferences, summaries, instructions, or open-task item
  types;
- automatic conflict detection, semantic deduplication, ranking, or expiry;
- policy enforcement or execution based on stored constraints;
- confidence calculation, consensus, source-quality scoring, or cryptographic
  user attestations;
- database, OpenSearch, vector store, HTTP API, graphical UI, model access,
  network access, telemetry, background workers, or file watching;
- real or confidential transcripts, project data, or fixtures.

## Planning decisions

- Consolidation is an explicit local-user write; imported content can never
  promote itself.
- Every item and lifecycle transition is linked to canonical same-project
  evidence.
- The memory statement is curated content, not a copied transcript payload.
- Verification is an attributable assertion about a performed check, not an
  upgrade of imported evidence from untrusted to trusted.
- Corrections are additive: supersession creates a replacement and
  invalidation records a terminal lifecycle transition.
- Active-only is the safe default for operational listing; historical states
  require explicit discovery but remain fully inspectable.
- Initial persistence remains local and replaceable; the ADR must precede its
  implementation.
- No memory item is automatically executed, injected into agent context, or
  included in a handoff during this sprint.

## Dependencies and sequencing

```text
S4-01 language + S4-02 contracts + S4-03 ADR
  -> S4-04 local storage + S4-05 provenance validation
       -> S4-06 guided CLI
            -> S4-07 acceptance and security verification
                 -> S4-08 documentation, review, retrospective, M2 close
```

Implementation must not start until S4-01 language and the S4-03 persistence
decision are reviewable. Storage and provenance adapters can then proceed in
parallel only if their domain contracts are stable.

## Risks and mitigations

| Risk                                                        | Mitigation                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Curated text is mistaken for verified truth                 | Display curation, verification, confidence, and source trust separately             |
| Untrusted evidence silently becomes active instruction      | Require explicit user-authored consolidation; never execute or auto-promote content |
| Stale knowledge appears current                             | Default to active-only and make supersession/invalidation atomic and visible        |
| A foreign-project event is attached as provenance           | Validate every source through a project-scoped read port with negative tests        |
| Concurrent writes lose lifecycle transitions                | Select and test locking plus atomic commit semantics in the ADR                     |
| “Verification” overclaims what was actually established     | Require method/note, actor, timestamp, and evidence; explain its limited meaning    |
| Correcting an item destroys audit history                   | Make changes additive and prohibit in-place content edits or deletion               |
| Memory storage becomes an accidental second history archive | Store curated statements and provenance references, not copied raw event payloads   |

## Verification plan

```bash
npm ci
npm run check
npm audit --audit-level=high

npm run cli -- help
npm run cli -- history search "synthetic runtime constraint" \
  --project <project-id>
npm run cli -- memory add --project <project-id> \
  --type constraint --content "Synthetic runtime constraint" \
  --source-event <event-id>
npm run cli -- memory list --project <project-id>
npm run cli -- memory show <memory-id> --project <project-id>
npm run cli -- memory verify <memory-id> --project <project-id> \
  --source-event <event-id> --note "Synthetic verification method"
npm run cli -- memory supersede <memory-id> --project <project-id> \
  --content "Synthetic replacement constraint" --source-event <event-id>
```

The review must also demonstrate invalidation, historical-state inspection,
cross-project rejection, recovery from corrupt local state, and unchanged
canonical evidence. It must begin from root help and use only synthetic data.

## Definition of done

Sprint 4 is complete only when:

- all S4-01–S4-08 criteria and the guided workflow pass;
- active decisions, constraints, and failures are project-scoped,
  source-linked, and visibly user-curated;
- validity, verification, confidence, and evidence trust remain distinct;
- stale items cannot appear in the default active view;
- every correction and verification is additive and attributable;
- canonical sessions and artifacts are proven unchanged;
- quality, security, documentation, migration, and public-fixture gates pass;
- M2 exit criteria pass and review and retrospective are appended without
  rewriting this commitment.
