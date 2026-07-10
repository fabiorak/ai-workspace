# ADR-0004: Use the Git executable through a safe adapter

**Status:** accepted  
**Date:** 2026-07-10

## Context

The Project Registry needs authoritative repository roots, branch and revision
state, configured remotes, worktree status, and later worktree relationships.
Reimplementing Git discovery is error-prone, while a JavaScript Git library
would add a dependency and may not cover all installed Git behavior.

Repository paths and configuration are untrusted input. Constructing shell
commands from them would create command-injection risk. Git can also invoke
credential prompts, hooks in some workflows, filters, pagers, or external
helpers unless operations remain deliberately read-only and constrained.

## Decision

Use the installed `git` executable behind a Project Registry-owned inspection
port. The adapter:

- invokes Git with an argument array and no shell;
- uses read-only commands only;
- disables terminal prompts, pagers, and optional locking;
- resolves the repository root through Git and the filesystem's canonical
  path;
- bounds captured output;
- converts expected absent state into explicit `null` values;
- translates process failures into domain-facing inspection errors;
- removes user information from HTTP(S) remote URLs before returning data.

Sprint 1 supports non-bare repositories and linked worktrees. Bare repositories
remain unsupported until a use case defines their required semantics.

## Consequences

- behavior matches the user's installed Git implementation;
- AI Workspace requires Git on the host for software-repository inspection;
- paths never pass through shell parsing;
- command execution still crosses a trust boundary and requires targeted tests;
- Git version compatibility must be documented and tested over time;
- alternative implementations can replace the adapter without changing the
  Project Registry use cases.
