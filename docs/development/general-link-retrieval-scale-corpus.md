# General Link Retrieval Scale Corpus

**Frozen before measurement implementation:** 2026-07-15  
**Scope:** Sprint 25 development-only evidence  
**Canonical dependencies:** ADR-0018, ADR-0019, ADR-0020

## Purpose

This document predeclares the synthetic corpus, exact queries, deterministic
operation counts, timing observations, and decision gates used to evaluate the
bounded General conversation and General-to-project link scan. It does not
authorize an index, semantic retrieval, a runtime route, or a GUI control.

Elapsed time is a local observation, not a portable benchmark. Exact document,
event, link, byte, validation, reference-check, and match counts are the
machine-independent evidence.

## Frozen corpus

The harness creates all state below in a private temporary workspace through
the production domain services and atomic JSON stores, reads it back through
the production validators, reports only aggregate metadata, and removes the
workspace in `finally`. No generated corpus or report artifact is retained.

| Dimension                        | `SMALL` | `REFERENCE` |
| -------------------------------- | ------: | ----------: |
| General conversations            |       3 |          12 |
| Events per conversation          |       4 |          20 |
| Total General events             |      12 |         240 |
| Registered synthetic project IDs |       3 |           6 |
| Immutable links                  |       6 |         120 |
| Links per linked event           |       2 |           2 |
| Linked events                    |       3 |          60 |
| Cold runs                        |       1 |           1 |
| Warm runs                        |       3 |           5 |

All timestamps are identical to exercise deterministic ID tie-breaks. The
first event in every conversation has the exact same safe synthetic content,
exercising same-text/hash collisions across distinct conversation/event IDs.
Other events contain deterministic unique ordinal text. Every even ordinal
event among the first linked set fans out to two distinct projects. Link tuple
identity remains `(event ID, exact content SHA-256, project ID)`.

## Frozen queries and expected semantics

Each run executes these queries through `HistoricalSearch`:

1. `GENERAL_ONLY`, exact shared phrase, limit 100: matches one event per
   conversation and orders same-timestamp results by stable scope identity.
2. `GENERAL_ONLY`, exact unique reference ordinal, limit 20: matches exactly
   one known item.
3. `ALL_SCOPES`, shared phrase, every registered project explicit, limit 5:
   validates all requested scopes and links before applying the global limit.
4. `GENERAL_ONLY`, shared phrase, explicit associated project: returns only
   General events carrying a validated link to that project and preserves
   `GENERAL` scope plus `LINK_ONLY` metadata.
5. `GENERAL_ONLY`, absent exact phrase: returns zero results after complete
   validation.

The expected literal known-item miss count is zero. This corpus deliberately
contains no paraphrase or vocabulary-mismatch claims, so it cannot trigger or
reject semantic retrieval.

## Deterministic counts

For each corpus, before every query result is used:

- canonical General document validations equal the conversation count;
- canonical General event validations equal the total event count;
- canonical link document validations equal the link count;
- link-to-event hash validations equal the link count;
- registered-target checks equal the link count, plus one for an explicit
  associated-project filter;
- literal candidate scans equal the type- and association-eligible General
  event count reported by each query, after complete canonical validation;
- storage bytes equal the exact UTF-8 bytes of canonical `.json` documents
  only and exclude locks, temporary files, paths, and directory metadata.

The report must keep storage validation/read elapsed time separate from search
elapsed time and must not include IDs, paths, event content, rationales, or
rejected values.

## Invalid-reference matrix

Production tests must continue to fail closed, without partial results or
content echo, for:

- stale General content hash;
- missing or removed target project;
- duplicate link tuple or link identity;
- cross-conversation duplicate event identity;
- noncanonical/corrupt General or link JSON;
- incomplete `.tmp` state and an existing owner-token lock;
- oversized document/count/total-byte bounds.

## Predeclared decision gates

Select `NO_CHANGE` only when all gates hold:

- all exact known-item and association expectations pass with zero misses and
  deterministic ordering/counts on two complete harness executions;
- reference corpus remains below 10% of the 10,000-event, 10,000-link, and
  16-MiB-per-store production bounds;
- no unexpected validation amplification occurs beyond the exact linear counts
  above;
- on the reference host, cold complete read plus five queries is at most
  2,000 ms and warm p95 is at most 500 ms on two consecutive executions;
- every invalid-reference case retains fail-closed/no-partial/no-echo behavior.

Crossing a timing gate once requires reproduction, not an architecture change.
Crossing the same gate on two clean consecutive executions, reaching 80% of a
production count/byte bound in real local use, or observing unexpected
superlinear validation is an FTS5/index investigation trigger and requires a
new ADR before code. Any material exact lexical miss caused by paraphrase or
vocabulary mismatch remains a separate hybrid-semantic evidence trigger under
ADR-0018.

## Observed Sprint 25 result

Two consecutive `REFERENCE` evaluations on the development host produced
identical machine-independent counts:

| Observation                                              |                      Run 1 |                      Run 2 |
| -------------------------------------------------------- | -------------------------: | -------------------------: |
| General documents/events                                 |                   12 / 240 |                   12 / 240 |
| Link documents/linked events                             |                   120 / 60 |                   120 / 60 |
| General/link/total canonical bytes                       | 165,312 / 87,000 / 252,312 | 165,312 / 87,000 / 252,312 |
| Shared / unique / limited all-scope matches              |                 12 / 1 / 5 |                 12 / 1 / 5 |
| Associated-project / absent matches                      |                     20 / 0 |                     20 / 0 |
| Known-item misses / scope violations / effect violations |                  0 / 0 / 0 |                  0 / 0 / 0 |
| Cold storage read                                        |                  13.970 ms |                  13.433 ms |
| Cold five-query search                                   |                  73.935 ms |                  69.371 ms |
| Cold total                                               |                  87.905 ms |                  82.804 ms |
| Warm five-query p95                                      |                  90.075 ms |                  73.986 ms |

Event, link, General-byte, and link-byte pressure were respectively 2.4%,
1.2%, 0.9853%, and 0.5186% of their production bounds. All predeclared gates
passed on both runs. The Sprint 25 decision is `NO_CHANGE`: retain canonical
bounded JSON scans and create no ADR, FTS5 adapter, semantic index, runtime
route, or GUI control. Re-run with:

```bash
npm run measure:general-links
```

Elapsed observations will vary by host; deterministic counts and the decision
algorithm are asserted by automated tests.
