# Sprint 25 — Measure General Link Retrieval Scale

**Primary epics:** E0 — Product foundation; E3 — Memory and Search

**Milestone:** M5-adjacent retrieval evidence

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 24 completed; ADR-0018, ADR-0019, and ADR-0020 accepted

## Sprint goal

Measure the bounded canonical scan and complete link-validation path with a
fixed synthetic corpus, so any decision to retain JSON scans or introduce a
rebuildable local index is based on predeclared scale, latency, and miss
evidence rather than assumption.

## Evidence and problem statement

Sprint 24 validates every link and both referenced scopes before returning any
result. This is the safest no-partial contract, but cost grows linearly with
General events and links. No current corpus exceeded a declared bound, latency
threshold, or lexical known-item expectation. Indexing now would add lifecycle
and privacy surface without evidence.

## Committed backlog

### S25-01 — Freeze measurement semantics

- predeclare corpus sizes, exact known-item queries, same-text/timestamp/hash
  collision cases, link fan-out, invalid-reference cases, warm/cold runs, and
  machine-independent operation counts before implementation;
- define decision thresholds separately for canonical scan latency, complete
  validation cost, bound pressure, and lexical known-item misses;
- keep generated corpus data synthetic, deterministic, bounded, and ignored.

### S25-02 — Add a development-only measurement harness

- build documents through production encoders and read through production
  validators without adding a GUI or runtime route;
- report exact documents, events, links, bytes, validations, matches, and
  elapsed observations without retaining local paths or content;
- keep canonical stores, public APIs, and search ordering unchanged.

### S25-03 — Exercise integrity and retrieval boundaries

- measure General-only, all-scope, linked annotation, and explicit associated
  project filtering before the global limit;
- prove corruption, stale hash, missing project, duplicate tuple, and partial
  state still fail closed with no partial output or content echo;
- distinguish storage validation cost from literal matching cost.

### S25-04 — Decide and document

- publish the reproducible synthetic report and compare observations with the
  predeclared triggers;
- record `no change` if all thresholds hold; write a new ADR before any FTS5 or
  other indexed adapter proposal if a trigger is crossed;
- keep semantic retrieval separately evidence-gated by paraphrase/vocabulary
  misses as required by ADR-0018.

### S25-05 — Close safely

- run clean install/build/check/audit, deterministic reruns, diff checks, and
  public-safety scans;
- update architecture, planning, public design, and developer documentation;
- create one commit without push.

## Out of scope

Production indexes, SQLite/FTS5, embeddings, semantic/hybrid retrieval,
database migration, background jobs, GUI controls, model/network access,
editing/deleting evidence or links, active-memory promotion, delivery, and
execution.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

## Definition of done

- corpus and thresholds precede measurement code;
- results separate validation, scan, matching, and bound pressure;
- repeated runs preserve deterministic counts and decisions;
- fail-closed and no-echo contracts remain unchanged;
- index and semantic decisions follow their separate evidence gates;
- all repository gates pass; one commit is created and no push occurs.

## Risks and mitigations

| Risk                                               | Mitigation                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Host timing is mistaken for a universal benchmark  | Pair elapsed observations with deterministic operation/byte counts |
| Synthetic corpus favors the current implementation | Predeclare adversarial fan-out, collision, and corruption cases    |
| Measurement code becomes a production dependency   | Keep it development-only with no facade or runtime route           |
| Indexing conflates scale with semantic relevance   | Maintain separate scale and lexical-miss decision gates            |

## Delivered outcome

- the corpus, invalid-reference matrix, operation counts, timing observations,
  and decision gates were frozen in
  `docs/development/general-link-retrieval-scale-corpus.md` before code;
- `scripts/general-link-scale-measurement.ts` creates SMALL or REFERENCE state
  through production services/stores in a private temporary workspace, reads
  through production validators, runs five production searches, reports only
  aggregate metadata, and always removes generated state;
- two REFERENCE evaluations produced identical document/event/link/byte/match
  counts with zero known-item misses, scope violations, or effect violations;
- cold totals were 87.905 ms and 82.804 ms; warm five-query p95 observations
  were 90.075 ms and 73.986 ms, below the predeclared 2,000/500 ms gates;
- count and byte pressure remained below 2.4% of every production bound;
- stale hash, removed project, duplicate identity/tuple, cross-conversation
  event identity, corruption, temporary state, owner lock, bounds, no-partial,
  and no-echo contracts remain covered by production-path tests.

## Decision and retrospective

Decision: `NO_CHANGE`. Canonical bounded JSON remains the source and retrieval
path. No measured scale, latency, bound-pressure, exact known-item miss, or
validation-amplification trigger justifies FTS5 or another index, so no ADR was
created. Semantic retrieval remains separately gated by a predeclared
paraphrase/vocabulary-mismatch corpus under ADR-0018; Sprint 25 provides no such
evidence.

The elapsed observations are local diagnostics only. Exact counts, bytes,
matches, violations, and the two-run decision algorithm are deterministic and
automated. No facade, GUI, runtime, persistence schema, background task,
network, model, delivery, permission, or execution boundary changed.

## Verification result

- clean locked install and clean composite build passed;
- repository check passed with 221/221 tests, including isolated loopback GUI
  acceptance and deterministic SMALL measurement reruns;
- two complete REFERENCE evaluations passed every frozen gate with decision
  `NO_CHANGE`;
- npm audit reported 0 vulnerabilities;
- formatting, lint, typecheck, diff check, and public-safety scans passed;
- one commit is created without push as the final close action.
