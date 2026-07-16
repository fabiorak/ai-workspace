# Sprint 29 — Review Exact Alias Suggestions Explicitly

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, reviewed alias-assistance increment

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 28 completed; ADR-0021 and ADR-0022 accepted

## Sprint goal

Let a user inspect exact candidates from one explicitly supplied, synthetic
alias dictionary and confirm selected current-hash spans into the unchanged
`USER_REVIEWED` contract, only if a new ADR accepts the boundary, without
automatic transformation, inferred identity, standard-syntax detection, or
delivery.

## Evidence and problem statement

Sprint 28 measured three deterministic candidates against frozen bilingual
exact-span evidence. Exact aliases achieved 100% precision and recall on the
bounded corpus and received `ADOPT_FOR_REVIEW`; standard syntax and the union
remain `REFINE` because telephone precision fell to 50% on source-code-like
text.

That evidence supports only a review suggestion, not production authority.
The product still needs an explicit contract for dictionary provenance,
candidate state, stale-content rejection, user confirmation, GUI limitations,
and conversion into the already accepted Sprint 26 reviewed-span schema.

## Committed backlog

### S29-01 — Decide the review-assistance boundary before code

- write and accept a new ADR before adding any production recognizer, facade,
  route, persistence, or GUI behavior;
- define `SUGGESTED_NOT_REVIEWED` as non-authoritative and distinct from
  `USER_REVIEWED` throughout the journey;
- keep dictionaries explicit, bounded, same-project, user-supplied for the
  current action, and absent from logs, reports, mappings, and canonical
  evidence;
- preserve mapping schema v1, custody envelope schema v1, canonical Context
  Packs, and byte-exact restoration without migration.

### S29-02 — Add a bounded exact-alias candidate contract

- accept only `CUSTOMER` and `PROJECT` aliases with exact bytes and
  Unicode-aware token boundaries;
- bind every suggestion to project, Work Item, handoff, model, Context Pack
  item ID, current content hash, entity type, and exact UTF-8 byte range;
- reject ambiguous aliases, duplicates, overlaps, invalid boundaries, stale
  hashes, excessive input, and cross-scope input without partial results;
- return only candidate metadata required for inert local inspection and never
  persist or echo matched values or dictionary contents.

### S29-03 — Require explicit confirmation into reviewed spans

- present suggestions separately from existing reviewed selections in the
  bilingual authenticated GUI;
- require an explicit per-suggestion confirmation against the current item
  hash before creating the unchanged `USER_REVIEWED` span;
- allow rejection or omission without correction memory, implicit learning,
  or mutation of the alias dictionary;
- keep pseudonymization and mapping creation a separate explicit action under
  the existing Sprint 26/27 contracts.

### S29-04 — Verify compatibility and non-authority

- prove stale, malformed, conflicting, out-of-bounds, split-code-point, and
  cross-project suggestions fail closed without partial output or text echo;
- preserve Restricted blocking and all existing reviewed-span, mapping,
  envelope, passphrase, restoration, loopback, accessibility, and localization
  regressions;
- demonstrate that no unconfirmed suggestion reaches transformation and no
  confirmed span creates model, network, permission, routing, delivery, or
  execution authority.

### S29-05 — Document and close

- update public, user, developer, architecture, security, planning, and ADR
  documentation with actual behavior and limitations;
- run clean build/check/audit, loopback acceptance, diff validation, and public
  safety scans;
- plan the next increment from observed review behavior rather than enabling
  delivery;
- create one commit without push.

## Stop and re-plan triggers

- the ADR does not accept a production review-assistance boundary;
- safe matching or confirmation requires persisted alias plaintext, inferred
  identity, telemetry, network access, a model, or a new dependency;
- suggestions cannot remain visibly and structurally separate from
  `USER_REVIEWED` spans;
- current-hash confirmation cannot reuse schema-v1 review spans without a
  mapping or envelope migration;
- fixtures or tests would require real identities, customer/project aliases,
  transcripts, mappings, keys, passphrases, or recovery material.

## Out of scope

Standard email, IP, or telephone recognizers; combined detection; semantic,
ML, or LLM classification; identity inference; complete PII or secret coverage;
dictionary persistence, discovery, sharing, or synchronization; correction
memory; automatic selection or transformation; mapping/envelope migration;
password reset or re-encryption; model/network access; delivery; response
handling; deanonymization of model output; routing; permission; execution;
databases; services; frameworks; and external dependencies.

## Definition of done

- a new ADR accepts the exact-alias review boundary before production code;
- suggestions remain non-authoritative, bounded, current-hash-bound, and
  separate from reviewed spans until explicit confirmation;
- only confirmed spans enter the unchanged schema-v1 `USER_REVIEWED` contract;
- dictionary and matched values never enter logs, reports, canonical evidence,
  mapping metadata, or persisted workspace state;
- bilingual GUI and failure paths explain corpus-bounded limitations and
  provide explicit recovery without authorizing transformation or delivery;
- full repository gates pass, documentation is synchronized, one commit is
  created, and no push is performed.

## Risks and mitigations

| Risk                                           | Mitigation                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| A suggestion is mistaken for verified identity | Use `SUGGESTED_NOT_REVIEWED` and require explicit current-hash confirmation |
| Alias plaintext leaks into durable state       | Keep the dictionary action-scoped, non-echoing, and unpersisted             |
| Content changes after candidate generation     | Bind and revalidate exact item hashes and UTF-8 ranges at confirmation      |
| Corpus accuracy is generalized beyond evidence | Expose limitations and support only explicit exact aliases                  |
| Review silently becomes delivery authority     | Keep transformation separate and add no network/model consumer              |
