# Development Guide

Measurement reports:

- [Synthetic handoff break-even corpus](handoff-break-even-corpus.md)
- [Synthetic Context Pack budget-pressure corpus](context-pack-budget-pressure-corpus.md)
- [Synthetic continuity disclosure granularity corpus](continuity-disclosure-granularity-corpus.md)
- [Synthetic Context Pack metadata-envelope corpus](context-pack-metadata-envelope-corpus.md)
- [Context Pack schema-v2 source-table rollout](context-pack-source-table-rollout.md)
- [Profile context selector measurement](context-selector-measurement.md)
- [Selector continuity evidence retention](selector-continuity-evidence-retention.md)
- [Reviewed entity candidate discovery corpus](entity-candidate-discovery-corpus.md)
- [Reviewed entity candidate discovery observations](entity-candidate-discovery-observations.md)
- [Privacy mapping schema-v2 compatibility corpus](privacy-schema-v2-compatibility-corpus.md)

## Prerequisites

- Git;
- Node.js 24;
- npm 11, bundled with the supported Node.js release.

The repository includes `.nvmrc` for compatible Node version managers. Runtime
and package-manager constraints are also declared in `package.json`.

## Set up a clean clone

```bash
git clone https://github.com/fabiorak/ai-workspace.git
cd ai-workspace
npm ci
npm run check
```

Use `npm install` only when intentionally adding or changing dependencies. CI
and reproducibility checks use `npm ci` against the committed lockfile.

## Quality commands

```bash
npm run format:check  # verify formatting
npm run format        # apply formatting
npm run lint          # static checks
npm run typecheck     # strict TypeScript check without output
npm run build         # compile buildable workspace packages
npm run test          # run tests once
npm run test:watch    # run tests during development
npm run check         # run the complete local/CI quality gate
```

## Run the CLI

Build the workspace and invoke the root CLI script:

```bash
npm run build
npm run cli -- project register /path/to/repository
npm run cli -- project list
npm run cli -- project inspect <project-id>
npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file integrations/codex/test/fixtures/session.jsonl
npm run cli -- session inspect <session-id>
npm run cli -- history search "test failed" --project <project-id>
npm run cli -- history show <event-id> --project <project-id>
npm run cli -- artifact show <artifact-id>
```

Add `--json` for machine-readable output. Set `AI_WORKSPACE_HOME` to use an
isolated state directory during development or tests. The default registry is
`~/.ai-workspace/projects.json`; session documents and artifacts use the
`sessions/` and `artifacts/` subdirectories of the same local home.

The committed Codex fixture is fictional and intentionally public. Do not
replace it or extend it with captured user transcripts, even after manual
redaction.

The Sprint 5 second-provider boundary is documented in the offline
[Claude Code provider spike](claude-code-provider-spike.md). Its fixture is
synthetic-only and does not imply production or broad provider support.

Root and command-specific help are acceptance-tested product interfaces. When
adding a command, keep first-run steps, empty states, suggested next commands,
examples, and recovery guidance aligned with its behavior.

## Workspace layout

- `apps/` contains executable composition roots;
- `packages/` contains domain and application capabilities;
- `integrations/` contains provider and protocol adapters;
- `services/` contains supporting components with justified runtime
  boundaries.

Packages expose supported APIs from their root entry point. Domain packages do
not depend on provider SDKs, databases, or application frameworks. See
[ADR-0003](../adr/0003-module-boundaries-and-dependency-direction.md).

## Adding a package

1. Place the package under the appropriate workspace directory.
2. Add a private `package.json` with an `@ai-workspace/` name.
3. Extend `tsconfig.base.json` and add a build reference when the package emits
   artifacts.
4. Export only the supported public API from `src/index.ts`.
5. Add tests alongside the package in `test/`.
6. Run `npm run check`.

Do not add a framework, database driver, provider SDK, or independently
deployed service without documenting the decision and its boundary.

## General link scale measurement

Run `npm run measure:general-links` to reproduce the development-only Sprint 25
REFERENCE evaluation. Corpus dimensions, exact queries, deterministic counts,
invalid-state matrix, thresholds, observed results, and the `NO_CHANGE`
decision are documented in
[General Link Retrieval Scale Corpus](general-link-retrieval-scale-corpus.md).
The harness uses temporary synthetic state only and exposes no runtime route.

## Reversible privacy transformation

Sprint 26 freezes its synthetic Unicode, integrity, encryption, permission,
non-echo, and round-trip cases in
[Privacy Pseudonymization Corpus](privacy-pseudonymization-corpus.md).
`packages/privacy-gateway` owns the pure reviewed-span transformation and
restore contracts. `integrations/local-privacy-mapping` owns only authenticated
encrypted persistence. Tests must use fictional values and explicit synthetic
32-byte keys; never add real mappings, keys, identity data, paths, or generated
ciphertext artifacts to the repository.

Sprint 27 freezes the custody scenarios and gates in
[Local Mapping Key Custody Corpus](local-mapping-key-custody-corpus.md) and
keeps deterministic results separate in
[Local Mapping Key Custody Observations](local-mapping-key-custody-observations.md).
`integrations/local-key-custody` owns only bounded passphrase-wrapped key
envelopes. Tests use synthetic passphrases and random temporary keys; never
probe or create real credential-store records or report host/user identity.

Sprint 30 freezes exact schema-v1 bytes, deterministic schema-v2 project
bytes, mixed read/restore, downgrade, scope, and authenticated-version gates in
the [Privacy Mapping Schema-v2 Compatibility Corpus](privacy-schema-v2-compatibility-corpus.md).
Run `node --test packages/privacy-gateway/test/privacy-schema-v2-compatibility.test.ts`
after building workspace packages. Schema-v1 fixtures are permanent; never
rewrite them to resemble v2 or substitute real customer/project data.

Sprint 31 freezes arbitrary-output v1/v2 token integrity, scope, anomaly, and
all-or-nothing gates in the
[Pseudonymized Output Restoration Corpus](privacy-output-restoration-corpus.md).
Run `npm run measure:output-restoration` to reproduce the deterministic
[observations](privacy-output-restoration-observations.md). Only strict
whole-token restoration is production eligible; the known-only baseline stays
harness-only.

Sprint 32 freezes the non-content privacy-decision audit schema, synthetic
reviewable/blocked cases, canonical bytes, chaining, fixed 1,000-event bound,
and failure matrix in the [Privacy Decision Audit Corpus](privacy-audit-corpus.md).
Run `npm run measure:privacy-audit` to reproduce the deterministic
[observations](privacy-audit-observations.md). Production records only valid
explicit preflight decisions after verified append/reread; no complete report,
content, item hash, path, detected value, secret, mapping, prompt, response, or
restored output is retained.

## Entity candidate discovery measurement

Sprint 28 freezes its synthetic English/Italian exact-span ground truth and
decision gates in the
[Entity Candidate Discovery Corpus](entity-candidate-discovery-corpus.md).
Run `npm run measure:entity-candidates` to reproduce two development-only runs.
The aggregate [observations](entity-candidate-discovery-observations.md) accept
exact configured aliases only as future review suggestions and require further
refinement for standard syntax and combined candidates. No recognizer is
exported to production or connected to the facade, GUI, mapping, or delivery
graph.

## Architecture decisions

Material decisions are recorded in `docs/adr/`. New ADRs use the next numeric
identifier and start with `proposed` status. An accepted ADR is updated rather
than silently contradicted; replacement decisions identify the superseded ADR.

## Local data

`.ai-workspace/`, indexes, artifacts, logs, environment files, and local
databases are excluded from Git. Tests and examples must use synthetic data.
Never copy real credentials, private transcripts, customer files, or reversible
pseudonymization mappings into the repository.
