# Synthetic Context Pack budget-pressure corpus

**Date:** 2026-07-13  
**Sprint item:** S13-03 and S13-04  
**Decision method:** exact UTF-8 content bytes

## Method

The deterministic corpus contains 27 samples across three independent axes:

| Dimension    | Profiles                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Continuity   | `compact` (32-byte payload, 1 list item), `working` (256, 4), `extended` (1,024, 16)                       |
| Instructions | `none`, `focused` (4 rules × 64-byte payload), `broad` (16 × 256)                                          |
| Budgets      | `constrained` (64/64), `standard` (4,096/2,048), `generous` (100,000/100,000) continuity/instruction bytes |

Every handoff, source, path, timestamp, instruction, and payload is authored
synthetic data. The same content combination is evaluated under every budget.
Inputs were not adjusted after observing the result.

The primary unit is the exact UTF-8 byte length of candidate item content.
The report distinguishes candidate, included, and omitted content. It does not
count the serialized GUI/report envelope as model context. `ceil(bytes / 4)` is
reported only as a token estimate and does not enforce a budget.

## Reproduction

From a built workspace:

```bash
AI_WORKSPACE_CONTEXT_REPORT=1 \
  node packages/context-builder/test/context-builder-measurement.test.ts
```

The test suite also proves stable ordering under sample and dimension
permutation, exact aggregate reconciliation, category-empty behavior, bounded
input, and fail-closed handling of duplicate or inconsistent measurements.

## Corpus result

The budget axis deliberately preserves all three mechanical outcomes:

| Fit           | Samples |
| ------------- | ------: |
| `FULL_FIT`    |       9 |
| `PARTIAL_FIT` |       9 |
| `NO_FIT`      |       9 |

Candidate size is determined by the two content profiles:

| Profile              | Candidate bytes |
| -------------------- | --------------: |
| Continuity compact   |           4,926 |
| Continuity working   |           7,560 |
| Continuity extended  |          33,000 |
| Instructions none    |               0 |
| Instructions focused |           1,798 |
| Instructions broad   |          10,226 |

Across all 27 samples:

| Category     | Candidate bytes | Included bytes | Omitted bytes | Samples with candidates | Samples with omissions | Retention |
| ------------ | --------------: | -------------: | ------------: | ----------------------: | ---------------------: | --------: |
| Continuity   |         409,374 |        171,435 |       237,939 |                      27 |                     18 |    41.88% |
| Instructions |         108,216 |         47,208 |        61,008 |                      18 |                      9 |    43.62% |

The aggregate values intentionally include the constrained and generous
budget extremes. They demonstrate report accounting, not a production
retention target. Exact included-byte distribution is:

| Statistic        | Exact bytes |
| ---------------- | ----------: |
| Minimum          |           0 |
| p50 nearest rank |       5,358 |
| p90 nearest rank |      33,000 |
| Maximum          |      43,226 |

## Standard-budget pressure

The standard profile isolates the most useful comparison. Continuity results
do not depend on the instruction profile, and instruction results do not
depend on the continuity profile.

| Continuity profile | Included | Omitted | Retention | Budget utilization |
| ------------------ | -------: | ------: | --------: | -----------------: |
| Compact            |    3,560 |   1,366 |    72.27% |             86.91% |
| Working            |    4,095 |   3,465 |    54.17% |             99.98% |
| Extended           |    4,004 |  28,996 |    12.13% |             97.75% |

| Instruction profile | Included | Omitted |      Retention | Budget utilization |
| ------------------- | -------: | ------: | -------------: | -----------------: |
| None                |        0 |       0 | not applicable |                 0% |
| Focused             |    1,798 |       0 |           100% |             87.79% |
| Broad               |    1,914 |   8,312 |         18.72% |             93.46% |

## Interpretation and recommendation

Both categories experience mechanical pressure when their synthetic content
grows. The extended continuity profile has the largest standard-budget
omission in absolute bytes (28,996), while focused instructions fit and broad
instructions do not. A larger numeric budget removes every omission, so this
experiment does not show that content is irrelevant or that it should be
discarded.

The evidence supports a narrow next experiment on continuity granularity and
progressive disclosure: compare the current whole-section atoms with explicit,
lossless lower-detail representations before considering historical retrieval,
ranking, summarization, deduplication, or compression. Such an experiment must
preserve source identity, trust, deterministic ordering, and visible omission
reasons and must not infer task relevance from byte size.

No builder behavior, persistence format, GUI control, selection policy, or
runtime is changed by Sprint 13. A later sprint and ADR are required before any
new representation or selection behavior is accepted.

## Limitations

- the corpus is synthetic and intentionally small;
- axes are coverage profiles, not an observed production distribution;
- exact bytes do not model provider tokenization, cache behavior, or cost;
- omission is not evidence of irrelevance, insufficiency, or task failure;
- no live agent, model grading, latency, precision, recall, or task-success
  measurement participates;
- no private transcript, repository content, credential, user identity,
  telemetry, or network access is used.
