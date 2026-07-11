# Sprint 7 — Inspect Effective Instructions Before Agent Execution

**Primary epic:** E5 — Instruction, Agent, and Skill Management  
**Milestone:** M4 — Controlled context beta, first boundary increment  
**Status:** completed
**Cadence:** two-week timebox  
**Dependency:** Sprint 6 completed

## Sprint goal

Define and demonstrate a deterministic, provenance-linked effective
instruction preview that distinguishes non-overridable constraints from scoped
preferences before any instruction can influence an agent execution.

## Evidence and problem statement

The Core MVP can now preserve evidence, curate active memory, maintain Work
Items, and hand one task across supported synthetic agent formats. It does not
yet have a provider-neutral way to explain which configured instructions would
apply to an agent or why one rule overrides another.

The public design proposes global, workspace, project, model, agent, and task
scopes. It also distinguishes non-overridable constraints from overridable
preferences. Those concepts are not executable contracts yet. Implementing a
registry, Prompt Composer, YAML ecosystem, or agent runtime before fixing
source identity, precedence, conflict behavior, and security boundaries would
make later E5 behavior difficult to inspect and unsafe to generalize.

Prompt precedence is not a security boundary. Sprint 7 may describe configured
constraints, but filesystem, tool, network, destructive-action, and external
model permissions remain enforceable only by later deterministic runtime
boundaries.

## User story

As a developer preparing portable agent behavior, I want to preview the exact
effective instruction rules with their source, scope, status, and override
reason so that I can detect forbidden overrides and ambiguity before any agent
or model receives them.

## Committed backlog

### S7-01 — Decide the instruction composition boundary

- compare a provider-neutral structured rule model, opaque concatenated prompt
  text, and provider-native files as the initial contract;
- define source identity, content integrity, scope vocabulary, trust labels,
  rule identity, and deterministic ordering;
- specify constraint and preference semantics, including whether equal-scope
  duplicates are rejected or resolved;
- record precedence and conflict behavior in an ADR before implementation;
- state explicitly which controls are descriptive prompt content versus
  enforceable runtime policy.

### S7-02 — Establish provider-neutral instruction contracts

- add a reusable package for bounded instruction sources and rules;
- support `GLOBAL`, `WORKSPACE`, `PROJECT`, `MODEL`, `AGENT`, and `TASK`
  scopes without adding provider-specific fields to the core model;
- distinguish `CONSTRAINT` from `PREFERENCE` and carry explicit overridability;
- retain source ID, source digest, authored scope, rule position, and content
  provenance through composition;
- reject empty, duplicate, malformed, unsupported, or oversized contracts.

### S7-03 — Compose effective instructions deterministically

- apply the accepted precedence only to overridable preferences;
- prevent lower-level input from replacing a non-overridable constraint;
- expose every rule as active, overridden, or rejected with an explicit reason
  and superseding rule where applicable;
- make fixed-input output and stable JSON byte-for-byte deterministic;
- fail closed on ambiguous identity, invalid scope targets, contradictory
  constraints, or unsupported schema versions.

### S7-04 — Add controlled local bundle ingestion

- accept only explicitly selected, authored-synthetic structured fixtures;
- preserve exact source bytes through a digest and bounded source metadata;
- avoid implicit home-directory, repository, provider, IDE, or MCP discovery;
- reject changed, malformed, restricted, cross-project, or oversized input
  without partial composition or persistence;
- add no parser dependency unless a separate ADR justifies its runtime and
  security cost.

### S7-05 — Expose guided effective-instruction preview

- add a read-only CLI flow with explicit project and bundle selection;
- show effective rules grouped by scope with source, status, override reason,
  and superseding rule;
- provide stable JSON and terminal-safe human output;
- make constraint/preference, trust, and non-enforcement warnings visible at
  the point of use;
- never invoke an agent, model, tool, plugin, instruction text, or imported
  command.

### S7-06 — Prove the synthetic composition workflow

- compose a bounded fixture spanning all accepted scopes and both rule kinds;
- prove deterministic output under repeated independent CLI invocations;
- cover allowed preference override, forbidden constraint override, duplicate
  identity, ambiguity, corruption, bounds, cross-project scope, terminal
  controls, and unchanged source bytes;
- verify that historical evidence and active memory are never auto-promoted
  into instruction sources;
- publish exact fixture construction, limitations, review, retrospective, and
  the next E5 increment recommendation.

## Out of scope

- agent or skill registries, package installation, signatures, marketplace, or
  community distribution;
- agent execution, model calls, provider routing, tool execution, sandboxing,
  permission enforcement, autonomy, approvals, or behavioral grading;
- E6 Context Builder, context packs, retrieval, token budgets, prompt assembly,
  caching, summarization, embeddings, or semantic search;
- GUI, HTTP API, daemon, MCP server, database, service, framework, network
  access, telemetry, or background discovery;
- recursive discovery of `AGENTS.md`, provider-native files, IDE rules, MCP
  configuration, home-directory instructions, or live provider state;
- YAML support or a new parser dependency without an accepted ADR;
- treating prompt text or precedence as enforcement of filesystem, tool,
  network, privacy, deployment, or destructive-action policy;
- real/private instruction files, credentials, customer repositories, or
  captured agent configurations.

## Verification plan

```bash
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
git diff --check
```

The isolated acceptance demo must use a temporary `AI_WORKSPACE_HOME`, an
authored-synthetic project, and reviewed public fixtures. A public-file scan
must find no absolute local path, credential, identity, private instruction,
runtime store, or generated artifact.

## Definition of done

- an accepted ADR fixes the first composition and security boundary;
- the provider-neutral model preserves bounded rule and source provenance;
- composition is deterministic, inspectable, and fail-closed;
- constraints cannot be silently replaced by lower-level input;
- preview identifies active, overridden, and rejected rules with reasons;
- no imported text is executed or promoted from evidence or memory;
- quality, audit, fixture-safety, source-immutability, and isolated-demo gates
  pass;
- review and retrospective are appended without rewriting this commitment.

## Planning decisions

- Sprint 7 is the first E5 boundary increment, not completion of E5 or M4;
- structured synthetic bundles are a controlled contract probe, not a promise
  of the eventual public authoring format;
- effective instruction preview is read-only and has no execution semantics;
- source provenance and conflict explanations are required output, not debug
  metadata;
- no instruction source is trusted merely because it is local, project-scoped,
  user-authored, or higher precedence;
- runtime permissions remain separate from descriptive instruction rules.

## Dependencies and sequencing

```text
Sprint 6 complete
  -> S7-01 boundary ADR
       -> S7-02 contracts + S7-04 controlled bundle adapter
            -> S7-03 deterministic composition
                 -> S7-05 guided preview
                      -> S7-06 acceptance and next recommendation
```

Implementation begins only after the ADR makes equal-scope conflicts,
constraint overrides, source identity, and schema behavior testable. Parallel
work is limited to synthetic fixtures and documentation that do not prejudge
that decision.

## Risks and mitigations

| Risk                                                   | Mitigation                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Prompt precedence is mistaken for security enforcement | Label rules as configured instructions and keep runtime permissions out of scope    |
| Provider-native formats leak into the core model       | Use a provider-neutral rule contract and keep adapters at the boundary              |
| Local or project files are assumed trusted             | Carry explicit trust and provenance without automatic promotion                     |
| Ambiguous precedence silently changes behavior         | Reject unresolved identity and equal-scope conflicts fail-closed                    |
| Broad discovery reads private configuration            | Require explicit synthetic bundle selection and no implicit scanning                |
| E5 expands into registries, E6, or execution           | Gate the sprint on read-only composition preview and preserve the out-of-scope list |

## Execution log

### 2026-07-11 — S7-01 composition boundary accepted

- accepted ADR-0014 after comparing opaque concatenation, provider-native
  canonical files, and structured provider-neutral rules;
- fixed explicit JSON bundles, source digests, scope ordering, preference
  precedence, constraint rejection, equal-scope ambiguity, and kind conflicts;
- separated configured prompt content from enforceable runtime policy.

### 2026-07-11 — S7-02 provider-neutral contracts completed

- implemented bounded sources and rules for all six accepted scopes;
- retained project, target, source ID, SHA-256 digest, trust, position, kind,
  overridability, and content;
- rejected malformed schema, targets, semantics, duplicates, bounds, and
  cross-project sources; the gate passed with 24 test files.

### 2026-07-11 — S7-03 deterministic composition completed

- emitted active, overridden, rejected, and excluded rules with reasons and
  superseding identities;
- applied precedence only to preferences and kept constraint replacement
  visible as rejected;
- proved fixed bytes under source and rule permutations and failed closed on
  equal-scope ambiguity and kind conflict; the gate passed with 25 test files.

### 2026-07-11 — S7-04 controlled local bundles completed

- added an explicit one-source-per-file JSON adapter with no discovery or
  persistence;
- derived source digests from exact bytes and supported reviewed expected
  digest checks;
- rejected changed, unreadable, malformed, extra-field, cross-project, and
  oversized files while preserving source bytes; the gate passed with 26 test
  files.

### 2026-07-11 — S7-05 guided preview completed

- exposed `instructions preview` with explicit project, repeated bundle, and
  optional model, agent, task, and expected-digest selection;
- added stable JSON and terminal-safe human output with source, trust, status,
  reason, superseding rule, and non-enforcement warning;
- proved no instruction persistence or execution; the gate passed with 27 test
  files.

### 2026-07-11 — S7-06 synthetic workflow completed

- authored six public-safe fixtures spanning every scope and both rule kinds;
- proved deterministic composition across reversed file order, allowed
  preference override, forbidden constraint override, unchanged exact bytes,
  and source allowlisting;
- retained historical evidence and active memory outside instruction input;
- completed the quality gate with 28 test files.

## Sprint review

Sprint 7 delivered the first E5 vertical boundary: a user can explicitly select
synthetic structured instruction sources and inspect the deterministic
effective rule set before any agent execution exists. The output explains
active preferences, lower-scope overrides, rejected constraint replacement,
and excluded targeted sources while retaining exact-byte source digests.

The implementation is provider-neutral. Provider, IDE, MCP, home-directory,
and recursive repository discovery were not introduced. The local adapter
accepts a strict JSON schema because it uses the existing runtime and makes the
contract testable without choosing Markdown/YAML authoring or adding a parser.
No instruction, agent, model, tool, historical event, or active-memory item is
executed or auto-promoted.

The six-scope fixture proves composition semantics, not behavioral compliance.
`USER_CONFIGURED` identifies explicit selection and does not mean trusted,
verified, safe, or enforceable. Filesystem, tool, network, privacy, deployment,
and destructive-action controls still require separate runtime policy
boundaries.

## Retrospective

What worked:

- deciding source identity and conflicts before implementation prevented input
  order from becoming accidental precedence;
- computing digests in the adapter avoided trusting self-declared provenance;
- separating composition from local reads made deterministic domain tests
  independent of filesystem behavior;
- running the full quality gate after every backlog tranche exposed workspace
  wiring immediately and kept the final integration incremental.

What changed during implementation:

- the controlled file contract became one source per bundle so each digest
  unambiguously covers the complete selected bytes;
- expected digests became optional repeated CLI inputs for reviewed change
  detection;
- targeted nonmatches remain visible as excluded rules instead of disappearing
  from the explanation.

Next-increment recommendation:

- plan the next E5 slice around immutable versioned instruction-source
  lifecycle and lossless export/re-import before agent or skill registries;
- evaluate native Markdown compatibility only through explicit adapters and
  synthetic fixtures after its parsing and provenance contract is decided;
- keep execution, runtime permissions, E6 Context Builder, model access, and
  GUI out of scope until separately planned.
