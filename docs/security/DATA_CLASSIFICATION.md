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
General-to-project link rationales also default to `CONFIDENTIAL`, retain
`LOCAL_USER`/`USER_AUTHORED`/`UNVERIFIED` attribution, and pass through the same
narrow restricted detector before persistence. Link metadata does not lower
the classification or authorize disclosure.

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

Valid preflight decisions now create a separate local `CONFIDENTIAL` audit
event before their report returns. The event contains only minimum identifiers,
policy and schema provenance, aggregate counts, and digests. It does not copy
Context Pack content, per-item hashes, detector values, paths, reports,
mappings, secrets, prompts, responses, or restored output. Audit metadata and
digests remain correlatable and are not a classification downgrade or delivery
authority.

Sprint 33 does not add a production authorization record or change data
classification. Its synthetic test-only intent contains metadata and digests
that would be `CONFIDENTIAL` if persisted in a real workspace. Exact request
content, item hashes, mappings, secrets, credentials, prompts, and responses
remain forbidden from authorization metadata. Any future transport design must
classify provider receipts and idempotency material before storage is selected.

Sprint 34 adds no production transport data. Its test-only attempt metadata,
request/response ID digests, event counts, and process digests would be
`CONFIDENTIAL` if associated with a real workspace. Provider request IDs,
client request IDs, response IDs, Codex thread IDs, account/project identifiers,
auth state, stderr, and model output require classification before any runtime
storage. Request and response bodies, bearer credentials, Codex auth files,
mapping plaintext, keys, and passphrases remain forbidden from qualification
evidence.

Sprint 35 adds no production Anthropic or Claude data. Its test-only attempt,
header-name, event-count, process, and identifier digests would be
`CONFIDENTIAL` if tied to a real workspace. API keys, setup tokens, OAuth and
keychain state, account IDs, provider request/message IDs, Claude settings,
init events, stderr, prompts, system instructions, and model output require an
explicit classification before runtime use. Credential values, auth exports,
request/response bodies, mapping plaintext, keys, and passphrases remain
forbidden from qualification evidence.

Sprint 36 adds no production attempt record. Its test-only canonical state,
scope digests, provider/client identifier digests, output digest, revision, and
exposure count would be `CONFIDENTIAL` if associated with a real workspace.
ADR-0027 permits only an allowlisted non-content prototype direction; request
or response bodies, transformed text, item hashes, mappings, keys, passphrases,
credentials, unrestricted headers, account data, error bodies, endpoints, and
private paths remain forbidden. `UNKNOWN_AFTER_EXPOSURE` is evidence quality,
not a data-class downgrade or provider-truth claim.

## Implemented reversible transformation

Reviewed entity spans, aliases, pseudonymized Context Pack content, mapping
metadata, and reversible mappings remain `CONFIDENTIAL`. Pseudonymization does
not lower source classification and is not anonymization. Original values are
retained only inside a separate AES-256-GCM authenticated mapping ciphertext.
The random 32-byte mapping key is persisted only as authenticated ciphertext
inside a separate passphrase-wrapped custody envelope; plaintext keys and
passphrases are volatile caller-process data and are never returned. Canonical
evidence and Context Packs remain byte-unchanged.

The first implementation performs no automatic PII detection and grants no
model permission. Unknown or unreviewed content retains its existing class and
risk. Key material is `RESTRICTED` and must never enter ordinary storage, logs,
fixtures, reports, browser-local state, or source control.
