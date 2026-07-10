# Development Guide

## Prerequisites

- Git;
- Node.js 24;
- npm 11, bundled with the supported Node.js release.

The repository includes `.nvmrc` for compatible Node version managers. Runtime
and package-manager constraints are also declared in `package.json`.

## Set up a clean clone

```bash
git clone https://github.com/fabiorak/ai-workspace.git
cd ai-workspace
npm ci
npm run check
```

Use `npm install` only when intentionally adding or changing dependencies. CI
and reproducibility checks use `npm ci` against the committed lockfile.

## Quality commands

```bash
npm run format:check  # verify formatting
npm run format        # apply formatting
npm run lint          # static checks
npm run typecheck     # strict TypeScript check without output
npm run build         # compile buildable workspace packages
npm run test          # run tests once
npm run test:watch    # run tests during development
npm run check         # run the complete local/CI quality gate
```

## Run the CLI

Build the workspace and invoke the root CLI script:

```bash
npm run build
npm run cli -- project register /path/to/repository
npm run cli -- project list
npm run cli -- project inspect <project-id>
npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file integrations/codex/test/fixtures/session.jsonl
npm run cli -- session inspect <session-id>
npm run cli -- history search "test failed" --project <project-id>
npm run cli -- history show <event-id> --project <project-id>
npm run cli -- artifact show <artifact-id>
```

Add `--json` for machine-readable output. Set `AI_WORKSPACE_HOME` to use an
isolated state directory during development or tests. The default registry is
`~/.ai-workspace/projects.json`; session documents and artifacts use the
`sessions/` and `artifacts/` subdirectories of the same local home.

The committed Codex fixture is fictional and intentionally public. Do not
replace it or extend it with captured user transcripts, even after manual
redaction.

Root and command-specific help are acceptance-tested product interfaces. When
adding a command, keep first-run steps, empty states, suggested next commands,
examples, and recovery guidance aligned with its behavior.

## Workspace layout

- `apps/` contains executable composition roots;
- `packages/` contains domain and application capabilities;
- `integrations/` contains provider and protocol adapters;
- `services/` contains supporting components with justified runtime
  boundaries.

Packages expose supported APIs from their root entry point. Domain packages do
not depend on provider SDKs, databases, or application frameworks. See
[ADR-0003](../adr/0003-module-boundaries-and-dependency-direction.md).

## Adding a package

1. Place the package under the appropriate workspace directory.
2. Add a private `package.json` with an `@ai-workspace/` name.
3. Extend `tsconfig.base.json` and add a build reference when the package emits
   artifacts.
4. Export only the supported public API from `src/index.ts`.
5. Add tests alongside the package in `test/`.
6. Run `npm run check`.

Do not add a framework, database driver, provider SDK, or independently
deployed service without documenting the decision and its boundary.

## Architecture decisions

Material decisions are recorded in `docs/adr/`. New ADRs use the next numeric
identifier and start with `proposed` status. An accepted ADR is updated rather
than silently contradicted; replacement decisions identify the superseded ADR.

## Local data

`.ai-workspace/`, indexes, artifacts, logs, environment files, and local
databases are excluded from Git. Tests and examples must use synthetic data.
Never copy real credentials, private transcripts, customer files, or reversible
pseudonymization mappings into the repository.
