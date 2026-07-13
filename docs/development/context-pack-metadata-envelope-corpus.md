# Synthetic Context Pack metadata-envelope corpus

**Date:** 2026-07-13  
**Sprint item:** S15-02 and S15-03  
**Decision method:** exact UTF-8 Context Pack content bytes

## Method

The experiment reuses the unchanged compact, working, and extended handoffs,
eight-section order, source values, and 64/4,096/100,000-byte continuity
budgets from Sprints 13 and 14. It compares three experiment-only in-memory
representations:

- `EMBEDDED`: the exact eight current `JSON.stringify(section)` Context
  Builder candidates;
- `SOURCE_TABLE`: one packet-level table containing each complete canonical
  source once, while origin, trust, curation, verification, and observation
  remain inline with deterministic source references in every section;
- `METADATA_TABLE`: the same source table plus a table of complete canonical
  metadata identities, with one metadata reference per section.

Only content candidates are counted, consistently with the Context Pack
measurement boundary. The typed measurement/report envelope is excluded.
Table candidates include project, Work Item, and handoff scope. Every exact
total reconciles source-table, metadata-table, and section candidate bytes.

Source and metadata IDs are SHA-256 digests of complete canonical values.
Tables and references are lexicographically ordered by those IDs, independent
of occurrence order. Within one section, a canonical source may occur at most
once: duplicate references are rejected rather than silently changing
multiplicity. Expansion restores the current logical section shape.

The implementation is exported as an explicitly experiment-only measurement
API. It is not connected to the production builder, HTTP facade, GUI,
persistence, delivery, or execution.

## Reproduction

From the repository root:

```bash
AI_WORKSPACE_METADATA_ENVELOPE_REPORT=1 \
  node packages/context-builder/test/metadata-envelope-measurement.test.ts
```

The contract tests also prove current-candidate byte identity, lossless deep
expansion, section-specific trust, complete source navigation, stable bytes
under permuted occurrences, exact reconciliation, and generic failure without
content echo. They reject dangling, duplicate, unreferenced, noncanonical,
malformed, cross-scope, inconsistent, and oversized entries or references.

## Exact result

Every profile contains one unique source and five unique complete metadata
identities across eight sections.

| Profile  | Embedded bytes | Source-table bytes | Change from embedded | Full metadata-table bytes | Change from embedded |
| -------- | -------------: | -----------------: | -------------------: | ------------------------: | -------------------: |
| Compact  |          4,926 |              3,517 |       1,409 / 28.60% |                     4,165 |         761 / 15.45% |
| Working  |          7,560 |              6,151 |       1,409 / 18.64% |                     6,799 |         761 / 10.07% |
| Extended |         33,000 |             31,592 |        1,408 / 4.27% |                    32,241 |          759 / 2.30% |

The one-byte variation comes from the profile-specific handoff ID included in
the table scope. Source-table normalization is 648 bytes smaller than full
metadata-table normalization for compact and working and 649 bytes smaller
for extended.

Exact byte categories are:

| Profile  | Alternative      | Source table | Metadata table | Sections |  Total |
| -------- | ---------------- | -----------: | -------------: | -------: | -----: |
| Compact  | `SOURCE_TABLE`   |          551 |              0 |    2,966 |  3,517 |
| Compact  | `METADATA_TABLE` |          551 |          1,728 |    1,886 |  4,165 |
| Working  | `SOURCE_TABLE`   |          551 |              0 |    5,600 |  6,151 |
| Working  | `METADATA_TABLE` |          551 |          1,728 |    4,520 |  6,799 |
| Extended | `SOURCE_TABLE`   |          552 |              0 |   31,040 | 31,592 |
| Extended | `METADATA_TABLE` |          552 |          1,729 |   29,960 | 32,241 |

## Budget fit

| Alternative      | Fits out of 9 observations | Compact standard | Working standard | Extended standard |
| ---------------- | -------------------------: | ---------------: | ---------------: | ----------------: |
| `EMBEDDED`       |                          3 |     no, 830 over |   no, 3,464 over |   no, 28,904 over |
| `SOURCE_TABLE`   |                          4 |   yes, 579 spare |   no, 2,055 over |   no, 27,496 over |
| `METADATA_TABLE` |                          3 |      no, 69 over |   no, 2,703 over |   no, 28,145 over |

All alternatives miss every constrained observation and fit every generous
observation. Only the source table changes a sampled boundary: compact now
fits the standard budget.

## Decision

ADR-0016 accepts the source-table representation as the contract direction
for a later rollout sprint. Its 28.60% compact and 18.64% working reductions,
plus one new standard-budget fit, are material on this bounded corpus. It
retains section-local trust and every canonical source field.

The full metadata table is rejected because its extra table and reference
indirection saves less in every profile and changes no sampled fit boundary.
`No change` remains safer than enabling either prototype during this decision
sprint. Production therefore stays embedded until a later sprint implements
versioned reader/writer compatibility and the complete accepted contracts.

## Limitations

- the corpus is synthetic, small, and contains one unique source and five
  metadata identities per profile;
- savings may shrink or grow with source uniqueness, section count, ID length,
  and metadata diversity;
- canonical order treats per-section provenance as a bounded unique set;
- exact bytes do not model provider tokenization, comprehension, latency,
  cache behavior, cost, or task success;
- the new compact fit proves mechanical capacity, not relevance or
  sufficiency;
- no persistence, resolution, retrieval, model, agent, network, telemetry,
  private transcript, or real repository content participates.
