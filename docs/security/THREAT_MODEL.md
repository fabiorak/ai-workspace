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
- preserve non-overridable security constraints in instruction composition.

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

## Review triggers

Review and update this model when:

- a new persistence or search technology is selected;
- a network listener or remote-access mode is added;
- an agent, model, plugin, or tool gains execution access;
- real user transcripts or documents are imported;
- a new data class or regulatory obligation appears;
- a security incident or near miss invalidates an assumption.

## Known residual risks

Sprint 0 does not provide runtime secret detection, storage encryption,
sandboxing, or model-policy enforcement. Until those controls exist, the
repository contains only synthetic fixtures and must not be presented as safe
for importing confidential production data.
