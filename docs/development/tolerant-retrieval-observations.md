# Tolerant retrieval observations

**Observed:** 2026-07-26, one developer machine  
**Frozen gates:** [tolerant search](tolerant-search-corpus.md),
[unified retrieval](unified-retrieval-corpus.md),
[document retrieval](document-retrieval-corpus.md),
[code retrieval](code-retrieval-corpus.md)  
**Decision reached:** [ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)

Four measurements, one line of evidence. Two run on synthetic corpora with
predeclared ground truth; two run on the real, already public content of this
repository, because whether one engine serves prose and code cannot be answered
on fixtures. Every report is declared
`DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER`, and no product code imports any of
them.

## What is deterministic here and what is not

**Deterministic**, and asserted by the owning tests: recall, precision,
localization, per-family and per-store figures, corpus and ground-truth
fingerprints, structural gates, and decisions. Identical input yields identical
output.

**Not deterministic**, reported as observed on one machine and never used as a
gate: every latency. Dense query latency in particular was observed to vary by a
factor of four across runs of the same script on the same machine, so only its
verdict against the 150 ms interactive budget is stable. Latencies below are
readings, not thresholds.

**State-dependent**: the two real corpora grow with the repository, so their
fingerprints and percentages move as the project moves. They are read from the
working tree, which also contains Git-ignored local planning material; a clean
clone therefore measures a smaller document corpus, and the ground truth that
names such a document cannot resolve there. This is a declared limit of the
document measurement, not a property of the engine.

## 1. Tolerant search over canonical events

Corpus `TOLERANT_SEARCH_SYNTHETIC_V1`: 13 records, 3 projects, 3 conversations,
16 questions, 25 ground-truth pairs. Corpus fingerprint `423137c8`, ground truth
`a687abbf`.

| Strategy             | Lexical recall | p@5    | Empty | First result relevant | Beyond-lexical recall | Decision           |
| -------------------- | -------------- | ------ | ----: | --------------------: | --------------------- | ------------------ |
| `LITERAL_BASELINE`   | 25%            | 25%    |     9 |                  3/16 | 0%                    | `INSUFFICIENT`     |
| `NORMALIZED_TOKENS`  | 52.78%         | 58.33% |     5 |                  7/16 | 0%                    | `INSUFFICIENT`     |
| `NORMALIZED_STEMMED` | 83.33%         | 83.33% |     2 |                 10/16 | 0%                    | `REFINE`           |
| `TOLERANT_RANKED`    | 100%           | 68.61% |     0 |                 11/16 | 50%                   | `ADOPT_FOR_ENGINE` |
| `TOLERANT_INDEXED`   | 100%           | 68.61% |     0 |                 11/16 | 50%                   | `ADOPT_FOR_ENGINE` |

The shipped literal engine **returns nothing at all for 9 of 16 questions**, and
its per-family recall is 100% on `LITERAL` and `PREFIX` and **0% on everything
else**: case and diacritics, inflection, typing errors, and word order are each a
complete miss. Normalization repairs case, diacritics, and word order;
rule-based Italian and English suffix reduction repairs inflection; bounded typo
tolerance and BM25 repair the rest. The misses are not exotic — they are ordinary
Italian.

Precision falls as tolerance rises, from 83.33% at the stemmed strategy to 68.61%
at the tolerant one. That is the price of answering at all, and it is why the
product must show why each result matched.

Residual gate: `BEYOND_LEXICAL_EVALUATION_JUSTIFIED`. Every lexical family clears
target; `SYNONYM` and `PARAPHRASE` stay at 50%, and one question
(`paraphrase-bando`) is unanswered by the best strategy. Lexical work is
therefore complete, and semantic evaluation is justified — as an addition, not a
substitute.

Scale, `REFERENCE` profile, one machine:

| Records | Distinct terms | Shipped baseline p95        | Tolerant scan p95 | Indexed build | Indexed p95 |
| ------: | -------------: | --------------------------- | ----------------: | ------------: | ----------: |
|   1,000 |          1,107 | 2.4 ms                      |           66.9 ms |       17.9 ms |      5.3 ms |
|   9,000 |          4,203 | 24.6 ms                     |          615.9 ms |      186.2 ms |     27.2 ms |
|  12,000 |          4,203 | `REFUSED_BY_DECLARED_BOUND` |          826.0 ms |      210.2 ms |     18.9 ms |

Two conclusions, both stable across readings. At 12,000 events the shipped
adapter **does not answer at all**: it refuses by its own declared 10,000-event
bound. And tolerance without an index is worse than the problem — a tolerant scan
leaves the interactive budget between 1,000 and 9,000 records, while the same
rules over an inverted index stay inside it, with the build off the query path.

## 2. Unified retrieval over events and active memory

Corpus `UNIFIED_RETRIEVAL_SYNTHETIC_V1`: 20 records — 13 events and 7 memory
items, 18 admissible, 2 inadmissible — 8 questions, 11 ground-truth pairs, 4
forbidden pairs. Corpus fingerprint `a5d86292`, ground truth `de5fd008`.

| Engine                   | Recall | Memory recall | Event recall | p@R    | Worst first-relevant rank | Empty | Decision             |
| ------------------------ | ------ | ------------- | ------------ | ------ | ------------------------: | ----: | -------------------- |
| `EVENTS_ONLY_INVERTED`   | 18.18% | **0%**        | 100%         | 4.17%  |                         3 |     1 | `REJECT`             |
| `UNIFIED_INVERTED`       | 100%   | 100%          | 100%         | 54.17% |                         5 |     0 | `ADOPT_AS_PRIMARY`   |
| `UNIFIED_FTS5_UNICODE61` | 81.82% | 77.78%        | 100%         | 45.83% |                         6 |     1 | `REFINE`             |
| `UNIFIED_FTS5_TRIGRAM`   | 81.82% | 77.78%        | 100%         | 58.33% |                         4 |     1 | `REFINE`             |
| `UNIFIED_DENSE`          | 100%   | 100%          | 100%         | 39.58% |                         2 |     0 | `ADOPT_AS_SECONDARY` |
| `UNIFIED_HYBRID`         | 100%   | 100%          | 100%         | 45.83% |                         3 |     0 | `ADOPT_AS_SECONDARY` |

**The store gap is the finding, not the ranking.** Searching events alone reaches
100% of event targets and **0% of memory targets**, for an overall 18.18%.
Conclusion `UNIFICATION_REQUIRED_FOR_DECLARED_EXPERIENCE`: a person asking what
was decided is asking for something today's search cannot reach at any quality,
because the store is not read.

**Provenance redundancy is real and systematic.** Across 7 memory-and-source
pairs, 10 pairs were returned together for the same question. Conclusion
`DEDUPLICATION_BY_PROVENANCE_REQUIRED`: the raw event and the curated memory item
compete, and BM25 favours the shorter event.

**FTS5 is capable and loses recall where users live.** Both measured
tokenizers — `unicode61 remove_diacritics 2` and `trigram` — work through
`node:sqlite`, and `unicode61` is two to three times faster than the TypeScript
index at 12,000 records. Both score **0% on typing errors and 50% on
inflection**, which is what costs them the recall. The trigram variant has the
best precision of any lexical engine measured here (58.33%) and still cannot
answer a misspelling.

All engines passed every structural gate: no inadmissible record was returned,
origin and match reason were exposed on every result, and output was
deterministic. Admissibility passing here is not evidence that ranking would keep
it: the superseded and invalidated records were excluded by rule, which is why
ADR-0031 makes admissibility a retrieval-level correctness rule.

Dense path, measured with `IF_AVAILABLE` against a local `bge-m3` endpoint at
1,024 dimensions: quality measured on real records, latency at scale on synthetic
vectors. First call 8.9 s; query embedding p95 537 ms, **outside** the budget;
build throughput 57 records/s.

Scale p95 per query, one machine: at 12,000 records the unified index answers in
21.6 ms with a 261 ms build, FTS5 `unicode61` in 8.7 ms with a 452 ms build,
FTS5 `trigram` in 21.1 ms with a 1.54 s build, and the dense engine in 689 ms.
Every lexical engine is inside budget; the dense one is not, at any size.

## 3. Document retrieval over the real documentation

Corpus `DOCUMENT_RETRIEVAL_REAL_REPOSITORY_V1`, observed fingerprint: 102
documents, 953 sections, 98,289 words, longest document 7,468 words, 3 Italian
documents, 4,703 distinct section terms. 18 questions, 29 ground-truth pairs, 4
localization questions, plus 12 same-language Italian questions.

These figures replace a first run that read Git-ignored planning material and so
measured one machine rather than this repository. The corpus is now asserted
against the Git index, and two questions answerable only from that material were
replaced; the [corpus document](document-retrieval-corpus.md#ground-truth-that-had-to-be-replaced)
records what changed and what did not. Every conclusion below survived the
correction unchanged.

| Engine                              | Recall | Section localization | p@R    | p95      |
| ----------------------------------- | ------ | -------------------- | ------ | -------- |
| `INVERTED_WHOLE_DOCUMENT`           | 61.11% | 0%                   | 47.22% | 9.6 ms   |
| `INVERTED_SECTION`                  | 66.67% | 50%                  | 45.83% | 3.9 ms   |
| `INVERTED_SECTION_HEADING_WEIGHTED` | 66.67% | 50%                  | 55.56% | 4.0 ms   |
| `INVERTED_SECTION_GLOSSARY`         | 83.33% | 100%                 | 61.11% | 3.9 ms   |
| `FTS5_SECTION_UNICODE61`            | 50%    | 50%                  | 44.44% | 1.2 ms   |
| `DENSE_SECTION`                     | 100%   | 75%                  | 80.56% | 279.4 ms |
| `HYBRID_SECTION`                    | 100%   | 75%                  | 54.63% | 279.4 ms |

**The indexing unit is not the document.** Conclusion
`SECTION_LEVEL_INDEXING_REQUIRED`: a whole document localizes nothing by
construction — the answer is "this 7,468-word file" — and it dilutes its own
terms, 61.11% against 66.67%. Repeating the heading path at the head of each
section costs no recall and buys **9.7 points of precision**.

**Lexical retrieval is language-bound, not weak in Italian.** Conclusion
`LEXICAL_RETRIEVAL_IS_LANGUAGE_BOUND`: Italian questions against English
documents reach 40% recall against 100% for English questions. Measured
separately on the 12 Italian questions against the 3 Italian documents, the
lexical engine reaches **100% recall and 75% precision with every family at
100%**, while dense retrieval reaches 91.67% and 37.5% and loses a synonym
question. For a corpus written mostly in Italian — the expected case — the
lexical engine is not the compromise; it is the better engine. Conclusion
`ITALIAN_SAME_LANGUAGE_LEXICAL_SUFFICIENT`.

**The glossary bridges most of the language jump.** 61 declared pairs raise
cross-language recall from 40% to 70% while precision _rises_ from 25% to 35% and
Italian-only recall is unchanged. Conclusion
`GLOSSARY_RAISES_CROSS_LANGUAGE_RECALL`. Three questions remain unresolved —
`it-model-delivery`, `it-dashboard`, and `it-memoria-attiva` — where the gap is
conceptual rather than lexical. The glossary was written after seeing which
questions failed, so its figure is optimistic by construction.

Dense on this corpus is the strongest on quality and unaffordable on the critical
path: 917 sections embedded, 36 skipped as too short, 16 truncated at the
4,000-character limit, **28.4 s to build**, query embedding median 238 ms and p95
279 ms. Fusing it with the lexical list **lowers** precision from 61.11% to
54.63%, because RRF promotes candidates only one engine believes in.

The embedding latency is worth reading as a bound and not as a figure: it fell
from 587 ms to 279 ms only because the corpus shrank by a third when the
untracked material stopped being read. It stays above the 150 ms interactive
budget either way, which is the part that decides where dense retrieval sits.

## 4. Code retrieval over the real TypeScript source

Corpus `CODE_RETRIEVAL_REAL_REPOSITORY_V1`, observed fingerprint: 206 files,
2,354 symbols, 56,748 lines, longest file 1,658 lines, 8,565 distinct code terms
against 6,527 prose terms over the same records. 18 questions, 20 ground-truth
pairs, 12 naming a symbol, 6 punctuation probes, 3 confusable pairs.

| Engine                            | File recall | Symbol localization | p@R    | p95      |
| --------------------------------- | ----------- | ------------------- | ------ | -------- |
| `PROSE_MODE_SYMBOL`               | 83.33%      | 25%                 | 38.89% | 1.5 ms   |
| `CODE_MODE_SYMBOL`                | 88.89%      | 41.67%              | 55.56% | 1.7 ms   |
| `CODE_MODE_SYMBOL_TYPO_TOLERANT`  | 88.89%      | 41.67%              | 55.56% | 1.1 ms   |
| `CODE_MODE_SYMBOL_EXACT_WEIGHTED` | 88.89%      | 41.67%              | 41.67% | 1.3 ms   |
| `CODE_MODE_SYMBOL_NAME_WEIGHTED`  | **100%**    | **75%**             | 61.11% | 1.5 ms   |
| `CODE_MODE_FILE`                  | 100%        | 0%                  | 30.56% | 1.1 ms   |
| `DENSE_SYMBOL`                    | 88.89%      | 66.67%              | 63.89% | 600.7 ms |
| `HYBRID_SYMBOL`                   | 100%        | 66.67%              | 69.44% | 600.7 ms |

**The mode flag earns its place, measured in both directions.** Conclusion
`SEARCH_MODE_FLAG_JUSTIFIED`: code questions reach 88.89% in code mode against
83.33% in prose mode, and prose questions reach 80% in prose mode against 70% in
code mode. The six punctuation probes are answerable in code mode and
unanswerable in prose mode, **6 of 6 against 0 of 6** — conclusion
`PUNCTUATION_IS_ONLY_SEARCHABLE_IN_CODE_MODE` — because prose normalization
discards punctuation as noise. The prose mode also scores 0% on the file-name
family, which code mode answers completely.

**The wrong mode is not silent**, and this is the reason the GUI owes the reader
a visible statement of the active mode: a query run in the wrong mode returns
plausible, lower-quality results rather than nothing.

**The decisive lever is the declared name, and it is the same lever as the
heading path.** Conclusion `DECLARED_NAME_MUST_OUTWEIGH_THE_BODY`: on the three
exact-name questions, weighting the declared name takes recall from 66.67% to
100% and localization from 0% to 66.67%, while weighting the **whole identifier**
moves neither and costs 14 points of overall precision. Identifier splitting
measured alone changes nothing at all — 100% against 100% recall, 80% against 80%
localization — conclusion `IDENTIFIER_SPLITTING_CHANGES_NOTHING_MEASURED`. What
the code corpus needed was not more splitting but a distinction between the name
a record declares and the words it merely contains.

**Typo tolerance does not conflate similar names.** Zero conflations on all three
confusable pairs in either mode, against the conflation this measurement was
written expecting. Conclusion
`TYPO_TOLERANCE_DOES_NOT_CONFLATE_NAMES_THAT_EXIST`. It also buys less than it
appears to: with and without tolerance, the same two typo questions are answered,
and the typo family reaches 100% only under the declared-name weight. Tolerance
is safe here; it is not what fixes misspelled names.

**Call-graph questions stay out of reach of ranking.** Conclusion
`CALL_GRAPH_NEEDS_A_DIFFERENT_INDEX`: a definition and a use of a name are
textually indistinguishable to BM25, and the shorter record wins. The same cause
leaves a residual defect in the recommended engine — an exact name can rank the
record that _calls_ it above the record that declares it, which is why symbol
localization is 75% and not 100%.

On code, unlike on documents, fusion **helps**: 69.44% precision against 61.11%
lexical and 63.89% dense. Dense cost 90.8 s to embed 2,122 symbols, with 82
truncated at the character limit, and its query embedding p95 was 600.7 ms; the
first query after the build is reported separately (529 ms) and excluded, because
it reflects the build rather than interactive use.

## Decision

The evidence above is the `Context` section of
[ADR-0031](../adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md),
which is **accepted** and amends ADR-0008 and ADR-0018. In short: one tolerant
lexical engine over a rebuildable in-process inverted index, section-level
records, the declared name weighted above the body, two search modes with the
active mode visible beside the results, admissibility before ranking, provenance
deduplication, a declared bilingual glossary, and dense retrieval admitted only
as an optional secondary path that degrades to lexical. FTS5 is recorded as the
predeclared escalation for latency, not for quality.

No product code, package, index, GUI surface, model dependency, or shipped API
changed as a result of these measurements. The ordered path from the decision to
a working engine is internal planning material and is deliberately not part of
this repository.

## Reproduction

```bash
npm run measure:tolerant-search
npm run measure:unified-retrieval
npm run measure:document-retrieval
npm run measure:code-retrieval
```

Each command prints one JSON report. The dense sections of the last three require
a local embedding service and are skipped, with the absence stated, when none
answers; the lexical results do not depend on it.

The executable assertions live beside the measured package:

```bash
node --test packages/historical-search/test/tolerant-search-measurement.test.ts
node --test packages/historical-search/test/unified-retrieval-measurement.test.ts
node --test packages/historical-search/test/document-retrieval-measurement.test.ts
node --test packages/historical-search/test/code-retrieval-measurement.test.ts
```

The development-only harnesses are `scripts/tolerant-search-measurement.ts`,
`scripts/unified-retrieval-measurement.ts`,
`scripts/document-retrieval-measurement.ts`, and
`scripts/code-retrieval-measurement.ts`. The two real-corpus harnesses import
their retrieval rules from the first one rather than reimplementing them, so all
four measure the same engine.
