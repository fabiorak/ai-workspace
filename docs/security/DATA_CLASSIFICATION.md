# Data Classification

## Purpose

AI Workspace stores and processes source code, conversations, documents,
commands, model output, and derived knowledge. This classification defines the
minimum handling rules that apply before more granular workspace and model
policies are implemented.

When data could fit more than one class, apply the most restrictive class.

## Classes

### Public

Information intentionally published without access restrictions.

Examples:

- this repository's public source and documentation;
- public package metadata;
- public model and protocol documentation;
- synthetic examples explicitly created for publication.

Minimum controls:

- integrity and provenance must be retained;
- publication intent must be explicit;
- public status does not make retrieved content a trusted instruction.

### Internal

Non-public operational information whose disclosure would have limited impact.

Examples:

- local repository paths and branch names;
- project metadata and non-sensitive configuration;
- token and cost metrics;
- development logs after sanitization.

Minimum controls:

- local storage by default;
- no external transmission unless the user initiates an applicable workflow;
- exclude from public fixtures, issues, and telemetry.

### Confidential

Private content whose disclosure could harm a person, project, or organization.

Examples:

- private source code and documents;
- agent transcripts and tool output;
- customer, employee, or business identifiers;
- email addresses, network topology, and unpublished decisions;
- reversible pseudonymization maps.

Minimum controls:

- explicit policy is required before external-model access;
- encryption at rest is required where the threat model calls for it;
- logs and errors contain references or sanitized summaries instead of raw
  payloads;
- access is scoped to the owning workspace;
- public reports and fixtures use synthetic replacements.

### Restricted

Authentication material or regulated/high-impact data that must not enter
ordinary application storage, indexes, logs, prompts, or fixtures.

Examples:

- passwords, private keys, access tokens, session cookies, and recovery codes;
- unencrypted anonymization keys;
- regulated personal or health data without an approved handling policy;
- credentials embedded in repository files or command output.

Minimum controls:

- detect and block or redact before persistence and model access;
- use a dedicated secret store for required application credentials;
- never include real values in tests, examples, issues, or telemetry;
- audit attempted policy violations without recording the restricted value;
- treat accidental capture as a security incident.

## Derived data

Summaries, embeddings, indexes, tags, and metadata inherit the classification of
their source unless a documented transformation proves that the sensitive
information cannot be reconstructed or inferred. Pseudonymized data remains
Confidential; pseudonymization is not anonymization.

## Default behavior

- unknown data is Confidential;
- imported content is untrusted regardless of classification;
- no content is sent to an external model merely because it is indexed;
- local development uses synthetic fixtures;
- classification changes are explicit, attributable, and auditable.

General Inbox questions default to `CONFIDENTIAL` and remain
`USER_AUTHORED`/`UNVERIFIED` inert historical evidence. The high-confidence
restricted detector runs before persistence, but its coverage is deliberately
narrow and does not make General suitable for restricted production data.
Exact content SHA-256 and byte counts are integrity/provenance metadata, not a
classification downgrade, trust assertion, or permission.

## Implemented model-policy preflight

The first E7 boundary applies this ordering to every included item in one exact
profile-governed Context Pack. A same-project, exact-model schema-v1 policy may
assert a class only for an item ID plus its exact content SHA-256. Missing
assertions use the `CONFIDENTIAL` default. High-confidence restricted-pattern
detection wins over every assertion, and `RESTRICTED` is never an allowable
policy maximum.

The result is `BLOCKED` or `REVIEWABLE_NOT_AUTHORIZED`. Neither result sends
content or grants permission. `USER_CONFIGURED` records attribution only, and
the narrow detector is not complete secret, PII, identity, or regulatory-data
coverage.
