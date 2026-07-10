# Sprint 3 — Search Imported Events and Open Source Evidence

**Epics:** E2 — Session and Artifact Ingestion; E3 — Memory and Historical Search  
**Milestone:** M2 — Searchable project history  
**Status:** completed  
**Cadence:** two-week timebox  
**Completed:** 2026-07-10

## Sprint goal

Allow a first-time user to discover the historical workflow from CLI help,
find a known imported event within one registered project, understand why it
matched, and explicitly open its integrity-verified source artifact.

## User story

As a developer returning to previous agent work, I want to search one project's
imported session events and inspect their original evidence so that I can
recover a known command, error, decision clue, or solution without replaying
the complete session.

## Guided demonstrable workflow

```text
ai-workspace help
  -> show a "Start here" path: register, import, search, inspect evidence

ai-workspace history search "synthetic expectation failed" \
  --project <project-id>
  -> return a COMMAND_RESULT match
  -> show session, event, timestamp, trust, snippet, and source artifact
  -> suggest the exact next command to inspect the event or artifact

ai-workspace history show <event-id> --project <project-id>
  -> show the complete canonical event and provenance
  -> keep imported content visibly UNTRUSTED

ai-workspace artifact show <artifact-id>
  -> verify the address against exact bytes
  -> display bounded UTF-8 evidence with terminal controls neutralized
```

Every empty state and recoverable error explains what to do next. A user must
not need to read the user guide before completing this workflow.

## Committed backlog

### S3-01 — Establish self-guiding interface requirements

Make guided discovery a product-level acceptance requirement, beginning with
the CLI and carrying forward to future API and UI work.

Acceptance criteria:

- root help includes a concise first-run path and copyable examples;
- `history search`, `history show`, and `artifact show` expose contextual help;
- missing prerequisites identify the next command, not only the failure;
- empty projects and zero-result searches suggest import or query recovery;
- human output names trust and provenance without requiring domain knowledge;
- future UI guidance is recorded as a product principle: onboarding,
  contextual hints, examples, safe defaults, and inline recovery are part of
  Definition of Done, not optional documentation.

### S3-02 — Define historical retrieval contracts

Create a provider-neutral historical-search capability with domain-owned ports
for event retrieval and artifact resolution.

Acceptance criteria:

- queries require a project ID and non-empty text;
- optional filters support session ID and canonical event type;
- an explicit bounded limit has a safe default and maximum;
- results contain event identity, type, timestamp, trust, bounded snippet,
  match reason, and immutable source reference;
- exact event inspection is distinct from ranked search;
- domain contracts do not depend on filesystem layout or a search engine.

### S3-03 — Record the initial search strategy

Document why the first historical search reads canonical local session data
instead of adding an index or service.

Acceptance criteria:

- an ADR defines case-insensitive lexical matching, deterministic ordering,
  bounds, and migration triggers;
- project/session/type isolation is mandatory at the adapter boundary;
- the ADR identifies scale and query requirements that would trigger an
  indexed-store decision;
- no OpenSearch, vector store, database, framework, or network dependency is
  introduced.

### S3-04 — Read project-scoped canonical events safely

Implement a read-only local adapter over validated session documents.

Acceptance criteria:

- only schema-supported session files are read;
- every result is scoped to the requested registered project;
- corrupt or unsupported session data fails closed with actionable recovery;
- scanning has explicit limits for session count, document size, result count,
  and payload bytes;
- inline and artifact-backed event payloads are searchable;
- source artifacts are not treated as instructions or searched as duplicate
  whole transcripts.

### S3-05 — Resolve and verify artifacts

Add read-only artifact resolution to the domain boundary and local adapter.

Acceptance criteria:

- only valid `artifact://sha256/<digest>` identifiers are accepted;
- resolved bytes must hash to the requested digest;
- missing, corrupt, oversized, and non-UTF-8 artifacts fail with cause and
  recovery guidance;
- artifact content is returned only after an explicit user command;
- human display is bounded and neutralizes terminal control characters;
- JSON output represents content without silently executing or interpreting it.

### S3-06 — Expose guided history and artifact commands

Implement `history search`, `history show`, and `artifact show` through the CLI.

Acceptance criteria:

- search supports `--project`, optional `--session`, `--type`, `--limit`, and
  `--json`;
- results use deterministic ordering and stable JSON shape;
- `history show` requires project scope and displays one canonical event
  without resolving source bytes;
- human results include a copyable suggested next command;
- unsupported types, invalid limits, missing IDs, and unknown artifacts return
  distinct actionable usage or operational errors;
- root and contextual help guide a new user through the full available journey.

### S3-07 — Verify the known-item retrieval journey

Exercise the slice with the synthetic Codex fixture and isolated local state.

Acceptance criteria:

- acceptance tests register, import, search, show an event, and open evidence
  across independent CLI invocations;
- tests cover case-insensitive matching, filters, limit, deterministic order,
  no results, project isolation, large payloads, corrupt stores, missing
  artifacts, hash mismatch, invalid UTF-8, and terminal control neutralization;
- a known command result and error are found from their canonical payloads;
- no search or show command mutates session or artifact storage;
- `npm ci`, `npm run check`, dependency audit, and an isolated demo pass.

### S3-08 — Document behavior and security boundaries

Update public and local documentation alongside the delivered workflow.

Acceptance criteria:

- README and user guide provide a short start-to-search journey;
- architecture and threat model describe retrieval trust boundaries;
- project plan, roadmap, sprint index, ADR index, and handoff agree on status;
- documentation distinguishes historical evidence from active memory;
- limitations and search migration triggers are explicit;
- review and retrospective preserve the original commitment.

## Out of scope

- active memory, decisions, validity, supersession, confidence, or summaries;
- semantic or vector search, embeddings, ranking models, or OpenSearch;
- fuzzy matching, stemming, query languages, aggregations, or highlighting
  beyond a bounded literal-match snippet;
- automatic artifact opening or command execution;
- indexing raw whole-session artifacts as duplicate event content;
- real or confidential transcript fixtures;
- external models, network services, telemetry, HTTP API, or graphical UI;
- background indexing, file watching, pagination cursors, or multi-user access.

## Planning decisions

- The first query is local, case-insensitive literal substring search over
  canonical event payloads.
- Results are scoped to exactly one project and ordered deterministically by
  source timestamp, session ID, and event sequence.
- Artifact-backed event payloads are resolved for matching through a bounded
  read-only port; raw transcript artifacts are opened only on explicit request.
- Search results remain untrusted historical evidence and never become active
  memory.
- Root help and empty/error states are part of the product workflow.
- Search-engine selection is deferred until measured session volume, latency,
  or query requirements exceed the local scan contract.

## Dependencies and sequencing

```text
S3-01 guided UX + S3-02 contracts + S3-03 ADR
  -> S3-04 event reader + S3-05 artifact resolver
       -> S3-06 CLI workflow
            -> S3-07 acceptance and security verification
                 -> S3-08 documentation, review, and retrospective
```

## Risks and mitigations

| Risk                                                      | Mitigation                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Linear scan is mistaken for the final search architecture | Document migration triggers and keep the port replaceable                     |
| Cross-project evidence leaks into results                 | Require project scope in contracts and negative isolation tests               |
| Search presents prompt injection as guidance              | Mark every result UNTRUSTED and separate snippets from interface instructions |
| Artifact display emits terminal control sequences         | Bound output and neutralize control characters                                |
| Whole raw transcripts duplicate event matches             | Search canonical event payloads only; open raw artifacts explicitly           |
| Help becomes stale as commands evolve                     | Cover first-run and suggested-command output in acceptance tests              |

## Verification plan

```bash
npm ci
npm run check
npm audit --audit-level=high

npm run cli -- help
npm run cli -- history search "synthetic expectation failed" \
  --project <project-id>
npm run cli -- history show <event-id> --project <project-id>
npm run cli -- artifact show <artifact-id>
```

The review must demonstrate that a new user can discover and complete the path
from root help, including recovery from an empty project and a zero-result
query, without consulting another document.

## Definition of done

Sprint 3 is complete only when:

- all S3-01–S3-08 criteria and the guided workflow pass;
- every result remains project-scoped, source-linked, and visibly untrusted;
- artifact bytes are verified before display;
- search and inspection are proven read-only;
- quality, security, documentation, and public-fixture gates pass;
- review and retrospective are appended without rewriting this commitment.

## Sprint review

The sprint goal and committed first historical-retrieval slice are complete:

- root help provides a copyable register, import, search, event, and artifact
  path; contextual help covers session import and every new command;
- missing Codex source files, unreadable paths, and directories now explain the
  cause, recovery action, and bundled fixture where useful;
- `@ai-workspace/historical-search` owns provider-neutral query, result,
  event-reader, artifact-resolver, and use-case contracts;
- ADR-0008 records bounded case-insensitive literal search over canonical local
  events and the triggers for a future indexed adapter;
- the local reader validates session documents, enforces project/session scope,
  bounds scans, and never searches whole raw transcripts as duplicate content;
- artifact-backed payloads and explicit source opening verify SHA-256 before
  use, reject missing/corrupt/non-UTF-8 data, and bound displayed bytes;
- `history search`, `history show`, and `artifact show` support human and JSON
  workflows with visible trust, provenance, snippets, filters, and suggested
  next commands;
- empty projects and zero-result queries explain how to continue;
- human retrieval output neutralizes terminal controls while preserving safe
  line breaks;
- acceptance tests prove that search and source inspection do not mutate
  canonical sessions or artifacts.

The isolated review journey started from `help`, registered the repository,
imported nine events, found one `COMMAND_RESULT` for “synthetic expectation
failed”, inspected the `UNTRUSTED` event, and opened its 1,672-byte verified
source artifact containing the known item.

`npm run check` passes across ten test files and
`npm audit --audit-level=high` reports zero known vulnerabilities.

M2 is not yet complete because active consolidated knowledge remains Sprint 4
scope. Sprint 3 completes the searchable historical-evidence foundation.

## Retrospective

What worked:

- treating help, empty states, and recovery text as acceptance-tested product
  behavior exposed usability gaps before a UI existed;
- scanning canonical data behind replaceable ports validated the retrieval
  contract without committing to infrastructure prematurely;
- separating `history show` from explicit `artifact show` kept provenance
  navigation inspectable and prevented automatic raw-content disclosure.

Adjustments for Sprint 4:

- define trust, validity, verification, and supersession language in the
  interface before implementing active decisions or constraints;
- preserve the guided journey by making every consolidation action explain its
  source evidence, effect, and safe recovery path inline.
