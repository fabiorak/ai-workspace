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
- [ADR-0009: Use atomic operation logs for active memory](0009-use-atomic-operation-logs-for-active-memory.md)
- [ADR-0010: Scope handoffs to Work Items within projects](0010-scope-handoffs-to-work-items-within-projects.md)
- [ADR-0011: Use atomic operation logs for Work Items](0011-use-atomic-operation-logs-for-work-items.md)
- [ADR-0012: Store handoffs as immutable JSON files](0012-store-handoffs-as-immutable-json-files.md)
- [ADR-0013: Normalize handoff provenance with lossless source references](0013-normalize-handoff-provenance-with-lossless-source-references.md)
- [ADR-0014: Compose structured instructions with explicit precedence](0014-compose-structured-instructions-with-explicit-precedence.md)
- [ADR-0015: Use a loopback built-in web host for the first GUI](0015-use-a-loopback-built-in-web-host-for-the-first-gui.md)
- [ADR-0016: Use a source table for future Context Pack metadata](0016-use-a-source-table-for-future-context-pack-metadata.md)
- [ADR-0017: Require an inspectable privacy decision before model delivery](0017-require-an-inspectable-privacy-decision-before-model-delivery.md)
- [ADR-0018: Add a general conversation scope with lexical search first](0018-add-a-general-conversation-scope-with-lexical-search-first.md)
- [ADR-0019: Use separate atomic General conversation documents](0019-use-separate-atomic-general-conversation-documents.md)

- [ADR-0020: Use separate immutable General-to-project links](0020-use-separate-immutable-general-project-links.md)
- [ADR-0021: Use reviewed spans and encrypted local pseudonym mappings](0021-use-reviewed-spans-and-encrypted-local-pseudonym-mappings.md)
- [ADR-0022: Use passphrase-wrapped local mapping keys](0022-use-passphrase-wrapped-local-mapping-keys.md)
- [ADR-0023: Use transient exact customer-alias suggestions](0023-use-transient-exact-customer-alias-suggestions.md)
- [ADR-0024: Use additive schema-v2 project pseudonym mappings](0024-use-additive-schema-v2-project-pseudonym-mappings.md)
- [ADR-0025: Use strict local pseudonymized output restoration](0025-use-strict-local-pseudonymized-output-restoration.md)
