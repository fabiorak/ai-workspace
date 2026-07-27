# ADR-0032: Index one merged token set over text extracted outside the engine

**Status:** accepted  
**Date:** 2026-07-27

## Context

[ADR-0031](0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)
accepted a tolerant lexical engine on four measurements: two over synthetic
canonical events and active memory, two over real content in this repository,
Markdown documentation and TypeScript sources. It named the gap it could not
close. None of the four measures real transcript events, and none of them can,
because real transcripts are not committable. That gap sits exactly where the
product lives.

A fifth measurement closed it without moving content.
`scripts/real-event-retrieval-measurement.ts` ran over 53 real canonical events
with 989 mechanically generated probes across 24 cells, and no content, path,
identifier, or probe text left the process. Its corpus and its observations are
recorded in
[real-event-retrieval-corpus.md](../development/real-event-retrieval-corpus.md)
and
[real-event-retrieval-observations.md](../development/real-event-retrieval-observations.md).

**The strength of this evidence is declared before its findings.** 53 events is
below the 300 the run itself declared necessary, so every verdict it produced is
marked `indicativeOnly`. This record therefore amends an accepted decision on
indicative evidence, deliberately. What justifies it is the corpus rather than
its size: a transcript event carries prose and code inside one record, while the
document and code corpora that supported ADR-0031 are homogeneous, one file being
all code and one document being all prose. The shapes ADR-0031 measured were
validated where they will not be used.

### A canonical payload is not text

Verdict `TEXT_EXTRACTION_REQUIRED_BEFORE_INDEXING`. A stored payload is
`JSON.stringify({...provenance, blockIndex, blockType, ...value})`: eight
provenance fields around the content, one of them unique per record, and a line
break survives only as the two characters `\n`. Indexing it as stored adds 37% of
vocabulary and 30% of bytes over its own content and destroys paragraph structure
entirely. Precision barely moves, because BM25 discounts fields that are
identical across records, so the shape is decided on structure and vocabulary
rather than on rank.

### One merged token set beats a per-query mode switch

| Tokenization       |   p@1 |  r@10 | unreachable of 989 |
| ------------------ | ----: | ----: | -----------------: |
| `PROSE_ONLY`       | 70.58 | 81.50 |                164 |
| `CODE_ONLY`        | 51.97 | 53.59 |                456 |
| `MODE_PER_QUERY`   | 71.18 | 81.60 |                163 |
| `BOTH_SETS_MERGED` | 79.58 | 88.78 |                100 |

Indexing every record under both token sets at once beats the mode switch by 8.4
points of precision at one and 7.2 of recall at ten, and leaves 63 fewer probes
unreachable.

The frozen scoring criterion could not see this, and the reason is recorded
rather than repaired after the fact. That criterion scores per-family
reachability, and reachability cannot separate the candidates: prose-only reaches
six families of seven while code-only, mode-per-query and both-sets-merged reach
all seven. The single family prose-only misses is the punctuation family, and
that family holds one probe. The run's verdict label `MODE_SELECTION_SUFFICIENT`
therefore stands as declared and **must not be cited as evidence that a per-query
mode switch is enough**; by every quality figure the run recorded, it is the
weaker of the two shapes.

### The gain traces to a point ADR-0031 left unstated

The advantage is concentrated in the two families about imperfect input:

| Family                 | probes | `MODE_PER_QUERY` p@1 | `BOTH_SETS_MERGED` p@1 |
| ---------------------- | -----: | -------------------: | ---------------------: |
| `TRANSPOSED_TERM`      |    331 |                41.99 |                  59.82 |
| `INFLECTED_PROSE_TERM` |    144 |                83.33 |                  86.81 |

Transposition recall rose from 47.73% to 67.98% and its unreachable probes fell
from 158 to 98. The cause is that stemming a misspelled word is not the same as
misspelling a stem. A rule-based stemmer looks at the ending, so a transposition
it does not recognize survives while the correct term's ending is stripped, and
the two end up two edits apart — above the budget of one that terms of four to
seven characters get. The term is then not mis-ranked but unreachable. The merged
index recovers those probes because it holds both the surface form and the stem
as terms, so tolerance has an unstemmed target to hit.

ADR-0031 records "bounded Damerau tolerance" without saying where in the pipeline
it sits, and the two existing harnesses resolve that differently:
`scripts/tolerant-search-measurement.ts` compares the query term to the record's
unstemmed token, while `scripts/code-retrieval-measurement.ts` keys its postings
by stem and so compares stem against stem. The underspecification is worth 18
points of precision on misspelled input, and an engine built from the record
alone picks one of the two answers by accident.

A smaller tension is recorded with it. On the 400 unique-prose-term probes,
precision at one is higher without stemming — 99.25 under code-only against 85.25
under prose-only — because stemming conflates a term that was unique in its
surface form. The merged index lands at 90.00, between the two. Stemming buys
inflection recall, where code-only collapses to 2.08, and it is paid for in
known-item precision.

### What this run leaves open

Two questions posed in the run's own gates are unanswered and are not settled
here. The record unit was not measured: blank-line splitting is the wrong
splitter for serialized tool output, which is JSON on a single line, and of five
events above the byte threshold only one contained a blank line, so
`EVENT_UNIT_SUFFICIENT` is a written statement rather than evidence. Mixed
content was not measured either: all 13 probes of the prose-and-code family are
answered at 100% precision under every tokenization, because a conjunction of two
terms each unique in the corpus is trivially easy whichever token set is used.
That is a defect of the probe rule, not a result about mixed content.

## Decision

Amend the engine contract of ADR-0031 on three points. Everything ADR-0031
declares that is not named here is unchanged and still governs.

**Index one merged token set per record, and withdraw the search mode.** Every
record is indexed under both tokenizations at once, into one index: prose
normalization and code splitting on case, underscore, digit and path boundaries,
with significant punctuation kept as terms. The `PROSE` and `CODE` modes carried
by the query are withdrawn, together with the mode flag on the search bar and the
obligation to state the active mode alongside results. Split identifiers and
punctuation terms remain reachable: what is withdrawn is the choice, not the
capability. This also removes at the root the failure ADR-0031 mitigated with a
GUI affordance, a query run in the wrong mode returning plausible and worse
results rather than none.

**Apply typo tolerance before stemming, against unstemmed surface forms.**
Bounded Damerau distance is computed against the dictionary of surface forms, and
a match then resolves through the same reduction as any other term. The budget is
unchanged: one edit for terms of four to seven characters, two for eight or more,
exact matching below four. The index therefore retains surface forms alongside
stems. This contract is normative rather than incidental, and a test fixes it
with a transposition case that distinguishes the two sides.

**The engine indexes text and never payloads.** Reducing a canonical payload to
text is the work of a reader that sits between the store and the engine. The
engine's input is `{id, text, location, timestamp}` and it knows nothing about
payload field names. The reader owns those names and states its extraction rules
in its own tests, including the case where parsing fails, where the raw payload
is indexed and the record says so rather than being dropped. This keeps the
inward dependency direction of ADR-0003 and keeps the engine reusable over
documents and code, where no payload exists at all.

The record unit and mixed content stay open. An engine may be built on the event
as its record unit only if that choice is declared untested where the unit is
defined.

## Consequences

- the search bar gains no mode, and the GUI owes no statement of which mode
  produced the results; the obligation that every result states why it matched is
  untouched, and with precision measured between 54% and 61% it becomes the only
  defence a reader has against a wrong-but-plausible hit;
- both token sets are still maintained and any normalization change still has to
  be measured in both, because the same change was measured to help one and hurt
  the other; what disappears is the per-query choice between them, not the second
  tokenizer;
- the term dictionary becomes the union of the two token sets and is larger than
  either — the code corpus produced 8,565 distinct terms under code tokenization
  against 6,527 under prose tokenization over the same records — and typo
  tolerance walks that dictionary per term, so the 150 ms interactive budget must
  be re-verified at the declared corpus bound instead of being carried over from
  ADR-0031;
- surface forms are retained alongside stems, so index memory grows for a
  reachability gain rather than a ranking one;
- known-item precision on unique prose terms is a declared trade rather than a
  regression to fix: 90.00 merged against 99.25 with no stemming at all, paid for
  the inflection recall that no-stemming collapses;
- an unparseable payload is a declared behavior and not an exception: it is
  indexed raw and the result says so;
- an accepted decision is amended on evidence declared `indicativeOnly`, and the
  exposure is asymmetric in a way that is worth stating: if a later run at
  declared scale reverses the finding, restoring the mode switch is a change
  inside the engine, because no mode affordance will have been built into the
  GUI, no strings will have been written in two languages, and no consumer will
  have learned to pass a mode;
- the four measurements behind ADR-0031 stay valid where they were run: nothing
  about the document corpus or the code corpus is re-decided here, and neither
  the section as indexing unit nor the weight on the declared name is reopened;
- the record unit remains untested, so a stale assumption can outlive this record
  unless the choice is declared where it is made.
