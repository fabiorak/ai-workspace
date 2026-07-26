# Real event retrieval observations

**Observed:** 2026-07-26, one developer machine, one private local home  
**Frozen gates:** [real event retrieval](real-event-retrieval-corpus.md)  
**Related observations:** [tolerant retrieval](tolerant-retrieval-observations.md)  
**Decision it informs:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

The four measurements behind ADR-0031 ran on synthetic fixtures and on this
repository's own public content. This one runs on real canonical events in a
local workspace home. It is recorded separately from the other four because its
reproducibility differs in kind, not in degree: the other corpora can be rebuilt
by anyone who clones this repository, and this one cannot be rebuilt by anyone
but the person whose home it is. Keeping the two apart stops the caveats of a
private corpus from being read as caveats of the reproducible ones.

The report is declared `DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`. No product code
imports the harness, nothing was written to the store it read, and no content,
path, identifier, or probe text left the process. What follows is aggregate
figures and what they support.

## What is deterministic here and what is not

**Deterministic for a given home**, asserted by the owning test: the corpus
fingerprint, precision at one, recall at ten, unreachable probes, per-family
reachability, bytes to read, and the three verdicts. The same home measured twice
yields the same report once latency is removed.

**Not deterministic**, reported as read on one machine and used as no gate: every
latency. Index build ranged from 7 ms to 47 ms across the 24 cells and 95th
percentile query time from 0.02 ms to 5.2 ms, all far inside the 150 ms
interactive budget. On a corpus this size that says the budget is not the binding
constraint; it says nothing about a corpus a hundred times larger.

**Not reproducible by anyone else, by construction.** A different home yields
different figures and an empty home yields none. Every figure below is therefore
offered as evidence about a shape — which record an index should hold, which
token set makes a term reachable — and never as a percentage to be cited.

**Indicative only.** The corpus holds 53 events, below the 300 the frozen gates
require before a verdict may be called settled. All three verdicts carry
`indicativeOnly: true`, and none of them should be quoted as decided.

## The corpus that was read

Fingerprint `a40d92c6`. One project, one session document, 53 canonical events —
23 tool calls, 21 tool results, 7 agent messages, 2 user messages — every one
carrying a timestamp. Two payloads were resolved from the artifact store and
neither hit the 64 KB read bound. Content classification: 37 events carry both
prose and code, 14 prose only, 2 code only.

989 probes were generated: 400 unique prose terms (the declared per-family bound),
331 transposed terms, 144 inflected prose terms, 71 unique identifiers, 29
two-term conjunctions, 13 prose-and-code conjunctions, and **1** unique
punctuation sequence. That last count matters and is picked up below.

## 1. A canonical payload is not text, and it has to be reduced before indexing

Verdict `TEXT_EXTRACTION_REQUIRED_BEFORE_INDEXING`.

Every one of the 53 payloads parsed as the serialized JSON object the adapter
writes, and all eight declared provenance keys were present across them. Indexing
that object as stored costs three things:

| Reading                         | `RAW_PAYLOAD` | `EXTRACTED_TEXT` |
| ------------------------------- | ------------: | ---------------: |
| events with more than one block |             0 |               29 |
| blocks in the corpus            |            53 |               87 |
| bytes in the corpus             |        53,317 |           40,932 |
| median event bytes              |           462 |              239 |
| distinct prose terms            |         1,857 |            1,388 |
| distinct code terms             |           172 |               91 |

The raw shape adds 37% vocabulary and 30% bytes over its own content, and it has
**no** paragraph structure at all: a newline survives serialization only as an
escape, so blank-line splitting finds nothing in any of the 53 payloads. The
vocabulary is spent on field names and on a per-record identifier that no
question will ever contain.

Precision at one, by contrast, barely moved: extraction gained 1.01 percentage
points at the event unit under mode-per-query. That was the expectation frozen
before this run and it held — provenance fields are identical across records, so
BM25 discounts them almost to nothing. The shape has to be decided on structure
and vocabulary, and on those it is not close.

The practical consequence for anything built next: the reader that feeds the
index must know the payload's field names. Under the raw shape the record-unit
axis collapses entirely — all three units produced exactly 53 records, because
there is nothing to split — so the unit question cannot even be asked without
extraction first.

## 2. The block unit did not earn its keep, and the measurement did not test it

Verdict `EVENT_UNIT_SUFFICIENT`, and it should not be read as evidence.

Over the extracted shape, blocks cost 0.6 points of precision at one, gained 0.2
points of recall at ten, and cut median bytes to read by 0.67% — against a
declared 30% threshold. The threshold unit fared no better.

The reason is not that events are the right unit. It is that there was almost
nothing to split. Extraction recovered blocks in 29 of 53 events, but the
`EVENT_ABOVE_THRESHOLD` unit produced **54** records from 53 events: of the five
events above 2,048 bytes, four split into one block and one into two. The long
events are tool results whose content field is itself serialized JSON — a single
line. Blank-line splitting is exactly the wrong splitter for them.

So the honest reading is the declared limit rather than the verdict: this run
measured a splitter, not a unit, and it measured it on the content where it has
least to work with. A unit decision needs a splitter that understands line
structure and serialized output, and that is not what was measured here.

A second bias is worth naming. Bytes to read is recorded over probes whose top
result was correct, and a probe is a term unique in the corpus — large records
own disproportionately many unique terms. The median returned record was around
2,500 bytes against a corpus median event of 239, so the probe set is skewed
toward long records. That skew makes the block unit look _better_ than a real
question would, and it still showed no gain.

## 3. One index per record beats two indexes and a mode switch — for a reason nobody predicted

Verdict `MODE_SELECTION_SUFFICIENT` by the frozen algorithm. The data say the
frozen algorithm asked the wrong question.

Per-family reachability, which is what the algorithm scores, cannot separate the
candidates: prose-only reaches 6 families of 7, and code-only, mode-per-query and
both-sets-merged all reach 7. The one family prose-only misses is the punctuation
family, and that family has **one probe** — so the only separation the frozen
criterion found in this corpus rests on a single question, which is not a
separation at all. Precision separates them clearly:

| Tokenization       |   p@1 |  r@10 | unreachable of 989 |
| ------------------ | ----: | ----: | -----------------: |
| `PROSE_ONLY`       | 70.58 | 81.50 |                164 |
| `CODE_ONLY`        | 51.97 | 53.59 |                456 |
| `MODE_PER_QUERY`   | 71.18 | 81.60 |                163 |
| `BOTH_SETS_MERGED` | 79.58 | 88.78 |                100 |

The merged index wins by 8.4 points of precision and 7.2 of recall over the mode
switch ADR-0031 accepted, and leaves 63 fewer questions unanswered. The frozen
criterion could not see that, and the verdict label stands as declared rather
than being rewritten to match. **`MODE_SELECTION_SUFFICIENT` should not be cited
as evidence that a per-query mode switch is enough**; on this corpus it is the
weaker of the two shapes by every quality figure the run recorded.

### The expectation that was refuted

The mixed prose-and-code family was written expecting it to be the family that
separates one index from two. It separates nothing: all 13 of its probes are
answered at 100% precision by every tokenization, prose-only and code-only
included. A conjunction of two terms each unique in the corpus is trivially easy
whichever token set is used, so the family as designed cannot discriminate. That
is a defect of the probe rule, not a result about mixed content, and the mixed-
content question posed in the frozen gates is therefore **unanswered** by this
run.

### What actually separates them

The gain is concentrated in the two families about imperfect input:

| Family                 | probes | `MODE_PER_QUERY` p@1 | `BOTH_SETS_MERGED` p@1 |
| ---------------------- | -----: | -------------------: | ---------------------: |
| `TRANSPOSED_TERM`      |    331 |                41.99 |                  59.82 |
| `INFLECTED_PROSE_TERM` |    144 |                83.33 |                  86.81 |

Transposition recall rose from 47.73% to 67.98% and its unreachable probes fell
from 158 to 98. The cause is a difference between the two existing harnesses that
ADR-0031 never resolved, because it never had to be stated: **which side of
stemming typo tolerance sits on.**

- `scripts/tolerant-search-measurement.ts` compares the query term to the
  record's unstemmed token, and separately matches stem against stem;
- `scripts/code-retrieval-measurement.ts` keys its postings by stem, so its
  tolerance compares a stemmed query term to stemmed index terms.

Stemming a misspelled word is not the same as misspelling a stem. A rule-based
stemmer looks at the ending, so a transposition it does not recognize survives
while the correct term's ending is stripped — two edits apart, above the budget of
one that terms of four to seven characters get. The term is then not merely
mis-ranked, it is unreachable. The merged index recovers those probes because it
holds both the surface form and the stem as terms, so tolerance has an unstemmed
target to hit.

ADR-0031 records "bounded Damerau tolerance" without saying where in the pipeline
it applies. That underspecification is the finding: it is worth 18 points of
precision on misspelled input, and any engine built from the record will pick one
of the two answers by accident.

### A second tension, smaller but real

On the 400 unique-prose-term probes, precision at one is **higher** without
stemming: 99.25 under code-only against 85.25 under prose-only. Stemming
conflates a term that was unique in its surface form, so the top hit becomes a
neighbour. The merged index lands at 90.00, between the two. Stemming buys
inflection recall — code-only collapses to 2.08 on the inflected family — and it
is paid for in known-item precision. That trade was not measured before this run.

## What this run does not support

- no verdict is settled: 53 events is below the declared 300;
- the record-unit question is open, and needs a splitter that reads line
  structure rather than blank lines;
- the mixed-content question is open, and needs probes that a single token set
  cannot answer;
- nothing here is evidence about answer quality. It measures whether the right
  record is reachable and how much a person has to read, and not whether they
  would call the result a good answer;
- one home is one person's habits, one agent, one language mix, and 53 events of
  a single session.

## Reproduction

```bash
npm run measure:real-event-retrieval          # reads AI_WORKSPACE_HOME, else ~/.ai-workspace
npm run measure:real-event-retrieval -- /path/to/a/home
```

The command prints one JSON report of aggregate figures. Against an absent or
empty home it reports `homeReadable: false` and three `UNDECIDED_CORPUS_TOO_SMALL`
verdicts rather than failing, so it is safe to run anywhere.

The executable assertions build a synthetic home in a temporary directory and
never read a real one, so they pass on a machine that has never run this product:

```bash
node --test packages/historical-search/test/real-event-retrieval-measurement.test.ts
```

The development-only harness is `scripts/real-event-retrieval-measurement.ts`. It
imports its prose rules from `scripts/tolerant-search-measurement.ts` and its
code tokenization and BM25 from `scripts/code-retrieval-measurement.ts`, so it
measures the engine ADR-0031 describes rather than a variant of it — which is
also how the difference in §3 came to be visible.
