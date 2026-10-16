# Architecture

AI Workspace begins as a modular monolith with replaceable infrastructure and
adapter-based integrations. The design separates:

- transactional project and work-item state;
- active, validated memory;
- historical search evidence;
- large immutable artifacts;
- temporary, budgeted context packs.

Node.js 24, strict TypeScript, ESM, and npm workspaces form the accepted control
plane baseline. This repository is beyond design-only scaffolding: the local
alpha implements the persistence, search, active-memory, conversation, GUI,
privacy, and preview slices described below. Some future boundaries remain
design candidates and will be selected only when a vertical product slice
requires them.

## Current alpha boundary

The standard host is local-first and uses a simulated transport. The GUI offers
the current conversation preview and persistent local session state, while
session imports remain historical, untrusted evidence. OpenAI Responses is
available only through an explicit process opt-in; it has not been live-probed
and is not the default transport. Codex and Claude Code adapters/runners are
qualified with synthetic executables and reach the conversation only through an
explicit opt-in. A local model is offered only when a loopback address is named
at start, and is qualified against a synthetic server. No claim of live provider quality, agent execution, or
complete privacy detection follows from the offline suite. Privacy protection
uses app-managed stable maps per project or General scope, with optional
reviewed manual protected terms. A passphrase is not requested for daily use;
legacy passphrase-wrapped custody remains for migration and technical recovery
workflows. Detection is incomplete, especially for first-occurrence person,
organization, address, date, path, and URL values.
Scoped reduced-turn composition is implemented and qualified offline for
General and project conversations without a handoff, including policy,
instructions, provenance, and explicit omission accounting. Durable turn
identity and conservative recovery are implemented by the local
conversation-turn registry. An optional expiring review binds the protected
payload to a later send and revalidates target and scope before exposure. The
legacy handoff path remains distinct.

The remainder of this page retains historical slice descriptions because they
are useful architectural provenance. Read those paragraphs as the state of the
named slice, not as a second current-state contract. Proposed ADRs and future
work remain proposed until their own evidence and review are recorded.

The first GUI vertical slice is a foreground Node built-in HTTP host in
`apps/web`. It binds only to loopback, serves semantic HTML and local assets,
and calls a typed in-process application facade rather than the CLI. A one-time
bootstrap establishes an opaque session cookie; Host, Origin, CSRF, method,
content-type, and body bounds are checked before state changes. Imported
evidence is rendered as inert text. ADR-0015 records this reversible alpha
boundary and its desktop and packaging revisit triggers.

The presentation remains one dependency-free local application but now exposes
a routed multi-page shell. Fragment routes and a persistent responsive sidebar
organize existing facade workflows without adding a framework, remote asset,
daemon, or second source of truth. Dashboard charts are CSS renderings of the
same bounded textual aggregates; Settings stores only locale in browser-local
storage, and unavailable pages do not imply runtime authority.

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

Conversation continuation preparation is available through the application area's
`continuations.prepare(query, target)` read-only operation. It resolves the work
from the conversation and reads the latest handoff in the handoff service's
canonical order. The technical result includes the dated handoff identity,
profile-governed schema-v2 Context Pack, expanded privacy input, exact omissions,
source provenance, and separately observed repository differences. Missing work,
handoff, or target and incoherent local inputs return explicit recovery reasons.
Profile composition is shared with the existing technical preview. Preparation
performs no audit, persistence, authorization, or delivery. The conversation GUI
now offers a separate local privacy preparation: validated transient recipient
configuration, an audited POST covering context and the complete next question,
review of suggested or manually selected words, and an exact protected-text
preview. The canonical Context Pack remains unchanged. A transient privacy
projection includes the question and current linked-session readings as separate
items. Its byte accounting includes evidence and the complete question; exact
transport text is serialized as readable sections before confirmation.
Existing encrypted v1/v2 app-managed mappings are reused; optional legacy
passphrase custody remains for migration and technical recovery, not daily use.
No new mapping schema is introduced.
Proposals expire, are scoped to their conversation, and are consumed once before
protection. Changed sources, policy or recipient configuration require a new
proposal. The guarded conversation-scoped send route uses ADR-0040's durable coordinator
only when the host explicitly injects a transport. Output is strictly restored,
checked for restricted content, and stored in the same conversation. The next
preparation reads that answer as untrusted evidence. Default startup enables no
transport or credential lookup. ADR-0041 documents limits and provenance.

ADR-0042 proposes replacing that manual continuation sequence as the primary GUI
with a provider-neutral `ConversationTurn`. Its public request contains only the
conversation, claimed project or General scope, target, exact user text, and a
client request identity. The server resolves Work Item and optional handoff, and
the idempotency port binds duplicate clicks to the exact request before a later
delivery boundary can expose content. A missing handoff selects reduced context;
it no longer blocks an ordinary turn. The conversation-turn package defines this contract and
its ports; routes, transports, persistence adapters and GUI behavior are
separate.

ADR-0043 defines stable per-project and General pseudonym maps whose keys are
managed by the local single-user application, with legacy passphrase custody kept
for additive migration and optional higher-protection workflows. ADR-0044
separately defines bounded versioned local target configuration while keeping
credentials process-only.

The historical web shell makes the conversation the primary GUI surface and
keeps historical search on its own route. The newest stored conversation opens on
arrival without taking focus, selecting the open row is idempotent, and
consecutive technical moments are grouped behind a disclosure. The composer,
per-conversation session-only model choice, context explanation, and automatic
protection explanation are present. The previous continuation controls remain
hidden as compatibility structure for later migration; they are not the ordinary
path.

The provider-neutral `model-targets` package and the `local-model-targets` JSON
adapter implement ADR-0044. The versioned bounded document keeps target
metadata, a global default, project selections, and conversation selections;
resolution precedence is conversation, project, then default. Writes use an
owner lock, expected revision, restrictive permissions, and atomic publication.
The ordinary conversation endpoint returns only target ID and validated display
name, while Settings owns the technical metadata. No credential, provider
transport, response, endpoint override, or authorization is stored. The selected
target survives host restart.

A provider-neutral `ConversationTurn` sits behind a single authenticated
conversation-scoped POST. The server resolves scope, target, optional Work Item
and optional handoff, then composes again immediately before `ModelDelivery`
claims exposure. General and project conversations without a handoff use a
bounded reduced context made from conversation evidence and active memory from
explicitly linked projects. Exact duplicate request identities share the first
result; changed content conflicts, source changes refuse before exposure, and an
unknown post-exposure result is cached without automatic retry. Completed pairs
are retained atomically with model-target attribution. The standard host injects
only a local simulated transport and performs no provider or network request by
default. A separate OpenAI Responses adapter and explicit process opt-in now
exist, but no live probe has been run.

A permanent local identity is kept for each conversation gesture, bound to the
exact request and server-resolved scope. Its separate versioned registry links
to the model attempt before exposure and to the canonical saved response after
completion; it stores metadata and digests, never prompt or answer text. Recovery
consults the attempt and conversation stores and never resends or reconstructs
an answer. An unresolved exposure is returned as `UNKNOWN_AFTER_EXPOSURE`, and
a completed attempt whose answer was not saved is returned as
`RESPONSE_WITHHELD` with reason `SAVE_FAILED`. The registry has no automatic
retention or replay TTL; deleting or rolling it back manually removes its
deduplication guarantee. Turns created before durable identities existed are not migratable.
ADR-0048 records the decision. Bounded volatile review preparations
last
five minutes and are consumed once. The optional `reviewId` joins the request
digest without changing the digest of existing five-field requests. Exact
duplicate replay remains owned by the registry after expiry or restart. Confirmation
recomposes and compares sources, policy, instructions, mapping, target and scope;
it sends the retained protected bytes only when the binding still matches.
Selection is reread after composition and binding is checked again after durable
attempt preparation, before the exposure claim. These are snapshot checks, not a
transaction across every source store. ADR-0042 specifies the amended contract.
The legacy continuation path is unchanged.

The provider-neutral `PiiDetector` port and stable pseudonymization contract
sit immediately before model delivery. The default deterministic detector
and previously known stable values produce readable typed placeholders. One
app-managed 32-byte key and one authenticated encrypted map are stored separately
per authoritative project scope, with a distinct General scope; both adapters
enforce bounds, private modes, owner locks, atomic publication, and strict schema
validation. Restoration rejects unknown typed placeholders before persistence.
Settings reports the residual local-account threat and offers an additive,
round-trip-verified import for immutable v1/v2 passphrase-protected mappings.
The browser never selects scope or receives keys, maps, originals, or paths.

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
fail-closed expansion. ADR-0016 accepts only the source table. The Context Pack schema-v2 work rolls
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

The second E7 increment extends the same provider-neutral package with
schema-v1 reviewed-span contracts, deterministic HMAC-derived inert aliases,
exact UTF-8 boundary validation, and byte-exact restoration. It never mutates
the expanded Context Pack supplied to it. The separate
`integrations/local-privacy-mapping` adapter receives an explicit 32-byte key
in memory and persists only bounded AES-256-GCM authenticated ciphertext. Clear
scope metadata is authenticated as additional data; nonce and authentication
tag are stored beside ciphertext, while original selected values remain inside
the encrypted canonical mapping. `apps/web` exposes one authenticated scoped
action that verifies a save/read/restore round trip and returns neither mapping
plaintext, key, passphrase, nor path. ADR-0022 adds
`integrations/local-key-custody`: it generates one random mapping key per new
mapping set and stores only a separately authenticated, scrypt-derived
passphrase-wrapped envelope. Offline recovery requires both encrypted stores
and the passphrase. Key export, passphrase change, existing-mapping rotation,
network, model delivery, permission, and execution remain outside the graph.

The implemented local persistence baseline now consists of:

- a schema-versioned atomic JSON Project Registry;
- schema-versioned per-session JSON documents that enforce logical append-only
  event prefixes and use exclusive per-session locks;
- immutable exact-byte artifacts addressed by SHA-256 on the local filesystem;
- schema-validated per-project active-memory operation logs with diagnostic
  owner-token locks and atomic whole-document replacement;
- separate schema-v1 General conversation documents with immutable events,
  exact UTF-8 byte/hash integrity, owner-token locks, restrictive modes, and
  atomic publication without a synthetic project;
- separate schema-v1 immutable General-to-project link documents with exact
  source-hash binding, explicit target/rationale, a store-wide owner-token
  lock, restrictive modes, atomic publication, and no evidence mutation;
- separate schema-v1/v2 encrypted pseudonym mapping documents with authenticated
  scope metadata, fresh nonces, in-memory keys, owner-token locking,
  restrictive modes, flushed atomic publication, and no source mutation.
- separate schema-v1 immutable key-custody envelopes with exact scrypt
  parameters, fresh salt and nonce, authenticated mapping-set scope,
  restrictive modes, owner-token locking, and atomic publication.
- separate per-project schema-v1 privacy-decision audit aggregates with minimum
  non-content provenance, fixed bounds, monotonic revisions, predecessor
  hashes, owner-token locking, private modes, atomic publication, and verified
  reread before a valid preflight report can return.

ADR-0025 adds a separate pure arbitrary-output restoration boundary in
`packages/privacy-gateway`. It validates one complete bounded UTF-8 value
against one authenticated version-dispatched mapping before constructing any
restored content. The loopback facade supplies URL scope and the mapping-owned
model, while encrypted mapping and custody adapters remain unchanged. Candidate
and restored output are never persisted or delivered.

ADR-0026 adds `packages/privacy-audit` as the provider-neutral event and use-case
boundary and `integrations/local-privacy-audit` as its bounded local adapter.
The GUI application records only its explicit valid preflight action; other
privacy actions remain unaudited. Read-only list/detail routes are authenticated
and project-scoped. The store has no dependency on active memory, history,
artifacts, mappings, custody, model, network, or delivery components.

The delivery-authorization work adds no production architecture component. A test-only provider-neutral
intent, in-memory single-use store, and synthetic adapter measure exact binding,
expiry, replay, concurrency, and crash windows. The `EVIDENCE_ONLY` decision
rejects an ADR and production export because external acceptance becomes
unknowable after byte exposure without a concrete provider idempotency and
receipt protocol. Existing application, API, GUI, persistence, privacy,
mapping, custody, restoration, and audit graphs remain unchanged.

The OpenAI transport work also adds no production architecture component. Two test-owned
qualification harnesses measured the documented OpenAI Responses protocol and a
fake `codex exec` process port. That qualification recorded Responses as
`EVIDENCE_ONLY` because
request correlation is not documented create idempotency. Codex is classified
`SEPARATE_AGENT_BOUNDARY` because its instructions, tools, and agent context
cannot prove exact reviewed-input isolation. Neither harness is exported;
network, auth, subprocess, application, API, and GUI graphs remain unchanged.

The Anthropic transport work adds a second-provider qualification without adding a production
component. A test-owned Messages protocol harness bound exact system and user
digests to fixed API version, output bound, and zero tools; missing create
idempotency leaves its decision `EVIDENCE_ONLY`. A fake Claude Code port keeps
bare API authentication separate from managed login. Bare is
`API_EQUIVALENT_NOT_FALLBACK`; managed login is a
`SEPARATE_AGENT_BOUNDARY`. No harness is exported and no application, network,
credential, subprocess, routing, fallback, or GUI graph changes.

ADR-0045 now proposes the missing follow-up without collapsing these boundaries.
Subscription-backed Codex and Claude Code targets belong to a separate
`AGENT_EXECUTION` path; direct provider APIs remain `MODEL_DELIVERY`, and local
inference remains `LOCAL_MODEL`. Its first increment adds a dormant Codex
subprocess runner and qualifies it only with a synthetic executable. There is
still no application wiring, managed-login use, external execution or GUI
target.

ADR-0045 is the current agent-execution decision record. Its dormant Codex and
Claude Code adapters/runners are qualification boundaries, not a claim that
either agent is available from the GUI. The direct Responses path remains an
optional model-delivery adapter, and the default simulated transport remains
the ordinary local path.

Target configuration schema v2 (ADR-0044 amendment) makes the class explicit:
each target has an `executionClass` and a `kind` from a closed list, and the
kind limits the declared boundary. `packages/model-targets` derives
availability from capabilities declared by the host, never from stored flags
or names; `apps/web/src/model-target-area.ts` declares Responses as simulated
or opted in, and the agent kinds and the local model as qualified offline,
launchable only when the host offers an executor for them. A target whose
boundary is `UNCLASSIFIED` is never available. The local JSON adapter reads v1
without writing and preserves its exact bytes before the first v2 publication.

ADR-0049 adds `packages/agent-execution` and `integrations/local-agent-attempts`.
The coordinator plans an agent invocation as digests without I/O, links the
attempt to the durable turn identity, prepares, rechecks, claims execution and
rereads the claim before the injected executor can start a process. An
unknown record names the failed check from a closed list, never content. The
agent store is separate from model-delivery attempts; the turn reference names its
class so recovery reads the right store, even after a start that offers no
agent.

ADR-0050 adds `integrations/agent-process`, used by both agent adapters for the
confined run tree, the explicit environment, executable qualification by
version and digest, and the process-group runner with lingering and workspace
checks. The Codex and Claude Code lists each hold one reviewed release; any
other installation, an automatic update included, does not qualify.

The conversation turn routes by class (ADR-0045 amendment). Agent targets go to
`AgentExecution` only for kinds the host offers through
`apps/web/src/execution-host.ts`; `apps/web/src/agent-executors.ts` builds real
executors behind an exact opt-in and a digest check. Answers keep their class:
General provenance has optional `executionClass` and `reportedModel`, and
project answers use `AGENT_EXECUTION:<name>` source labels, read through
`apps/web/src/generated-source.ts`.

ADR-0051 adds the local model as a third boundary, beside model delivery and
agents, with three modules. `packages/local-model-execution` owns the port, the
fixed limits, the outcomes, the coordinator and the attempt contract.
`integrations/llama-server-loopback` speaks only HTTP: one non-streaming
`POST /v1/chat/completions` to a numeric `127.0.0.1` or `::1` address with an
explicit port, with no proxy, redirect or fallback.
`integrations/local-model-run-attempts` is the separate append-only,
hash-chained attempt store, which holds digests only. The target is offered only
when `AI_WORKSPACE_LOCAL_MODEL_ENDPOINT` is set at start and must declare the
`LOCAL_ONLY` boundary, which is the user's declaration. Only for this class and
boundary is pseudonymization skipped; the data policy and the block on reserved
material stay active, and the exemption is written into the attempt. The turn
reference carries class `LOCAL_MODEL`, and recovery reads only the local store.
`ModelDelivery` and the API attempt store are not generalized. See the
[local model boundary](../development/local-model-boundary.md).

The OpenAI attempt-semantics work also changes no production graph. A test-owned OpenAI attempt store,
fake create adapter, and canonical snapshot harness measure the ADR-0027
application-level at-most-once state machine. The local exposure claim precedes
the fake adapter call; unfinished exposure/acknowledgement recovers as
`UNKNOWN_AFTER_EXPOSURE` and cannot resend. The accepted semantics do not
export the store or adapter and add no persistence, network, credential,
response, application, API, GUI, routing, fallback, or execution edge.

Session ingestion contracts are provider-neutral. The first Codex adapter
translates one controlled JSONL subset at the integration boundary. Imported
events remain untrusted historical evidence and do not enter active memory or
an execution path. These choices are recorded in ADR-0005 through ADR-0007.

Real local transcripts enter through a second adapter behind the same port,
under a distinct `claude-code-local` source type, so the reviewed synthetic
corpus and every already-imported session keep their exact meaning. The
tolerant reader is permissive about record and block shapes and strict about
accounting: unrecognized blocks become `UNKNOWN` evidence, skipped records are
counted per reason in the import report, skipping emits no event so re-import
stays idempotent, and an unparsable record is tolerated only as the final line
of a live transcript. Discovery is a separate metadata-only port over one
explicitly named non-recursive directory, so listing candidates cannot read a
conversation. Restricted-data screening keeps its position ahead of persistence
and the provider-neutral core stays fail-closed on what it receives; it scans
overlapping windows so a transcript larger than the detector input limit is
screened completely instead of failing opaquely. For this source type the reader
classifies each record through a second port that reports a category instead of
throwing, and excludes a contaminated record from both the events and the source
content it returns, so the import is partial, counted as
`RESTRICTED_DATA:<category>`, and reported separately from ordinary skips.
ADR-0029 records this reversal of the synthetic-only posture and ADR-0030 the
per-record screening that made it usable.

Historical retrieval is also behind domain-owned ports. The initial adapter
scans validated canonical project sessions and General events with explicit
tagged scope and
resolves artifact-backed payloads through an integrity-checking read port. The
provider-neutral use case can now compose an explicit set of up to 100
registered project IDs and 10,000 canonical events, merge deterministic matches
before one global limit, and reject inconsistent or partial scope. `GENERAL_ONLY`
works without projects; project-only APIs and CLI remain unchanged and exclude
General. The GUI enriches project results with safe name/ID and requires an
explicit project selection before existing event/source routes are used. Raw source artifacts
are opened only after explicit user action. Artifact-backed conversation moments
are resolved through their conversation and event, and their integrity-checked
local file is read only on the reader's request. ADR-0008 records the bounded
literal-search strategy and the triggers for selecting an index; ADR-0018,
ADR-0019, and ADR-0020 record General scope, persistence, and additive project
links. Scoped retrieval validates every configured link against its exact
General event/hash and registered target before returning results. General
results may expose immutable link metadata or use an explicit associated-project
filter, but retain `GENERAL` scope; project-only routes remain isolated.

The General-link scale work adds no production edge. Its development-only script composes the
existing domain services, atomic adapters, and search use case against private
temporary synthetic state, reports aggregate counts/bytes/timings, and deletes
the state. Two predeclared REFERENCE runs observed identical counts, zero
known-item misses, sub-threshold timing, and less than 2.4% pressure on every
bound. Decision `NO_CHANGE` retains canonical scans; no index ADR, package,
facade, GUI route, background task, or semantic boundary was added.

The entity-candidate work likewise adds no production edge. Its development-only script owns
bounded standard-syntax and exact-alias candidate adapters plus a fixed
English/Italian exact UTF-8 corpus. It imports the existing Restricted detector
only for regression equivalence, emits aggregate non-echoing measurements, and
has no export from `packages/privacy-gateway`. Two identical runs classify
exact aliases `ADOPT_FOR_REVIEW` and standard/combined candidates `REFINE`.
Any production review surface still requires an ADR, explicit user review, and
a new facade/GUI boundary; no candidate reaches transformation or delivery.

ADR-0023 adds only that narrow boundary for exact `CUSTOMER` aliases. The
provider-neutral privacy-gateway contract consumes a transient bounded
dictionary and the recomposed exact Context Pack, then returns non-echoing
current-hash UTF-8 ranges as `SUGGESTED_NOT_REVIEWED`. The loopback facade and
GUI keep candidates unselected and confirmation only prepares the existing
schema-v1 review form. `PROJECT` remains excluded pending the planned v2
review/mapping compatibility corpus; schema-v1 mapping and custody-envelope
contracts are unchanged.

ADR-0024 adds a separate mapping/review schema v2 for confirmed `PROJECT`
spans. Customer-only reviews continue to write schema v1; any confirmed project
span selects v2 explicitly. Version-dispatched readers retain permanent v1
bytes and reject downgrade, mixed-version identity, incoherent entity tokens,
and unsupported versions. New v2 encrypted mapping documents authenticate the
mapping schema with their exact scope; mapping-set identities remain immutable
and distinct. The independent passphrase-wrapped custody envelope remains
schema v1 and no state is migrated or re-encrypted.

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
