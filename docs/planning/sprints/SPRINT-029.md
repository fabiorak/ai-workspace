# Sprint 29 — Review Exact Alias Suggestions Explicitly

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, reviewed alias-assistance increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 28 completed; ADR-0021 and ADR-0022 accepted

## Sprint goal

Let a user inspect exact customer candidates from one explicitly supplied,
synthetic alias dictionary and confirm selected current-hash spans into the unchanged
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

## Planning decisions

- ADR-0023 is the expected first artifact. It must accept or reject an
  action-scoped exact-alias review boundary before production code begins;
- only the measured `EXACT_ALIAS` `CUSTOMER` subset is eligible. Matching is exact and
  case-sensitive, and every intended case variant is a separate explicit
  dictionary entry;
- the dictionary is transient request input, not a registry or workspace
  aggregate. It contains only alias text and explicit `CUSTOMER` type, with
  no canonical identity inference or replacement authority;
- production code belongs in `packages/privacy-gateway`. No runtime package may
  import the development script; the Sprint 28 harness must instead verify
  equivalence with the accepted package contract;
- the candidate response contains item identity, current content hash, type,
  exact UTF-8 range, reason, and non-authoritative state, but not matched text
  or dictionary values;
- the GUI highlights returned ranges against the already reviewed Context Pack
  content. It does not need the server to echo sensitive aliases;
- confirmation creates only transient schema-v1 review selections for the
  existing separate pseudonymization action. Suggestions and confirmations are
  not persisted as correction memory or audit history in this sprint.

## Planned user journey

1. the user reaches the existing profile-governed privacy journey and reviews
   the exact Context Pack, project, Work Item, handoff, model, and policy;
2. the user enters a bounded synthetic alias dictionary, assigning each entry
   explicitly to `CUSTOMER`;
3. an authenticated local preview recomposes the current Context Pack and
   returns deterministic `SUGGESTED_NOT_REVIEWED` ranges only;
4. the bilingual GUI shows limitations, keeps every candidate unselected by
   default, and lets the user confirm individual current-hash ranges;
5. confirmed ranges become the same transient schema-v1 `USER_REVIEWED`
   selections already accepted by ADR-0021;
6. pseudonymization remains a separate explicit action with the existing
   passphrase custody, encrypted mapping, restoration, and non-authorization
   behavior.

There is no bulk accept, automatic transformation, implicit dictionary update,
or candidate reuse after the composed Context Pack hash changes.

## Committed backlog

### S29-01 — Decide the review-assistance boundary before code

- write and accept ADR-0023 before adding any production recognizer, facade,
  route, persistence, or GUI behavior;
- decide exact request/response schemas, bounds, state labels, recomposition,
  no-echo behavior, and candidate-to-review conversion;
- define `SUGGESTED_NOT_REVIEWED` as non-authoritative and distinct from
  `USER_REVIEWED` throughout the journey;
- keep dictionaries explicit, bounded, same-project, user-supplied for the
  current action, and absent from logs, reports, mappings, and canonical
  evidence;
- preserve mapping schema v1, custody envelope schema v1, canonical Context
  Packs, and byte-exact restoration without migration.

### S29-02 — Add a bounded exact-alias candidate contract

- move only the accepted exact-alias behavior behind a provider-neutral
  `packages/privacy-gateway` contract and keep the Sprint 28 aggregate decision
  reproducible against it;
- accept only `CUSTOMER` aliases with exact bytes and
  Unicode-aware token boundaries;
- bind every suggestion to project, Work Item, handoff, model, Context Pack
  item ID, current content hash, entity type, and exact UTF-8 byte range;
- reject ambiguous aliases, duplicates, overlaps, invalid boundaries, stale
  hashes, excessive input, and cross-scope input without partial results;
- return only candidate metadata required for inert local inspection and never
  persist or echo matched values or dictionary contents.

Production bounds may be narrower but not broader than the measured maximum of
1,000 aliases and 256 UTF-8 bytes per alias. Context Pack item and total-byte
bounds remain governed by the existing composition contract.

### S29-03 — Require explicit confirmation into reviewed spans

- extend the typed facade and one authenticated loopback preview route only
  after ADR acceptance, reusing the existing profile/context composition;
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

### S29-05 — Deliver the bounded bilingual review surface

- add English/Italian labels, limitations, empty state, loading, failure,
  stale-content recovery, and keyboard-visible per-candidate confirmation;
- render all Context Pack and alias-derived content inertly without
  `innerHTML`, remote assets, telemetry, or browser-local persistence;
- keep candidates unselected by default and expose exact type/range/reason plus
  a visible `SUGGESTED_NOT_REVIEWED` status;
- preserve CSRF, Origin, Host, loopback authentication, body limits, project
  scope, and one-time bootstrap behavior.

### S29-06 — Document and close

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
project-alias production support before a separately accepted schema-v2 ADR;
dictionary persistence, discovery, sharing, or synchronization; correction
memory; automatic selection or transformation; mapping/envelope migration;
password reset or re-encryption; model/network access; delivery; response
handling; deanonymization of model output; routing; permission; execution;
databases; services; frameworks; and external dependencies.

## Acceptance criteria

- **A29-01:** ADR-0023 is accepted before the first production code change and
  records dictionary lifetime, bounds, response redaction, state transition,
  and compatibility consequences;
- **A29-02:** exact configured customer aliases reproduce the Sprint 28
  `EXACT_ALIAS` customer subset ordering and 3 TP/0 FP/0 FN result, and
  `ADOPT_FOR_REVIEW` decision over the frozen corpus;
- **A29-03:** case variants, Unicode boundaries, repeated occurrences, adjacent
  punctuation, and identifier-embedded negatives behave deterministically;
- **A29-04:** duplicate or ambiguous aliases, invalid UTF-8, controls,
  conflicting overlaps, stale hashes, split code points, excessive bounds,
  malformed payloads, and cross-project input fail closed with no partial
  candidates or sensitive echo;
- **A29-05:** candidate responses contain no alias text, matched text, Context
  Pack content, local path, mapping, key, passphrase, or recovery material;
- **A29-06:** every candidate starts `SUGGESTED_NOT_REVIEWED`; omission,
  rejection, navigation, or preview never creates a reviewed selection;
- **A29-07:** explicit confirmation revalidates current item hash, type, and
  UTF-8 range and produces byte-identical schema-v1 `USER_REVIEWED` input for
  the existing pseudonymization contract;
- **A29-08:** no unconfirmed range can enter transformation, and confirmation
  alone writes no mapping or custody envelope and grants no delivery authority;
- **A29-09:** the authenticated bilingual loopback journey passes keyboard,
  label, focus, inert-rendering, narrow-viewport, Origin/CSRF/body-bound, empty,
  error, and recovery acceptance;
- **A29-10:** canonical Context Packs, source evidence, Restricted detection,
  mapping schema v1, envelope schema v1, and byte-exact restoration remain
  unchanged.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm run measure:entity-candidates
npm audit --audit-level=high
git diff --check
```

The test matrix must cover package contracts, frozen-corpus equivalence, typed
facade behavior, authenticated server failure paths, English/Italian
interaction parity, and one complete suggestion → confirmation → separate
pseudonymization preview using synthetic data only.

## Definition of done

- ADR-0023 accepts the exact-alias review boundary before production code;
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

## Authorized follow-up planning

Plan a later schema-v2 increment for exact `PROJECT` aliases. It must preserve
permanent schema-v1 reads, define explicit v2 writer/reader/facade/GUI
compatibility, reject silent `PROJECT` → `OTHER` conversion, require a new ADR
before code, and introduce no implicit migration or delivery authority.

## Delivered outcome

- ADR-0023 accepted a transient exact `CUSTOMER` alias boundary and explicitly
  deferred `PROJECT` rather than changing schema v1 or coercing it to `OTHER`;
- `packages/privacy-gateway` now validates bounded case-sensitive dictionaries,
  Unicode token boundaries, exact current content hashes and UTF-8 ranges, then
  emits only deterministic `SUGGESTED_NOT_REVIEWED` metadata;
- duplicate, project-typed, control-bearing, malformed-Unicode, overlapping,
  oversized, stale, and cross-scope input fails closed without partial output
  or alias/matched-text echo;
- the typed facade and authenticated loopback route recompose the exact
  profile-governed Context Pack and model policy before producing suggestions;
- the English/Italian GUI highlights ranges using the separately reviewed
  Context Pack, leaves all candidates unselected, and requires individual
  confirmation before populating the existing transient schema-v1 review form;
- pseudonymization remains a separate explicit action and revalidates the exact
  item hash and range before writing encrypted mapping and custody state;
- Sprint 30 plans the separately ADR-gated schema-v2 compatibility work for
  `PROJECT` with permanent v1 reads and no implicit migration.

## Review and retrospective

The implementation preserves the measured benefit while narrowing rollout to
the type already representable by ADR-0021. Discovering that schema-v1 reviewed
spans do not contain `PROJECT` before production code prevented both an
undocumented enum extension and a lossy `OTHER` conversion. The follow-up is
therefore an explicit v2 compatibility increment rather than hidden scope in
the suggestion feature.

Sensitive aliases remain request-local. Candidate responses omit both alias and
matched content; the GUI obtains display content only from the existing
profile-context preview and renders highlights through DOM text nodes and
`mark`, never `innerHTML`. Confirmation writes no state, and transformation,
mapping creation, and passphrase custody remain visibly separate.

## Final verification

- formatting, lint, typecheck, composite build, and all 245 tests passed;
- authenticated loopback acceptance covers suggestion, explicit confirmation,
  separate pseudonymization, project-alias rejection, and non-echo behavior;
- the production customer matcher reproduces the frozen Sprint 28 customer
  subset with three exact spans and no false positive;
- dependency audit reported zero vulnerabilities; diff validation and the
  public-safety scan passed, with only deliberate synthetic detector canaries;
- one commit is created without push as the final close action.
