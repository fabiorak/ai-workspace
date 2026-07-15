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

The same facade now exposes the provider-neutral active-memory lifecycle to the
GUI. Presentation and HTTP layers do not reconstruct domain rules: all
same-project provenance, active-only listing, optimistic versions, terminal
transitions, and additive verification/supersession/invalidation remain owned
by `packages/active-memory` and the atomic local adapter.

GUI localization is a dependency-free presentation boundary in `apps/web`.
Typed English and Italian catalogs have exact key parity; locale resolution is
explicit browser-local preference, supported browser language, then English.
Locale never enters domain persistence or API contracts. Effective-instruction
preview reuses the provider-neutral composer and strict local bundle reader
through the typed facade; HTTP and presentation remain read-only and do not
enforce or execute instruction content.

The first agent/skill profile slice also belongs to the provider-neutral
instruction-management boundary. Schema v1 contains one project-scoped agent
and exactly its enabled skills, validates internal model/tool/context/
confirmation compatibility, and encodes canonical newline-terminated JSON.
The existing local-instructions integration reads one explicit bounded file,
optionally pins its SHA-256 digest, and returns no full path. The facade and GUI
inspect the value only; there is no discovery, registry persistence,
installation, selection, availability resolution, permission enforcement,
delivery, or execution graph.

The profile-composition increment remains inside that provider-neutral,
read-only graph. `composeProfileInstructions` requires the exact union of agent
and enabled-skill instruction-source IDs, one explicitly selected allowed
model, and same-project values. It derives the AGENT target and both exact-byte
budgets from the validated profile, while retaining declaration ownership for
each source. The facade combines the safe digest-pinned profile inspection,
existing local instruction reader, immutable handoff, instruction composer,
and unchanged Context Pack schema-v2 builder into a transient envelope.
Context include/exclude selectors remain descriptive; no resolver, persistence,
delivery, permission, or execution boundary is introduced.

The selector-measurement increment adds a separate experiment-only projection
inside `packages/context-builder`. Eight explicit `handoff.*` selectors map
one-to-one to existing continuity sections; objective, repository, next action,
and source references are a non-excludable safety floor. Projection retains
trust/source counts and hashes byte-identical historical v1 candidates. The
facade reports one digest-pinned profile against one immutable handoff but
cannot override selectors or budget and never passes the result into
`buildContextPack`. Decision `adapt` leaves production and schemas unchanged.

The follow-up evidence-retention increment remains in the same package and
adds no facade or runtime edge. Six in-memory digest-pinned synthetic manifests
are validated for exact-answer uniqueness, optional-section coverage,
first-action identity, source navigation, scope, and bounds before the existing
selector projection runs. The evaluator measures retained exact bytes and
canonical sources, then separately accounts historical embedded v1 candidates
and schema-v2 normalized sections plus the marginal source-table union. It
matches the production v2 builder only as a baseline contract check; it never
passes projected input into `buildContextPack`. No policy preserves the corpus
or creates a new sampled fit, so builder, schemas, profile semantics, facade,
GUI, persistence, delivery, and execution remain unchanged.

The first E6 slice is `packages/context-builder`, a provider-neutral in-memory
builder. It maps the eight sections of one validated immutable handoff and
optional effective instruction rules into two deterministic categories. Exact
UTF-8 byte budgets include or omit whole items with source identity and reason.
The builder performs no I/O, retrieval, persistence, delivery, or execution.
Its developer-only measurement boundary accepts already-built read-only
previews, validates their exact-byte accounting, and produces an immutable
schema-versioned corpus report. Reports distinguish candidate, included, and
omitted content bytes and cannot modify builder selection behavior.
An additional experiment-only projection compares the current full continuity
sections with resolvable references and string-leaf outlines. All levels retain
complete metadata and SHA-256-bound immutable resolution identity, but none is
accepted as Context Builder input. The experiment performs no storage lookup,
automatic level selection, persistence, delivery, or execution.
The metadata-envelope experiment separately compares embedded metadata with a
packet-level source table and a full metadata table over the unchanged corpus.
It uses SHA-256 identities over complete canonical source/metadata values,
scope-bound bounded tables, canonical unique references, and lossless
fail-closed expansion. ADR-0016 accepts only the source table. Sprint 17 rolls
that representation into production Context Pack schema v2 while retaining an
explicit v1 writer/reader path. The builder charges canonical marginal table
growth during deterministic whole-section selection; the facade expands v2
before presentation and exposes only entry count and shared exact bytes. The
experiment remains separate, and persistence, delivery, and execution remain
outside the graph.

The first E7 increment adds `packages/privacy-gateway`, a dependency-free
provider-neutral policy/classification/detector/preflight boundary. It consumes
only an expanded immutable Context Pack, an exact selected model, and a
validated schema-v1 model data policy. `integrations/local-privacy-policy`
contains the sole controlled local JSON reader. The existing local ingestion
adapter calls the same pure high-confidence detector while retaining its
public error behavior. `apps/web` composes these pieces through its typed
in-process facade and authenticated loopback route. The dependency direction
remains presentation → local adapter/provider-neutral package; no network,
model, delivery, persistence, permission, or execution adapter is present.

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
resolves artifact-backed payloads through an integrity-checking read port. The
provider-neutral use case can now compose an explicit set of up to 100
registered project IDs and 10,000 canonical events, merge deterministic matches
before one global limit, and reject inconsistent or partial scope. The GUI
enriches results with safe project name/ID and requires an explicit project
selection before existing event/source routes are used. Raw source artifacts
are opened only after explicit user action. ADR-0008 records the bounded
literal-search strategy and the triggers for selecting an index.

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
