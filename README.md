# AI Workspace

AI Workspace is an open-source, local-first control plane for working with
multiple AI agents and language models.

It aims to preserve project knowledge across tools, build the smallest useful
context for each task, support reliable handoffs between agents, and protect
sensitive data before it reaches external models.

> [!IMPORTANT]
> AI Workspace is currently in the design and early scaffolding phase. There
> is no supported release yet. The repository contains early CLI slices for
> local development and evaluation.

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
