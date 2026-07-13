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

- every search and event lookup is scoped to an existing project ID;
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
