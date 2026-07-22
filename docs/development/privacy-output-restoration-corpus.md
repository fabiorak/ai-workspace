# Pseudonymized output restoration corpus and gates

**Frozen before Sprint 31 harness or production implementation:** 2026-07-22  
**Scope:** model-free local measurement; all content and identities are synthetic

## Purpose

This corpus determines whether one authenticated schema-v1 or schema-v2 mapping
can restore exact AI Workspace pseudonyms inside arbitrary bounded local output
without relying on the original Context Pack positions. It does not represent a
model response and cannot authorize model access, response capture, delivery,
routing, permissions, execution, or automatic handling.

The existing position-based Context Pack restore remains the compatibility
baseline and must not change.

## Frozen policies

1. `STRICT_WHOLE_TOKEN`: validate the complete output before replacement;
   restore only exact whole tokens owned by the selected mapping; block the
   complete result on any unknown or malformed `[[AW...` construct.
2. `KNOWN_ONLY_BASELINE`: restore exact known whole tokens and leave unknown or
   malformed constructs unchanged. This is comparison-only and cannot become a
   production policy in Sprint 31.

## Frozen corpus

The corpus contains schema-v1 customer/person mappings and a distinct schema-v2
project/customer mapping. Fixed English and Italian cases cover:

1. one known token inside new English output;
2. repeated and reordered known tokens;
3. known tokens next to punctuation and multi-byte Unicode;
4. an output with no pseudonym;
5. a well-formed token unknown to the selected mapping;
6. a token owned by the other mapping set;
7. truncated, lower-cased, wrong-entity, nested, split, and extra-bracket
   constructs;
8. one known token followed by an anomaly, proving all-or-nothing behavior;
9. wrong project, Work Item, handoff, model, mapping-set, and schema dispatch;
10. conflicting mapping entries, malformed UTF-16 input, and oversized input.

Exact candidate bytes, expected restored bytes, SHA-256 values, mapping-set
identities, decisions, restored-token counts, and unchanged regions are pinned
in the executable fixture. Stable case and mapping-entry permutations run twice.

## Bounds and token grammar

- candidate output is at most 1 MiB of round-trippable UTF-8;
- one mapping contains at most the existing 1,000 entries;
- a suspicious construct begins with `[[AW` in any ASCII case;
- an exact token is `[[AW_<ENTITY>_<16 uppercase hexadecimal digits>]]`;
- the entity must be valid for the selected mapping schema;
- a token followed by an additional `]` is malformed, while adjacent complete
  tokens are allowed;
- every exact token must resolve within the selected mapping to one byte-exact
  original; conflicting originals fail closed;
- mapping identity and project, Work Item, handoff, and model scope must match
  the explicit request before scanning.

Measurement reports and all errors expose only decisions, schema version,
hashes, byte counts, token counts, reason codes, and generic recovery. They
never contain candidate output, restored values, mapping plaintext, keys,
passphrases, or local paths. An accepted local inspector may return restored
content only after complete strict validation.

## Frozen gates

Structural gates require:

- zero incorrect restorations and zero partial output for blocked cases;
- byte-exact preservation of every non-token region;
- exact replacement of all and only known whole tokens;
- every unknown, altered, cross-mapping, malformed, conflicting, or cross-scope
  strict case returns `BLOCKED_INTEGRITY_FAILURE` with no restored content;
- no-token cases return `NO_PSEUDONYMS` with no restored content;
- explicit permanent v1 and v2 dispatch with unchanged canonical mapping bytes;
- identical reports across permutations and two complete runs;
- bounded failures and non-echoing reports/errors;
- unchanged current Context Pack restore, encrypted mapping, and custody tests.

## Frozen decision algorithm

- `ADOPT_FOR_LOCAL_INSPECTION`: every structural gate passes and all valid
  strict cases restore exact expected bytes;
- `REFINE`: no incorrect or partial restoration occurs, but a determinism,
  compatibility, boundedness, or valid-case gate fails;
- `NO_CHANGE`: any incorrect restoration, partial blocked output, scope bypass,
  sensitive echo, or existing compatibility regression occurs.

The known-only baseline is recorded but cannot receive
`ADOPT_FOR_LOCAL_INSPECTION`. A positive strict result permits ADR-0025 to
consider only a user-triggered local inspector. Negative evidence closes Sprint
31 without production behavior.

## Expected pressure, not a result

The mixed known-plus-unknown case is expected to distinguish the policies: the
baseline can construct a partially restored result, while strict validation
must return no content. This expectation is frozen before implementation so the
case cannot be weakened after observing results.
