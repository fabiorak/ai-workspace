# Measure profile context selectors

Sprint 20 adds a bilingual, read-only report for an experiment-only profile
selector vocabulary. It exposes proposed handoff-section selection, exact
candidate bytes, provenance, hashes, budget fit, and a non-excludable safety
floor. It does not change normal Context Pack preview.

## GUI workflow

1. Select the owning project, an ACTIVE Work Item, and one persisted immutable
   handoff.
2. Under **Measure profile context selectors**, enter one reviewed schema-v1
   profile path and optionally pin its lowercase SHA-256 digest.
3. Ensure `context.include` and `context.exclude` use only the eight
   `handoff.*` selectors shown inline.
4. Choose **Preview selector measurement read-only**.
5. Review safe profile identity, vocabulary, safety floor, all eight section
   decisions, reasons, trust, source counts, hashes, baseline/selected exact
   bytes, reduction, and fit against the profile continuity budget.

The caller cannot override selectors or budget. Both come from the reviewed
profile. The handoff is loaded by explicit project, Work Item, and handoff
identity; the browser cannot submit a replacement body.

Objective, repository state, next action, and source references are always
selected. Unknown or legacy strings, duplicates, include/exclude overlap,
attempts to exclude the floor, changed digests, malformed profiles, and foreign
handoffs fail closed without exposing content or full paths.

The report measures historical v1 candidate serialization for comparison with
Sprint 13–15. It is not token accounting, schema-v2 shared-source accounting,
relevance, quality, permission, retrieval, delivery, or execution evidence.

Sprint 20's decision is `adapt`: the corpus created three new standard-budget
fits and reduced repeated candidate bytes by 49.89%, but did not measure whether
excluded content is necessary for a correct resume. Production selectors
remain descriptive and Context Builder behavior is unchanged.

See the full [measurement report](../development/context-selector-measurement.md)
for exact results, limits, and reproduction.
