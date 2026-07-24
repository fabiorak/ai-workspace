# AI Workspace

AI Workspace is an open-source, local-first control plane for working with
multiple AI agents and language models.

It aims to preserve project knowledge across tools, build the smallest useful
context for each task, support reliable handoffs between agents, and protect
sensitive data before it reaches external models.

It runs with **zero external runtime dependencies**: every application, package,
adapter, and the GUI itself are built only on the Node.js 24 standard library.
Installing AI Workspace adds no third-party package to your machine at runtime,
so there is no transitive dependency tree to audit, no supply-chain surface to
monitor, and nothing to update when an unrelated ecosystem package is
compromised. External tooling is limited to development: TypeScript, ESLint, and
Prettier.

> [!IMPORTANT]
> AI Workspace is in an early design and scaffolding phase. There is no
> supported release yet. The repository contains a local pre-release GUI and
> development slices intended for synthetic evaluation.

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

It is not another coding agent. It coordinates the agents and tools you already
use.

## Design principles

- **Local-first:** project data remains local unless explicitly configured
  otherwise.
- **Agent-agnostic:** integrations are adapters, not hard dependencies on one
  provider.
- **Context-minimal:** models receive the minimum sufficient context for the
  current task.
- **Verifiable memory:** persisted knowledge retains provenance, confidence,
  validity, and status.
- **Privacy by design:** redaction, policy enforcement, and auditability are
  architectural concerns.
- **Composable and open:** standard protocols, replaceable storage, plugins,
  and documented APIs are preferred.
- **Zero runtime dependencies:** production code uses only the Node.js standard
  library. A new runtime dependency requires an Architecture Decision Record
  that justifies the added supply-chain, portability, and maintenance surface.

## Core model

AI Workspace separates active memory from historical evidence:

```text
Projects, sessions, files, logs, documents, commits
                         |
              Historical archive/search
                         |
              +----------+----------+
              |                     |
        Search index          Active memory
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
5. expose a minimal UI and MCP search interface;
6. resume work with a different agent without replaying the full session.

Later milestones add instruction and agent management, context optimization, a
privacy proxy, a tool registry, multi-agent orchestration, and document-first
workflows. See [ROADMAP.md](ROADMAP.md) for the phased plan.

## Repository layout

```text
apps/          runnable applications (today: web GUI and CLI)
packages/      reusable provider-neutral domain and application modules
integrations/  replaceable local adapters for agents, storage, and protocols
services/      reserved for independently deployed services (none exists yet)
deploy/        local and production deployment assets
docs/          design, architecture, ADRs, security, and guides
examples/      example configurations and workflows
scripts/       development and maintenance automation
```

The project is a modular monorepo. A directory exists only when something is
implemented in it: anticipated modules are described in the long-term vision
rather than reserved as empty placeholders. Package managers, frameworks, runtime
dependencies, and service boundaries are introduced only through explicit
architectural decisions.

## Documentation

- [Public design document (English)](docs/AI_WORKSPACE_DESIGN_PUBLIC_EN.md)
- [Documento di progettazione (Italiano)](docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md)
- [Long-term vision (English)](docs/AI_WORKSPACE_VISION_LONG_TERM_EN.md) —
  exploratory horizon, not a delivery commitment
- [Visione a lungo periodo (Italiano)](docs/AI_WORKSPACE_VISION_LONG_TERM_IT.md) —
  orizzonte esplorativo, non impegno di consegna
- [Architecture overview](docs/architecture/README.md)
- [Architecture Decision Records](docs/adr/README.md)
- [Product definition](docs/product/PRODUCT.md)
- [Project plan](docs/planning/PROJECT_PLAN.md)
- [Development guide](docs/development/README.md)
- [Roadmap](ROADMAP.md)

## Try the local GUI

The pre-release GUI is the primary user path. It requires Node.js 24 and npm 11.
From the repository root:

```bash
npm ci --ignore-scripts
npm run build
npm run gui
```

The terminal prints a one-time URL similar to
`http://127.0.0.1:<port>/bootstrap/<token>`. Open the complete URL in a local
browser and keep the process running. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop
it.

The host binds only to `127.0.0.1`, chooses an ephemeral port, does not open a
browser automatically, and serves no remote assets. Local state defaults to
`~/.ai-workspace`. For an isolated synthetic evaluation:

```bash
AI_WORKSPACE_HOME=/tmp/ai-workspace-demo npm run gui
```

You can import your own local agent transcripts. They are read on this machine
only, and nothing is transmitted. They are stored unencrypted under
`AI_WORKSPACE_HOME`, so treat that directory as sensitive and never copy it into
a repository, an issue, or a fixture. Do not import credentials, customer or
third-party confidential material, mapping material, or recovery secrets: the
current restricted-data screening is deliberately narrow and is a safety net
rather than a guarantee.

## GUI-first journey

The GUI provides English and Italian presentation and guides the user through a
local, inspectable workflow:

1. use the persistent sidebar to open focused local pages for Dashboard,
   Projects, Evidence, Active memory, Work and handoffs, Privacy, Settings, and
   System status;
2. read the graphical dashboard for workspace health, coverage, and the next
   area requiring attention;
3. capture a project-free question in General Inbox or register a local Git
   repository;
4. import bundled fictional evidence, or list a directory you name and import
   one of your own local Claude Code transcripts, then search the result and
   inspect its verified source;
5. curate source-linked active memory and manage a Work Item;
6. preview and create an immutable handoff, then inspect drift and prepare a
   successor;
7. inspect effective instructions, agent profiles, and deterministic bounded
   Context Packs without installing or executing them;
8. preview privacy policy decisions and reviewed reversible
   pseudonymization;
9. inspect strict local output restoration and the separate non-content privacy
   decision audit.

Imported evidence remains visibly `UNTRUSTED`. Curated state remains explicitly
user-authored or user-configured. Previewed instructions, profiles, and Context
Packs are not executable authority.

Start with the
[GUI-first journey guide](docs/user-guide/gui-first-journey.md). Focused guides
cover:

- [the graphical workspace dashboard](docs/user-guide/workspace-dashboard.md);
- [project registration](docs/user-guide/project-registry.md),
  [session ingestion](docs/user-guide/session-ingestion.md),
  [importing your own local transcripts](docs/user-guide/local-transcripts.md),
  and [historical search](docs/user-guide/historical-search.md);
- [General Inbox](docs/user-guide/general-inbox.md) and
  [active memory](docs/user-guide/active-memory.md);
- [Work Items and handoffs](docs/user-guide/work-items-and-handoffs.md);
- [effective instructions](docs/user-guide/effective-instructions.md),
  [agent and skill profiles](docs/user-guide/agent-skill-profiles.md), and
  [profile-governed context](docs/user-guide/profile-governed-context.md);
- [privacy preflight](docs/user-guide/privacy-preflight.md),
  [reversible privacy transformation](docs/user-guide/reversible-privacy-transformation.md),
  and
  [strict pseudonymized-output restoration](docs/user-guide/pseudonymized-output-restoration.md).

## Current boundaries

All current user surfaces are local and inspectable. The pre-release alpha does
not provide:

- remote access or remote asset loading;
- unattended, recursive, or default-location transcript discovery: only a
  directory you name is listed, one level deep, and only a file you then select
  is read;
- transcript formats other than the documented Codex subset and local Claude
  Code JSONL;
- encryption at rest for imported evidence;
- agent, model, instruction, or tool execution;
- model delivery, routing, or fallback;
- complete secret or personally identifiable information detection;
- automatic candidate selection or implicit authorization;
- cloud synchronization, sharing, escrow, or recovery.

Privacy transformations use reviewed exact spans and encrypted local mappings.
Restoration requires canonical, mapping-owned whole tokens and blocks the entire
output on anomalies. Privacy audit records are separate, project-scoped, and
non-content. These safeguards do not authorize external model access.

Developer and automation interfaces exist for testing and integration, but
user-facing capabilities are considered complete only when available through
the GUI.

## Development

AI Workspace currently requires Node.js 24 and npm 11.

```bash
npm ci
npm run check
```

See the [development guide](docs/development/README.md) for individual quality
commands and workspace conventions. Search currently scans local canonical
events; it does not require or use OpenSearch.

## Contributing

Implementation is in an early pre-release phase. Design feedback and focused,
reviewable proposals are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening a change.

For security-sensitive reports, follow [SECURITY.md](SECURITY.md) and do not
publish exploit details in a public issue.

## License

Licensed under the [Apache License 2.0](LICENSE).
