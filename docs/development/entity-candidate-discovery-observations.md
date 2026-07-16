# Reviewed entity candidate discovery observations

**Observed:** 2026-07-16  
**Frozen gates:** [entity-candidate-discovery-corpus.md](entity-candidate-discovery-corpus.md)

All inputs were fictional and synthetic. Reports contained only aggregate
counts, hashes, gates, and decisions; no matched text, alias, item content,
mapping, key, passphrase, recovery material, identity, or local path was
reported.

## Deterministic results

Two complete executions produced identical ground-truth hash, candidate-set
hashes, ordering, counts, per-type metrics, structural gates, and decisions.

| Candidate         | Proposed | Ground truth |  TP |  FP |  FN | Precision | Recall | Decision           |
| ----------------- | -------: | -----------: | --: | --: | --: | --------: | -----: | ------------------ |
| `STANDARD_SYNTAX` |        9 |            8 |   8 |   1 |   0 |    88.89% |   100% | `REFINE`           |
| `EXACT_ALIAS`     |        4 |            4 |   4 |   0 |   0 |      100% |   100% | `ADOPT_FOR_REVIEW` |
| `COMBINED`        |       13 |           12 |  12 |   1 |   0 |    92.31% |   100% | `REFINE`           |

Every structural gate passed: exact UTF-8 boundaries, permutation stability,
count reconciliation, unique candidate identity, five-of-five invalid-matrix
rejection, non-echo behavior, unchanged Restricted-detector regression, and
zero production effects.

## Per-type observation

Email and documentation-range IPv4 syntax each achieved 100% precision and
recall on the frozen corpus. Compact telephone syntax found the one intended
prose occurrence but also proposed the syntactically identical string inside
source-code-like text. Telephone precision was therefore 50%, below the frozen
80% per-type adoption gate. This forces both `STANDARD_SYNTAX` and `COMBINED`
to `REFINE` even though the combined overall precision exceeded 90%.

Exact fictional customer and project aliases produced four exact spans with
100% precision and recall, including the multibyte `Résumé Δ` boundary and the
standalone occurrence beside an identifier-embedded negative. That result
passes the corpus only as `ADOPT_FOR_REVIEW`: it supports a later explicit
review-assistance boundary, not automatic selection or transformation.

## Decision

Recommend a later ADR-gated production increment for exact, explicitly
configured alias candidates only. Suggestions must remain distinct from
`USER_REVIEWED` spans and require explicit user confirmation before the
existing schema-v1 pseudonymization contract can consume them.

Do not roll out standard syntax or the combined candidate. They require a new
corpus and refinement that distinguishes source-code literals and other
context-dependent false positives without claiming semantic or complete PII
detection.

This decision changes no package export, facade, HTTP route, GUI, policy,
Context Pack, mapping, envelope, persistence, model, network, delivery,
permission, routing, response, or execution behavior.

## Reproduction

```bash
npm run measure:entity-candidates
```

The command evaluates the frozen corpus twice in process. The executable
assertions are in
`packages/privacy-gateway/test/entity-candidate-measurement.test.ts`; the
development-only adapters and harness are in
`scripts/entity-candidate-measurement.ts`.
