# Tolerant search corpus and gates

**Frozen before the harness was run:** 2026-07-26  
**Scope:** development-only measurement; every record and question is synthetic  
**Decision it supports:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

## Purpose

ADR-0008 accepted a bounded literal scan as the first retrieval behavior and
predeclared that an indexed-store decision becomes necessary once measured
latency, corpus size, or ranking exceeds its bounds. This corpus measures
whether that threshold has been crossed, over canonical session events only.

It measures retrieval quality and latency. It does not authorize an engine, a
package, a persisted index, a GUI surface, an embedding model, or a change to
any shipped API. The strategies below are harness-local; no production code
imports them.

## Frozen corpus

Thirteen canonical session events across three projects and three
conversations, written in Italian because the person asking is Italian:

1. `project-carrello`, five events — a shopping-cart total that does not add up,
   a failing test run, a `TypeError`, the decision that the total is computed on
   the server, and the fix;
2. `project-infra`, four events — a question about session storage, the decision
   to keep sessions in process, the constraint that no external service ships
   without a recorded decision, and the rejected alternative;
3. `project-gare`, four events — a question about late-delivery penalty clauses
   in a tender document, the section that was added, the gap that was found, and
   the decision to report it.

Canonical session events have no `DECISION` or `CONSTRAINT` type: those belong
to active memory, which the shipped search does not read. Decision-shaped
evidence therefore appears here as the conversation turn that recorded it, which
is also the only form the shipped engine could meet. The consequence of that
limit is measured separately in the
[unified retrieval corpus](unified-retrieval-corpus.md).

Every record is fictional. Names of towns, projects, and files are invented.

## Frozen questions

Sixteen predeclared questions, each stating the tolerance it requires and every
record a person asking it would consider a correct answer. Ground truth contains
25 question-to-record pairs, declared by reading the corpus rather than by
running a query.

| Family            | Questions | What it probes                                    |
| ----------------- | --------: | ------------------------------------------------- |
| `LITERAL`         |         2 | the word as written                               |
| `CASE_DIACRITICS` |         2 | uppercase and missing accents                     |
| `INFLECTION`      |         3 | ordinary Italian singular, plural, and verb forms |
| `TYPO`            |         2 | one-character typing errors                       |
| `WORD_ORDER`      |         2 | the right words in the wrong order                |
| `PREFIX`          |         1 | the beginning of a word                           |
| `SYNONYM`         |         2 | a different word for the same thing               |
| `PARAPHRASE`      |         2 | the question restated with none of the same words |

The first six families are declared **lexical**: an index is expected to answer
them. `SYNONYM` and `PARAPHRASE` are declared **beyond lexical** and are scored
separately, so that a lexical shortfall is never hidden behind a semantic one,
and so that failing them does not by itself argue for a model.

## Frozen strategies

Five strategies over the same corpus and the same questions:

1. `LITERAL_BASELINE` — case-insensitive literal substring over canonical
   payload text, ordered by source timestamp, session, and sequence. This is the
   shipped behavior;
2. `NORMALIZED_TOKENS` — NFD decomposition with combining marks removed,
   lowercased, tokenized on non-letter boundaries;
3. `NORMALIZED_STEMMED` — the same, plus rule-based Italian and English suffix
   reduction and stopword removal;
4. `TOLERANT_RANKED` — the same, plus bounded typo tolerance and BM25 ranking
   with a recency tiebreak, over a scan;
5. `TOLERANT_INDEXED` — the same rules over an inverted index built once.

Strategy 5 exists to separate two questions that are easy to confuse: whether
tolerance improves answers, and whether an index is needed to deliver them
inside a budget. Strategies 4 and 5 must return the same results.

## Declared bounds

- at most 20,000 records, 4,096 bytes per record, 256 bytes per query;
- at most 20 results returned, precision scored over the top 5;
- typo tolerance is bounded Damerau edit distance against the index term
  dictionary: one edit for terms of 4 to 7 characters, two for 8 or more, exact
  match below 4;
- BM25 with k1 1.2 and b 0.75, source timestamp as the deterministic tiebreak;
- interactive budget 150 ms per query;
- the shipped adapter's declared bound of 10,000 events is respected rather than
  bypassed: above it the baseline is recorded as
  `REFUSED_BY_DECLARED_BOUND` instead of being measured.

## Predeclared scoring

- **recall** over the declared ground-truth pairs, reported separately for the
  lexical and the beyond-lexical families;
- **precision at five positions**;
- **fully answered questions**, **questions whose first result is relevant**,
  and **questions that return nothing at all**, which is the failure a person
  notices first;
- per-family recall, so that one family cannot be averaged away.

## Frozen decision algorithm

Per strategy:

- `ADOPT_FOR_ENGINE` requires lexical recall of at least 90% **and** a relevant
  first result on at least 80% of questions;
- `REFINE` requires lexical recall of at least 70% without meeting the adoption
  gate;
- `INSUFFICIENT` otherwise.

Over the best strategy, one residual gate:

- `LEXICAL_WORK_FIRST` when any **lexical** family stays below 70%: lexical work
  is unfinished and no semantic evaluation is justified yet;
- `BEYOND_LEXICAL_EVALUATION_JUSTIFIED` when every lexical family clears 70% and
  a beyond-lexical family does not;
- `KEEP_CURRENT_ENGINE` when no family is below target.

## Scale profile

`REFERENCE` measures 1,000, 9,000, and 12,000 records; `SMALL` measures 1,000.
Filler records are generated from a 4,096-term vocabulary. Each step runs two
warm-up passes and three measured passes, and reports p95 per query plus index
build time separately, because a rebuild per query would consume the whole
interactive budget before any query work.

## Expected pressure, not a result

Three expectations are frozen here so they cannot be added after seeing the
report:

- the literal baseline is expected to return nothing for a substantial share of
  the questions, because Italian inflection alone defeats substring matching;
- the beyond-lexical families are expected to stay unanswered by every lexical
  strategy, and that is not an argument for a model until the lexical families
  are complete;
- the tolerant strategies are expected to **lose** precision as they gain
  recall, which is a cost the product must present rather than hide.

## What this measurement does not authorize

No production consumer, package export, GUI surface, persisted index,
background indexing, active-memory access, embedding model, network call, or
change to the shipped search API. The report is declared
`DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`, and the corpus is synthetic: it says
nothing about real transcripts, whose measurement is a separate obligation.
