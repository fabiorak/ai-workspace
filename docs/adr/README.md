# Architecture Decision Records

Use ADRs for decisions that materially constrain the project, including
frameworks, storage engines, protocols, security models, and deployment
boundaries.

Name records `NNNN-short-title.md` and use this minimal structure:

```markdown
# ADR-NNNN: Title

Status: proposed | accepted | superseded

## Context

## Decision

## Consequences
```

## Accepted decisions

- [ADR-0001: Start as a modular monolith](0001-modular-monolith.md)
- [ADR-0002: Use Node.js, TypeScript, and npm workspaces](0002-node-typescript-npm-workspaces.md)
- [ADR-0003: Enforce module boundaries and inward dependency direction](0003-module-boundaries-and-dependency-direction.md)
