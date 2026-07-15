# Sprint 27 — Decide Local Mapping Key Custody

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, key-custody decision increment

**Status:** planned

**Cadence:** two-week timebox

**Dependency:** Sprint 26 completed; ADR-0021 accepted

## Sprint goal

Select an explicit, recoverable local key-custody boundary for encrypted
pseudonym mappings using a predeclared cross-platform threat and usability
corpus, so the temporary raw hexadecimal key input can be retired without
silently choosing an OS keychain, password KDF, recovery protocol, or external
dependency.

## Evidence and problem statement

Sprint 26 proves authenticated encrypted persistence and byte-exact restore,
but intentionally delegates key custody to the user and accepts a volatile
32-byte hexadecimal value. This is testable and architecture-neutral, not an
acceptable routine UX: loss makes mappings irrecoverable, reuse widens blast
radius, and clipboard or browser-field handling can expose key material.

## Committed backlog

### S27-01 — Freeze custody and recovery scenarios

- compare at minimum volatile imported key, OS credential store, and
  passphrase-derived wrapping-key candidates;
- predeclare Linux/macOS/Windows availability, headless use, lock/unlock,
  backup, recovery, rotation, workspace move, multi-user host, and corruption
  scenarios;
- define security, portability, dependency, accessibility, and no-manual gates
  before prototyping.

### S27-02 — Build isolated development-only adapters

- exercise candidate interfaces only against synthetic keys and encrypted
  Sprint 26 mappings;
- never log or persist plaintext keys, passphrases, recovery material, or
  machine/user identities;
- keep prototypes outside the production facade, GUI, and delivery graph.

### S27-03 — Decide before rollout

- publish deterministic capability and failure observations separately from
  host-specific availability;
- accept one boundary in a new ADR only if it meets the frozen gates;
- record `NO_CHANGE` and retain explicit volatile custody if no candidate is
  sufficiently safe and portable.

### S27-04 — Roll out only an accepted bounded boundary

- if and only if the ADR accepts a candidate, add the smallest production
  adapter, migration-free GUI selection, non-echoing recovery, and tests;
- preserve schema-v1 encrypted mapping reads and exact Sprint 26 restoration;
- keep delivery, network, models, routing, execution, automatic PII detection,
  and mapping export outside scope.

### S27-05 — Close safely

- run clean build/check/audit, isolated loopback acceptance, diff and public
  safety scans;
- update public/security/developer documentation with the actual decision;
- create one commit without push.

## Stop and re-plan triggers

- a candidate requires a cloud account, remote recovery service, telemetry, or
  network access;
- safe implementation requires a new native/runtime dependency before an ADR;
- a candidate cannot fail closed without deleting or orphaning existing
  ciphertext;
- test fixtures would need real credentials, identities, keychain records, or
  private host metadata.

## Out of scope

Model delivery, provider SDKs, routing, response handling, runtime permission,
automatic entity detection, semantic PII classification, mapping export or
sharing, multi-device synchronization, cloud recovery, and production secrets.

## Definition of done

- corpus and gates precede prototypes;
- candidate observations cover all declared host and recovery scenarios;
- key values and host identity never enter reports or repository state;
- an ADR accepts one bounded custody boundary or records `NO_CHANGE`;
- production changes occur only after acceptance and retain Sprint 26
  compatibility and fail-closed behavior;
- full repository gates pass and one commit is created without push.
