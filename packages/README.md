# Packages

Reusable modules for the modular monolith live here. Only implemented packages
have a directory: a domain boundary earns a package when its public contract is
defined by an increment, not when it is first imagined. Anticipated future
boundaries — tool registry, model routing, agent adapters, telemetry, policy
engine, skill registry — are described in the
[long-term vision](../docs/AI_WORKSPACE_VISION_LONG_TERM_EN.md) and will be
created by the increment that implements them.

Implemented packages:

- `active-memory/` owns provider-neutral active-memory vocabulary, lifecycle
  use cases, and persistence and provenance ports;
- `core/` owns bounded Work Item objective state, additive lifecycle use cases,
  provenance, and optimistic persistence ports;
- `project-registry/` owns repository models, ports, and registration use
  cases;
- `session-ingestion/` owns canonical imported-session and event contracts;
- `historical-search/` owns read-only historical evidence search contracts and
  use cases, including additive tagged-scope General/all-scope retrieval, and
  the single searchable surface that ranks canonical events together with
  active memory through the tolerant index, admissibility settled and
  provenance deduplicated before a reader sees a list;
- `general-conversation/` owns project-free immutable question capture,
  provenance, integrity, classification, and persistence ports;
- `general-project-link/` owns explicit immutable `LINK_ONLY` associations from
  exact General event hashes to registered projects, including rationale,
  attribution, duplicate, stale-reference, and restricted-data rules;
- `handoff/` owns immutable provider-neutral handoff snapshots, section-level
  trust and provenance, stable rendering, persistence ports, and the
  backward-readable v1/v2 persisted codec with lossless normalized source
  references;
- `instruction-manager/` owns bounded provider-neutral instruction sources,
  rules, deterministic precedence, conflict decisions, and stable effective
  instruction output;
- `privacy-gateway/` owns canonical model data policies, conservative
  classification, the shared high-confidence restricted detector, and
  deterministic non-authorizing Context Pack preflight reports, plus
  exact-hash reviewed-span pseudonymization and byte-exact restoration
  contracts;
- `privacy-audit/` owns the bounded non-content local privacy decision audit
  contracts;
- `model-attempts/` owns the provider-neutral bounded model attempt state
  machine and its persistence ports;
- `context-builder/` owns deterministic budgeted Context Pack composition and
  its schema-versioned canonical representation;
- `tolerant-retrieval/` owns the in-memory tolerant lexical index of ADR-0031
  and ADR-0032: one merged token set per record, typo tolerance against
  unstemmed surface forms, admissibility before ranking, a stated reason for
  every result, and the reader that reduces a canonical payload to text outside
  the engine;
