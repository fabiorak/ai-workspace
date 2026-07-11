# Sprint 6 — Make Handoff Overhead Measurable and Proportional

**Primary epic:** E4 — Handoff and Cross-agent Resume hardening  
**Milestone:** post-M3 evidence increment  
**Status:** planned  
**Cadence:** two-week timebox  
**Dependency:** Sprint 5 and M3 completed

## Sprint goal

Establish when a provenance-rich handoff becomes smaller than full-session
replay and, only after measuring that boundary, define a backward-compatible
representation that removes structural duplication without weakening trust,
source navigation, immutability, or provider neutrality.

## Evidence and problem statement

Sprint 5 proved the expected first action but measured a 1,325-byte synthetic
resume source against an 8,272-byte handoff. The handoff was 6,947 bytes larger
because section metadata repeats full provenance snapshots and the fixture is
deliberately tiny.

This result does not justify arbitrary compression, omitted provenance, a
token budget, summarization, or an E6 Context Builder. It justifies measuring
structural overhead and considering normalized references inside the existing
immutable handoff boundary.

## User story

As a developer evaluating cross-agent continuity, I want exact, reproducible
break-even measurements and a compact packet whose trust and sources remain
inspectable so that I can decide whether a handoff is useful without relying on
inflated baselines or unlabeled token estimates.

## Committed backlog

### S6-01 — Build a deterministic synthetic break-even corpus

- author only synthetic, public-safe session variants from reviewed records;
- vary record count and payload size independently;
- measure exact raw-session bytes and stable handoff JSON bytes;
- publish the first measured break-even point or state that none exists within
  the bounded corpus;
- keep token conversion secondary and explicitly estimated.

### S6-02 — Attribute handoff overhead by field category

- measure envelope, content, section metadata, and repeated provenance bytes;
- distinguish required safety information from serialization duplication;
- make the analysis reproducible for a fixed packet;
- do not optimize based on token estimates alone.

### S6-03 — Decide normalized provenance before changing the schema

- propose an ADR only if measurements show repeated provenance is material;
- compare current embedded links, a packet-level source table with section
  references, and no schema change;
- require lossless source navigation, section-level trust, deterministic
  encoding, immutable predecessors, and fail-closed decoding;
- define schema-version migration and backward-read behavior before v2 writes.

### S6-04 — Implement the accepted representation narrowly

- proceed only after S6-03 accepts a change;
- preserve every source field and trust distinction byte-for-byte in meaning;
- keep v1 handoffs readable and immutable;
- reject dangling, duplicate, cross-project, or oversized source references;
- add no database, model, service, framework, or network dependency.

### S6-05 — Expose size preview and comparison guidance

- show exact prospective handoff bytes before immutable creation or provide an
  equivalent explicit dry-run contract;
- report full-session comparison only when the baseline source is named;
- label token estimates and negative savings clearly;
- never auto-drop memory, sources, failures, tests, or trust metadata to meet a
  target.

### S6-06 — Prove proportionality and close the experiment

- rerun the bounded corpus and publish before/after exact-byte results;
- prove source navigation and evaluation results are unchanged;
- cover v1 compatibility, corruption, cross-project references, terminal
  controls, and deterministic encoding;
- update review, retrospective, roadmap, and next-increment recommendation;
- do not claim general context optimization or production readiness.

## Out of scope

- E5 instruction, agent, or skill registries;
- E6 Context Builder, retrieval, token budgets, semantic search, embeddings,
  summarization, model calls, caching, or prompt construction;
- dropping provenance or trust metadata for size;
- binary compression, archives, databases, services, or new dependencies;
- real/private transcripts, live agents, provider discovery, or network access;
- using a larger synthetic baseline solely to manufacture positive savings.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high

# Exact command is frozen with S6-01 implementation.
npm run cli -- handoff measure --help
```

The review must publish exact UTF-8 bytes, corpus construction, formulae,
negative results, and limitations. Token values remain estimates. A schema
change is optional; a credible `no change` decision satisfies S6-03 when the
measurements do not justify migration.

## Definition of done

- the break-even experiment is reproducible and public-safe;
- overhead categories sum to the exact encoded packet size;
- any schema change has an accepted ADR and backward-read tests;
- trust, provenance, immutability, and source navigation do not regress;
- claims distinguish E4 representation overhead from later E6 optimization;
- quality, audit, fixture-safety, and isolated-demo gates pass;
- review and retrospective are appended without rewriting this commitment.
