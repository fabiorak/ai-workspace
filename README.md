# AI Workspace

AI Workspace is an open-source, local-first control plane for working with
multiple AI agents and language models.

It aims to preserve project knowledge across tools, build the smallest useful
context for each task, support reliable handoffs between agents, and protect
sensitive data before it reaches external models.

> [!IMPORTANT]
> AI Workspace is currently in the design and early scaffolding phase. There
> is no supported release yet. The repository contains an early local GUI and
> CLI slices for synthetic development and evaluation.

## Why AI Workspace?

Moving work between coding agents usually means rebuilding context from chat
history, source files, decisions, failed attempts, and test output. That costs
time and tokens, and important details are easily lost.

AI Workspace is intended to provide a vendor-neutral layer for:

- project and session memory with traceable sources;
- global search across conversations, code, documents, decisions, and tools;
- compact, task-specific context packs;
- neutral handoffs between agents and models;
- privacy-aware access to local and cloud models;
- reusable scripts, skills, and automation recipes;
- token, cost, and context-quality measurements.

It is not another coding agent. It coordinates the agents and tools you
already use.

## Design principles

- **Local-first:** project data remains local unless explicitly configured
  otherwise.
- **Agent-agnostic:** integrations are adapters, not hard dependencies on one
  provider.
- **Context-minimal:** models receive the minimum sufficient context for the
  current task.
- **Verifiable memory:** persisted knowledge keeps provenance, confidence,
  validity, and status.
- **Privacy by design:** redaction, policy enforcement, and auditability are
  architectural concerns.
- **Composable and open:** standard protocols, replaceable storage, plugins,
  and documented APIs are preferred.

## Core model

AI Workspace separates active memory from historical evidence:

```text
Projects, sessions, files, logs, documents, commits
                         |
               Historical archive/search
                         |
              +----------+----------+
              |                     |
        Search index           Active memory
              |                     |
              +----------+----------+
                         |
                  Context Builder
                         |
                    AI agent
```

The central domain object is a **Work Item**: an objective connected to a
repository, context, decisions, constraints, agents, outputs, verification,
costs, artifacts, and handoff state.

## Initial roadmap

The first milestone is **Project Memory**:

1. discover and register local repositories;
2. detect Git metadata and acquire agent sessions;
3. persist project instructions, handoffs, decisions, and session summaries;
4. index historical evidence for global search;
5. expose a minimal UI and an MCP search interface;
6. resume work with a different agent without replaying the full session.

Later milestones add instruction and agent management, context optimization,
a privacy proxy, a tool registry, multi-agent orchestration, and document-first
workflows. See [ROADMAP.md](ROADMAP.md) for the phased plan.

## Repository layout

```text
apps/          runnable server, web, desktop, and CLI applications
packages/      reusable domain and application modules
services/      independently deployed supporting services
integrations/  adapters for agents, gateways, and protocols
deploy/        local and production deployment assets
docs/          design, architecture, ADRs, security, and guides
examples/      example configurations and workflows
scripts/       development and maintenance automation
```

The project starts as a simple modular monorepo. Package managers, frameworks,
and service boundaries will be introduced through explicit architectural
decisions rather than assumed by this initial scaffold.

## Documentation

- [Public design document (English)](docs/AI_WORKSPACE_DESIGN_PUBLIC_EN.md)
- [Documento di progettazione (Italiano)](docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md)
- [Architecture overview](docs/architecture/README.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Product definition](docs/product/PRODUCT.md)
- [Project plan](docs/planning/PROJECT_PLAN.md)
- [Development guide](docs/development/README.md)
- [Roadmap](ROADMAP.md)

## Current capabilities

### Start the local GUI

The pre-release GUI requires Node.js 24 and npm 11. From the repository root,
install the locked dependencies, build every workspace, and start the
foreground loopback host:

```bash
npm ci --ignore-scripts
npm run build
npm run gui
```

The terminal prints a one-time URL similar to
`http://127.0.0.1:<port>/bootstrap/<token>`. Open that complete URL in a local
browser once. Keep the terminal process running while using the GUI and press
Ctrl+C to stop it. The host binds only to `127.0.0.1`, chooses an ephemeral port,
does not open a browser automatically, and serves no remote assets.

The header language control offers **English** and **Italiano** before project
onboarding. The choice is stored only in browser-local presentation state;
supported browser language is used when no choice exists, with English as the
deterministic fallback. Switching language does not reload the page, clear
forms, or change persisted workspace data. Imported and user-authored content
is never translated.

Local state defaults to `~/.ai-workspace`. To run an isolated evaluation
without touching normal state, choose a private temporary directory before
starting:

```bash
AI_WORKSPACE_HOME=/tmp/ai-workspace-demo npm run gui
```

The visible journey is:

1. capture a project-free question explicitly in the General Inbox, including
   before any project is registered, then optionally link one exact event to an
   explicitly selected registered project with a reviewed rationale; or
   register and select an existing local Git repository;
2. import the bundled fictional session—never a private transcript;
3. search and inspect `UNTRUSTED` canonical evidence and its verified source;
4. curate source-linked active memory and manage its additive lifecycle;
5. create and transition an explicit software Work Item;
6. preview all bounded handoff sections and exact persisted bytes;
7. create and inspect the immutable handoff, validate Git drift, and prepare a
   successor when state changes.
8. explicitly select reviewed synthetic instruction-bundle paths and preview
   effective instructions, provenance, precedence, exclusions, and conflicts
   without persistence, enforcement, or execution.
9. inspect an immutable handoff, enter exact UTF-8 byte budgets, and preview a
   deterministic schema-v2 Context Pack whose shared canonical source table,
   expanded logical items, and whole-item omissions retain source identity.
   The token count is labeled as an estimate only.
10. select one reviewed synthetic agent/skill profile bundle and inspect its
    canonical portable declarations and digest without installation, selection,
    permission, delivery, or execution.
11. from an immutable handoff, explicitly select that profile, its exact
    declared instruction bundles, and one allowed model; preview the derived
    effective instructions and profile-budgeted Context Pack with provenance,
    without installation, persistence, delivery, or execution.
12. measure one reviewed profile's experiment-only `handoff.*` selectors
    against that immutable handoff, with visible section decisions, safety
    floor, provenance, exact candidate bytes, and profile-budget fit; production
    Context Builder policy remains unchanged.
13. select the same explicit profile-governed inputs plus one same-project,
    exact-model data policy; preview deterministic item classifications,
    hashes, byte accounting, blocked recovery, and detector limitations.
    `REVIEWABLE_NOT_AUTHORIZED` remains local evidence: no data is sent and no
    model permission, delivery, or execution is created.

If the bootstrap URL was already used, stop and restart `npm run gui` to obtain
a new one. If startup reports missing `dist` files, run `npm run build` again.
Repository paths must identify accessible Git worktrees. Corrupt local state
fails closed with recovery guidance; move it aside only after preserving it for
diagnosis. The alpha does not provide remote access, private transcript import,
agent/model/tool execution, handoff evaluation, or instruction execution.

The GUI guides project registration, safe synthetic import, literal evidence
search, canonical event inspection, and integrity-verified source opening. It
binds only to `127.0.0.1`, uses no remote assets or telemetry, and keeps
imported content visibly `UNTRUSTED` and inert. This is a pre-release alpha;
real or private transcripts are not supported. See the
[GUI first-journey guide](docs/user-guide/gui-first-journey.md).

The current GUI also provides:

- source-linked active-memory curation with additive verification,
  supersession, and invalidation;
- explicit Work Item lifecycle and immutable handoff creation, inspection, Git
  drift validation, and successor preparation;
- deterministic effective-instruction preview with provenance, precedence,
  exclusions, conflicts, and no runtime enforcement;
- schema-v2 Context Pack preview with exact UTF-8 category budgets, whole-item
  omissions, canonical shared-source provenance, and lossless expansion;
- portable schema-v1 agent and skill profile inspection with optional SHA-256
  pinning, relationship validation, and canonical JSON round trips;
- profile-governed read-only composition that requires exact instruction-source
  closure, derives agent target and byte budgets from the reviewed profile, and
  returns effective instructions plus an unchanged schema-v2 Context Pack;
- experiment-only profile context selector measurement with an explicit
  eight-section vocabulary, non-excludable safety floor, exact historical
  candidate bytes, and no production policy change;
- model-free selector evidence-retention measurement over six digest-pinned
  synthetic manifests, with exact answer/source availability and separate
  schema-v2 accounting; no candidate policy passes the corpus;
- bounded literal history search across at most 100 registered projects and
  General, with one merge-before-limit result set over at most 10,000 canonical
  events, without an index or OpenSearch;
- a separate bounded atomic General conversation store with immutable
  `LOCAL_USER`/`USER_AUTHORED` questions, exact UTF-8 bytes and SHA-256,
  `UNVERIFIED` state, default `CONFIDENTIAL` handling, and no model response;
- separate immutable `LINK_ONLY` General-to-project provenance documents with
  exact source-hash binding, explicit target/rationale, atomic restrictive
  storage, retrieval annotations and association filtering, without changing
  either evidence scope;
- schema-v1 model data policies with canonical project/model scope, exact item
  content-hash assertions, conservative `CONFIDENTIAL` defaulting, and a
  non-echoing privacy preflight in the English/Italian GUI;
- one shared narrow high-confidence restricted-data detector whose result
  overrides declarations while preserving existing ingestion behavior.

All these surfaces are local and inspectable. Imported evidence remains
`UNTRUSTED`; curated state and profile declarations remain `USER_CURATED` or
`USER_CONFIGURED` attribution, not executable authority. Context Packs and
profile-composition previews are not persisted or delivered; profiles are not
installed, runtime-selected, or executed. See the
[active-memory](docs/user-guide/active-memory.md),
[Work Item and handoff](docs/user-guide/work-items-and-handoffs.md),
[effective-instruction](docs/user-guide/effective-instructions.md),
[agent and skill profile](docs/user-guide/agent-skill-profiles.md),
[profile-governed context](docs/user-guide/profile-governed-context.md),
[context selector measurement](docs/user-guide/context-selector-measurement.md), and
[GUI journey](docs/user-guide/gui-first-journey.md) guides for the current
contracts and limitations. The [General Inbox guide](docs/user-guide/general-inbox.md)
documents project-free capture and search. The [privacy preflight guide](docs/user-guide/privacy-preflight.md)
explains policy inputs, decisions, recovery, and why reviewable is not
authorization.

The development-only [selector continuity evidence report](docs/development/selector-continuity-evidence-retention.md)
records the fixed Sprint 21 corpus, exact results, and `no change` decisions. It
adds no GUI input or user-facing quality score.

The development-only [General link retrieval scale report](docs/development/general-link-retrieval-scale-corpus.md)
records Sprint 25's frozen corpus, two deterministic 240-event/120-link runs,
exact counts, local timing observations, and `NO_CHANGE` index decision. Run
`npm run measure:general-links` to reproduce it; no normal workspace state,
runtime API, GUI behavior, index, delivery, or execution path is added.

The Project Registry can register and inspect local non-bare Git repositories
from the CLI. It records an opaque project identifier,
canonical path, branch, HEAD revision, sanitized origin URL, and worktree state
in a local versioned registry.

```bash
npm ci
npm run build
npm run cli -- project register .
npm run cli -- project list
```

To refresh a project after its Git state changes:

```bash
npm run cli -- project inspect <project-id>
```

Add `--json` to any project command for machine-readable output. Local registry
data is stored under `~/.ai-workspace` by default and is never committed to the
registered repository. See the [Project Registry guide](docs/user-guide/project-registry.md).

The CLI supports controlled Codex session ingestion for a registered project:

```bash
npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file /path/to/session.jsonl
npm run cli -- session inspect <session-id>
```

Repeated imports are idempotent and append-only source growth adds only new
events. Raw evidence and large payloads use immutable SHA-256 artifact
references; imported content remains untrusted and is never executed. See the
[Session Ingestion guide](docs/user-guide/session-ingestion.md).

> [!WARNING]
> The supported Codex schema and restricted-data screen are deliberately
> narrow. They are suitable for synthetic pre-release evaluation, not private
> or production transcripts. No complete secret or PII detection is claimed.

The CLI provides project-scoped literal search and explicit source inspection;
use the GUI's default all-project scope when the project is unknown:

```bash
npm run cli -- history search "test failed" --project <project-id>
npm run cli -- history show <event-id> --project <project-id>
npm run cli -- artifact show <artifact-id>
```

Run `npm run cli -- help` for a guided first-use path and contextual examples.
Results remain visibly untrusted, source-linked evidence. Artifact content is
shown only after an explicit command and a successful SHA-256 integrity check.
See the [Historical Search guide](docs/user-guide/historical-search.md).

The CLI can explicitly curate selected evidence as active decisions,
constraints, and failures:

```bash
npm run cli -- memory add --project <project-id> \
  --type constraint --content "Synthetic runtime constraint" \
  --source-event <event-id>
npm run cli -- memory list --project <project-id>
npm run cli -- memory show <memory-id> --project <project-id>
```

Create an explicit Work Item and immutable handoff:

```bash
npm run cli -- work create --project <project-id> \
  --objective-stdin --source-event <event-id>
npm run cli -- work activate <work-item-id> --project <project-id> \
  --source-event <event-id>
npm run cli -- handoff create --project <project-id> \
  --work-item <work-item-id> --next-action-stdin --source-event <event-id>
```

Use `handoff preview` with the same creation options to inspect the exact
prospective schema-v2 bytes without creating an immutable file. Add
`--baseline-session <session-id>` only when comparing against a named canonical
full-session source; token values remain labeled estimates.

Preview explicitly selected synthetic instruction bundles before any agent
execution:

```bash
npm run cli -- instructions preview --project <project-id> \
  --bundle <synthetic-bundle.json> [--model <id>] [--agent <id>] [--task <id>]
```

The output shows active, overridden, rejected, and excluded rules with source
digests and reasons. It is read-only and does not treat prompt precedence as
runtime permission enforcement. See the
[Effective instruction guide](docs/user-guide/effective-instructions.md).

Memory remains visibly `USER_CURATED`, while linked historical evidence stays
`UNTRUSTED`. Verification, supersession, and invalidation are additive and
source-linked; no command executes evidence or invokes an agent. Sensitive
write values can be read from stdin. See the
[Active Memory guide](docs/user-guide/active-memory.md).
[Work Item and handoff guide](docs/user-guide/work-items-and-handoffs.md).

## Development

AI Workspace currently requires Node.js 24 and npm 11.

```bash
npm ci
npm run check
```

See the [development guide](docs/development/README.md) for individual quality
commands and workspace conventions.

Search currently scans local canonical events; it does not require or use
OpenSearch.

## Contributing

Implementation is in an early pre-release phase. Design feedback and focused,
reviewable proposals are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening a change.

For security-sensitive reports, follow [SECURITY.md](SECURITY.md) and do not
publish exploit details in a public issue.

## License

Licensed under the [Apache License 2.0](LICENSE).
