# ADR-0001: Start as a modular monolith

**Status:** accepted  
**Date:** 2026-07-10

## Context

AI Workspace spans project discovery, session ingestion, memory, search,
context construction, privacy, model routing, and agent integration. These
areas need clear boundaries, but the first MVP is maintained as one product and
does not yet have evidence for independent deployment or scaling.

Starting with multiple network services would add versioning, deployment,
observability, failure-handling, and local-development costs before the core
cross-agent workflow is validated.

## Decision

Begin with a modular monolith. Domain and application capabilities live in
separate workspace packages with explicit public entry points. Runnable
applications compose those packages. External systems and agent providers are
accessed through adapter contracts.

Supporting components may become independent services only when at least one
of these conditions is demonstrated:

- a distinct runtime or security boundary is required;
- independent scaling is measured and necessary;
- the component has a separate lifecycle or failure domain;
- isolation materially reduces risk;
- an upstream component is already operated as an external service.

## Consequences

- local development and testing remain simple;
- transactions and refactoring can initially cross module boundaries without
  distributed coordination;
- package boundaries require review because the runtime does not enforce
  service isolation;
- deployment independence is deferred;
- extraction remains possible through adapter contracts and package APIs.
