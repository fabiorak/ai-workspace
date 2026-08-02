# Roadmap

What AI Workspace does today, and what comes next. Scope and ordering may change
as the architecture is validated.

Two things deliberately live elsewhere. **Why** a technical choice is in force is
recorded in the [Architecture Decision Records](docs/adr/README.md), each with
the evidence it was accepted on. **When** something changed is recorded in the
commit history. Repeating either here produced a document that described the
past more accurately than the present.

## What works today

This is a pre-release alpha. Everything below runs locally, reads and writes
only local files, and makes no network request.

**Projects and evidence.** Register a local Git repository, inspect its Git
metadata, and import agent sessions: the bundled fictional sample, or one of
your own Claude Code transcripts from a directory you name. Imported content is
stored as canonical events with content-addressed source artifacts, stays
visibly `UNTRUSTED`, and is never executed. Records carrying high-confidence
restricted data are excluded whole, counted, and never stored.

**Search.** One tolerant index answers over canonical events and active memory
together, inside a project and across projects and General scopes. It forgives
accents, capitalization, ordinary Italian and English word endings, and single
character typing errors, ranks results by relevance, and states why each result
matched. It runs in process, holds an interactive budget of 150 ms at its
declared bound, and uses no service, no model, and no network.

**Memory and continuity.** Curate source-linked active memory through an
additive lifecycle, manage Work Items, and create immutable handoffs with drift
inspection and successor preparation. Capture project-free questions in the
General Inbox and link chosen General evidence to a project without losing its
`GENERAL` scope.

**Instructions and context.** Inspect composed effective instructions, portable
agent and skill profiles, and deterministic Context Packs with exact UTF-8 byte
budgets, shared source provenance, and declared omissions. Nothing previewed is
installed, resolved, delivered, or executed.

**Privacy.** Preview per-model data policy decisions, review and apply
reversible pseudonymization over exact user-reviewed spans with encrypted local
mappings and passphrase-wrapped custody, restore pseudonymized output strictly
and all-or-nothing, and read a separate non-content decision audit.

**Interface.** A loopback GUI in English and Italian is the primary path, with a
graphical dashboard derived on demand from the authoritative stores. A CLI
covers the same ground for scripting. The GUI has no runtime dependency, loads
no remote asset, and renders charts as inline SVG from tested pure functions.

## What comes next

**Make the whole path feel like one product.** The capabilities above are
complete but still ask the reader to know where each one lives. The next
increment reduces steps, technical vocabulary, and confirmations rather than
adding surfaces, so that opening a project, finding what was decided, and
carrying it to another assistant is one continuous path.

**General-purpose repositories.** Registration is still expressed in terms of a
Git repository. Document repositories are designed in the long-term vision and
are not in the delivery horizon yet; until they are, no screen may assume a
project contains code.

**Model delivery.** M5 remains incomplete. The at-most-once exposure semantics,
the durable attempt evidence, and the provider-neutral attempt store exist as
offline-qualified contracts; no credential is consumed, no provider is called,
and a live probe requires separate explicit approval.

**Later boundaries.** Optional dense recall behind the lexical path; a tool
registry with sandboxed execution; multi-agent orchestration with provider
neutral adapters; a community registry for portable agent and skill packages.
Each requires its own decision record before any dependency or runtime is added.

## Milestones

1. **Project Memory** — repository discovery, session acquisition, historical
   search, and continuity. _Outcome: resume earlier work with a different agent
   without replaying the complete session._
2. **Instruction and agent management** — inspectable composition, portable
   profiles, and permission policy.
3. **Context optimization** — byte-exact budgets, deduplication, progressive
   disclosure, and savings evidence.
4. **Privacy proxy** — entity detection, reversible pseudonymization, per-model
   policy, and audit.
5. **Tool registry** — reusable script manifests, discovery, and sandboxed
   execution.
6. **Multi-agent orchestration** — roles, provider-neutral adapters, isolated
   worktrees, routing, and fallback.
7. **Community registry** — portable packages with signatures, provenance, and
   compatibility metadata.

Document workflows evolve alongside these: local registration, parsing, search,
annotations, and provenance first; then semantic search, requirements
traceability, structured version comparison, a Document Graph, and mixed
code/document work.

## Decisions that will not be reopened without new evidence

Each of these is recorded with the evidence it was accepted on.

- **Retrieval engine.**
  [ADR-0031](docs/adr/0031-use-a-tolerant-unified-lexical-index-with-optional-dense-recall.md)
  replaces literal scanning with a tolerant in-process lexical index over
  canonical events and active memory, amended by
  [ADR-0032](docs/adr/0032-index-one-merged-token-set-over-text-extracted-outside-the-engine.md):
  one merged token set per record, no search mode, typo tolerance applied before
  stemming, and text extracted outside the engine. OpenSearch is not adopted: a
  local index answers within the interactive budget.
- **Model delivery guarantee.**
  [ADR-0027](docs/adr/0027-use-explicit-unknown-after-exposure-attempt-semantics.md):
  application-level at-most-once exposure per authorization,
  `UNKNOWN_AFTER_EXPOSURE` when the provider outcome is not observable, and zero
  automatic retries. Provider-side exactly-once processing is not claimed and is
  not a prerequisite for M5.
- **Attempt persistence boundary.**
  [ADR-0028](docs/adr/0028-use-separate-local-model-attempt-store.md): a
  separate provider-neutral local attempt store, not an extension of session or
  memory documents.
- **Italian PII detection candidate.**
  [ADR-0033](docs/adr/0033-qualify-rizzo-pii-behind-an-interchangeable-local-detection-port.md)
  qualifies `rizzo-pii` behind an interchangeable local port. It adopts no
  runtime, weights, or dependency: mapping, custody, strict restoration, and
  release authorization remain AI Workspace's own.
