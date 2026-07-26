# Document retrieval corpus and gates

**Frozen before the harness was run:** 2026-07-26  
**Scope:** development-only measurement over the real documentation of this
repository, which is already public  
**Decision it supports:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

## Purpose

The two synthetic corpora measure conversation-shaped records: one to three
sentences each. Documents are three orders of magnitude longer, they carry
headings, and in this repository they are written mostly in English while the
person asking is Italian. Those three differences are what this corpus isolates,
and they cannot be isolated on fixtures — a fixture long enough to behave like a
document would have to be a document.

It answers three questions with numbers:

1. **what the indexing unit must be** — a whole document, a heading-delimited
   section, or a section whose heading path is weighted;
2. **what the language gap costs**, separating the cost of asking in Italian from
   the cost of tolerance, and measuring whether lexical retrieval is weak in
   Italian or merely bound to the language of the document;
3. **whether a declared bilingual glossary** closes that gap, and at what price
   in precision.

It authorizes no engine, package, index, GUI surface, or embedding model.

## Frozen corpus

The committed documentation of this repository, read from disk at run time rather
than copied into a fixture: `docs/`, plus `README.md`, `ROADMAP.md`,
`AGENTS.md`, `CONTRIBUTING.md`, and `SECURITY.md`. Excluded: `.ai-workspace`,
`node_modules`, and `.git`. The local handoff file is Git-ignored and must never
be read into a measured corpus.

The corpus is real prose that is already public, so measuring it copies nothing
and exposes nothing. It also **grows as the project grows**. The corpus is
therefore not frozen by value: the report states its fingerprint — document
count, section count, word count, longest document, Italian documents, distinct
section terms — and the owning test asserts predeclared targets and thresholds
rather than frozen percentages.

## Frozen questions

Eighteen predeclared questions, 30 ground-truth pairs, declared by reading the
documents rather than by running a query. `expected` lists every document a
person asking that question would want; `expectedHeading` names the section a
section-level answer should land in, for the four localization questions.

- **ten Italian questions against mostly English documents**, which is the
  measured reality of this repository;
- **eight English questions**, kept beside them so that the cost of the language
  gap is separable from the cost of tolerance;
- families `LITERAL`, `INFLECTION`, `TYPO`, `WORD_ORDER`, `SYNONYM`,
  `PARAPHRASE`, and `SECTION_LOCALIZATION`.

A separate set of **twelve Italian questions against the three Italian
documents** measures same-language retrieval directly, so that an Italian
question that fails against an English document is not recorded as an Italian
weakness. Their families deliberately avoid restating a heading, so that no
question can be answered by repeating the title it targets.

## Frozen engines

| Engine                              | Unit           | Notes                                     |
| ----------------------------------- | -------------- | ----------------------------------------- |
| `INVERTED_WHOLE_DOCUMENT`           | whole document | cannot localize a section by construction |
| `INVERTED_SECTION`                  | section        | heading-delimited, fenced-code aware      |
| `INVERTED_SECTION_HEADING_WEIGHTED` | section        | heading path repeated at the head         |
| `INVERTED_SECTION_GLOSSARY`         | section        | heading weight plus declared glossary     |
| `FTS5_SECTION_UNICODE61`            | section        | SQLite FTS5, `unicode61`                  |
| `DENSE_SECTION`                     | section        | locally generated dense vectors           |
| `HYBRID_SECTION`                    | section        | RRF fusion of lexical and dense           |

Retrieval rules are imported from the lexical harness rather than
reimplemented, so this measures that engine and not a variant of it.

## Declared bounds

- heading weight repeats the heading path three times at the head of a section;
- at most 10 results per query; BM25 with k1 1.2 and b 0.75; RRF at k = 60;
- interactive budget 150 ms per query;
- the declared bilingual glossary contains 61 term pairs. It adds the declared
  translation **in addition** to the term the reader typed, never as a
  substitute, and never only when the term is absent from the index: a term being
  present says nothing about it being present in the right document;
- dense path: `bge-m3` at a local endpoint, input truncated at 4,000 characters,
  with the truncation count reported rather than hidden, and a declared `SKIP` /
  `IF_AVAILABLE` / `REQUIRE` mode.

## Predeclared scoring

- **document recall** over ground truth;
- **section localization**: the share of localization questions whose top result
  lands in the expected heading. A whole-document engine scores zero here by
  construction, which is the point of measuring it;
- **precision** over as many positions as the question has correct answers;
- **questions returning nothing**, per-family recall, per-language recall, and
  the worst rank of the first correct answer;
- **p95 per query** over eighteen questions, which is a worst case and not a
  typical one.

## Frozen decision algorithm

The measurement recommends an indexing unit and a primary engine. Three
conclusions are predeclared as the shapes an outcome can take:

- the unit conclusion is `SECTION_LEVEL_INDEXING_REQUIRED` when a section unit
  beats the whole document on recall or localization;
- the language conclusion is `LEXICAL_RETRIEVAL_IS_LANGUAGE_BOUND` when Italian
  questions against English documents lose recall that the same engine keeps on
  same-language questions;
- the glossary conclusion is `GLOSSARY_RAISES_CROSS_LANGUAGE_RECALL` when
  cross-language recall rises while Italian-only recall is unchanged.

A dense engine that answers outside the interactive budget cannot be recommended
for the critical path, whatever its quality.

## Declared limits

Frozen with the corpus, because each one bounds what the numbers may be used to
claim:

- ground truth is predeclared by reading, not by querying;
- the corpus grows with the repository, so every figure is state-dependent. It is
  read from the working tree, which also contains Git-ignored local material;
  ground truth that names such a document is not reproducible on a clean clone;
- dense sections are truncated at the declared character limit;
- a whole-document unit cannot localize a section, by construction;
- p95 over eighteen questions is the worst case, not the typical one;
- **only three corpus documents are Italian**, so same-language Italian retrieval
  is barely probed;
- the glossary was written **after** seeing which questions went unresolved, so
  its cross-language recall is optimistic, it is hand-written, and it does not
  generalize to a vocabulary nobody declared;
- no code records are measured here; that is a separate corpus.

## Expected pressure, not a result

- the whole-document unit is expected to localize nothing and to dilute its own
  terms under BM25 length normalization;
- Italian questions against English documents are expected to lose recall, and
  the same-language set exists so that this cannot be misread as a weakness of
  Italian;
- the glossary is expected to leave a residue that is conceptual rather than
  lexical, and those questions are named in the observations rather than removed.

## What this measurement does not authorize

No engine adoption in code, package export, persisted index, GUI surface,
embedding model as a product dependency, or network call beyond the declared
local embedding endpoint. The report is
`DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`. Measuring this repository's public
documentation says nothing about a user's private documents.
