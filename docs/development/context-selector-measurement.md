# Profile context selector measurement

Sprint 20 measures an experiment-only interpretation of profile `include` and
`exclude` declarations over the eight existing handoff continuity sections.
It does not change the profile schema, Context Builder, Context Pack schema,
selection order, persistence, delivery, or execution.

## Experimental contract

| Selector                    | Handoff section    |
| --------------------------- | ------------------ |
| `handoff.objective`         | `objective`        |
| `handoff.repository`        | `repository`       |
| `handoff.selected_memory`   | `selectedMemory`   |
| `handoff.known_failures`    | `knownFailures`    |
| `handoff.test_state`        | `testState`        |
| `handoff.relevant_files`    | `relevantFiles`    |
| `handoff.next_action`       | `nextAction`       |
| `handoff.source_references` | `sourceReferences` |

`objective`, `repository`, `nextAction`, and `sourceReferences` form a
non-excludable experimental safety floor. An empty include list retains every
optional section except explicit excludes. A non-empty include list retains
only named optional sections plus the safety floor. Unknown selectors,
duplicates, include/exclude overlap, and attempts to exclude the floor fail
closed.

Selectors are not paths, globs, retrieval queries, permissions, tool
capabilities, sandbox rules, or availability declarations. Existing arbitrary
strings such as `git_diff` receive no implicit mapping.

## Corpus and method

The unchanged compact, working, and extended synthetic handoffs are crossed
with `focused` (test state and relevant files), `risk-aware` (memory, failures,
and tests), and `floor-only` policies. Every policy also retains the floor.
Each case uses constrained (64), standard (4,096), and generous (100,000)
continuity budgets: 9 cases and 27 observations.

Exact bytes use the historical Context Builder v1 candidate serialization
retained by Sprint 13–15. Every projected candidate is byte- and
SHA-256-identical to that baseline. These are serialized candidate-content
bytes, not provider tokens, Context Pack v2 shared-table accounting, relevance,
completeness, task quality, or production-policy claims.

## Results

| Case                | Baseline bytes | Selected bytes | Reduction | New standard fit |
| ------------------- | -------------: | -------------: | --------: | ---------------- |
| compact floor-only  |          4,926 |          2,536 |    48.52% | yes              |
| compact focused     |          4,926 |          3,618 |    26.55% | yes              |
| compact risk-aware  |          4,926 |          4,409 |    10.50% | no               |
| working floor-only  |          7,560 |          3,074 |    59.34% | yes              |
| working focused     |          7,560 |          4,246 |    43.84% | no               |
| working risk-aware  |          7,560 |          6,953 |     8.03% | no               |
| extended floor-only |         33,000 |          4,987 |    84.89% | no               |
| extended focused    |         33,000 |          6,536 |    80.19% | no               |
| extended risk-aware |         33,000 |         32,017 |     2.98% | no               |

Across all policy/profile cases, the repeated baseline totals 136,458 bytes and
selected candidates total 68,376 bytes: 68,082 bytes excluded, or 49.89%.
Baseline fit count is 9/27 and selector-policy fit count is 12/27. Safety-floor
loss is zero. The aggregate repeats each handoff once per policy and is a
comparison total, not a storage or traffic estimate.

## Decision: adapt

The experiment proves that a narrow vocabulary, deterministic decisions,
non-excludable floor, provenance, and exact-byte accounting are implementable.
It does not justify production rollout:

- only 3 of 18 previously non-fitting observations become fits;
- working focused misses the standard budget by 150 bytes;
- even the extended floor alone is 4,987 bytes and misses standard;
- byte reduction does not prove excluded content irrelevant to a correct resume;
- existing schema-v1 profiles allow arbitrary descriptive selectors;
- the measurement intentionally excludes schema-v2 shared-source accounting.

Production remains `no change`, no ADR is created, and selectors remain
descriptive in normal profile-governed Context Pack preview. A future increment
should first measure continuity/task-quality or answerability, then revisit
vocabulary versioning, compatibility, floor evidence, and v2 accounting.

## Reproduction

```bash
AI_WORKSPACE_SELECTOR_REPORT=1 node packages/context-builder/test/context-selector-measurement.test.ts
```

The command uses only synthetic in-memory fixtures and writes no report file.
