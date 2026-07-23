# AI Workspace

AI Workspace is an open-source, local-first control plane for working with
multiple AI agents and language models.

It aims to preserve project knowledge across tools, build the smallest useful
context for each task, support reliable handoffs between agents, and protect
sensitive data before it reaches external models.

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
and service boundaries are introduced through explicit architectural
decisions.

## Documentation

- [Public design document (English)](docs/AI_WORKSPACE_DESIGN_PUBLIC_EN.md)
- [Documento di progettazione (Italiano)](docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md)
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

Do not use real or private transcripts, credentials, customer data, mapping
material, or recovery secrets. The current restricted-data screening is
deliberately narrow and is not suitable for production data.

## GUI-first journey

The GUI provides English and Italian presentation and guides the user through a
local, inspectable workflow:

1. read the graphical homepage dashboard for workspace health, coverage, and
   the next area requiring attention;
2. capture a project-free question in General Inbox or register a local Git
   repository;
3. import bundled fictional evidence, search it, and inspect its verified
   source;
4. curate source-linked active memory and manage a Work Item;
5. preview and create an immutable handoff, then inspect drift and prepare a
   successor;
6. inspect effective instructions, agent profiles, and deterministic bounded
   Context Packs without installing or executing them;
7. preview privacy policy decisions and reviewed reversible
   pseudonymization;
8. inspect strict local output restoration and the separate non-content privacy
   decision audit.

Imported evidence remains visibly `UNTRUSTED`. Curated state remains explicitly
user-authored or user-configured. Previewed instructions, profiles, and Context
Packs are not executable authority.

Start with the
[GUI-first journey guide](docs/user-guide/gui-first-journey.md). Focused guides
cover:

- [the graphical workspace dashboard](docs/user-guide/workspace-dashboard.md);
- [project registration](docs/user-guide/project-registry.md),
  [session ingestion](docs/user-guide/session-ingestion.md), and
  [historical search](docs/user-guide/historical-search.md);
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
- support for real or private transcript ingestion;
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
