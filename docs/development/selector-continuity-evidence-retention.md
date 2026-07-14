# Selector continuity evidence retention

Sprint 21 evaluates whether the three experiment-only selector policies from
Sprint 20 retain exact, predeclared continuity evidence. The evaluator is
model-free and development-only. It measures byte availability, not answer
correctness, comprehension, relevance ranking, task completion, or resume
success.

## Frozen consumer and corpus

Six repository-owned synthetic manifests cover diagnostic, regression,
migration, refactor, security, and release continuations. Before projection,
each manifest pins the complete handoff SHA-256 and declares:

- exact answer anchors that occur once in one supporting section and nowhere
  else;
- the canonical source IDs required for every answer;
- one expected first action equal to the complete `nextAction` value;
- project, Work Item, and handoff scope.

Every scenario requires at least one optional section. `selectedMemory`,
`knownFailures`, `testState`, and `relevantFiles` are each required by at least
one scenario and non-required by another. Empty, duplicate, ambiguous,
cross-scoped, stale-digest, malformed, control-text, circular, or oversized
inputs fail through one generic non-echoing error.

The unchanged focused, risk-aware, and floor-only policies produce 18 policy
observations. Each is crossed with constrained (64), standard (4,096), and
generous (100,000) byte budgets for 54 budget observations. Six complete
baselines remain separate.

## Exact evidence results

Counts precede percentages. A policy is corpus-preserving only if required
answers, expected first actions, and required sources all reach 100%, with zero
critical miss and digest mismatch.

| Policy     | Required answers | First actions | Required sources | Critical misses | Corpus-preserving |
| ---------- | ---------------: | ------------: | ---------------: | --------------: | ----------------- |
| floor-only |         0/9 (0%) |    6/6 (100%) |        0/15 (0%) |              24 | no                |
| focused    |     5/9 (55.56%) |    6/6 (100%) |       9/15 (60%) |              10 | no                |
| risk-aware |     7/9 (77.78%) |    6/6 (100%) |   13/15 (86.67%) |               4 | no                |

The safety floor retains every first action and source-reference section, but
that is insufficient: when a supporting optional section is excluded, its
answer and section-linked source navigation are unavailable. Focused preserves
the complete regression and release anchors; risk-aware preserves diagnostic,
refactor, release, and security anchors. Neither covers all task-dependent
requirements.

## Separate v1 and schema-v2 accounting

Historical v1 sums serialize complete embedded section candidates. Schema v2
serializes normalized section content plus the exact marginal union of
canonical source-table entries. These methods remain separate.

| Projection set    | Observations | Historical v1 bytes | Schema-v2 bytes |
| ----------------- | -----------: | ------------------: | --------------: |
| complete baseline |            6 |              60,071 |          58,533 |
| floor-only        |            6 |              36,784 |          37,318 |
| focused           |            6 |              47,864 |          47,362 |
| risk-aware        |            6 |              54,650 |          53,630 |
| all policies      |           18 |             139,298 |         138,310 |

Source sharing makes v2 smaller than v1 for the complete, focused, and
risk-aware sets, but the fixed packet-level table makes floor-only v2 534 bytes
larger than its v1 candidate sum. This is why v1 candidate savings cannot stand
in for production schema-v2 accounting.

Baseline and policy fit are both 18/54 under both methods: only the generous
budget fits. No constrained or standard observation changes boundary. Tests
prove exact agreement with the production schema-v2 builder for every complete
baseline, lossless expansion, source navigation, canonical source IDs and
ordering, exact UTF-8/Unicode bytes, and deterministic results under corpus,
manifest, selector, budget, and source permutations.

## Decision: no change / no change

- Evidence-retention semantics: `no change`. No candidate policy is
  corpus-preserving, so the Sprint 20 vocabulary and policies remain
  experiment-only.
- Schema-v2 fit: `no change`. Exact accounting changes byte totals but creates
  no sampled budget fit.

Production remains unchanged. No ADR is created. A later policy proposal must
use new predeclared task-independent evidence and, before rollout, an ADR for
vocabulary/versioning, compatibility, safety floor, profile migration, and
builder/GUI behavior.

## Reproduction

```bash
AI_WORKSPACE_CONTINUITY_EVIDENCE_REPORT=1 \
  node packages/context-builder/test/continuity-evidence-measurement.test.ts
```

The command uses only in-memory public synthetic fixtures and writes no report,
state, manifest, or handoff file.
