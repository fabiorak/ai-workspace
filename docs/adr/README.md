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
- [ADR-0004: Use the Git executable through a safe adapter](0004-use-the-git-executable-through-a-safe-adapter.md)
- [ADR-0005: Use a local versioned JSON project registry](0005-use-a-local-versioned-json-project-registry.md)
- [ADR-0006: Use atomic append-only session documents](0006-use-atomic-append-only-session-documents.md)
- [ADR-0007: Use a local content-addressed artifact store](0007-use-a-local-content-addressed-artifact-store.md)
- [ADR-0008: Scan canonical session events for initial search](0008-scan-canonical-session-events-for-initial-search.md)
