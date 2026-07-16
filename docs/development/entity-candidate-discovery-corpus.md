# Reviewed entity candidate discovery corpus and gates

**Frozen before Sprint 28 harness implementation:** 2026-07-16  
**Scope:** development-only measurement; all values and identities are fictional

## Purpose

This corpus measures whether local deterministic recognizers can propose exact
UTF-8 byte spans worth presenting for explicit human review. It does not
authorize automatic selection, transformation, classification, persistence,
GUI integration, model delivery, or claims of complete PII or secret coverage.

The unchanged Sprint 26 baseline is an exact `USER_REVIEWED` span. A candidate
is only a suggestion and cannot become reviewed truth without a later explicit
user action and a separately accepted production boundary.

## Frozen candidates

1. `STANDARD_SYNTAX`: dependency-free bounded syntax recognizers for email,
   IPv4, and compact E.164-like telephone candidates.
2. `EXACT_ALIAS`: dependency-free exact matching of explicitly configured,
   fictional customer and project aliases with Unicode-aware token boundaries.
3. `COMBINED`: the deterministic union of the two candidate sets. Any overlap
   with conflicting type or reason fails closed instead of choosing silently.

The existing high-confidence Restricted detector remains independent. It is a
blocking control, is not measured as pseudonymization discovery, and must not
change during this sprint.

## Frozen corpus

Eight bounded items cover:

1. English prose with one email, compact international telephone number, and
   customer alias;
2. Italian prose with a Unicode project alias, documentation-range IPv4, and
   email;
3. structured JSON-like text with uppercase customer alias, documentation IPv4,
   and email;
4. invalid email/IP/telephone lookalikes that must remain unmatched;
5. one alias embedded inside a larger identifier plus one exact standalone
   occurrence;
6. a repeated email occurrence that must produce two distinct exact spans;
7. public words and inert pseudonym-shaped placeholders with no target span;
8. a syntactically valid compact telephone string inside source-code-like text
   that ground truth deliberately marks negative.

Ground truth contains 12 exact spans: five email, two IPv4, one telephone,
three customer, and one project span. The code-like telephone produces one
intentional false-positive pressure case. Every byte offset is calculated from
the fixed UTF-8 fixture and checked against exact item, entity type, start, and
end; substring overlap receives no credit.

The alias dictionary contains explicit entries for `CUSTOMER` and `PROJECT`
only. Case variants are separate aliases rather than locale-dependent implicit
folding. All names, addresses, numbers, and network values use fictional or
documentation-only fixture data.

## Bounds and invalid matrix

- at most 64 items and 4 MiB total input;
- at most 1 MiB UTF-8 per item;
- at most 1,000 alias entries and 256 UTF-8 bytes per alias;
- item IDs are unique bounded printable text;
- aliases are non-empty, printable, unique by exact bytes, and map to exactly
  one entity type;
- duplicate IDs, ambiguous duplicate aliases, control text, invalid types,
  excessive bounds, and conflicting overlaps fail closed with no candidates;
- reports and errors contain no matched text, alias, item content, local path,
  mapping, key, passphrase, or recovery material.

## Predeclared scoring

Each candidate is scored only against its applicable ground truth:

- `STANDARD_SYNTAX`: `EMAIL`, `IPV4`, and `PHONE`;
- `EXACT_ALIAS`: `CUSTOMER` and `PROJECT`;
- `COMBINED`: all five types.

Counts include exact true positives, false positives, false negatives, and
per-type precision/recall. A proposal is a true positive only when item, type,
UTF-8 byte start, and UTF-8 byte end all match. Ordering differences, partial
spans, wider/narrower spans, or wrong types are failures.

## Frozen decision algorithm

Structural gates require:

- 100% valid UTF-8 boundaries and in-bounds spans;
- identical candidates, hashes, ordering, counts, and decision across stable
  item/dictionary permutations and two complete runs;
- complete count reconciliation and no duplicate candidate identity;
- every invalid-matrix case fails closed without partial output or text echo;
- zero production effect and unchanged Restricted-detector regressions.

When structural gates pass:

- `ADOPT_FOR_REVIEW` requires overall precision and recall of at least 90%,
  plus precision and recall of at least 80% for every applicable entity type;
- `REFINE` requires overall precision and recall of at least 50% but misses at
  least one adoption threshold;
- `NO_CHANGE` applies when a structural gate fails or either overall metric is
  below 50%.

A passing result authorizes only a recommendation for a later ADR and sprint.
Production rollout must retain explicit review, expose limitations and
recovery in the bilingual GUI, and cannot consume these results directly.

## Expected pressure, not a result

The code-like telephone is expected to challenge the per-type precision gate
for `STANDARD_SYNTAX` and `COMBINED`. This expectation is frozen so the case
cannot be removed after observing the report. Actual counts and decisions are
recorded separately only after two complete executions.
