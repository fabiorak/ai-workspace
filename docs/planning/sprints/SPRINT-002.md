# Sprint 2 — Import a Codex Session with Provenance

**Epics:** E1 — Project Registry; E2 — Session and Artifact Ingestion  
**Milestone:** M2 — Searchable project history (first ingestion slice)  
**Status:** completed  
**Cadence:** two-week timebox  
**Completed:** 2026-07-10

## Sprint goal

Allow a user to import a synthetic, representative Codex session for an
already registered project through the CLI, preserving immutable source
evidence and provenance while making repeated and incremental imports
idempotent.

## User story

As a developer moving work between coding agents, I want AI Workspace to
acquire a session for a registered repository without duplicating its events
so that later search and handoff workflows can rely on traceable historical
evidence.

## Demonstrable workflow

```text
ai-workspace project register /path/to/repository --json
  -> return an opaque project ID

ai-workspace session import \
  --project <project-id> \
  --source codex \
  --file integrations/codex/test/fixtures/session.jsonl
  -> validate the registered project
  -> screen the complete source before persistence
  -> retain immutable source bytes as a content-addressed artifact
  -> translate supported Codex records into canonical append-only events
  -> report imported and already-present event counts

ai-workspace session import <same arguments>
  -> add no duplicate session or event

ai-workspace session inspect <session-id> --json
  -> show session metadata, ordered events, and source references
```

The demonstration uses only a fictional fixture created for this public
repository. No private transcript, real local path, credential, user identity,
or provider-generated identifier is committed.

## Committed backlog

### S2-01 — Define provider-neutral Session, Event, and provenance contracts

Introduce the domain models and ports owned by a session-ingestion capability
package before implementing provider or filesystem details.

Acceptance criteria:

- every session belongs to an existing opaque project ID;
- canonical events have stable IDs, a session ID, source order, a supported
  type, trust status, and an immutable source reference;
- timestamps and agent/model metadata distinguish absent source data from
  import time;
- event payloads remain either bounded canonical values or artifact
  references, never implicit copies of large source content;
- imported content is explicitly marked as untrusted historical evidence and
  cannot become active memory or executable instruction;
- corrections and later enrichment are additive; imported events are not
  updated in place.

### S2-02 — Record the initial session and artifact storage decisions

Resolve the smallest local persistence design needed by this vertical slice
and record it before implementation.

Acceptance criteria:

- an ADR defines the schema-versioned append-only session/event store,
  incremental-import checkpoint, crash behavior, and migration boundary;
- an ADR defines the filesystem artifact layout, SHA-256 addressing,
  immutability checks, atomic writes, and restrictive permissions;
- the decisions document concurrent-writer limitations and recovery behavior;
- no database, framework, network service, or cloud dependency is introduced.

### S2-03 — Store immutable content-addressed artifacts

Implement a local adapter for source transcripts and event payloads that
should not be embedded in the event log.

Acceptance criteria:

- the artifact identifier is derived from the exact stored bytes and uses an
  explicit algorithm, for example `artifact://sha256/<digest>`;
- writing identical bytes is idempotent and never creates a second artifact;
- an existing object whose bytes do not match its address fails closed;
- directories and files request modes `0700` and `0600` where supported;
- writes use a temporary file and atomic rename;
- artifacts remain under `AI_WORKSPACE_HOME` and are excluded from Git;
- size limits and sanitized errors prevent raw payloads from entering logs.

### S2-04 — Import one controlled Codex JSONL format

Implement the first provider adapter against a documented, synthetic fixture
representing the supported Codex record subset.

Acceptance criteria:

- provider-specific records are translated at the integration boundary;
- the fixture covers user and agent messages, a tool call and result, a
  command result, a file change, a test result, and an error;
- unknown but well-formed records are preserved as referenced source evidence
  without being misclassified;
- malformed JSON, missing required source identity, invalid ordering, and
  unsupported schema variants produce actionable sanitized errors;
- parsing is bounded and never executes imported commands or follows paths
  mentioned inside the transcript;
- the supported source subset and compatibility assumptions are documented.

### S2-05 — Make imports incremental and idempotent

Persist sessions and events so a growing source can be imported repeatedly
without duplicating prior evidence.

Acceptance criteria:

- stable session and event identities derive from provider source identity
  and source position or content, not from import time or local paths;
- importing an unchanged fixture twice adds zero events on the second run;
- importing an append-only extension adds only the new events;
- a changed or truncated previously imported prefix is detected and fails
  closed instead of silently rewriting history;
- a failed import does not expose a partially committed session;
- events are returned in deterministic source order;
- multi-process writer coordination is either implemented or stated as a
  tested limitation with a clear error/recovery path.

### S2-06 — Screen restricted data before persistence

Add a replaceable ingestion-screening port and a conservative initial adapter
for high-confidence credential patterns.

Acceptance criteria:

- the complete raw source and extracted payloads are screened before any new
  event or artifact becomes visible;
- detected restricted content blocks the import by default;
- errors identify the source location and detector category without repeating
  the detected value;
- tests use obvious fictional canaries and verify that values do not appear in
  output, persisted state, snapshots, or logs;
- the documentation states that this baseline is not a guarantee that all
  secrets or confidential data will be detected;
- no content is sent to an external model or network service.

### S2-07 — Expose import and inspection through the CLI

Add scriptable session commands and compose the domain with the Codex and
local-storage adapters.

Acceptance criteria:

- `session import` requires an existing project ID, explicit source adapter,
  and explicit input file;
- `session inspect` displays session metadata, ordered events, and source
  references without dumping large artifact bodies;
- human output neutralizes control characters from imported metadata;
- `--json` emits only deterministic machine-readable output on success;
- usage errors and operational failures return distinct non-zero outcomes;
- import summaries distinguish added, already present, and total events.

### S2-08 — Verify and document the ingestion slice

Exercise the complete workflow with synthetic data and document its security
and compatibility boundaries.

Acceptance criteria:

- unit tests cover identity, ordering, provenance, and additive behavior;
- adapter tests cover the supported Codex records and malformed input;
- storage tests cover hashing, deduplication, corruption, atomic failure, and
  restrictive permissions where portable;
- acceptance tests cover first import, identical re-import, incremental
  extension, project isolation, secret rejection, and session inspection
  across independent CLI invocations;
- `npm run check` and the dependency audit pass;
- the README, architecture overview, threat model, user guide, ADR index,
  project plan, sprint index, and local handoff reflect delivered behavior.

## Out of scope

- automatic discovery of Codex state directories or background watching;
- import of real, private, or manually redacted user transcripts into tests;
- support for a second agent or undocumented Codex schema variants;
- search, OpenSearch, embeddings, summaries, active memory, or handoffs;
- execution or replay of imported commands and tool calls;
- sending content to agents, models, telemetry, or other network services;
- general PII detection, reversible pseudonymization, or a claim of complete
  secret detection;
- concurrent multi-process imports unless the storage ADR explicitly brings
  them into scope;
- HTTP API, UI, database, or daemon work.

## Planning decisions

- Codex is the first adapter because it provides the current development path
  while the canonical domain remains provider-neutral.
- Only an explicitly supplied file is imported; automatic local transcript
  discovery is deferred to avoid surprising filesystem access.
- The repository contains one purpose-built fictional fixture, not captured or
  transformed private data.
- Raw bytes are screened before content-addressed persistence.
- SHA-256 addresses immutable artifacts; canonical events reference rather
  than duplicate large payloads.
- Source identity and stable source position drive idempotency. Local paths,
  import timestamps, and random IDs do not.
- Historical evidence remains separate from active memory and search indexes.
- Storage details become accepted decisions only through the Sprint 2 ADRs.

## Dependencies and sequencing

```text
S2-01 contracts
  -> S2-02 storage ADRs
       -> S2-03 artifact adapter
       -> S2-05 session/event persistence

S2-01 contracts
  -> S2-04 Codex adapter
       -> S2-06 ingestion screening

S2-03 + S2-04 + S2-05 + S2-06
  -> S2-07 CLI workflow
       -> S2-08 acceptance, security review, and documentation
```

S2-03 through S2-06 can proceed in parallel after their owning contracts and
decisions are stable. S2-07 is the integration point; S2-08 closes the sprint.

## Risks and mitigations

| Risk                                            | Mitigation                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Codex source format changes                     | Support and document one fixture-backed subset; fail closed on incompatible variants |
| Stable IDs change when a file grows             | Base identities on immutable source identity and validated source position           |
| A prior source prefix is rewritten              | Persist prefix checkpoints and reject truncation or mutation                         |
| Restricted content is copied into local storage | Screen raw and extracted content before making any artifact or event visible         |
| JSONL append is interrupted                     | Specify atomicity and recovery in the storage ADR and test the failure path          |
| Provider concepts leak into the domain          | Translate in `integrations/codex` and test the canonical contract independently      |
| Public fixtures reveal local information        | Author fictional values from scratch and review committed bytes and Git diff         |

## Verification plan

Run from the repository root using an isolated home directory:

```bash
npm ci
npm run check
npm audit --audit-level=high

AI_WORKSPACE_HOME=/tmp/ai-workspace-sprint-2 \
  npm run cli -- project register . --json

AI_WORKSPACE_HOME=/tmp/ai-workspace-sprint-2 \
  npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file integrations/codex/test/fixtures/session.jsonl \
  --json

AI_WORKSPACE_HOME=/tmp/ai-workspace-sprint-2 \
  npm run cli -- session inspect <session-id> --json
```

The review must show the first import, an unchanged second import with zero
new events, an append-only extension that adds only its suffix, and rejection
of a synthetic restricted-data canary without printing or storing its value.

## Definition of done

Sprint 2 is complete only when:

- the demonstrable workflow and all committed acceptance criteria pass;
- every visible imported event has a resolvable immutable source reference;
- unchanged and incremental import behavior is verified across CLI processes;
- no fixture or documentation contains private data or machine-specific paths;
- storage decisions and residual risks are recorded in ADRs and the threat
  model;
- user-facing and planning documents describe the same delivered scope;
- review and retrospective sections are added without rewriting this original
  commitment.

## Sprint review

The sprint goal and committed acceptance criteria are complete:

- `@ai-workspace/session-ingestion` owns provider-neutral Session, Event,
  Source Reference, import report, and adapter ports;
- ADR-0006 selects validated per-session atomic JSON documents with logical
  append-only prefixes and exclusive locks;
- ADR-0007 selects immutable exact-byte SHA-256 artifacts published without
  overwriting existing content;
- the Codex adapter imports one bounded, documented JSONL subset from an
  explicit file and preserves unknown records as `UNKNOWN` evidence;
- the public fixture was authored from scratch and covers messages, tools,
  commands, file changes, tests, errors, and an unknown record;
- a conservative pre-persistence screen blocks high-confidence credential
  patterns without echoing detected values;
- stable identities and stored record hashes make unchanged imports
  idempotent, append-only growth incremental, and mutation or truncation a
  fail-closed error;
- `session import` and `session inspect` provide human and JSON workflows for
  an existing project ID without resolving artifact bodies;
- tests cover domain behavior, parser failures, large payload artifacts,
  corruption, locks, permissions, project isolation, restricted-data
  rejection, CLI usage errors, and independent CLI invocations.

An isolated CLI demonstration imported nine events, reimported the same source
with zero additions, and inspected nine ordered `UNTRUSTED` events with
resolvable SHA-256 source references. `npm run check` passes and
`npm audit --audit-level=high` reports zero known vulnerabilities.

M2 is not complete: Sprint 2 supplies its ingestion foundation, while
historical retrieval remains forecast for Sprint 3.

## Retrospective

What worked:

- stabilizing domain contracts and storage ADRs before adapters prevented
  provider and filesystem details from leaking into the application model;
- exact source-record hashes made idempotency, incremental growth, and
  tamper detection one coherent invariant;
- a real CLI acceptance workflow exposed asynchronous error handling that
  unit tests alone did not reveal.

Adjustments for Sprint 3:

- add read-only artifact resolution behind a domain-owned port before search
  results can open source evidence;
- define retrieval acceptance fixtures and workspace/project isolation before
  choosing a search engine, keeping the first searchable slice local and
  dependency-light if its measured requirements permit.
