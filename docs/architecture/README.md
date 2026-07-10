# Architecture

AI Workspace begins as a modular monolith with replaceable infrastructure and
adapter-based integrations. The design separates:

- transactional project and work-item state;
- active, validated memory;
- historical search evidence;
- large immutable artifacts;
- temporary, budgeted context packs.

Node.js 24, strict TypeScript, ESM, and npm workspaces form the accepted control
plane baseline. Application frameworks, UI technology, transactional storage,
historical search, and privacy-service boundaries remain design candidates and
will be selected when a vertical product slice requires them.

The implemented local persistence baseline now consists of:

- a schema-versioned atomic JSON Project Registry;
- schema-versioned per-session JSON documents that enforce logical append-only
  event prefixes and use exclusive per-session locks;
- immutable exact-byte artifacts addressed by SHA-256 on the local filesystem.

Session ingestion contracts are provider-neutral. The first Codex adapter
translates one controlled JSONL subset at the integration boundary. Imported
events remain untrusted historical evidence and do not enter active memory or
an execution path. These choices are recorded in ADR-0005 through ADR-0007.

See the full public design documents in the parent `docs/` directory. Material
decisions should be captured as ADRs before implementation locks them in.
