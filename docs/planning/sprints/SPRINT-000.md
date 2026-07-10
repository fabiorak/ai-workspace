# Sprint 0 — Engineering Baseline

**Epic:** E0 — Product and engineering foundation  
**Milestone:** M0 — Engineering baseline  
**Status:** completed  
**Cadence:** initial two-week timebox
**Completed:** 2026-07-10

## Sprint goal

Establish a documented, secure, and reproducible engineering baseline from
which E1 Project Registry can be implemented as a vertical increment.

## Expected outcome

A contributor can clone the repository, install pinned dependencies, run one
command to validate the workspace, understand the initial product and domain
boundaries, and inspect the decisions and security assumptions that govern the
next sprint.

## Committed backlog

### S0-01 — Define the initial product slice

Document the primary persona, job to be done, MVP hypothesis, success criteria,
and explicit non-goals.

Acceptance criteria:

- one primary persona and workflow anchor are stated;
- MVP success can be evaluated through observable behavior;
- later-stage features are explicitly excluded from the first MVP.

### S0-02 — Record foundational architecture decisions

Accept ADRs for the modular-monolith strategy, TypeScript/Node toolchain, and
module boundaries.

Acceptance criteria:

- each decision contains context, decision, and consequences;
- choices deferred to later sprints are explicit;
- decisions preserve local-first and provider-neutral constraints.

### S0-03 — Create a reproducible workspace

Configure Node.js, npm workspaces, strict TypeScript, formatting, linting,
building, and tests.

Acceptance criteria:

- runtime and package-manager versions are declared;
- dependency resolution is locked;
- `npm run check` validates formatting, linting, types, build, and tests;
- at least one domain behavior has an automated test.

### S0-04 — Establish continuous integration

Validate the same quality gate on supported pushes and pull requests.

Acceptance criteria:

- CI uses the declared Node version and `npm ci`;
- CI runs the repository-level quality command;
- dependency caching does not include local workspace data.

### S0-05 — Define the security baseline

Document assets, trust boundaries, principal threats, data classes, and the
minimum controls that apply before the full privacy gateway exists.

Acceptance criteria:

- secrets, private content, metadata, and public data are distinguished;
- untrusted repositories, transcripts, model output, and plugins are treated
  as untrusted input;
- local storage, external model, and tool-execution boundaries are identified;
- logging and fixture rules prohibit sensitive content by default.

### S0-06 — Document the contributor workflow

Replace the development placeholder with reproducible setup and verification
instructions.

Acceptance criteria:

- setup begins from a clean clone;
- individual and aggregate quality commands are documented;
- the ADR and package-boundary conventions are linked.

## Out of scope

- repository scanning behavior;
- an HTTP API or UI implementation;
- database and search-engine selection;
- agent transcript adapters;
- Docker Compose services;
- production release automation.

## Decisions

- Node.js 24 is the initial supported runtime.
- npm workspaces provide package management without a separate monorepo
  orchestrator.
- TypeScript uses strict checking and ESM.
- The Node.js test runner provides the initial test harness without an
  additional runtime dependency.
- ESLint and Prettier enforce static and formatting checks.
- The first executable domain package is `@ai-workspace/core`.
- Framework, database, search, API, and UI decisions remain deferred.

## Verification

Run from the repository root:

```bash
npm ci
npm run check
```

## Sprint review

The committed backlog and its acceptance criteria are complete:

- the product definition narrows the initial persona and MVP hypothesis;
- ADR-0001 through ADR-0003 establish architecture, toolchain, and dependency
  direction;
- `@ai-workspace/core` provides the first pure domain behavior and tests;
- CI mirrors the local `npm ci` and `npm run check` workflow;
- the threat model and data classification establish baseline controls;
- a clean `npm ci` followed by `npm run check` passes;
- `npm audit --audit-level=high` reports zero known vulnerabilities.

No application feature is claimed in Sprint 0. Its demonstrable increment is a
reproducible engineering and governance baseline.

## Retrospective

What worked:

- avoiding an application framework kept E1 choices open;
- using the Node.js test runner removed an unnecessary dependency and native
  installation script;
- running the full clean-install path exposed dependency problems before CI.

Adjustment for Sprint 1:

- validate filesystem and Git access through a thin vertical slice before
  deciding on an API framework or persistence technology;
- add a dependency only when its capability cannot be provided safely and
  clearly by the supported runtime.
