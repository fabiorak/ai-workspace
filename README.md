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

1. register and select an existing local Git repository;
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
   deterministic Context Pack whose included and omitted whole items retain
   source identity. The token count is labeled as an estimate only.

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

Sprint 9 extends that same primary GUI with complete active-memory curation.
From an inspected canonical event, users can explicitly create a source-linked
decision, constraint, or failure; browse active or terminal items; inspect
provenance; and verify, supersede, or invalidate additively. `USER_CURATED`
never promotes the linked `UNTRUSTED` evidence to trusted or executable data.

Sprint 10 adds the continuity cockpit: complete Work Item lifecycle plus
transparent handoff preview, immutable creation, history inspection, read-only
Git drift validation, and explicit successor guidance. Preview never writes a
handoff file, and no cockpit action executes or contacts an agent.

Sprint 11 adds an extensible typed localization boundary with complete English
and Italian catalogs, deterministic fallback, validated interpolation, and no
translation service. It also brings effective-instruction composition into the
GUI as an explicit read-only preview. Stable enums, IDs, paths, commands,
hashes, evidence, and persisted content remain unchanged.

Sprint 12 adds the first read-only E6 slice. Context Pack preview combines one
explicitly inspected immutable handoff with optional reviewed effective
instructions, enforces separate exact-byte budgets, and reports whole-item
omissions. It performs no retrieval, truncation, persistence, delivery, model
call, or execution.

Sprint 13 measures that boundary with a deterministic 27-sample synthetic
corpus over continuity, instruction, and budget profiles. Exact reports expose
candidate, included, and omitted content bytes, category retention, fit counts,
and distributions without changing the GUI, selection policy, persistence, or
execution boundary. See the
[budget-pressure report](docs/development/context-pack-budget-pressure-corpus.md).

The completed Project Registry slice can register and inspect local non-bare
Git repositories from the CLI. It records an opaque project identifier,
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

Sprint 2 adds controlled Codex session ingestion for a registered project:

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

Sprint 3 adds project-scoped literal search and explicit source inspection:

```bash
npm run cli -- history search "test failed" --project <project-id>
npm run cli -- history show <event-id> --project <project-id>
npm run cli -- artifact show <artifact-id>
```

Run `npm run cli -- help` for a guided first-use path and contextual examples.
Results remain visibly untrusted, source-linked evidence. Artifact content is
shown only after an explicit command and a successful SHA-256 integrity check.
See the [Historical Search guide](docs/user-guide/historical-search.md).

Sprint 4 added explicit CLI curation of selected evidence as active decisions,
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

Sprint commitments and completed evidence are recorded in the
[sprint archive](docs/planning/sprints/README.md). Search currently scans local
canonical events; it does not select or introduce OpenSearch.

## Contributing

Implementation is in an early pre-release phase. Design feedback and focused,
reviewable proposals are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening a change.

For security-sensitive reports, follow [SECURITY.md](SECURITY.md) and do not
publish exploit details in a public issue.

## License

Licensed under the [Apache License 2.0](LICENSE).
