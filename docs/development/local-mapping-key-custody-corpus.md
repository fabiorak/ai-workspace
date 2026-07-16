# Local mapping key-custody corpus and decision gates

**Frozen before Sprint 27 prototypes:** 2026-07-16  
**Scope:** development-only comparison; all values and identities are synthetic

## Purpose

This corpus compares custody boundaries for the 32-byte key consumed by the
schema-v1 encrypted privacy-mapping store. It does not authorize production
rollout, network recovery, credential export, mapping migration, or changes to
the Sprint 26 ciphertext format. Candidate observations must be recorded
before ADR-0022 can accept a boundary.

## Candidates

1. `VOLATILE_IMPORT`: import an exact 32-byte key for each operation and retain
   it only in process memory. This is the Sprint 26 baseline.
2. `OS_CREDENTIAL_STORE`: place a randomly generated 32-byte key behind the
   current operating-system user's credential-store API and retain only an
   opaque lookup label outside that store.
3. `PASSPHRASE_WRAPPING`: generate a random 32-byte mapping key, derive a
   wrapping key from a user passphrase plus random public salt, and persist
   only an authenticated wrapped-key envelope beside the workspace.

No candidate may reuse a mapping key as a wrapping key, derive a mapping key
directly from a passphrase, or place plaintext key, passphrase, recovery
material, user name, machine name, credential-store label, or local path in a
report.

## Frozen synthetic corpus

Each executable candidate adapter receives only:

- a generated synthetic 32-byte mapping key;
- passphrases `correct horse synthetic staple` and
  `wrong horse synthetic staple`, where applicable;
- an opaque workspace scope `workspace-synthetic-01`;
- one valid schema-v1 mapping ciphertext produced by Sprint 26;
- copies with a flipped envelope byte, changed authenticated scope, truncated
  payload, unsupported schema/algorithm/KDF parameters, and excessive bounds.

Adapters are isolated from the production facade, GUI, delivery graph, and
ordinary workspace state. Tests use private temporary directories and remove
them in `finally`/test cleanup. Reports contain enum outcomes and aggregate
counts only.

## Predeclared scenario matrix

Every candidate is evaluated against the same scenarios. `DETERMINISTIC`
means behavior can be exercised without depending on a particular host;
`HOST_OBSERVATION` means availability may be reported separately but cannot
override a deterministic failure.

| Scenario                    | Required observation                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Linux, macOS, Windows       | deterministic support contract for all three; host availability reported separately                                                   |
| Headless use                | unlock can use a non-GUI caller without persisting or echoing the secret                                                              |
| Lock/unlock                 | locked state yields no key; correct unlock yields the exact 32 bytes only to the caller                                               |
| Wrong secret/caller         | fail closed with one sanitized error and no partial key                                                                               |
| Backup and recovery         | documented offline inputs are sufficient; loss cases are explicit and never presented as recoverable                                  |
| Rotation                    | create a new envelope/key identity without rewriting or deleting existing schema-v1 ciphertext; mapping re-encryption is out of scope |
| Workspace move              | behavior is deterministic when private custody metadata moves to another supported host                                               |
| Multi-user host             | ordinary workspace files alone never grant access; private permissions and caller secret/store isolation are required                 |
| Corruption                  | altered, truncated, noncanonical, oversized, or unsupported state fails closed and remains untouched                                  |
| Concurrent/incomplete write | owner lock, private temporary state, flush, atomic publication, and no partial result                                                 |

## Frozen gates

### Security and compatibility

- valid unlock returns the exact synthetic 32-byte key in memory and nothing
  else; every invalid integrity, scope, bounds, permission, or secret case
  returns no key;
- persisted candidate state contains no plaintext key or passphrase and uses
  authenticated scope separation with fresh randomness for each creation;
- errors, reports, snapshots, and repository state contain no key,
  passphrase, recovery material, machine/user identity, credential label, or
  local path;
- existing encrypted mapping documents remain byte-identical, readable by the
  Sprint 26 store with the recovered key, and use no migration;
- loss or corruption never deletes or overwrites mapping ciphertext or an
  existing custody envelope.

### Portability and recovery

- routine create/unlock has one contract on supported Linux, macOS, and
  Windows and works in a headless process;
- a workspace move has an explicit offline recovery path that requires no
  cloud account, network service, machine identity, or source-host access;
- backup inputs and irrecoverable-loss cases are explicit; no candidate may
  claim recovery from ciphertext alone;
- multiple local users do not silently share custody through ordinary
  workspace-readable state.

### Dependency and accessibility

- production rollout adds no runtime, native, framework, database, cloud, or
  package dependency unless a prior ADR explicitly accepts it;
- the boundary supports non-interactive programmatic testing and callers can
  provide secrets through an inaccessible-to-logs input channel;
- routine GUI input never echoes a secret after submission, stores it in
  browser-local state, or exposes generated hexadecimal key material;
- all decisions derive from asserted capability/failure outcomes; a host's
  installed tools or desktop session cannot be the sole acceptance evidence.

## Decision algorithm

Reject a candidate on any security/compatibility failure. Among remaining
candidates, reject one that lacks a single cross-platform/headless contract,
offline workspace-move recovery, or an implementation path within accepted
dependencies. Accept the smallest remaining boundary only after deterministic
tests pass twice and the host-specific availability report is kept separate.

If no candidate passes, record `NO_CHANGE` and retain explicit volatile import.
If `PASSPHRASE_WRAPPING` passes, the later ADR must choose exact KDF, envelope
bounds, recovery semantics, and rotation limits before production code. If
`OS_CREDENTIAL_STORE` passes, the later ADR must choose exact platform APIs,
dependency boundary, label privacy, and headless fallback first.

Passing this corpus authorizes key custody only. It grants no model, network,
delivery, routing, permission, execution, automatic PII detection, mapping
export, synchronization, or cloud-recovery capability.
