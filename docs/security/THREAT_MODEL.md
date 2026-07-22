# Initial Threat Model

## Scope

This threat model covers the local-first control plane and the initial
cross-agent continuity workflow. It is a baseline for Sprint 0 and must evolve
when persistence, search, agent adapters, model routing, plugins, or remote
access are introduced.

## Security objectives

- keep workspace data local unless a user-authorized policy permits transfer;
- prevent secrets and restricted data from entering logs, indexes, prompts,
  fixtures, and public artifacts;
- preserve the integrity and provenance of imported and derived information;
- prevent untrusted content from silently becoming executable instruction;
- isolate workspaces and enforce least-privilege tool access;
- make security-relevant decisions and failures auditable without logging
  sensitive payloads.

## Assets

- source repositories and documents;
- agent transcripts, prompts, responses, and tool output;
- active memory, decisions, handoffs, and context packs;
- artifacts, indexes, embeddings, and metadata;
- credentials for models, repositories, and supporting services;
- reversible pseudonymization mappings and encryption keys;
- configuration, policies, audit records, and package trust metadata.

## Actors

- the local workspace owner;
- authorized contributors or operators;
- local AI agents and tools;
- external model and service providers;
- package, plugin, and integration publishers;
- an attacker controlling repository content, documents, transcripts, network
  responses, packages, or a local user account.

## Trust boundaries

```text
Untrusted repositories, documents, transcripts, packages, model output
                              |
                              v
                    Parsing and validation
                              |
              +---------------+---------------+
              | Local AI Workspace process    |
              | policy, memory, search, audit |
              +------+-------------+----------+
                     |             |
             Local storage     Tool sandbox
                     |             |
                     +------+- ----+
                            |
                 Explicit model gateway
                            |
                    External providers
```

The host operating system is trusted for the initial local deployment. Content
read from the host is not automatically trusted. External providers, imported
content, generated model output, packages, and tool arguments remain untrusted.

The first GUI adds a browser-to-loopback boundary. Its foreground host binds
only to `127.0.0.1`, validates the request remote address and exact Host,
establishes an opaque cookie through a one-time bootstrap URL, and requires an
exact same-origin Origin plus CSRF token for mutations. A restrictive CSP,
frame denial, no-sniff, no-referrer, local-only assets, bounded bodies, declared
methods and content types, and inert `textContent` rendering reduce DNS
rebinding, CSRF, framing, XSS, and data-exfiltration risks. Non-loopback access,
remote assets, persistent daemon operation, and production packaging remain
forbidden without a new architecture and threat review.

Localization adds no network, remote assets, translation provider, or
server-side preference. Only a supported locale code is stored in browser-local
state; evidence and user-authored content are never translated. Catalog
interpolation validates parameters and dynamic values remain inert DOM text.
Effective-instruction GUI preview accepts only explicit local paths through the
existing bounded fail-closed reader and does not persist, enforce, or execute
instruction text.

Global historical search enumerates only registered projects inside the
authenticated loopback facade. One query is bounded to 100 unique project IDs,
10,000 canonical events, and 100 returned results. Matches are merged before
the limit; any unreadable, corrupt, cross-scoped, or oversized included history
fails the whole query without a partial report or content echo. Results expose
safe project name/ID, never repository paths. Event and artifact reads remain
project-scoped, integrity checked, and reachable only after the user explicitly
selects the result's project. Global results remain inert `UNTRUSTED` evidence
and cannot create cross-project memory or state.

Context Pack preview accepts only project/Work-Item-scoped persisted handoff
identity plus optional explicit instruction bundle paths and bounded numeric
budgets. The browser cannot submit a handoff body or request an inferred latest
packet. Whole-item omission prevents semantic substring truncation; the result
remains inert, in memory, and unavailable to any model or execution gateway.
The synthetic corpus measurement adds no HTTP or persistence surface. It
accepts already-built previews in process, bounds samples, dimensions, items,
budgets, and item bytes, rejects inconsistent accounting without echoing item
content, and labels its output as measurement rather than selection policy.
Disclosure projections add no browser, HTTP, storage, or resolution surface.
They bound IDs, sources, structure depth, nodes, budgets, and representation
bytes; reject unsupported or circular values without content echo; and retain
complete trust/provenance metadata at every experiment-only level. Digests are
identity checks, not authorization, trust promotion, or proof of availability.
The metadata-envelope experiment remains in process. Its accepted source-table
contract is now implemented by production Context Pack schema v2: packet tables
repeat and validate project, Work Item, and handoff scope; retain every
canonical source field and section-specific trust; bound items, tables,
sources, references, and exact bytes; and reject dangling, duplicate,
unreferenced, noncanonical, malformed, cross-scope, inconsistent, or oversized
inputs with one generic non-echoing error. SHA-256 table IDs bind identity but
do not authorize resolution, delivery, or execution. The complete v2 packet is
validated before expansion, and the HTTP facade returns logical expanded
content plus a safe count/byte summary rather than raw reference resolution.
Schema v1 remains explicit and is never reinterpreted as v2.

Agent/skill profile preview accepts one explicit local path only after a
registered project is selected. The adapter bounds bytes, decodes UTF-8
fatally, optionally pins the exact SHA-256 source digest, validates exact schema
keys and project scope, checks enabled-skill, model, tool, context, and
confirmation relationships, and proves canonical re-import. Success returns a
safe basename rather than the full path. Failures use one non-echoing error.
Profile trust is `USER_CONFIGURED` attribution only: declarations never grant
runtime capabilities, resolve availability, install packages, select an agent,
change instruction composition, configure a sandbox, deliver data, or execute.

Profile-governed context preview requires the user to select the profile path,
optional pinned digest, every instruction bundle path, one allowed model, and
one project/Work-Item/handoff-scoped immutable packet. Before composition, the
domain requires exact closure between selected source IDs and the union
declared by the agent and enabled skills; missing and extra sources fail with a
generic non-echoing error. Agent target and byte budgets cannot be overridden
by the HTTP caller. The response retains safe profile digest/name and source
declaration provenance but no full paths. Include/exclude selectors remain
inert descriptive strings and never become filesystem, retrieval, permission,
or sandbox input. The envelope is not persisted, delivered, or executable.

The context-selector measurement route accepts one explicit digest-pinned
profile after project/Work-Item/handoff scope is resolved. Selectors and the
continuity budget come from that profile; callers cannot submit a policy,
budget, handoff body, path/glob interpretation, or retrieval query. The
experiment recognizes only eight exact `handoff.*` strings, rejects legacy or
unknown values and conflicts without echo, and prevents exclusion of objective,
repository, next action, and source references. Results contain safe profile
identity, section trust/source counts, exact bytes, and hashes, but no full
paths or content resolver. They never enter production Context Builder,
persistence, permission, delivery, or execution paths.

The fixed selector continuity-evidence corpus adds no HTTP, GUI, local reader,
upload, or persistence boundary. Manifests and handoffs are repository-owned
synthetic values validated in memory before projection. Complete handoff
SHA-256 pinning prevents post-result ground-truth substitution; exact-answer
uniqueness, project/Work-Item/handoff scope, source-table identity and
navigation, bounded counts/bytes, canonical ordering, and generic non-echoing
failure cover ambiguity, stale input, corruption, controls, and oversized
values. Digests remain integrity identities, not signatures or authority. The
report contains hashes and counts rather than rejected answer content and
cannot authorize retrieval, profile policy, builder input, delivery, or
execution.

GUI active-memory mutations require both the existing browser mutation
controls and explicit canonical event IDs. The domain resolves those sources
inside the selected project before persistence; missing and foreign sources
fail without disclosing foreign content. `USER_CURATED` is displayed as an
attribution state, never as trusted input, executable instruction, or an
automatic promotion from historical evidence.

## Principal threats and baseline controls

### Secret capture and disclosure

Threats:

- credentials are imported from files, environment output, transcripts, or
  command logs;
- error reporting or telemetry publishes raw payloads;
- a context pack sends restricted data to an external model.

Baseline controls:

- ignore environment files, keys, local stores, transcripts, and artifacts;
- use synthetic test data;
- prohibit raw sensitive values in logs and errors;
- require an explicit model-access workflow;
- introduce secret detection before session persistence and model routing.

### Prompt injection and instruction confusion

Threats:

- repository files, documents, historical messages, or search results contain
  instructions that attempt to override system policy;
- generated output is stored as an active decision without verification.

Baseline controls:

- mark retrieved and imported content as untrusted evidence;
- keep immutable evidence separate from curated active memory;
- retain source, status, confidence, and verification metadata;
- never execute commands recovered from history automatically;
- preserve non-overridable security constraints in instruction composition;
- do not treat prompt precedence, delimiters, or instruction text as security
  enforcement;
- enforce tool, filesystem, network, destructive-action, and outbound model
  permissions at deterministic runtime boundaries before those capabilities
  are enabled.
- accept instruction bundles only through explicit selection in the initial
  adapter; do not scan home, repository, provider, IDE, or MCP configuration;
- derive source provenance from the exact selected bytes and optionally require
  a reviewed expected digest before composition;
- reject malformed, oversized, changed, ambiguous, or cross-project bundles
  before producing partial output;
- label local instruction sources `USER_CONFIGURED`, which does not imply
  verified truth, trusted code, or enforceable policy.

Retrieved content remains data even when it contains imperative language.
Delimiting and labeling it reduces instruction confusion but cannot guarantee
that a model will ignore it. The effective safety boundary is independent
capability enforcement plus explicit user authorization, not prompt wording.

### Malicious tool or plugin execution

Threats:

- a tool reads unrelated files, modifies repositories, accesses the network,
  or executes destructive commands;
- a package understates its capabilities or changes after review.

Baseline controls:

- no plugin execution is part of the first MVP;
- future tools declare filesystem, network, and process capabilities;
- sensitive and destructive actions require confirmation;
- packages require provenance and integrity checks;
- execution must be isolated before the Tool Registry is considered complete.

### Workspace boundary failure

Threats:

- data from one workspace appears in another workspace's search, context, or
  handoff;
- local path traversal reaches files outside the registered repository.

Baseline controls:

- make workspace and repository identity explicit in domain records;
- canonicalize and validate paths at the filesystem boundary;
- scope queries and artifacts by workspace;
- add negative isolation tests when persistence is introduced.

### Evidence and memory tampering

Threats:

- imported evidence is changed without detection;
- stale decisions are presented as current;
- a handoff does not match the repository or test state.

Baseline controls:

- use append-only events and content hashes for artifacts;
- track validity, supersession, confidence, and source references;
- validate handoffs against Git and test state;
- make corrections additive and attributable.

### Dependency and supply-chain compromise

Threats:

- a compromised dependency or CI action executes during installation or build;
- dependency drift produces an unreviewed runtime change.

Baseline controls:

- commit the npm lockfile and use `npm ci` in CI;
- keep dependencies minimal and review lockfile changes;
- pin CI actions to major versions initially and evaluate immutable commit
  pinning before release automation;
- run dependency and license review before production releases;
- do not expose secrets to pull-request workflows.

### Local storage compromise

Threats:

- another local process or user reads stored transcripts, keys, or mappings;
- backups expose confidential workspace content.

Baseline controls:

- keep runtime data outside Git and use restrictive filesystem permissions;
- store application credentials in a platform secret store;
- encrypt pseudonymization maps and other designated sensitive stores;
- document backup and deletion behavior before persistent user data ships.

### Entity candidate inference

Threats:

- a heuristic suggestion is mistaken for verified identity or complete PII
  coverage;
- matched values leak through reports, errors, snapshots, or fixture names;
- a false-positive span is transformed without explicit review.

Baseline controls:

- keep Sprint 28 recognizers and corpus development-only with synthetic data;
- report only aggregate counts, hashes, gates, and decisions;
- score exact item/type/UTF-8 ranges and retain adversarial false positives;
- keep candidate suggestions distinct from `USER_REVIEWED` spans;
- require a later ADR, bilingual review surface, and explicit confirmation
  before any candidate can reach the existing transformation contract.

ADR-0023 accepts exact customer aliases and ADR-0024 adds exact project aliases
through an explicit schema-v2 boundary. The production dictionary is
request-scoped and non-persistent; responses omit alias and matched text, every
candidate starts `SUGGESTED_NOT_REVIEWED`, and individual confirmation chooses
schema v2 only when a `PROJECT` span is present. Schema-v1 reads remain
permanent and byte-identical; downgrade, mixed-version identity, unsupported
versions, entity-token disagreement, and implicit migration fail closed.

## Security requirements for upcoming epics

- **E1:** canonical path validation and repository-boundary tests;
- **E2:** secret scanning, sanitized ingestion errors, append-only events, and
  content-addressed artifacts;
- **E3:** workspace-scoped queries, provenance, validity, and injection-safe
  retrieval presentation;
- **E4:** handoff verification and explicit trust labels;
- **E5:** non-overridable constraints and least-privilege tool policies;
- **E6:** inspectable context inclusion and policy-aware caching;
- **E7:** encrypted reversible mappings and per-model data enforcement;
- **E8/E9:** capability sandbox, package integrity, and approval gates.

## Implemented E1 controls

- repository paths are canonicalized and must resolve to directories;
- Git receives path and command arguments without shell interpretation;
- inspection uses read-only commands with terminal prompts, pagers, optional
  locks, and repository-configured filesystem monitors disabled;
- process output is bounded and command execution has a timeout;
- credentials are removed from HTTP(S) origin URLs before persistence;
- human CLI output neutralizes control characters from untrusted metadata;
- registry files are schema-validated, reject duplicate identity/path records,
  and use atomic writes with restrictive permissions;
- project IDs are opaque UUIDs rather than path-derived identifiers.

## Implemented E2 ingestion controls

- the first adapter reads only an explicit user-supplied file and never scans
  Codex state directories;
- source size, record size, event count, UTF-8, schema, ordering, timestamps,
  and required identity fields are validated before persistence;
- raw and extracted content is screened for a conservative set of
  high-confidence restricted credential patterns before artifacts or events
  become visible;
- screening failures report detector category and source position without
  repeating the detected value;
- raw sources and large payloads are immutable exact-byte SHA-256 artifacts;
- canonical events use deterministic IDs, retain source record hashes and
  artifact references, and are always marked `UNTRUSTED`;
- reimport validates the complete stored prefix and rejects mutation or
  truncation instead of rewriting evidence;
- session updates use validated schema-versioned documents, an exclusive lock,
  temporary writes, atomic rename, and restrictive permissions;
- imported commands and tool calls are never executed;
- tests and examples use a fixture authored from scratch with fictional data;
- ingestion performs no network, telemetry, agent, or model access.

## Implemented E3 retrieval controls

- every search uses an explicit project, `GENERAL_ONLY`, or `ALL_SCOPES`
  contract; project event lookup remains scoped to an existing project ID;
- General is never inferred from project selection or represented by a hidden
  Project Registry entry;
- optional session and event-type filters can only narrow that project scope;
- canonical session documents are schema-validated and corrupt data fails
  closed;
- search reads canonical event payloads and does not duplicate whole raw
  transcript matches;
- result count, scanned session count, document size, artifact size, and
  displayed content are bounded;
- every result and opened artifact is visibly marked `UNTRUSTED`;
- snippets are separated from interface guidance and terminal control
  characters are neutralized in human output;
- artifact reads accept only SHA-256 identifiers and verify exact bytes before
  search or display;
- missing, corrupt, oversized, and non-UTF-8 artifacts produce actionable
  failures;
- source bytes are displayed only after an explicit command and are never
  executed, promoted to active memory, or sent to a model;
- retrieval commands are read-only and use no network service or telemetry.

## Implemented General capture controls

- only explicit local-user GUI actions create a conversation or append one
  `USER_MESSAGE`; no provider, agent, model, tool, or background writer exists;
- events bind `GENERAL` scope, `LOCAL_USER`, `USER_AUTHORED`, `UNVERIFIED`,
  `CONFIDENTIAL`, timestamp, exact UTF-8 bytes, SHA-256, and capture provenance;
- the shared restricted detector runs before persistence and rejection reports
  only category and generic recovery;
- schema, exact keys, canonical encoding, ordering, scope, IDs, timestamps,
  bounds, bytes, hashes, and duplicate content are validated before use;
- separate documents use bounded scans, exclusive owner-token locks, `0700`
  directory/`0600` files, flushed temporary writes, atomic rename, and
  owner-only cleanup; there is no edit/delete API;
- corrupt, cross-scope, oversized, noncanonical, incomplete, or integrity-bad
  General state fails all requested scope search without partial matches;
- General evidence is never active memory, a Work Item, instruction, handoff,
  Context Pack, policy, prompt, permission, delivery, or execution input.

## Implemented General-to-project link controls

- link creation requires an exact General conversation, event, lowercase
  SHA-256, explicit registered project, reviewed rationale, and create action;
- current project selection is never treated as consent, and link effect is
  fixed to `LINK_ONLY` with `LOCAL_USER`, `USER_AUTHORED`, `UNVERIFIED`, and
  `CONFIDENTIAL` attribution;
- the shared restricted detector screens rationale before persistence without
  echoing rejected content;
- a separate bounded canonical store validates exact keys, hashes, timestamps,
  duplicate tuples, filenames, modes, locks, temporary state, and total bytes;
- every retrieved link is revalidated against the exact General event/hash and
  registered target; stale, removed, cross-scope, corrupt, or partial state
  fails the complete requested link set without partial results;
- links never mutate evidence or grant ownership, trust, active memory,
  instruction priority, Work Item/Context Pack membership, permission,
  delivery, model access, or execution.

## Implemented E3 active-memory storage controls

- imported evidence remains `UNTRUSTED` and cannot promote itself into active
  memory;
- every creation and lifecycle transition requires same-project canonical
  source links resolved through a read-only adapter;
- active-memory documents repeat project scope internally while filenames use
  a SHA-256 digest of the project ID rather than a caller-controlled path;
- schema, bounds, attribution, UUIDs, revisions, item versions, source shapes,
  and lifecycle transitions are validated before use;
- current state is reconstructed from a logically append-only operation log;
- writes use per-project exclusive locks, `0700` directories, `0600` temporary
  files, flush-before-rename, and atomic publication;
- lock metadata contains an owner token, PID, and timestamp; locks are not
  removed automatically based only on age or PID;
- lock cleanup removes only a file whose owner token still matches;
- corruption and concurrent changes fail closed with recovery guidance that
  does not echo memory content;
- active memory is never executed, sent to a model, or included in a handoff
  automatically.

## Implemented E4 repository snapshot controls

- handoff capture resolves only the canonical path of an explicitly registered
  project and invokes Git without a shell;
- snapshots contain branch, HEAD, dirty state, and at most 100 sorted changed
  path names, but no file content, patch, remote URL, credential, or arbitrary
  command output;
- changed path names remain potentially sensitive metadata and are bounded at
  capture and handoff-contract boundaries;
- validation is read-only, compares current state with the immutable snapshot,
  and reports drift with guidance to create a successor handoff;
- stale state never silently refreshes or mutates an existing handoff.

## Implemented E7 privacy-preflight controls

- ADR-0017 requires an explicit inspectable privacy decision before any future
  model delivery, while the current increment has no delivery consumer;
- a dependency-free provider-neutral module validates one bounded canonical
  project/model-scoped policy and exact item-hash assertions;
- missing assertions default to `CONFIDENTIAL`; model policy can allow at most
  `CONFIDENTIAL`; high-confidence restricted detection always blocks;
- the existing ingestion detector categories and non-echoing error shape are
  preserved through the shared pure detector;
- reports expose item/source identity, trust, hashes, byte accounting, classes,
  categories, decisions, and generic reasons, never content, detected matches,
  surrounding text, or raw policy paths;
- the controlled local reader uses fatal UTF-8, a 256-KiB bound, optional
  lowercase SHA-256 pinning, same-project validation, canonical round trip, and
  safe basename-only output;
- the authenticated loopback route reuses explicit profile composition and
  accepts no caller override for agent, budget, class, or policy maximum;
- no policy, report, audit event, mapping, credential, prompt, or response is
  persisted or sent; no model, SDK, routing, permission, delivery, or execution
  capability exists.

Residual risk: fixed high-confidence patterns can produce false positives and
miss secrets, PII, regulated data, and business identifiers. User-authored
classifications can be incorrect. A reviewable result therefore remains
non-authorizing evidence and requires human review and a later enforced
delivery boundary.

## Implemented E7 reversible-transformation controls

- ADR-0021 requires exact user-reviewed spans rather than claiming automatic
  PII discovery, and binds each span to project, Work Item, handoff, model,
  Context Pack item, exact content SHA-256, entity type, and UTF-8 byte range;
- empty, overlapping, duplicate, dangling, stale, split-code-point,
  cross-scope, noncanonical, and oversized input fails closed before output;
- deterministic HMAC-derived aliases are scoped to one explicit 32-byte key
  and entity type; every byte outside reviewed spans remains unchanged;
- mapping plaintext is validated, bounded, and stored only inside separate
  AES-256-GCM authenticated ciphertext using a fresh 96-bit nonce;
- authenticated additional data binds schema, mapping set, project, Work Item,
  handoff, and model so metadata tampering or cross-scope replay fails;
- schema-v2 mapping ciphertext additionally authenticates the exact mapping
  schema version; legacy v1 ciphertext remains unchanged and version-dispatched
  readers reject downgrade or mixed-version state;
- the adapter requires `0700` directory and `0600` document modes, an exclusive
  owner-token lock, flushed temporary writes, atomic rename, immutable mapping
  identity, complete-state reads, and non-owner lock preservation;
- wrong keys, ciphertext/tag/metadata modification, temporary state, unsafe
  modes, bounds, corruption, and incomplete restore fail without partial
  output or selected-value echo;
- ADR-0022 generates an independent random mapping key per mapping set and
  stores it only inside a separate AES-256-GCM custody envelope; scrypt uses a
  fresh salt and fixed bounded parameters, and authenticated metadata binds
  the envelope to its exact mapping-set identity;
- custody envelopes use private modes, bounded canonical validation,
  owner-token locking, flushed atomic publication, and fail closed for wrong
  passphrases, tampering, unsupported parameters, incomplete state, or unsafe
  permissions without changing existing mapping ciphertext;
- the GUI passphrase is accepted only for the local action, is not returned or
  placed in browser-local state, and its form value is cleared after each
  attempt; plaintext mapping and wrapping keys exist only in process memory;
- a successful round trip remains local review evidence and does not change
  classification, preflight result, permission, model availability, routing,
  delivery, or execution.

Residual risk: passphrase quality and offline retention remain user
responsibilities. Losing either the passphrase or custody envelope makes the
mapping irrecoverable; copying both encrypted stores enables offline guessing,
and the minimum length plus memory-hard KDF cannot make a weak passphrase
strong. The browser field and process memory briefly contain the passphrase,
and process memory briefly contains plaintext keys. A local process with the
same user privileges may read memory or replace files despite filesystem modes
and authentication checks. There is no passphrase reset, escrow, export,
sharing, synchronization, cloud recovery, or existing-mapping re-encryption.

## Implemented E7 local output-restoration controls

- ADR-0025 separates arbitrary output from existing position-based Context
  Pack restoration and requires one authenticated version-dispatched mapping;
- project, Work Item, handoff, mapping-set, and mapping-owned model scope match
  before scanning; callers cannot override schema or model;
- every `[[AW`-shaped construct is validated before replacement, and unknown,
  altered, foreign, conflicting, malformed, or oversized input blocks the
  complete output without partial restored content;
- known whole tokens may repeat or reorder, while all non-token UTF-8 bytes are
  preserved exactly;
- the loopback request remains under the 32-KiB body bound and the GUI limits
  candidate input to 30,000 characters;
- candidate and restored output are not persisted, logged, audited, delivered,
  or added to memory/history/artifacts; passphrase fields clear after attempts;
- decisions, failures, and recovery remain non-authorizing and non-echoing.

Residual risk: candidate text, restored originals, passphrases, and mapping keys
exist briefly in browser or process memory. A same-user local process or
compromised browser can observe them. Exact token ownership does not establish
complete output safety, response authenticity, correct model behavior, privacy
policy approval, or secret/PII completeness.

## Implemented E7 privacy-decision audit controls

- ADR-0026 records only successfully evaluated explicit preflight decisions
  after validation and before returning their report;
- events contain minimum scope/policy provenance, aggregate counts, and
  canonical report digest, never content, item hashes, detected values, paths,
  reports, mappings, secrets, prompts, responses, or restored output;
- a separate per-project aggregate enforces private modes, exact canonical
  schema, fixed 1,000-event capacity, monotonic revisions, unique IDs,
  predecessor hashes, deterministic ordering, and cross-scope rejection;
- owner-token locks, flushed temporary writes, atomic replacement, directory
  flush, and exact reread verification fail closed without partial report;
- incomplete, corrupt, noncanonical, unsafe-mode, stale-lock, capacity, cursor,
  and concurrent-write failures return generic recovery without rejected input
  or local paths;
- authenticated loopback list/detail routes expose bounded read-only evidence
  and no mutation, export, search, or retention controls.

Residual risk: the chain detects internal corruption, gaps, and reordering but,
without an external anchor, cannot prove that a privileged actor did not replace
or truncate the whole store. Metadata and digests remain correlatable local
information. A same-user process may observe memory or replace files despite
filesystem modes. Fixed capacity blocks new reports until explicit recovery;
there is no automatic retention or archive.

## Sprint 33 delivery-authorization evidence

The development-only authorization corpus binds one explicit synthetic intent
to exact audit, policy, profile, model, scope, mapping, expiry, and transformed
request digests. Its in-memory consumer rejects blocked, stale, missing,
altered, expired, replayed, concurrent, and cross-scoped cases before exposing
bytes to a synthetic adapter.

This is not a production control. Failure after byte exposure has an ambiguous
external outcome even when local state is consumed, and a mock receipt cannot
prove provider acceptance after a process crash. Decision `EVIDENCE_ONLY`
therefore adds no persisted grant, bearer token, provider, credential, endpoint,
network, model call, response, retry, routing, delivery, or execution surface.
A future provider-specific threat model must cover idempotency, timeouts,
acceptance receipts, cancellation, replay, and crash recovery before network
access is authorized.

## Sprint 34 OpenAI transport qualification

The offline Responses harness binds one synthetic transformed digest to fixed
`store:false`, no-background, zero-tool request semantics and rejects altered,
stateful, agentic, malformed, or credential-incomplete candidates. It retains
only digests and counts. The official `X-Client-Request-Id` reconciliation
mechanism is not treated as idempotency: timeouts or malformed receipts after
possible exposure remain ambiguous and never trigger automatic retry.

The Codex harness fixes ephemeral, read-only, approval-never, JSONL,
ignore-config/rules, output-schema, and isolated-repository arguments. Fake
command/file events, malformed or oversized streams, nonzero exits, incomplete
turns, altered argv, and killed timeouts fail closed. These flags do not remove
Codex product instructions, repository instruction discovery, reasoning, or
tool-capable agent semantics, so Codex is not accepted as E7 model delivery.

Neither harness loads bearer material or auth files, opens a socket, invokes
Codex or a model, or returns synthetic content in receipts/errors. A future live
probe requires separate authorization, synthetic-only input, process-scoped
credentials, cost bounds, sanitization, and an updated threat model.

## Sprint 35 Anthropic and Claude transport qualification

The offline Messages harness binds synthetic system and transformed-input
digests to a fixed Anthropic version, reviewed model, bounded output, and zero
tools. It rejects altered bytes before exposure and treats stream loss, 429,
529, malformed events, and duplicate create after possible exposure as
ambiguous. Request and message identifiers are not inferred to be idempotency
keys, so no automatic post-exposure retry is authorized.

The fake Claude process harness separates `--bare` API authentication from
managed-login authentication and fixes safe mode, no tools, no persistence,
empty setting sources, strict MCP configuration, permission denial, structured
output, reviewed model, and a cost ceiling. Unexpected tool, MCP, plugin, retry,
result, output-size, exit, timeout, or process-tree state fails closed. Bare
mode does not solve missing API credentials; managed login does not prove that
coding-agent instructions and context are absent from model-visible input.

Neither harness reads auth/configuration, opens a socket, launches Claude, or
returns content in receipts/errors. A live probe requires separate approval,
synthetic input, process-scoped credential injection, fixed cost, isolated
state, non-echo sanitization, and cleanup proof.

## Sprint 36 bounded OpenAI attempt semantics

The offline test-owned harness claims the only application-level create right
before invoking a fake OpenAI adapter. Replay, concurrency, simulated crash,
restart, duplicate completion, late callbacks, malformed/mismatched receipts,
and inspection cannot increase an authorization above one create or schedule a
retry. Unfinished exposure or acknowledgement recovers conservatively as
`UNKNOWN_AFTER_EXPOSURE`; this can abandon a request that never left the
process but prevents automatic duplication.

Canonical attempt snapshots are exact, bounded, and non-content. They retain
only validated scope/state/revision fields and digests. Inspection cannot send,
retry, reuse authorization, or convert uncertainty into provider truth. A
deliberate future create requires a new authorization and explicit acceptance
of duplicate-processing and cost risk.

ADR-0027 does not prove provider exactly-once processing and adds no production
store, adapter, credential, socket, OpenAI request, model call, response, GUI,
routing, fallback, delivery, or execution. A future persistence implementation
must make the exposure claim durable before a provider call and remain safe
against rollback, truncation, corruption, same-user tampering, and crash. A
live conformance probe remains separately authorized and cannot prove
undocumented idempotency.

## Review triggers

Review and update this model when:

- a new persistence or search technology is selected;
- a network listener or remote-access mode is added;
- an agent, model, plugin, or tool gains execution access;
- real user transcripts or documents are imported;
- a new data class or regulatory obligation appears;
- a security incident or near miss invalidates an assumption.

## Known residual risks

The Sprint 2 screen is intentionally narrow and can miss secrets, PII, and
confidential business data. Local session and artifact storage is not
encrypted, stale locks require careful manual recovery, and failed commits may
leave unreferenced immutable artifacts. Active-memory documents are also not
encrypted, and a local process with filesystem access can tamper with data or
locks despite validation and restrictive modes. Sandboxing and model-policy
enforcement also remain unavailable. The repository contains only synthetic
fixtures and must not be presented as safe for importing confidential
production data.
