# Sprint 1 — Register and Inspect a Local Git Repository

**Epics:** E0 — Product and engineering foundation; E1 — Project Registry  
**Milestone:** M1 — Local project catalog  
**Status:** completed  
**Cadence:** two-week timebox
**Completed:** 2026-07-10

## Sprint goal

Allow a user to register, list, and refresh the inspection of a local Git
repository through a CLI while preserving canonical identity, local-only
storage, and safe handling of untrusted paths and Git metadata.

## User story

As a developer using multiple local repositories, I want AI Workspace to
remember a Git repository and show its current branch, revision, remote, and
worktree state so that later sessions and handoffs can refer to the correct
project state.

## Demonstrable workflow

```text
ai-workspace project register /path/to/repository
  -> canonicalize the repository root
  -> inspect Git metadata without a shell
  -> persist a local registry record atomically

ai-workspace project list
  -> show registered repositories

ai-workspace project inspect <project-id>
  -> refresh and display current Git state
```

All commands support `--json` for deterministic machine-readable output.

## Committed backlog

### S1-01 — Define Project Registry contracts

Create the repository inspection model, registered project model, and ports for
Git inspection, persistence, identifiers, and time.

Acceptance criteria:

- domain/application code does not depend on filesystem or Git process APIs;
- registered projects have opaque identifiers and canonical paths;
- registration of an existing canonical path is idempotent;
- inspection refreshes mutable Git metadata without changing identity.

### S1-02 — Inspect local Git repositories safely

Implement an adapter around the installed Git executable.

Acceptance criteria:

- commands are invoked without a shell and without interactive prompts;
- a nested path resolves to the canonical non-bare repository root;
- branch, HEAD revision, origin URL, and dirty state are reported;
- detached HEAD, missing commits, and missing origin are represented safely;
- credentials embedded in HTTP remote URLs are removed before output or
  persistence;
- missing paths and non-Git directories produce actionable errors.

### S1-03 — Persist a local project registry

Implement a schema-versioned JSON registry.

Acceptance criteria:

- the default location is `~/.ai-workspace/projects.json`;
- `AI_WORKSPACE_HOME` can isolate the registry for tests and automation;
- parent directories and files use restrictive permissions where supported;
- writes use a temporary file and atomic rename;
- malformed or unsupported registry files fail closed with a clear error;
- no registry data is committed to the project repository.

### S1-04 — Expose the vertical slice through the CLI

Implement `project register`, `project list`, and `project inspect`.

Acceptance criteria:

- human-readable output communicates identity and current Git state;
- `--json` writes only valid JSON to standard output;
- usage errors and operational failures return non-zero exit codes;
- the CLI has no HTTP framework or database dependency.

### S1-05 — Verify real repository behavior

Exercise the slice using temporary Git repositories.

Acceptance criteria:

- unit tests cover idempotent registration and refresh behavior;
- integration tests cover canonical paths, dirty state, detached HEAD, and
  invalid repositories;
- storage tests cover persistence and malformed input;
- a CLI test covers register, list, and inspect across independent invocations;
- the complete `npm run check` quality gate passes.

### S1-06 — Document setup and security behavior

Document CLI usage, local storage, current limitations, and security controls.

Acceptance criteria:

- a user can run the workflow from the root README;
- the threat model records Git/path controls and residual risks;
- architectural decisions are captured as ADRs;
- the local handoff identifies the Sprint 2 starting point.

## Out of scope

- scanning directories for repositories;
- bare repository support;
- remote repository cloning;
- repository mutation;
- background file watching;
- multi-process registry locking;
- PostgreSQL, OpenSearch, an HTTP API, or a graphical UI;
- session and artifact ingestion.

## Decisions

- The first interface is CLI-first and scriptable with JSON output.
- Git metadata comes from the installed Git executable invoked without a
  shell.
- The first registry is a local schema-versioned JSON file written atomically.
- Project identifiers are random UUIDs and do not disclose local paths.
- Canonical paths establish idempotency within one local registry.
- Repository classification defaults to `SOFTWARE` in this slice.

## Verification

```bash
npm ci
npm run check
npm run build
node apps/cli/dist/main.js project register .
node apps/cli/dist/main.js project list
```

Use a temporary `AI_WORKSPACE_HOME` when demonstrating the commands without
changing the user's normal registry.

## Sprint review

The sprint goal and committed acceptance criteria are complete:

- `project register`, `project list`, and `project inspect` work through the
  CLI with human and JSON output;
- nested paths resolve to a canonical non-bare Git repository root;
- repeated registration is idempotent by canonical path;
- project identity persists while branch, revision, remote, and dirty state are
  refreshed;
- the registry is schema-versioned, validated, private by default, and written
  atomically;
- Git execution does not use a shell and strips HTTP(S) user information;
- tests cover domain behavior, real temporary repositories, storage, and the
  complete CLI workflow;
- `npm ci`, `npm run check`, a manual isolated CLI demonstration, and dependency
  audit pass.

Sprint 1 delivers the first usable vertical slice toward E1 and M1. Directory
discovery and richer repository profiles remain later E1 work.

## Retrospective

What worked:

- domain-owned ports kept Git and JSON details outside the use cases;
- invoking installed Git provided authoritative worktree behavior without a
  new runtime dependency;
- temporary real repositories exposed detached-HEAD and dirty-state behavior;
- CLI-first delivery validated the model without prematurely selecting an API
  framework.

Adjustment for Sprint 2:

- define the append-only session/event contract before selecting persistence;
- use controlled transcript fixtures from one agent adapter;
- preserve raw evidence as artifacts while keeping import idempotent;
- avoid expanding Project Registry discovery unless session ingestion requires
  it.
