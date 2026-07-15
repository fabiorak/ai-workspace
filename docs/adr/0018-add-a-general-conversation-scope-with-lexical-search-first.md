# ADR-0018: Add a general conversation scope with lexical search first

**Status:** accepted  
**Date:** 2026-07-15

## Context

AI Workspace currently attaches canonical historical sessions to a registered
project. This preserves repository provenance, but it gives an incorrect choice
for an extemporaneous question that is unrelated to the project open in the
GUI: either lose the conversation or attribute it to a project that did not
actually own it.

Global historical search can already merge bounded results from registered
projects, but every source event still carries a project ID. Representing
general conversation as a synthetic project would make project counts,
permissions, provenance, Work Item relationships, and later context selection
misleading.

Known-item retrieval currently uses deterministic case-insensitive literal
matching over canonical payloads. Semantic retrieval could find paraphrases,
but it would add embedding generation, derived-data classification, index
lifecycle, model selection, reproducibility, and privacy-policy questions
before miss rate and corpus scale have been measured.

## Decision

Introduce `GENERAL` as a first-class conversation scope, distinct from every
registered project. It is not a hidden Project Registry entry, repository, or
default project. A scoped conversation is conceptually one of:

```text
PROJECT(projectId)
GENERAL
```

Locally captured general turns must have stable conversation and event
identities, timestamps, role/type, exact source provenance, integrity metadata,
and explicit `GENERAL` scope. They remain inert historical evidence. Capturing
a user-authored turn does not make it verified active memory, an instruction, a
Work Item, a handoff, or executable context.

Changing the selected project must never silently change the scope of an
existing conversation. The GUI must show the scope before capture and on every
result. A future operation that associates general evidence with a project must
be explicit and additive: it preserves the original `GENERAL` record and adds a
provenance link rather than rewriting its ownership.

Global search covers both registered projects and `GENERAL`. Search also
supports explicit `GENERAL`-only and single-project filters. A project-scoped
query never includes general results implicitly. Result ordering, bounds,
trust, snippets, source navigation, corruption handling, and no-partial-result
behavior remain deterministic.

The first retrieval implementation is bounded lexical search over canonical
full content, using the current case-insensitive literal behavior. It adds no
semantic model, embedding, vector index, external service, or relevance claim.
If measured corpus size, latency, query syntax, stemming, prefix lookup, or
concurrency exceeds the scan boundary, a later ADR may introduce a rebuildable
local full-text index such as SQLite FTS5 while canonical events remain the
source of truth.

Semantic retrieval is deferred until a predeclared evaluation corpus shows
material lexical misses caused by paraphrase or vocabulary mismatch. Any later
semantic implementation must be hybrid with lexical retrieval, expose why a
result matched, remain rebuildable, classify embeddings and index metadata as
derived data, and receive separate privacy, storage, model, and lifecycle
decisions.

This ADR defines scope and retrieval direction only. It does not implement or
authorize chat persistence, model invocation, delivery, background indexing,
active-memory promotion, cross-scope mutation, or semantic search.

## Consequences

- extemporaneous conversations can be retained without false project
  attribution;
- project isolation remains explicit, while global search can find both
  project-owned and general evidence;
- persistence and APIs must use a scope union rather than assuming every event
  has a project ID;
- existing project-scoped Work Items, handoffs, active memory, profile
  composition, and privacy policies do not automatically accept `GENERAL`;
- GUI capture and search need visible scope controls, recovery guidance, and
  English/Italian copy;
- migration and backward compatibility must preserve all existing project
  event identities and queries;
- lexical search remains explainable and dependency-free but does not solve
  stemming, typo tolerance, synonyms, or paraphrase retrieval;
- scale-triggered full-text indexing and evidence-triggered hybrid semantic
  retrieval remain separate future decisions.
