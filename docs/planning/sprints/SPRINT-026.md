# Sprint 26 — Preview Reversible Privacy Transformation

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, reversible-transformation increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 25 completed; ADR-0017 accepted

## Sprint goal

Let a user apply explicitly reviewed, exact-hash UTF-8 spans to one exact
profile-governed Context Pack, inspect a deterministic pseudonymized preview,
persist its mapping as separate authenticated ciphertext, and prove byte-exact
local restoration—without changing source evidence or authorizing delivery.

## Committed backlog

### S26-01 — Decide and freeze the boundary

- accept ADR-0021 before implementation;
- freeze the synthetic corpus, security gates, limits, and non-echo rules;
- keep key custody explicit and outside persisted workspace state.

### S26-02 — Add provider-neutral reviewed-span transformation

- validate canonical schema-v1 review selections bound to project, Work Item,
  handoff, model, item ID, content hash, entity type, and UTF-8 byte range;
- reject stale, dangling, duplicate, overlapping, split-code-point, cross-scope,
  malformed, and oversized input without partial results;
- derive inert deterministic aliases with HMAC-SHA-256 and preserve every byte
  outside reviewed spans;
- expose only selection identity, entity type, range, alias, hashes, counts,
  limitations, and a non-authorizing effect.

### S26-03 — Add the encrypted local mapping adapter

- store bounded schema-v1 mapping plaintext only inside AES-256-GCM ciphertext
  with fresh nonce and scope-bound authenticated metadata;
- require an explicit in-memory 32-byte key and never persist or log it;
- use canonical separate documents, `0700`/`0600`, owner locking, flush, atomic
  rename, and fail-closed complete reads;
- prove wrong-key, tamper, metadata, permission, temporary-state, bounds, and
  no-echo behavior.

### S26-04 — Deliver the bilingual preview journey

- extend the typed facade and authenticated GUI route after the existing
  privacy preflight inputs;
- require explicit reviewed selections and key material for the local preview;
- show transformed inert content, aliases, hashes, counts, limitations, and
  recovery without original selected values, key, mapping plaintext, or paths;
- preserve English/Italian parity, accessibility, CSRF/Origin/body bounds,
  project scope, inert rendering, and no-manual guidance.

### S26-05 — Verify, document, and close

- pass the frozen corpus and full repository gates;
- plan Sprint 27 from observed evidence rather than enabling delivery;
- synchronize architecture, security, roadmap, project plan, READMEs, user and
  developer documentation;
- create one commit without push.

## Out of scope

Automatic or semantic PII detection, custom dictionaries, OS keychains,
password-derived keys, key persistence/recovery/rotation, network or model
access, delivery, execution, permissions, routing, response handling,
canonical Context Pack mutation, databases, services, frameworks, and external
dependencies.

## Definition of done

- ADR and corpus precede code;
- valid synthetic cases restore byte-exactly and preserve unselected bytes;
- invalid selection, integrity, scope, key, permission, and storage cases fail
  closed without echo or partial output;
- mapping ciphertext is separate, authenticated, bounded, private, atomic, and
  non-deterministic across saves;
- bilingual GUI behavior is explicit, local-only, and non-authorizing;
- full checks, audit, loopback acceptance, diff and public-safety scans pass;
- Sprint 27 is planned, documentation is synchronized, and one commit is
  created without push.

## Risks and mitigations

| Risk                                    | Mitigation                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Reviewed offsets drift or split Unicode | Bind exact hash and validate UTF-8 boundaries before end-to-start replacement |
| Mapping or key leaks                    | Separate authenticated ciphertext, explicit volatile key, non-echo contracts  |
| Pseudonymization is mistaken for safety | Preserve explicit limitations and non-authorizing effect                      |
| Ciphertext is replayed across scope     | Bind complete identity as AES-GCM authenticated data                          |
| Scope expands into delivery             | No provider, network, permission, routing, or execution consumer              |

## Delivered outcome

- ADR-0021 and the synthetic corpus preceded implementation and fixed reviewed
  exact-hash UTF-8 spans, deterministic HMAC-derived aliases, AES-256-GCM
  authenticated storage, explicit volatile key custody, and non-authorizing
  semantics;
- `packages/privacy-gateway` validates canonical review and mapping schema v1,
  rejects stale/dangling/overlapping/split-code-point input, transforms only
  reviewed bytes, and verifies exact restoration against both original and
  transformed hashes;
- `integrations/local-privacy-mapping` persists immutable mapping documents as
  fresh-nonce authenticated ciphertext with scope-bound additional data,
  `0700`/`0600`, owner locking, flush, atomic rename, bounded complete reads,
  and no key generation or persistence;
- the authenticated bilingual GUI action reuses the exact profile, instruction,
  model, policy, Work Item, handoff, and Context Pack composition; it saves,
  rereads, and restores before returning only transformed inert content and
  safe metadata;
- wrong keys, ciphertext or metadata tampering, unsafe modes, temporary state,
  stale lock, oversized state, hash/range/scope errors, and transformed-content
  changes fail closed without partial output or selected-value/key/path echo.

## Review and retrospective

The increment meets its bounded objective without adding a provider, network,
delivery, execution, database, framework, or external dependency. Canonical
evidence and Context Packs remain unchanged. Pseudonymized content and mappings
remain `CONFIDENTIAL`; the key is `RESTRICTED`; a verified round trip remains
review evidence rather than transmission permission.

Explicit hexadecimal key entry kept the cryptographic/storage boundary
independent of an unreviewed custody mechanism, but it is the principal
remaining usability and security risk. Sprint 27 therefore compares local key
custody and recovery candidates before any production choice. Automatic entity
detection remains separately evidence-gated.

## Final verification

- clean locked install and clean composite build passed;
- formatting, lint, typecheck, build, and all 228 tests passed, including
  authenticated loopback GUI acceptance;
- dependency audit reported zero vulnerabilities;
- diff validation and public-safety scans passed;
- Sprint 27 and all public, architecture, security, developer, and user
  documentation were synchronized;
- one commit is created without push as the final close action.
