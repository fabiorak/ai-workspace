# Sprint 5 — Hand Off One Work Item Across Agents

**Epic:** E4 — Handoff and Cross-agent Resume  
**Milestone:** M3 — Core MVP alpha  
**Status:** planned  
**Cadence:** two-week timebox  
**Dependency:** Sprint 4 completed with its committed acceptance criteria

## Sprint goal

Allow a first-time user to capture one explicit software Work Item, generate a
neutral source-linked handoff from curated project state, and demonstrate with
synthetic evidence that a second supported agent can take the expected first
action without reading the full originating session.

## User story

As a developer switching coding agents, I want to hand over one active
objective with bounded repository state, selected memory, provenance, trust,
and a concrete next action so that the receiving agent can resume correctly
without replaying the complete previous conversation.

## Guided demonstrable workflow

```text
ai-workspace work create --project <project-id> \
  --objective "Synthetic example: update the runtime compatibility check" \
  --source-event <event-id>
  -> create one explicit PROPOSED Work Item with USER_CURATED objective sources

ai-workspace work activate <work-item-id> --project <project-id> \
  --source-event <event-id>
  -> explicitly make the Work Item ACTIVE without inferring a current task

ai-workspace work show <work-item-id> --project <project-id>
  -> show objective, lifecycle, sources, and available handoff actions

ai-workspace handoff create --project <project-id> \
  --work-item <work-item-id> \
  --memory <memory-id> \
  --next-action "Inspect the synthetic compatibility fixture" \
  --source-event <event-id>
  -> capture bounded Git state and selected active memory
  -> preserve provenance and trust per section
  -> write a new immutable handoff without executing an agent

ai-workspace handoff show <handoff-id> --project <project-id> \
  --work-item <work-item-id>
  -> render the neutral task packet and exact source-inspection commands

ai-workspace session import --project <project-id> \
  --source claude-code --file <synthetic-resume-session.jsonl>
  -> import the controlled second-agent response as UNTRUSTED evidence

ai-workspace handoff evaluate <handoff-id> --project <project-id> \
  --resume-session <session-id> --expected-event <event-id>
  -> record whether the expected first action occurred
  -> report elapsed-time and context-size baseline methods separately
```

The exact command grammar may be refined during implementation. The review
must preserve this discoverable journey, require explicit IDs, and never
invoke a model, agent, command, or network service automatically.

## Committed backlog

### S5-01 — Freeze the Core MVP handoff boundary

Use ADR-0010 to align domain vocabulary and prevent later document scope from
expanding the first cross-agent workflow.

Acceptance criteria:

- the Work Item is the aggregate root for objective state and handoff history;
- every Work Item and handoff belongs to exactly one registered project;
- project evidence and active memory remain independently owned and referenced;
- `repositoryId` is migrated to `projectId` before Work Item persistence;
- no command infers an implicit current Work Item;
- public design distinguishes the software Core MVP from later document and
  mixed-repository Work Item extensions.

### S5-02 — Spike the second-provider boundary before freezing formats

Run a time-boxed, offline spike against a deliberately small synthetic Claude
Code fixture and record only the stable subset required for resume evaluation.

Acceptance criteria:

- fixtures contain no private transcript, user identity, credential, local
  path, or provider account metadata;
- the spike compares Codex and Claude Code records against canonical session
  events without changing the provider-neutral event model prematurely;
- unsupported records fail closed and remain recoverable from raw artifacts;
- provider-specific fields remain inside the adapter;
- the spike ends with an explicit accept, adapt, or defer decision before the
  handoff serialization contract is accepted;
- no network or live model invocation is required.

### S5-03 — Persist minimal Work Item objective state

Replace the scaffold with bounded provider-neutral Work Item use cases and a
local persistence adapter selected by an ADR before implementation.

Acceptance criteria:

- create, show, list, activate, block, complete, and reopen rules are explicit;
- objective creation and meaningful transitions are attributable and linked
  to same-project canonical source events;
- project and Work Item IDs are opaque, content-independent, and never inferred;
- corrections and lifecycle history are additive;
- concurrent writes fail instead of losing state;
- malformed, unsupported, or cross-project state fails closed with recovery;
- no active memory, transcript payload, Git diff, or handoff body is copied
  into Work Item state.

### S5-04 — Define neutral handoff contracts with section-level trust

Create provider-neutral handoff generation and inspection contracts after the
provider spike.

Acceptance criteria:

- handoffs are immutable snapshots with schema version, handoff ID, Work Item
  ID, project ID, creation attribution, timestamp, and predecessor link;
- sections cover objective, repository snapshot, selected memory, known
  failures, test state, relevant files, next action, and source references;
- every section declares origin, trust/curation/verification metadata, and
  whether content was observed, user-authored, or imported;
- `UNTRUSTED` evidence is never rewritten as instruction or merged with
  interface guidance;
- memory inclusion is explicit and active-only by default;
- generated packets are bounded, deterministic for fixed inputs, terminal-safe,
  and available as stable JSON plus a portable human-readable representation;
- creating a handoff never mutates evidence, memory, repository files, or an
  older handoff.

### S5-05 — Capture and validate bounded repository resume state

Connect handoff generation to local Git inspection without turning the packet
into a repository archive.

Acceptance criteria:

- snapshot includes branch, HEAD, dirty status, bounded changed-path metadata,
  and explicitly recorded test observations where supplied;
- no file contents, patch, untracked secret, remote credential, or unrestricted
  command output is included by default;
- handoff inspection reports when current HEAD or dirty state differs from the
  captured snapshot;
- observed repository state is labeled separately from verified claims;
- validation is read-only and scoped to the Work Item's registered project;
- stale state produces recovery guidance rather than silently refreshing the
  immutable handoff.

### S5-06 — Add the controlled Claude Code ingestion adapter

Implement only the synthetic, reviewed subset approved by S5-02.

Acceptance criteria:

- adapter maps supported records to the existing canonical event vocabulary;
- import retains exact raw bytes as immutable artifacts and marks events
  `UNTRUSTED`;
- stable IDs and append-only idempotency match the Codex ingestion contract;
- unsupported, malformed, truncated, restricted, and changed-prefix inputs
  fail distinctly and without leaking content;
- Codex behavior and canonical storage remain unchanged;
- help and errors state that pre-release support is narrow and synthetic-only.

### S5-07 — Expose a self-guiding work and handoff CLI

Implement the guided workflow without agent execution or hidden selection.

Acceptance criteria:

- root and contextual help connect history, memory, Work Items, handoffs, and
  second-agent evaluation with copyable synthetic examples;
- every command requires explicit project and object scope where ambiguity is
  possible;
- handoff creation previews or clearly states included sections, trust labels,
  bounds, and immutable effect;
- sensitive objective, next-action, and note inputs support stdin so they need
  not enter shell history;
- human output is terminal-safe and JSON output has stable machine fields;
- empty, stale, corrupt, cross-project, unsupported-provider, and invalid-state
  failures are distinct and actionable;
- no command invokes an agent or sends project data over a network.

### S5-08 — Prove the synthetic cross-agent resume and close M3

Exercise the complete workflow in isolated local state and publish a
reproducible comparison with full-session replay.

Acceptance criteria:

- independent CLI invocations register, import Codex evidence, curate active
  memory, create a Work Item, generate and inspect a handoff, import a synthetic
  Claude Code resume, and evaluate the expected first action;
- negative tests cover project isolation, stale Git state, invalid lifecycle,
  corrupt storage, source trust, terminal controls, and unchanged source bytes;
- the expected first action is defined before evaluation and checked against a
  canonical source event rather than inferred by a model;
- full-session and handoff inputs are measured in exact UTF-8 bytes; any token
  conversion is labeled as an estimate with its method;
- elapsed time uses a documented manual or deterministic harness procedure and
  does not claim general productivity impact;
- README, architecture, threat model, user guide, project plan, roadmap, sprint
  index, ADR index, review, retrospective, and handoff agree on delivered state;
- `npm ci`, `npm run check`, dependency audit, isolated demo, and public-fixture
  scans pass before M3 is marked complete.

## Out of scope

- live Codex, Claude, model API, gateway, network, or subprocess agent execution;
- automatic objective extraction, memory selection, summarization, next-action
  generation, grading, or trust promotion;
- Context Builder, token-budget optimization, semantic retrieval, embeddings,
  caching, or context-pack APIs from E6;
- multi-agent orchestration, routing, worktrees, planner/reviewer roles, or
  automatic fallback;
- document, mixed-repository, requirements, compliance, or report Work Items;
- instruction, agent, skill, tool, privacy-policy, anonymization, telemetry, UI,
  HTTP, MCP, database, search-engine, or background-worker additions;
- real/private transcripts, credentials, customer repositories, or live
  provider-format discovery;
- treating a successful synthetic scenario as a production-readiness or broad
  agent-quality claim.

## Planning decisions

- Sprint 5 begins only after Sprint 4 is complete; planning it does not change
  Sprint 4 scope or status.
- Work Items own objectives and handoff history; projects own evidence and
  active memory.
- The first handoff is explicit, immutable, additive, and section-source-linked.
- A neutral task packet is not yet an E6 context pack and carries no automatic
  execution semantics.
- The second-provider spike precedes format acceptance and uses synthetic local
  fixtures only.
- Resume evaluation checks a predeclared first action from canonical evidence;
  no model grades another model.
- Exact bytes are the primary context-size measure; token counts are estimates.

## Dependencies and sequencing

```text
Sprint 4 complete
  -> S5-01 aggregate boundary + S5-02 provider spike
       -> S5-03 Work Item state + S5-04 handoff contracts + S5-06 adapter
            -> S5-05 repository validation + S5-07 guided CLI
                 -> S5-08 acceptance, measurement, docs, and M3 close
```

Parallel work is allowed only after shared contracts are reviewable. The
second-provider spike is a gate, not a promise to accept the sampled format.

## Risks and mitigations

| Risk                                          | Mitigation                                                           |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Handoff becomes a trusted prompt              | Preserve origin and trust per section; never auto-execute            |
| Project-global task state becomes ambiguous   | Require explicit Work Item and project IDs                           |
| Provider sample freezes canonical events      | Time-box the spike and keep provider fields in the adapter           |
| Document scope delays Core MVP                | Limit the slice to software Work Items and defer document extensions |
| Packet leaks repository or transcript content | Default to metadata and explicit bounded selection                   |
| Stale Git state misleads the receiver         | Capture immutable state and report drift on inspection               |
| Synthetic success is overclaimed              | Publish method and limitations; do not infer general productivity    |
| Metrics optimize estimated tokens             | Use exact bytes as primary and label token conversion                |

## Verification plan

```bash
npm ci
npm run check
npm audit --audit-level=high

npm run cli -- help
npm run cli -- work create --project <project-id> \
  --objective "Synthetic resume objective" --source-event <event-id>
npm run cli -- work activate <work-item-id> --project <project-id> \
  --source-event <event-id>
npm run cli -- handoff create --project <project-id> \
  --work-item <work-item-id> --memory <memory-id> \
  --next-action "Inspect the synthetic fixture" --source-event <event-id>
npm run cli -- handoff show <handoff-id> --project <project-id> \
  --work-item <work-item-id>
npm run cli -- session import --project <project-id> \
  --source claude-code --file <synthetic-resume-session.jsonl>
npm run cli -- handoff evaluate <handoff-id> --project <project-id> \
  --resume-session <session-id> --expected-event <event-id>
```

The review begins from root help, uses isolated local state and synthetic
fixtures, and demonstrates recovery from stale repository state and a
cross-project reference. It must show the full-session byte baseline before
showing the handoff result.

## Definition of done

Sprint 5 is complete only when:

- Sprint 4 is completed and all S5-01–S5-08 criteria pass;
- one explicit Work Item is handed from synthetic Codex evidence to a
  controlled Claude Code resume fixture;
- the receiver's expected first action is proven without full-session replay;
- every packet section retains source and trust metadata;
- handoff creation and inspection never execute imported content or an agent;
- context and elapsed-time comparisons publish exact methods and limitations;
- Core MVP documentation excludes later document and context-optimization
  success criteria;
- M3 is marked complete only after review and retrospective evidence is
  appended without rewriting this commitment.

## Execution log

### 2026-07-10 — S5-01 boundary aligned

- migrated the Work Item scaffold from `repositoryId` to `projectId` before
  persistence;
- removed `repositoryType` from Work Item state so the Core MVP contract does
  not imply document or mixed-repository support;
- retained repository classification as a separate Project Registry concern;
- confirmed that the English and Italian public designs already distinguish
  the first software-only Work Item from later document and mixed-repository
  extensions;
- kept objective state separate from project-owned evidence and active memory;
  persistence, lifecycle use cases, source links, and handoff history remain
  S5-03 and later work.

### 2026-07-11 — S5-03 domain lifecycle defined

- accepted ADR-0011 before persistence implementation;
- added bounded provider-neutral create, show, list, activate, block, complete,
  and reopen use cases with explicit project and Work Item IDs;
- required `LOCAL_USER` attribution and canonical same-project source events
  for creation and every lifecycle transition;
- made objective state immutable and lifecycle corrections additive;
- exposed a versioned store boundary so stale concurrent transitions fail;
- kept active memory, transcript payloads, Git diffs, and handoff bodies outside
  Work Item state.
