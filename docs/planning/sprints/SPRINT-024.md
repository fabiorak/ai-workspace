# Sprint 24 — Link General Evidence to a Project Explicitly

**Primary epics:** E0 — Product foundation; E3 — Memory and Search

**Milestone:** M5-adjacent provenance increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 23 completed; ADR-0018 and ADR-0019 accepted

## Sprint goal

Let a user add an explicit, immutable provenance link from selected General
evidence to one registered project without moving, copying, promoting, or
reclassifying the original evidence, so later retrieval can explain relevance
without corrupting ownership.

## Evidence and problem statement

Sprint 23 proves project-free capture and lexical retrieval. A retrieved
question can later become relevant to a project, but changing its `GENERAL`
scope or copying it into project history would destroy canonical provenance and
create divergent evidence. ADR-0018 requires any future association to be
explicit and additive.

## Committed backlog

### S24-01 — Decide the association aggregate

- write ADR-0020 before code, comparing embedded General links, a separate
  append-only association store, and copying into project session history;
- preserve immutable General/project documents and select a separate bounded
  link aggregate unless evidence overturns the boundary;
- define stable link identity, actor, timestamp, General event hash, explicit
  target project, user-authored rationale, and verification/data-class state;
- stop and re-plan for a database, migration, model, network, or encryption
  dependency.

### S24-02 — Create immutable links safely

- require an explicit General event and registered project; never use current
  project selection as implicit consent;
- screen the rationale for restricted data and bind the link to the exact
  General content hash;
- use bounded schema-versioned JSON, locks, temporary write, flush, atomic
  rename, owner-token cleanup, restrictive permissions, and no edit/delete;
- reject stale hashes, duplicate links, cross-scope IDs, corrupt state, and
  partial writes without echo.

### S24-03 — Explain links in retrieval

- add link metadata to General results without changing their `GENERAL` scope;
- support an explicit associated-with-project filter while keeping existing
  selected-project history project-only;
- validate links and both referenced scopes before returning all-scope results;
- preserve merge-before-limit, deterministic ordering, and no-partial behavior.

### S24-04 — Deliver the bilingual GUI journey

- show source `GENERAL` and target `PROJECT` side by side before confirmation;
- require a reviewed rationale and explicit create action;
- display attribution, exact source hash, target, and “link only” effect using
  non-color labels and safe `textContent` rendering;
- provide EN/IT stale, duplicate, restricted, missing-project, corruption, and
  no-link recovery without exposing paths.

### S24-05 — Prove boundaries and close

- cover same-timestamp and same-text collisions, stale hashes, duplicate links,
  project removal, corruption, permissions, locks, bounds, and no echo;
- prove original General/project bytes are unchanged and no active memory,
  Work Item, Context Pack, instruction, permission, model, or execution path is
  created;
- run clean install/build/check/audit, isolated loopback acceptance, diff and
  public-safety scans; update docs and create one commit without push.

## Out of scope

Moving or copying General events, changing scope, promotion to active memory or
Work Items, model invocation or assistant replies, semantic/indexed search,
editing/deleting links or evidence, encryption, remote access, and execution.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

## Definition of done

- ADR-0020 fixes the additive link boundary before code;
- one explicit General event can be linked immutably to one registered project;
- original evidence remains byte-identical and scoped `GENERAL`;
- search explains links without implicitly including General in project-only
  queries;
- corruption and stale provenance fail closed without partials or content echo;
- bilingual loopback acceptance and all repository gates pass; one commit is
  created and no push occurs.

## Risks and mitigations

| Risk                                       | Mitigation                                                        |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Link is mistaken for ownership transfer    | Keep `GENERAL` scope and show source/target/effect explicitly     |
| Current project creates accidental consent | Explicit target and confirmation; no selection inference          |
| Stale content is linked                    | Bind and revalidate exact General SHA-256                         |
| Link becomes trusted memory                | `USER_AUTHORED`/`UNVERIFIED` evidence only; no promotion consumer |
| Corrupt links leak partial results         | Validate the complete requested link set before search output     |

## Delivered outcome

- ADR-0020 selected a separate immutable, schema-v1 link aggregate before
  implementation; no database, migration, model, network, or encryption store
  was introduced.
- `packages/general-project-link` owns explicit creation, exact General hash
  binding, project validation, restricted-rationale screening, attribution,
  duplicate semantics, and the `LINK_ONLY` boundary.
- `integrations/local-general-project-link` owns bounded canonical JSON
  documents, a store-wide owner-token lock, flushed temporary writes, atomic
  rename, directory flush, restrictive modes, and fail-closed reads.
- Scoped historical search validates all links and both referenced scopes,
  annotates General results, and supports an explicit `associatedProjectId`
  filter. Existing project-only search and CLI behavior are unchanged.
- The loopback GUI/API show exact `GENERAL` source/hash and explicit `PROJECT`
  target before creation, render link attribution and rationale with
  `textContent`, and state the non-ownership effect in English and Italian.
- Synthetic tests cover stale hashes, restricted rationale without echo,
  duplicates, missing/removed projects, corruption, partial temporary state,
  restrictive permissions, exact association filtering, and unchanged General
  API bytes.

## Review and retrospective

The separate aggregate preserved both existing canonical formats and required
only additive ports. Store-wide locking is intentionally conservative: it
prevents duplicate tuple races while the bounded corpus is small. No measured
scale or lexical miss trigger justifies FTS5, semantic retrieval, or another
runtime dependency. Sprint 25 will measure validation and scan cost before any
index decision.

## Verification result

- clean locked install and clean composite build passed;
- repository check passed with 217/217 tests, including isolated loopback GUI
  acceptance;
- npm audit reported 0 vulnerabilities;
- formatting, lint, typecheck, diff check, and public-safety scan passed;
- one commit is created without push as the final close action.
