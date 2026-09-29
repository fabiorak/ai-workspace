# Contributor instructions

## Project status

AI Workspace is an implemented local alpha, not a supported release. Prefer
small changes that preserve its local-first boundaries and align with public
design documents. Offline adapter qualification is not live-provider acceptance.

## Working agreements

- Preserve the local-first and agent-agnostic design principles.
- Do not add a runtime, framework, database, or cloud dependency without an
  Architecture Decision Record (ADR).
- Keep active memory separate from historical search and artifact storage.
- Treat provenance, privacy, and least-privilege access as core requirements.
- Add tests with implementation changes.
- Update user-facing documentation when behavior or setup changes.
- Never commit credentials, anonymization maps, private transcripts, local
  indexes, or generated artifacts.

## Repository conventions

- Runnable applications belong in `apps/`.
- reusable modules belong in `packages/`.
- external-system adapters belong in `integrations/`.
- independently deployed supporting components belong in `services/`.
- Architectural decisions belong in `docs/adr/`.
