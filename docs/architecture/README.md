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

The first GUI vertical slice is a foreground Node built-in HTTP host in
`apps/web`. It binds only to loopback, serves semantic HTML and local assets,
and calls a typed in-process application facade rather than the CLI. A one-time
bootstrap establishes an opaque session cookie; Host, Origin, CSRF, method,
content-type, and body bounds are checked before state changes. Imported
evidence is rendered as inert text. ADR-0015 records this reversible alpha
boundary and its desktop and packaging revisit triggers.

The implemented local persistence baseline now consists of:

- a schema-versioned atomic JSON Project Registry;
- schema-versioned per-session JSON documents that enforce logical append-only
  event prefixes and use exclusive per-session locks;
- immutable exact-byte artifacts addressed by SHA-256 on the local filesystem;
- schema-validated per-project active-memory operation logs with diagnostic
  owner-token locks and atomic whole-document replacement.

Session ingestion contracts are provider-neutral. The first Codex adapter
translates one controlled JSONL subset at the integration boundary. Imported
events remain untrusted historical evidence and do not enter active memory or
an execution path. These choices are recorded in ADR-0005 through ADR-0007.

Historical retrieval is also behind domain-owned ports. The initial adapter
scans validated canonical session events with mandatory project scope and
resolves artifact-backed payloads through an integrity-checking read port. Raw
source artifacts are opened only after explicit user action. ADR-0008 records
the bounded literal-search strategy and the triggers for selecting an index.

Active memory remains separate from historical evidence and artifacts. Its
provider-neutral lifecycle is implemented in `packages/active-memory`, while
the local adapter derives current state from append-only logical operations.
Project IDs are hashed for filenames, documents repeat and validate project
scope, and source links retain canonical evidence identity without copying
payloads. ADR-0009 records the storage, locking, reconstruction, and migration
rules.

Effective instruction composition is also provider-neutral and read-only. The
domain accepts bounded structured sources across global, workspace, project,
model, agent, and task scopes. Preferences use explicit deterministic
precedence; constraints cannot be silently replaced; every decision retains a
source ID and exact-byte SHA-256 digest. The local adapter reads only explicitly
selected synthetic JSON bundles and neither discovers nor persists
instructions. ADR-0014 records the composition and non-enforcement boundary.

Instruction text and precedence are not runtime permission enforcement. Agent,
model, tool, filesystem, network, privacy, deployment, and destructive-action
controls remain outside this slice and require deterministic capability
boundaries before execution is introduced.

See the full public design documents in the parent `docs/` directory. Material
decisions should be captured as ADRs before implementation locks them in.
