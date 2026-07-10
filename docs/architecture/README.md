# Architecture

AI Workspace begins as a modular monolith with replaceable infrastructure and
adapter-based integrations. The design separates:

- transactional project and work-item state;
- active, validated memory;
- historical search evidence;
- large immutable artifacts;
- temporary, budgeted context packs.

The current candidate stack is TypeScript/Node.js for the control plane, a web
UI, PostgreSQL for transactional state, OpenSearch for historical retrieval,
and a Python-based privacy service. These are design candidates, not yet
committed implementation choices.

See the full public design documents in the parent `docs/` directory. Material
decisions should be captured as ADRs before implementation locks them in.

