# ADR-0002: Use Node.js, TypeScript, and npm workspaces

**Status:** accepted  
**Date:** 2026-07-10

## Context

The control plane needs shared domain models, CLI and server entry points,
adapter packages, asynchronous I/O, and an accessible contributor toolchain.
The public design identifies TypeScript and Node.js as the leading backend
candidate. The repository needs a reproducible baseline before framework or
infrastructure decisions are necessary.

Node.js 24 and npm 11 are available in the initial development environment.
npm workspaces cover the current monorepo requirements without an additional
package-manager bootstrap or task orchestrator.

## Decision

Use:

- Node.js 24 as the initial supported runtime;
- TypeScript with strict type checking and ECMAScript modules;
- npm workspaces and a committed lockfile;
- project references for buildable TypeScript packages;
- ESLint for static checks;
- Prettier for deterministic formatting;
- the Node.js test runner for initial unit and integration tests.

The root workspace exposes a single `npm run check` quality gate. CI installs
dependencies with `npm ci` and runs the same command.

Do not add a monorepo task orchestrator until build time or dependency
coordination demonstrates a need. Do not select an application framework in
this ADR.

## Consequences

- contributors need only a supported Node.js installation;
- the initial test setup adds no test-runner dependency;
- the lockfile makes dependency resolution reproducible;
- package scripts and TypeScript references remain understandable without
  orchestration-specific configuration;
- Node.js 22 and earlier are not initially supported;
- a future package-manager migration will require a separate ADR and lockfile
  transition;
- framework, database, and deployment choices remain reversible.
