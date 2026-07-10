# ADR-0005: Use a local versioned JSON project registry

**Status:** accepted  
**Date:** 2026-07-10

## Context

Sprint 1 must retain registered repositories across CLI processes. The data set
is initially small, local to one user, and accessed by one command at a time.
Selecting PostgreSQL or another service now would add installation and schema
operations before transactional or query requirements are known.

The registry contains confidential local metadata such as canonical paths and
remote URLs. Partial writes and silently accepted schema changes could corrupt
project identity.

## Decision

Store the initial registry at `~/.ai-workspace/projects.json`, or under the
directory selected by `AI_WORKSPACE_HOME`.

The store:

- uses an explicit schema version;
- validates loaded structure and fails closed on malformed or unsupported
  content;
- writes a complete temporary file and atomically renames it;
- requests directory mode `0700` and file mode `0600` where supported;
- stores opaque UUID project identifiers;
- keeps canonical paths for local idempotency;
- is accessed through a Project Registry-owned persistence port.

Concurrent writer coordination is not part of Sprint 1. Commands are expected
to complete quickly and operate as a single local user.

## Consequences

- the CLI has no database service prerequisite;
- registry contents remain inspectable and recoverable by the user;
- schema migrations must be introduced before changing persisted structure;
- last-writer-wins behavior is unsafe for concurrent processes and remains a
  documented limitation;
- the persistence adapter can later move to a transactional store without
  changing use cases;
- the registry file must never be treated as portable public configuration.
