# Unified retrieval corpus and gates

**Frozen before the harness was run:** 2026-07-26  
**Scope:** development-only measurement; every record and question is synthetic  
**Decision it supports:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

## Purpose

The [tolerant search corpus](tolerant-search-corpus.md) measures retrieval over
canonical session events alone. This corpus measures a different question: which
store a question is actually asking about. "What did we decide about totals" is a
question about a decision, and decisions live in active memory, which the shipped
search does not read and which exposes no retrieval operation at all.

It also measures two correctness problems that only appear once memory is
searchable, and which ranking cannot solve:

- **superseded and invalidated memory** is an excellent lexical match for exactly
  the question its replacement should answer;
- **a memory item and the event it was extracted from** both match the same
  question, and BM25 favours the shorter of the two.

It compares candidate engines, including SQLite FTS5 through `node:sqlite` and
locally generated dense vectors, so that engine selection is a measurement rather
than a preference. It authorizes no engine, package, index, GUI surface, store
mutation, or embedding model.

## Frozen corpus

Twenty records over the same three projects as the lexical corpus:

- **thirteen canonical events**, reused unchanged from the
  [tolerant search corpus](tolerant-search-corpus.md), all admissible;
- **seven active-memory items**, of which five are `ACTIVE`, one is `SUPERSEDED`
  and one is `INVALIDATED`. The two inadmissible items are deliberate: an engine
  that reaches memory must also refuse to present memory that no longer holds.

The memory items are `DECISION`, `CONSTRAINT`, and `FAILURE` shaped, each
carrying the identifier of the event it was extracted from, so that provenance
redundancy is observable rather than assumed. Every value is fictional and no
real store is read.

A record is **admissible** when it may be shown as a current answer, which for a
memory item means validity `ACTIVE`. Inadmissible records stay in the index so
that returning one is a measurable failure rather than an impossibility.

## Frozen questions

Eight predeclared questions, 11 ground-truth pairs, and 4 **forbidden** pairs. A
forbidden pair names a record that matches the words and would still be a wrong
answer:

- five questions whose answers live in memory only, across the `LITERAL`, `TYPO`,
  `INFLECTION`, `PARAPHRASE`, and `SYNONYM` families;
- two questions that name the superseded decision and the invalidated constraint
  almost verbatim, and whose correct answer is the record that replaced them;
- one cross-store question whose correct answers span both stores.

Families are the ones declared in the lexical corpus, so the two measurements
remain comparable.

## Frozen engines

| Engine                   | Substrate                                    | Critical path |
| ------------------------ | -------------------------------------------- | ------------- |
| `EVENTS_ONLY_INVERTED`   | tolerant inverted index over events only     | yes           |
| `UNIFIED_INVERTED`       | tolerant inverted index over both stores     | yes           |
| `UNIFIED_FTS5_UNICODE61` | SQLite FTS5, `unicode61 remove_diacritics 2` | yes           |
| `UNIFIED_FTS5_TRIGRAM`   | SQLite FTS5, `trigram`                       | yes           |
| `UNIFIED_DENSE`          | locally generated dense vectors              | no            |
| `UNIFIED_HYBRID`         | RRF fusion of lexical and dense              | no            |

`EVENTS_ONLY_INVERTED` is the control: it isolates the cost of the missing store
from the cost of the ranking function, so that a store gap cannot be mistaken
for a tolerance gap.

## Declared bounds

- at most 20,000 records; at most 20 results per query;
- BM25 with k1 1.2 and b 0.75; RRF at k = 60, chosen because it needs no
  score-scale calibration across engines and preserves per-result explanation;
- interactive budget 150 ms per query, index build reported separately;
- dense path: `bge-m3` at a local endpoint, batches of 64, a 120 s build timeout,
  five query samples, and a declared `SKIP` / `IF_AVAILABLE` / `REQUIRE` mode. A
  dense engine that cannot reach the service is reported
  `UNDECIDED_SERVICE_UNAVAILABLE` rather than scored;
- scale profiles are 1,000 / 9,000 / 12,000 records (`REFERENCE`) or 1,000
  (`SMALL`), with two warm-up and three measured passes. Filler repeats the real
  records with one distinct term each, so that the posting lists of the queried
  words grow with the corpus instead of staying artificially short.

## Predeclared scoring

Quality per engine: recall over ground truth, recall restricted to
memory-resident targets, precision over as many positions as the question has
correct answers, the worst rank at which a person finds the first correct answer,
and per-family recall. Precision at a fixed five positions is deliberately not
used: a question with one correct answer could never exceed 20%.

Four structural gates per engine, each independent of ranking quality:

1. **no inadmissible result** is returned for any question;
2. **origin is exposed on every result**, because a person must know which store
   answered;
3. **a match reason is exposed on every result**, because a result whose reason
   cannot be stated must not be shown at a measured precision near one half;
4. **determinism** across runs.

Two separate observations, reported as conclusions rather than scores:

- **store gap**: whether memory targets are reachable at all, and what memory
  recall is with and without unification;
- **provenance redundancy**: how many memory-and-source pairs are returned
  together for the same question.

## Frozen decision algorithm

Per engine, in order:

- `REJECT` if any inadmissible record is returned, whatever the recall;
- `REJECT` if recall is below 70%;
- `REFINE` if recall is below 90%;
- `ADOPT_AS_SECONDARY` if the engine is not on the critical path, or if it needs
  a running service to answer;
- `ADOPT_AS_PRIMARY` otherwise.

Requiring a running service is therefore disqualifying for the primary engine by
construction, not by preference: search must answer with no model, no service,
and no network.

The store-gap conclusion is `UNIFICATION_REQUIRED_FOR_DECLARED_EXPERIENCE` when
memory targets are unreachable without unification. The redundancy conclusion is
`DEDUPLICATION_BY_PROVENANCE_REQUIRED` when any memory item and its source event
are returned together.

## Expected pressure, not a result

Frozen before the run:

- the events-only control is expected to reach **zero** memory targets, because
  the store is not read at all — a floor set by architecture, not by ranking;
- the two questions that quote the superseded and invalidated records are
  expected to rank those records highly, which is why admissibility is a gate
  and not a scoring term;
- the dense engines are expected to be strong on quality and outside the
  interactive budget, and the first call after a build is expected to carry the
  build cost and to be reported separately.

## What this measurement does not authorize

No engine adoption in code, package export, persisted index, background
indexing, active-memory write path, GUI surface, embedding model as a product
dependency, or network call beyond the declared local embedding endpoint. The
report is `DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`. The corpus is synthetic and
says nothing about real transcripts.
