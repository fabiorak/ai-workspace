# Context Builder

Provider-neutral, dependency-free construction of deterministic read-only
Context Pack previews from one immutable handoff and optional effective
instructions. Exact UTF-8 byte budgets include or omit atomic items without
truncation. The package performs no retrieval, persistence, or execution.

The production writer emits explicit schema v2. It stores complete canonical
handoff sources once in a scope-bound table and uses sorted SHA-256 source IDs
inside normalized continuity sections. Shared table growth is charged
incrementally during whole-section selection; the final table contains exactly
the source union used by included sections. `expandContextPack` validates the
whole packet and restores complete logical metadata and navigation identity.
The explicit schema-v1 writer remains supported for compatibility and the
historical measurement corpus.

The package also measures bounded corpora of already-built previews. Reports
reconcile candidate, included, and omitted content bytes by category, normalize
sample ordering, and label token values as estimates. Measurement does not
change selection policy or treat omissions as relevance judgments.

An experiment-only continuity disclosure API compares full sections with
immutable resolvable references and structural outlines. Every level repeats
complete trust/provenance metadata and is excluded from production Context
Builder input. It performs no storage resolution or automatic level selection.

A second experiment-only API compares current embedded section metadata with a
packet-level canonical source table and a full metadata table. It measures only
exact Context Pack candidate bytes, expands both alternatives losslessly, and
rejects noncanonical, dangling, duplicate, unreferenced, malformed,
cross-scoped, inconsistent, or oversized tables and references. ADR-0016
accepted the source table direction subsequently implemented by schema v2;
the experiment remains separate and also retains the rejected full-metadata
alternative for reproducibility. No Context Pack persistence, delivery, or
execution path exists.
