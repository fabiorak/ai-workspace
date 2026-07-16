# Sprint 30 — Plan Reviewed Project Aliases with Schema v2

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, project-alias compatibility increment

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 29 completed; ADR-0021, ADR-0022, and ADR-0023 accepted

## Sprint goal

Design and, only after an accepted ADR, implement explicit `PROJECT` alias
review with versioned reviewed-span and mapping schema v2 while retaining
permanent lossless schema-v1 reads, custody envelope schema v1, and all current
non-authorizing privacy boundaries.

## Required evidence and decisions

- freeze v1 customer/other mapping fixtures, v2 project fixtures, mixed
  read/restore scenarios, wrong-version and downgrade cases before code;
- reject silent `PROJECT` → `OTHER` conversion and adding a new enum value to
  schema v1;
- compare a separate schema-v2 writer/reader with permanent v1 reads against
  exact canonical bytes, restore identity, storage authentication, GUI
  inspection, and rollback expectations;
- write ADR-0024 only after the compatibility corpus is executable; record
  `NO_CHANGE` if lossless coexistence cannot be demonstrated;
- keep custody envelope schema v1 because key wrapping is independent of entity
  type; authenticate the exact mapping schema/version in the mapping document.

## Committed backlog

### S30-01 — Freeze compatibility and downgrade gates

- preserve byte-identical reads and restore for every schema-v1 fixture;
- require deterministic canonical schema-v2 `PROJECT` review and mapping bytes;
- prove v1 and v2 mappings coexist under distinct mapping-set identities;
- fail closed on v2 input presented to a v1-only path, mixed-version identity,
  unsupported versions, tampering, stale hashes, and cross-scope state.

### S30-02 — Decide schema v2 before production changes

- evaluate explicit v2 review and mapping documents without rewriting v1;
- define writer selection, reader dispatch, facade/route contracts, GUI labels,
  backup/restore behavior, and downgrade guidance;
- accept ADR-0024 or retain Sprint 29 `CUSTOMER`-only production behavior.

### S30-03 — Roll out only an accepted boundary

- add `PROJECT` to schema-v2 reviewed selections and mapping entries only;
- keep schema-v1 parsing/restoration permanent and byte-identical;
- extend exact alias suggestions, explicit confirmation, bilingual GUI, and
  local round-trip verification without automatic transformation;
- preserve schema-v1 custody envelopes and generate no implicit migration.

### S30-04 — Verify and close

- test canonical v1/v2 reads, writes, encryption, restoration, failures,
  loopback security, accessibility, and English/Italian parity;
- update ADR, architecture, security, user, developer, planning, roadmap, and
  public design documentation with the actual decision;
- run clean build/check/audit, compatibility corpus, diff and public-safety
  scans; create one commit without push.

## Stop and re-plan triggers

- schema-v1 bytes, reads, restoration, or mapping identity would change;
- safe v2 requires rewriting, deleting, or implicitly migrating v1 state;
- custody envelope v1 cannot remain independent and authenticated;
- project suggestions cannot remain unreviewed until explicit current-hash
  confirmation;
- tests would require real project/customer names, mappings, keys,
  passphrases, transcripts, or recovery material.

## Out of scope

Schema-v1 enum extension, `PROJECT` → `OTHER` coercion, automatic migration,
mapping re-encryption, passphrase changes, key/mapping export, dictionary
persistence, standard syntax detection, semantic identity inference, network,
models, delivery, routing, permissions, execution, databases, services,
frameworks, and external dependencies.

## Definition of done

- compatibility corpus and gates precede ADR-0024 and production code;
- all schema-v1 fixtures remain byte-identical and permanently readable;
- accepted v2 state represents `PROJECT` explicitly and restores byte-exactly;
- v1/v2 coexist without implicit migration or custody-envelope changes;
- unconfirmed suggestions never reach transformation;
- full repository gates pass, documentation is synchronized, one commit is
  created, and no push is performed.
