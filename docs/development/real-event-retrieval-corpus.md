# Real event retrieval corpus and gates

**Frozen before the harness was run:** 2026-07-26  
**Third axis added after the first run:** 2026-07-26, disclosed in
[Methodological limits](#methodological-limits-declared)  
**Scope:** development-only measurement over real canonical events held in a
local workspace home, reported as aggregate figures only  
**Decision it supports:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

## Purpose

Four measurements support ADR-0031. Two run on synthetic conversation-shaped
fixtures, and two run on this repository's own public documentation and
TypeScript. None of them touches a real transcript, and none of them can: a real
transcript cannot be committed. That leaves a gap at exactly the place the
product lives, and three questions inside it that the accepted record left open.

**What an event's record actually is.** A canonical payload is not text. Every
payload this store holds is a serialized JSON object: provenance fields, a
per-record identifier among them, and what a person wrote inside one field. An
index built on the payload as stored would spend its vocabulary on field names
and identifiers, and would see no paragraph structure at all, because a newline
survives serialization only as an escape. Whether the payload must be reduced to
its content before it is indexed comes before the other two questions, and it is
measurable rather than obvious.

**What the record unit for an event must be.** ADR-0031 refuses the whole
document as a record and adopts the heading-delimited section, because a section
carries its own location and an answer should name a place rather than a file. An
event has no headings. A long assistant message is a document without a table of
contents, so the unit is either the event or a block inside it, and which one is
a measurement rather than a preference.

**Whether one record needs both token sets.** The document and code measurements
each built one index per tokenization and let the query choose between them. That
works when a record is either prose or code. A transcript event is routinely
both: a sentence of explanation, a block of code, and a sentence about what the
code did, inside one record that a person will find by asking about either half.
Whether such a record needs both token sets, or whether choosing a mode per query
is enough, decides an index shape before it is designed in.

It authorizes no engine, package, index, GUI surface, embedding model, or write
of any kind to the store it reads.

## Frozen corpus

Canonical session events read at run time from a local workspace home:
`AI_WORKSPACE_HOME` when set, otherwise `~/.ai-workspace`. Every project in the
home's registry is read. `INLINE_TEXT` payloads are read from the session
document; `ARTIFACT` payloads are resolved from the artifact store, because the
long events are precisely the ones that decide the record unit and excluding them
would answer the question by omission.

This corpus is **private and cannot be frozen by value**. It is not committed, it
is not copied, and no record, path, identifier, or fragment of it appears in this
document, in the report, or in any output. What is frozen instead is its
**fingerprint** — counts, type distribution, byte quantiles, and how many events
carry prose, code, or both — so that a later reader can tell whether a figure was
observed over a comparable corpus or over a different one.

The consequence is stated rather than worked around: **this measurement is not
reproducible by anyone else.** A different home yields different figures, and an
empty home yields none. The verdicts below are therefore about a shape that
persists across corpora — which unit dilutes an answer, which token set makes a
term reachable — and never about a percentage.

## Frozen probes

Ground truth for the other four corpora was declared by reading them. Here that
is impossible twice over: the content is private, and predeclaring a question
would mean quoting the answer. Probes are therefore **generated from the corpus
by rule**, and every probe is a known-item question whose single correct answer
is fixed by construction rather than by judgment.

| Probe family                 | Rule                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `UNIQUE_PROSE_TERM`          | a prose term occurring in exactly one record                  |
| `UNIQUE_IDENTIFIER`          | a code-shaped identifier occurring in exactly one record      |
| `UNIQUE_PUNCTUATION`         | a significant punctuation sequence present in one record only |
| `INFLECTED_PROSE_TERM`       | a unique prose term with its Italian ending altered by rule   |
| `TRANSPOSED_TERM`            | a unique term with two adjacent characters swapped            |
| `TWO_TERM_CONJUNCTION`       | two unique terms drawn from the same record                   |
| `PROSE_AND_CODE_CONJUNCTION` | one unique prose term and one unique identifier, same record  |

The last family is the one the mixed-content question turns on. A probe exists
only when both halves are present in the same record, so a corpus whose events
never mix the two produces none, and that absence is reported rather than filled.

Probe text is derived from private content and is therefore **never emitted**. It
exists in memory during the run. The report carries counts, rates, and byte
quantiles, and the owning test asserts thresholds rather than values.

## Frozen record shapes

| Shape            | Record                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `RAW_PAYLOAD`    | the canonical payload exactly as stored                            |
| `EXTRACTED_TEXT` | the payload's content fields, in reading order, provenance dropped |

`RAW_PAYLOAD` is what an engine reading the store today would index, and it is
the control. Extraction is by field name: eight declared provenance keys are
dropped, five declared content keys are kept in order, and any key this
measurement does not know is treated as content — dropping it would make a future
adapter's text invisible to retrieval with no signal at all. A payload that is
not the expected object is kept whole and counted, so a store written by a
different adapter degrades to the raw shape instead of being silently emptied.

Every shape is crossed with every unit and every tokenization: 2 × 3 × 4 cells.
The shape axis is not a preprocessing step applied before the other two, because
whether it changes an answer is precisely what is in question.

## Frozen record units

| Unit                    | Record                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `EVENT`                 | one canonical event, whole                                    |
| `BLOCK`                 | each blank-line-delimited block inside an event               |
| `EVENT_ABOVE_THRESHOLD` | the whole event below a declared byte threshold, blocks above |

`EVENT` is what an engine built today would do, and it is the control. The third
unit exists because the interesting outcome is neither extreme: splitting a
two-line tool call into blocks buys nothing and costs an index entry, while
leaving a 40 KB assistant message whole hands the reader a haystack. Measuring
the threshold separately keeps that from being decided by taste.

## Frozen tokenizations

| Tokenization       | Index shape                                           |
| ------------------ | ----------------------------------------------------- |
| `PROSE_ONLY`       | one index, prose rules                                |
| `CODE_ONLY`        | one index, code rules                                 |
| `MODE_PER_QUERY`   | two indexes, the query chooses — ADR-0031 as accepted |
| `BOTH_SETS_MERGED` | one index, both token sets over the same record       |

Retrieval rules are imported from the existing harnesses rather than
reimplemented, so this measures the engine ADR-0031 describes and not a variant
of it: prose normalization and stemming from the tolerant search harness, code
tokenization and BM25 from the code harness.

## Declared bounds

- BM25 with k1 1.2 and b 0.75, deterministic timestamp tiebreak, as everywhere
  else;
- at most 10 results per probe; interactive budget 150 ms per query;
- the byte threshold for `EVENT_ABOVE_THRESHOLD` is declared at 2,048 bytes;
- the vocabulary a raw payload may add over its own content before the shape is
  judged wasteful is declared at 20%;
- at most 400 probes per family, drawn in a deterministic order, so that a large
  home cannot turn the measurement into an unbounded run;
- artifact payloads are read up to 64 KB each and counted as truncated above it;
- no embedding model, no network call, no dense path at all. The question here is
  the unit and the token set, and a model answers neither.

## Predeclared scoring

Per unit and per tokenization:

- **precision at one** over generated probes, which for a known-item question is
  the only honest headline;
- **recall at ten**, and **unreachable probes**, the probes that return nothing;
- **bytes to read**: the median and 95th-percentile size of the returned record,
  which is what the record unit actually changes for a person;
- **per-family reachability**, so that one family cannot be averaged away;
- **index build time and p95 query time**, reported and never used as a gate,
  because they are one machine's readings.

## Frozen decision algorithm

For the record shape, in order:

- `UNDECIDED_CORPUS_TOO_SMALL` under the same size gate as the unit;
- `TEXT_EXTRACTION_REQUIRED_BEFORE_INDEXING` when the raw shape destroys block
  structure the extracted shape has, **or** costs precision at one, **or**
  inflates the vocabulary by at least the declared percentage;
- `RAW_PAYLOAD_INDEXABLE_AS_IS` when it does none of the three.

The size gate counts blocks over the extracted shape. Counting them over the raw
shape would report every home as too small whatever it holds, because serialized
JSON has no blank line by construction — which is the finding, not the gate.

For the record unit, in order:

- `UNDECIDED_CORPUS_TOO_SMALL` below 30 canonical events, or below 10 events that
  contain more than one block. A corpus that small cannot separate a unit from
  noise, and reporting a percentage over it would be false precision;
- `INDICATIVE_ONLY` below 300 events: the run completes and the shape is
  reported, but no verdict may be cited as settled;
- `BLOCK_UNIT_REQUIRED` when blocks improve precision at one, or cut median bytes
  to read by at least 30% without losing recall;
- `EVENT_UNIT_WITH_THRESHOLD` when that gain is confined to events above the
  declared threshold;
- `EVENT_UNIT_SUFFICIENT` when blocks improve neither.

Both the unit and the tokenization verdict are read off the extracted shape.
Comparing units over the raw shape would compare a whole event against itself.

For the tokenization, in order:

- `BOTH_TOKEN_SETS_REQUIRED_PER_RECORD` when each single-mode index leaves a probe
  family unreachable that the other reaches, **and** the mixed family is
  unreachable under mode-per-query;
- `MODE_SELECTION_SUFFICIENT` when two indexes with a per-query mode reach every
  family the merged index reaches;
- `PROSE_ONLY_SUFFICIENT` when the code token set changes no family's
  reachability.

## Methodological limits, declared

- **the record shape axis was added after the first run of the harness, and this
  document was amended rather than written before it.** The first run returned no
  cells and `UNDECIDED_CORPUS_TOO_SMALL` on both questions, because it counted
  zero events with more than one block. That zero was not a small corpus and not
  a defect in the reader: it is what a store of serialized payloads contains. The
  axis exists because the question as first frozen could not be answered over the
  shape the store actually holds — an observed fact about the data, not an
  unwelcome verdict. The distinction matters and cannot be verified by a reader,
  so what is offered instead is the sequence: the first run's outcome, the reason
  traced to the adapter that writes the payload, and the amendment. No threshold
  and no verdict label of the original two questions was changed;
- **the corpus fingerprint was observed before these thresholds were chosen.**
  The home was counted while establishing that it could be read at all, so 30 and
  300 were picked knowing the corpus size. They are not post-hoc in the sense
  that matters — no threshold was moved to change a verdict — but the ordinary
  guarantee that a bound predates its result does not hold here, and pretending
  otherwise would be worth less than saying so;
- probes are generated, so they are the questions a corpus admits, not the
  questions a person asks. A generated known-item probe is easier than a real
  question: it cannot be a paraphrase, and it cannot be about a concept;
- a unique term is unique **in this corpus**. The same probe over a larger home
  would not be a known-item question at all;
- block splitting is blank-line-based. It is not a parse of Markdown, and a fenced
  code block containing blank lines splits. It also finds nothing to split in a
  field whose own content is serialized JSON, which is most long tool output, so a
  verdict that blocks do not help is a verdict about this splitter and not about
  the block unit;
- extraction is by field name against one adapter's payload shape. A store
  written by another adapter would fall back to the raw shape, and the shape
  question would then be answered by omission rather than measured;
- one home means one person's habits, one agent, and one language mix;
- reading an artifact costs a file read per event, so build time here is not
  comparable with the in-memory corpora;
- nothing is measured about whether a person would call the returned record a
  good answer. This measurement decides a unit and a token set, and it is not
  evidence about answer quality.

## Expected pressure, not a result

Frozen before the first run, for the unit and the tokenization:

- the prose token set is expected to fail the punctuation family completely, and
  the code token set to fail inflection and transposition, because each discards
  what the other family is made of;
- the block unit is expected to earn its keep on the long events and to be dead
  weight on the short ones, which is why the threshold unit exists at all;
- **the mixed prose-and-code family is expected to be the family that separates
  one index from two.** That expectation is the reason the family was written, and
  it is recorded here so that a result showing the family separates nothing cannot
  be presented afterwards as what the measurement set out to show.

Written after the first run and before the run that produced the reported
figures, for the shape:

- the raw payload is expected to inflate the vocabulary, because a per-record
  identifier is a term no question will ever contain;
- whether it also costs precision is genuinely open. Provenance fields are
  identical across records, so BM25 should discount them to nearly nothing, and
  the expectation frozen here is that the precision difference will be small and
  that the shape will have to be decided on structure and vocabulary instead.

## What this measurement does not authorize

No engine adoption in code, package export, persisted index, background
indexing, GUI surface, store write, embedding model, or network call. The report
is `DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`. It reads a private store, so it
emits aggregate figures only: no content, no path, no identifier, and no probe
text may leave the process.
