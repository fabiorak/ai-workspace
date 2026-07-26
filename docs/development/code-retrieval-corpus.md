# Code retrieval corpus and gates

**Frozen before the harness was run:** 2026-07-26  
**Scope:** development-only measurement over the real TypeScript source of this
repository, which is already public  
**Decision it supports:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

## Purpose

Transcripts contain code. A retrieval engine designed for prose folds diacritics,
stems words, drops stopwords, and discards punctuation as noise — and every one
of those rules is wrong for `getUserById`, for `??`, and for a symbol name half
remembered. This corpus answers two questions with evidence instead of opinion:

1. does the tolerant lexical engine designed for prose also work on code;
2. does a **search-mode flag** earn its place in the GUI, or is one tokenization
   enough?

The second question is measured in both directions. Code questions run through
both tokenizations, and the prose questions of the
[document corpus](document-retrieval-corpus.md) run through both as well, so the
cost of leaving the flag in the wrong position is measured rather than assumed.

The measurement is deliberately unkind to the prose engine, and it authorizes no
engine, package, index, GUI surface, or embedding model.

## Frozen corpus

The TypeScript source of this repository, read from disk at run time: `apps/`,
`integrations/`, `packages/`, `services/`, and `scripts/`. Excluded:
`.ai-workspace`, `node_modules`, `.git`, `coverage`, and **`dist`**.

`dist` is excluded on purpose. Its generated `.d.ts` files repeat every exported
name, so indexing them would inflate recall with copies of the source rather than
with source.

As with the document corpus, this one grows with the repository. The report states
its fingerprint — files, symbols, lines, longest file, and distinct terms under
each tokenization — and the owning test asserts predeclared targets rather than
frozen percentages.

Declaration splitting is line-based and must not read a declaration out of a
template literal. It is not a parse, which is a declared limit rather than a
defect to be discovered later.

## Frozen questions

Eighteen predeclared questions across eight families, 20 ground-truth pairs, of
which 12 also name the symbol the answer should land on. They are the questions a
developer actually types:

| Family             | What it probes                                      |
| ------------------ | --------------------------------------------------- |
| `IDENTIFIER_EXACT` | the whole name, typed exactly                       |
| `IDENTIFIER_WORDS` | the words inside a name, spaced and lowercased      |
| `FILE_NAME`        | a file known by its kebab-case name                 |
| `TYPE_NAME`        | a type or interface name                            |
| `STRING_LITERAL`   | a message seen at runtime, including an Italian one |
| `TYPO`             | a name misspelled by one or two characters          |
| `DEFINITION_SITE`  | where a name is defined                             |
| `CALL_SITE`        | who calls a name                                    |

The two graph families are measured **knowing** that BM25 cannot separate a
definition from a use: both records mention the name, and the shorter one wins.
They are here to size the gap, not to be passed.

Three additional probe sets:

- **six punctuation probes** — `??`, `===`, `!==`, `=>`, `?.`, `...` — not scored
  for recall, because the answer is spread across hundreds of files, but scored
  for whether a mode answers **at all**. The prose tokenizer deletes all six, so
  `a ?? b` and `a || b` become the same text;
- **three deliberately confusable identifier pairs**, differing by a prefix or a
  suffix, to measure whether typo tolerance conflates names that both exist;
- the prose questions of the document corpus, reused unchanged.

## Frozen engines

| Engine                            | Mode  | Unit   | Notes                              |
| --------------------------------- | ----- | ------ | ---------------------------------- |
| `PROSE_MODE_SYMBOL`               | prose | symbol | folding, stemming, stopwords, typo |
| `CODE_MODE_SYMBOL`                | code  | symbol | identifier splitting, punctuation  |
| `CODE_MODE_SYMBOL_TYPO_TOLERANT`  | code  | symbol | plus bounded typo tolerance        |
| `CODE_MODE_SYMBOL_EXACT_WEIGHTED` | code  | symbol | whole identifier weighted          |
| `CODE_MODE_SYMBOL_NAME_WEIGHTED`  | code  | symbol | declared name weighted             |
| `CODE_MODE_FILE`                  | code  | file   | whole file as the record           |
| `DENSE_SYMBOL`                    | —     | symbol | locally generated dense vectors    |
| `HYBRID_SYMBOL`                   | —     | symbol | RRF fusion of lexical and dense    |

Two of these exist to separate levers that intuition conflates.
`CODE_MODE_SYMBOL_EXACT_WEIGHTED` weights the **whole identifier** against its own
parts, which is the change intuition suggests: splitting `getUserById` makes five
weak parts compete with one strong exact match. `CODE_MODE_SYMBOL_NAME_WEIGHTED`
instead weights the name a record **declares** above the words it merely contains.
Measuring both separates a real lever from a plausible one.

`CODE_MODE_FILE` is the control for the indexing unit, mirroring the whole
document in the prose corpus.

## Declared bounds

- code mode splits identifiers on case, underscore, digit, and path boundaries,
  indexes significant punctuation as terms, and does not stem;
- the weighted engines repeat the weighted text three times at the head of a
  record;
- at most 10 results per query; BM25 with k1 1.2 and b 0.75; RRF at k = 60;
- interactive budget 150 ms per query;
- dense path: `bge-m3` at a local endpoint, input truncated at 4,000 characters
  with the truncation count reported, and a record ceiling of 6,000 above which
  the build stops being a measurement and starts being a wait.

## Predeclared scoring

- **file recall** over ground truth;
- **symbol localization**: the share of the twelve symbol questions whose top
  result lands on the declared symbol;
- **precision** over as many positions as the question has correct answers;
- per-family recall, empty-result questions, the worst rank of the first correct
  answer, and p95 per query.

Five separate observations, reported as conclusions rather than scores: the mode
flag in both directions, identifier splitting measured alone, exact-name matching
under each weighting, punctuation answerability per mode, and typo tolerance
against the confusable pairs.

## Frozen decision algorithm

The measurement recommends a mode and a unit. The predeclared conclusion shapes:

- `SEARCH_MODE_FLAG_JUSTIFIED` when each tokenization beats the other on its own
  question set;
- `PUNCTUATION_IS_ONLY_SEARCHABLE_IN_CODE_MODE` when the probes are answerable in
  one mode and not the other;
- `DECLARED_NAME_MUST_OUTWEIGH_THE_BODY` when weighting the declared name
  improves exact-name localization that whole-identifier weighting does not;
- `IDENTIFIER_SPLITTING_CHANGES_NOTHING_MEASURED` when splitting alone moves
  neither recall nor localization;
- `TYPO_TOLERANCE_DOES_NOT_CONFLATE_NAMES_THAT_EXIST` when no confusable pair is
  conflated;
- `CALL_GRAPH_NEEDS_A_DIFFERENT_INDEX` for the graph families, which no ranking
  weight is expected to fix.

Whether the **wrong mode is silent** is recorded explicitly, because a query run
in the wrong mode returning plausible lower-quality results is a failure that
hides itself, and it decides whether the GUI owes the reader a visible statement
of the active mode.

## Declared limits

- ground truth is predeclared by reading, not by querying;
- the corpus grows with the repository, so figures are state-dependent;
- only TypeScript is measured, so other languages are unprobed;
- symbol splitting is line-based, not parsed, so nested declarations are not
  separate records;
- call-site ground truth counts textual mentions, not resolved references;
- a shorter record that **calls** a name can outrank the record that declares it,
  because a mention is textually indistinguishable from a declaration;
- punctuation probes measure whether the mode answers, not how well it ranks;
- the corpus contains deliberate typo fixtures, so a misspelling can be a
  legitimate indexed term and silently disable tolerance;
- eighteen questions make p95 a worst case, not a typical one;
- query latency measured immediately after the embedding build reflects the
  build, so the first query is reported separately and excluded;
- dense query latency varies with machine state, so only the verdict against the
  budget is stable.

## Expected pressure, not a result

- the prose mode is expected to fail the punctuation probes completely, and the
  file-name family, because its normalization discards exactly what those
  questions are made of;
- whole-identifier weighting is expected to look right and to be measured, not
  assumed;
- the two call-site questions are expected to stay unlocalized, and the
  measurement is written expecting the confusable pairs to be conflated — an
  expectation frozen here so that the opposite result cannot be presented as the
  intent.

## What this measurement does not authorize

No engine adoption in code, package export, persisted index, GUI surface,
embedding model as a product dependency, call-graph index, or network call beyond
the declared local embedding endpoint. The report is
`DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`, and code mode is intended for the code
that lives **inside transcripts**, not for searching this repository.
