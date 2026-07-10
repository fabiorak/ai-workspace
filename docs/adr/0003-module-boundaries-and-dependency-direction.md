# ADR-0003: Enforce module boundaries and inward dependency direction

**Status:** accepted  
**Date:** 2026-07-10

## Context

A modular monolith can become tightly coupled if domain concepts directly
depend on databases, agent SDKs, web frameworks, or operating-system details.
AI Workspace must remain local-first and agent-agnostic while supporting
replaceable infrastructure.

## Decision

Use the following dependency direction:

```text
apps
  -> application/domain packages
    -> core contracts and value types

integrations and infrastructure adapters
  -> contracts owned by the consuming domain package
```

Rules:

- `packages/core` contains cross-cutting domain vocabulary and pure behavior;
- capability packages own their use cases and ports;
- provider SDKs, persistence drivers, and frameworks do not appear in core
  domain APIs;
- integrations implement domain-owned ports and translate provider types at
  the boundary;
- applications act as composition roots;
- packages expose supported APIs through their root entry point;
- tests may use adapters directly, but production packages must not import an
  application's internals.

Initial domain vocabulary includes Workspace, Repository, Work Item, Session,
Event, Artifact, Memory Item, Decision, Handoff, Context Pack, Agent, Skill,
Tool, and Source Reference. Only Work Item identity and lifecycle are encoded
in Sprint 0; other models are introduced with their owning epic.

## Consequences

- infrastructure and provider choices remain replaceable;
- some translation code is required at boundaries;
- shared packages must not become dumping grounds for unrelated helpers;
- dependency rules will initially be enforced through review, TypeScript
  references, and package exports;
- automated architectural checks can be added when the package graph grows.
