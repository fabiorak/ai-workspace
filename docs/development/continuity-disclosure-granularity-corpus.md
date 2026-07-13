# Synthetic continuity disclosure granularity corpus

**Date:** 2026-07-13  
**Sprint item:** S14-03 and S14-04  
**Decision method:** exact UTF-8 representation bytes

## Method

The experiment reuses the unchanged compact, working, and extended handoff
profiles from Sprint 13. Each profile contains the same eight logical handoff
sections and is evaluated under the unchanged continuity budgets:

| Budget      | Exact bytes |
| ----------- | ----------: |
| Constrained |          64 |
| Standard    |       4,096 |
| Generous    |     100,000 |

Three experiment-only representations are measured for every section:

- `FULL`: the exact current `JSON.stringify(section)` content used by the
  Context Builder;
- `REFERENCE`: complete section metadata plus immutable handoff ID, section
  name, serialized full-value byte length, and SHA-256 digest;
- `OUTLINE`: the same metadata and resolver plus the object/array shape,
  non-string primitives, and byte length/SHA-256 reference for every string
  leaf.

All levels repeat the complete current metadata, including trust, curation,
verification, observation, and canonical sources. Lower levels are
lossless-resolvable only while the named immutable handoff remains available;
they are not self-contained replacements for the full value.

No level is selected by the production builder. The measurement compares all
eight sections at one uniform level and declares a fit only when their combined
representation fits the named budget.

## Reproduction

From a built workspace:

```bash
AI_WORKSPACE_DISCLOSURE_REPORT=1 \
  node packages/context-builder/test/continuity-disclosure-measurement.test.ts
```

The tests prove byte identity between `FULL` and current builder candidates,
metadata equality at every level, resolver digest verification, exact total
reconciliation, stable profile/budget ordering, deep output immutability,
bounded structures, and failure without content echo.

## Exact result

The metadata-only encoding is 3,816 bytes for all profiles before adding a
resolver or any value detail.

| Profile  | `REFERENCE` bytes |       Change from full | `OUTLINE` bytes | Change from full | `FULL` bytes |
| -------- | ----------------: | ---------------------: | --------------: | ---------------: | -----------: |
| Compact  |             5,386 |    +460 bytes / -9.34% |           9,167 | +4,241 / -86.09% |        4,926 |
| Working  |             5,390 |  -2,170 bytes / 28.70% |          13,027 | +5,467 / -72.31% |        7,560 |
| Extended |             5,402 | -27,598 bytes / 83.63% |          28,471 |  -4,529 / 13.72% |       33,000 |

Positive percentages are reductions from `FULL`; negative percentages are
explicit regressions. Reference size is nearly constant because metadata and
resolver identity dominate after the value is removed.

Every representation fits only the three generous-budget observations:

| Level       | Fits out of 9 observations | Fits standard budget |
| ----------- | -------------------------: | -------------------: |
| `REFERENCE` |                          3 |                    0 |
| `OUTLINE`   |                          3 |                    0 |
| `FULL`      |                          3 |                    0 |

At 4,096 bytes, `REFERENCE` still exceeds the budget by 1,290 bytes for compact,
1,294 for working, and 1,306 for extended. `OUTLINE` exceeds it by 5,071,
8,931, and 24,375 bytes. `FULL` exceeds it by 830, 3,464, and 28,904 bytes.

## Section observations

The reference representation becomes material only when section values are
large. In the extended profile it removes 18,342 bytes from `selectedMemory`
and 6,760 from `knownFailures`. For compact values, reference identity costs
more than the removed value in seven of eight sections.

The generic string-leaf outline has high structural and digest overhead. It is
larger than full for every compact section, increases working total by 72.31%,
and reduces extended total by only 13.72% despite its much larger values. This
is a measured negative result, not a candidate for enablement.

## Decision and recommendation

Sprint 14 accepts `no change` for the production Context Builder:

- do not enable `REFERENCE` because it regresses compact content and does not
  improve any sampled budget-fit boundary;
- do not enable the generic `OUTLINE` because it is larger for compact and
  working profiles and still misses the standard boundary for extended;
- do not add automatic level selection, resolution, persistence, or GUI
  controls.

The 3,816-byte repeated metadata floor explains why value-only disclosure
cannot fit all eight sections into 4,096 bytes. The evidence is sufficient to
plan a later ADR comparing the current repeated metadata with a packet-level,
lossless shared metadata/provenance table and explicit section references. That
ADR must include `no change`, retain section trust and source navigation, and
cannot assume that the schema-v2 handoff decision automatically applies to a
temporary Context Pack.

## Limitations

- the corpus is synthetic and contains one canonical source per section;
- uniform levels do not measure mixed-level selection quality;
- a digest proves identity, not relevance, sufficiency, or availability;
- exact bytes do not model provider tokenization, task success, latency, cost,
  cache behavior, or model comprehension;
- no source resolution, storage read, retrieval, model, agent, network,
  telemetry, private transcript, or real repository content participates.
