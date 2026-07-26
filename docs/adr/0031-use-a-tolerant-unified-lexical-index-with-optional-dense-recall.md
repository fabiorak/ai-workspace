# ADR-0031: Use a tolerant unified lexical index with optional dense recall

**Status:** accepted  
**Date:** 2026-07-26

## Context

ADR-0008 accepted a bounded literal scan as the first retrieval behavior and
predeclared that an indexed-store ADR becomes necessary once measured latency,
corpus size, or ranking exceeds its bounds. ADR-0018 accepted lexical search
first for the `GENERAL` scope and deferred semantic retrieval until a
predeclared evaluation corpus shows material lexical misses. Both decisions
named the evidence that would reopen them. That evidence now exists.

Four measurements were run, all declared development-only with no production
consumer. Two use synthetic corpora with predeclared ground truth:
`scripts/tolerant-search-measurement.ts` compares retrieval strategies over
canonical session events, and `scripts/unified-retrieval-measurement.ts` compares
candidate engines over canonical session events **and** active memory together,
including SQLite FTS5 and locally generated dense vectors. Two use the real
content of this repository, because the question of whether an engine works on
documents and on code cannot be answered on fixtures:
`scripts/document-retrieval-measurement.ts` over the Markdown documentation and
`scripts/code-retrieval-measurement.ts` over the TypeScript sources.

### What the synthetic corpora established

The shipped literal engine finds 25% of predeclared lexical targets and returns
nothing at all for 9 of 16 questions. Normalizing case and diacritics reaches
52.78%; adding rule-based Italian and English inflection reduction reaches
83.33%; adding bounded typo tolerance and BM25 ranking with a recency tiebreak
reaches 100% lexical recall, with precision at the expected result count falling
to 68.61%. The misses are not exotic: they are ordinary Italian inflection,
one-character typing errors, and word order. At 12,000 events the shipped
adapter does not answer at all — it refuses by its own declared 1,000-document
bound — while the indexed variant answers in about 13 ms and rebuilds in about
110 ms.

Searching canonical events alone reaches **0%** of the memory-resident targets
and 18.18% overall. A user who asks "what did we decide about totals" is asking
for a decision, and decisions live in active memory, which today's search does
not read and which exposes no search operation at all. This is not a ranking
weakness; it is a missing store.

The unified comparison also measured what is arguably the more dangerous
behavior: superseded and invalidated memory items are lexically excellent
matches for exactly the questions their replacements should answer, and a memory
item and the event it was extracted from both surface for the same query, with
BM25 favouring the shorter event.

Measured candidates on the unified corpus, 8 questions, 11 ground-truth pairs,
20 records of which 18 admissible, scaled to 12,000 records:

| engine                 | recall | memory recall | p@R    | worst family | p95 at 12k  |
| ---------------------- | ------ | ------------- | ------ | ------------ | ----------- |
| events-only inverted   | 18.18% | 0%            | 4.17%  | literal 0%   | —           |
| unified inverted index | 100%   | 100%          | 54.17% | none         | 13.1 ms     |
| unified FTS5 unicode61 | 81.82% | 77.78%        | 45.83% | typo 0%      | 4.9 ms      |
| unified FTS5 trigram   | 81.82% | 77.78%        | 58.33% | typo 0%      | 7.3 ms      |
| unified dense (bge-m3) | 100%   | 100%          | 39.58% | none         | 238.2 ms    |
| unified hybrid (RRF)   | 100%   | 100%          | 45.83% | none         | dense-bound |

FTS5 through `node:sqlite` is real and capable: `unicode61 remove_diacritics 2`,
`trigram`, and `porter unicode61` all work, and it is two to three times faster
than the TypeScript index at 12,000 records. It has no Italian stemming and no
typo tolerance, which is where its recall is lost — 0% on typing errors and 50%
on inflection. Its speed advantage is real but is spent on a budget that is not
under pressure: both engines answer well inside an interactive budget.

### What the document corpus established

140 documents, 1,746 sections, 163,829 words, longest document 7,468 words, of
which 3 documents are written in Italian. 18 questions, 30 ground-truth pairs.

| engine                            | recall | section localization | p@R    | p95      |
| --------------------------------- | ------ | -------------------- | ------ | -------- |
| inverted, whole document          | 61.11% | 0%                   | 37.41% | 10.0 ms  |
| inverted, section                 | 66.67% | 50%                  | 45.19% | 4.3 ms   |
| inverted, section, heading weight | 66.67% | 50%                  | 53.70% | 4.2 ms   |
| inverted, section, glossary       | 88.89% | 100%                 | 58.33% | 4.3 ms   |
| FTS5 unicode61, section           | 55.56% | 50%                  | 41.67% | 1.9 ms   |
| dense, section (bge-m3)           | 100%   | 75%                  | 75%    | 233.9 ms |
| hybrid, section (RRF)             | 100%   | 75%                  | 50.93% | 233.9 ms |

Three results decide the design.

**The indexing unit is not the document.** A whole document localizes nothing by
construction — the answer is "this 7,468-word file" — and it dilutes its own
terms: 61.11% against 66.67% for sections. Repeating the heading path at the head
of each section costs no recall and buys 8.5 points of precision. This is the
same lever, measured twice, that the code corpus independently confirms below.

**Lexical retrieval is bound to the language of the document, not weak in
Italian.** Italian questions asked of English documents reach 40% recall, against
100% for English questions. That figure was initially read as an Italian
weakness. It is not. Measured separately on the 12 Italian questions against the
3 Italian documents, the lexical engine reaches **100% recall and 75% precision,
with every question family at 100%**, while dense retrieval reaches 91.67% and
37.5% and loses a synonym question. For a corpus written mostly in Italian —
which is the expected case here — the lexical engine is not the compromise; it is
the better engine.

**A declared bilingual glossary bridges most of the language jump.** 61 declared
term pairs raise cross-language recall from 40% to 80% while precision *rises*
from 26.67% to 35% and Italian-only recall is unchanged. The bridge adds the
translation *in addition* to the term the reader typed, never as a substitute:
a term being present in the index says nothing about it being present in the
right document. Two questions remain unresolved — `it-dashboard` and
`it-memoria-attiva` — where the gap is conceptual rather than lexical.

Dense retrieval on this corpus is genuinely the strongest on quality: 100%
recall, 75% precision, and it answers the two questions the glossary cannot.
It costs 53.16 s to build 1,642 section vectors and 209 ms median per query
against a 150 ms budget, and fusing it with the lexical list *lowers* precision
from 58.33% to 50.93%, because RRF promotes candidates that only one engine
believes in.

### What the code corpus established

206 TypeScript files, 2,354 symbols, 56,748 lines, longest file 1,658 lines.
Generated `dist` output is excluded on purpose: its `.d.ts` files repeat every
exported name and would inflate recall with copies of the source. 18 questions
across 8 families, 20 ground-truth pairs, 12 of which name the symbol the answer
should land on. 8,565 distinct terms in code tokenization against 6,527 in prose
tokenization of the same records.

| engine                          | file recall | symbol localization | p@R    | p95      |
| ------------------------------- | ----------- | ------------------- | ------ | -------- |
| prose mode, symbol              | 83.33%      | 25%                 | 38.89% | 0.9 ms   |
| code mode, symbol               | 88.89%      | 41.67%              | 55.56% | 1.2 ms   |
| code mode, symbol, typo tolerant| 88.89%      | 41.67%              | 55.56% | 1.5 ms   |
| code mode, whole-name weight    | 88.89%      | 41.67%              | 41.67% | 0.9 ms   |
| code mode, declared-name weight | 100%        | 75%                 | 61.11% | 1.7 ms   |
| code mode, whole file           | 100%        | 0%                  | 30.56% | 0.2 ms   |
| dense, symbol (bge-m3)          | 88.89%      | 66.67%              | 63.89% | 882.5 ms |
| hybrid, symbol (RRF)            | 100%        | 66.67%              | 69.44% | 882.5 ms |

**Code needs its own tokenization, and the difference is measurable in both
directions.** Code questions reach 88.89% in code mode against 83.33% in prose
mode; prose questions reach 80% in prose mode against 70% in code mode. Six
punctuation probes — `??`, `===`, `!==`, `=>`, `?.`, `...` — are answerable in
code mode and unanswerable in prose mode, 6 of 6 against 0 of 6, because prose
normalization discards punctuation as noise.

**The wrong mode is not silent.** Measured: a query run in the wrong mode returns
plausible, lower-quality results rather than nothing. This is the failure mode
that hides itself, and it is the reason the active mode has to be visible where
the results are, not only where the query was typed.

**The decisive lever on code is the same as on documents: weight the declared
name.** Repeating the symbol name at the head of its record takes the engine to
100% file recall, 75% symbol localization, 61.11% precision, with every one of
the eight question families at 100%. Weighting the *whole identifier* against its
own parts — the change that intuition suggests, since splitting `getUserById`
makes five weak parts compete with one strong exact match — changes no recall and
costs 14 points of precision. Splitting identifiers, measured alone, changes
nothing at all: 100% against 100% recall and 80% against 80% localization on the
word-form questions. What the code corpus needed was not more splitting but a
distinction between the name a record *declares* and the words it merely
contains.

**Typo tolerance does not conflate similar names.** On three deliberately
confusable pairs — `encodeMemoryLog`/`decodeMemoryLog`,
`validatePseudonymMapping`/`...V2`,
`inspectPseudonymizedOutput`/`...WithPolicy` — zero conflations occurred in either
mode, against the conflation this measurement was written expecting.

**Call-graph questions are out of reach of ranking**, measured, not assumed:
`CALL_GRAPH_NEEDS_A_DIFFERENT_INDEX`. A definition and a use of a name are
textually indistinguishable to BM25, and the shorter record wins. The same cause
produces a residual defect in the recommended engine: searching
`inspectPseudonymizedOutputWithPolicy` ranks first the shorter record that
*calls* it, which is why symbol localization on exact names is 66.67% and not
100%.

On code, unlike on documents, fusing dense with lexical *improves* precision:
69.44% against 61.11% lexical and 63.89% dense. Dense costs 82.32 s to build
2,122 symbol vectors. Its measured query latency varied between roughly 200 ms
and 900 ms across runs of the same script on the same machine, so no single
figure is quotable; every reading is outside the 150 ms interactive budget, which
is the only stable conclusion and the one that matters.

## Decision

Replace the literal scan with one **tolerant lexical retrieval engine, written in
TypeScript, over a rebuildable in-process inverted index**, and make it read
canonical session events and active memory as a single searchable surface.

The engine is normative in the following respects.

- Terms are normalized by Unicode NFD decomposition with combining marks
  removed, lowercased, with rule-based Italian and English suffix reduction.
  Stopwords are removed, except when every term of a query is a stopword, in
  which case the query is used unreduced rather than emptied.
- Typo tolerance is bounded Damerau edit distance against the index term
  dictionary, with a budget of one edit for terms of 4 to 7 characters and two
  for 8 or more. Terms shorter than 4 characters are matched exactly.
- Ranking is BM25 with k1 1.2 and b 0.75, with source timestamp as the
  deterministic tiebreak. Identical input yields identical output.
- Every result states its origin store and a human-readable reason it matched.
  A result whose reason cannot be stated is not returned.

**The indexing unit is a section, never a whole document or a whole file.** A
record is a heading-delimited section for prose and a declaration for code, and
each record carries its own location so that an answer is a place in a document
rather than a document. Markdown splitting is fenced-code aware; declaration
splitting must not read a declaration out of a template literal.

**The name a record declares outweighs the words it contains.** The heading path
of a section, and the declared name of a symbol, are weighted above the body they
head. This is one rule with two applications, measured independently in both
domains, and it is where the largest single quality gain in both measurements
came from. Weighting the whole identifier against its own parts is explicitly
**not** adopted: it was measured and it costs precision without buying recall.

**Search has two modes, and the mode is part of the query.** `PROSE` is the
default and normalizes for natural language. `CODE` splits identifiers on case,
underscore, digit, and path boundaries, indexes significant punctuation as terms,
and does not stem. The GUI exposes this as a flag on the search bar, and **the
active mode is stated alongside the results**, because a query run in the wrong
mode was measured to return plausible results rather than none.

**Cross-language reach is a declared glossary, not an inference.** A bilingual
term glossary adds the declared translation *in addition* to the term the reader
typed, never as a replacement and never only when the term is absent from the
index. Every bridged result states which term was translated.

Search spans both stores. A query answers from canonical session events and from
active memory in one ranked list, and each result declares which store it came
from. Active memory therefore gains a retrieval operation; it currently has none.

**Admissibility precedes ranking.** A memory item whose validity is not `ACTIVE`
is never returned as a current answer. Superseded and invalidated items remain
readable as history through explicit provenance navigation, never through a
question about the present. This is a correctness rule, not a ranking
preference: a superseded decision that outranks its replacement is a wrong
answer, not a lower-quality one.

**Provenance deduplication is part of the contract.** When a memory item and the
event it was extracted from both match, the pair is presented as one answer
carrying both references, with the memory item as the answer and the event as
its source. Returning both as peers duplicates the same fact and lets the raw
event outrank the curated one.

SQLite FTS5 is **not** adopted as the primary engine. It is faster and it is
available in the platform without a new dependency, but it loses recall exactly
where the measured user behavior lives, and buying that speed costs the two
capabilities that were measured to matter — on the real document corpus it
reaches 55.56% against 88.89%. Its measured throughput is recorded so that the
decision can be revisited on latency grounds: if corpus growth pushes the
TypeScript index out of budget, FTS5 becomes the candidate substrate underneath
the same normalization and tolerance rules rather than a replacement for them.

Dense retrieval is admitted as a **secondary, optional recall path that degrades
to lexical**. It is never on the critical path. The lexical engine must answer
completely and correctly with no model, no service, and no network. When a local
embedding service answers, dense candidates are fused with lexical ones by
Reciprocal Rank Fusion with k = 60, chosen because it needs no score-scale
calibration across engines and preserves per-result explanation. When the service
is absent, slow, or failing, the result set is the lexical one and the absence is
stated rather than silently changing quality. Embeddings and the index are
derived data, rebuildable from canonical events and memory, which remain the
source of truth.

Fusion is admitted **per domain, on evidence, not by default**: it was measured
to raise precision on code and to lower it on documents, so a domain where fusion
has not been measured does not get it.

**Questions about the call graph are out of scope for this ADR.** Where a symbol
is defined and who calls it were measured to be unreachable by ranking, and the
answer is a different index, not a better weight. Nothing here should be read as
promising them.

The interactive budget is 150 ms per query at the declared corpus bound,
measured, with the index rebuild off the query path.

This ADR amends ADR-0008 and ADR-0018 rather than superseding them. ADR-0008's
literal-substring matching and 1,000-document scan bound are replaced by the
engine above; its ports, determinism, bounded snippets, trust reporting,
fail-closed corruption handling, and content-addressed artifact verification are
unchanged. ADR-0018's "no semantic model" position is amended to "no semantic
model on the critical path", which satisfies the hybrid, explainable, and
rebuildable conditions ADR-0018 itself required of any semantic work.

This ADR does not authorize a specific embedding model as a product dependency,
an always-on indexing service, background reindexing, active-memory promotion,
cross-scope mutation, or any model delivery. The dense path is admitted as an
architecture position; the model, its packaging, its privacy classification, and
its lifecycle are a separate decision.

## Consequences

- ordinary Italian questions with inflection, accents, and typing errors become
  answerable, measured from 25% to 100% lexical recall on the predeclared
  synthetic corpus, and 100% recall with 75% precision on real Italian documents;
- questions about decisions and constraints become answerable at all, measured
  from 0% to 100% memory-target recall;
- an answer becomes a place rather than a file, which is what section-level
  indexing buys and what whole-document indexing cannot express at all;
- precision falls as tolerance rises — precision at the expected result count is
  54.17% on the unified corpus — so result presentation must make the match
  reason visible enough that a wrong-but-plausible hit is recognizable as one;
- the search bar gains a mode, and the GUI now owes the user a visible statement
  of which mode produced the results, because the wrong mode was measured to fail
  plausibly rather than emptily;
- two tokenizers must be maintained, and any normalization change has to be
  measured in both, since the same change was measured to help one and hurt the
  other;
- the glossary is a maintained artifact with a declared vocabulary: it was
  written after seeing which questions went unresolved, it does not generalize to
  vocabulary nobody declared, and its coverage has to be reviewed as the corpus
  grows;
- cross-language recall stays a declared limit rather than a solved problem: 80%
  with the glossary, and the residue is conceptual rather than lexical;
- a name mentioned in a short record can outrank the record that declares it,
  because a mention and a declaration are textually identical to BM25; closing
  that gap means scoring a declared-name field rather than repeating the name in
  the body, and it is not closed by this ADR;
- active memory needs a search operation, and its store gains a read path it does
  not have today;
- the admissibility rule must be enforced in retrieval, not in the caller, and
  needs a test that no non-`ACTIVE` item is ever returned for any query;
- provenance deduplication must be enforced in retrieval for the same reason;
- an index must be built and kept consistent with canonical storage, and a
  stale-index failure mode now exists that a scan did not have;
- retrieval latency becomes dependent on query term count as well as corpus
  size, because typo tolerance walks the term dictionary per term;
- FTS5 remains the predeclared escalation for latency, not for quality;
- the dense path adds a runtime that may be absent, so every dense feature must
  be written to be missing, and any claim of semantic recall must state whether
  the service answered;
- dense build cost is real and user-visible — 53 s for 1,642 document sections
  and 82 s for 2,122 symbols — so it belongs to an explicit, interruptible,
  resumable operation and never to a keystroke;
- dense query latency was measured to vary by a factor of four on the same
  machine, so any dense budget must be enforced by timeout at the call site
  rather than trusted from a benchmark.
