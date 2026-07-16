# Local mapping key-custody observations

**Observed:** 2026-07-16  
**Frozen gates:** [local-mapping-key-custody-corpus.md](local-mapping-key-custody-corpus.md)

All test inputs were synthetic. No credential-store record was created or
read, and no key, passphrase, recovery material, machine/user identity,
credential label, or path entered these observations.

## Deterministic capability and failure observations

| Candidate             | Cross-platform/headless contract | Offline workspace move                      | Accepted dependencies only | Generated key hidden | Result   |
| --------------------- | -------------------------------- | ------------------------------------------- | -------------------------- | -------------------- | -------- |
| `VOLATILE_IMPORT`     | yes                              | only by separately transporting the raw key | yes                        | no                   | `REJECT` |
| `OS_CREDENTIAL_STORE` | no single built-in Node contract | no portable recovery contract               | no                         | yes                  | `REJECT` |
| `PASSPHRASE_WRAPPING` | yes                              | envelope plus passphrase                    | yes                        | yes                  | `PASS`   |

The volatile baseline preserves Sprint 26 compatibility but cannot retire
manual hexadecimal key handling: its only backup is the Restricted raw key.
The OS candidate requires different platform APIs or a new native/runtime
dependency, can require an interactive desktop unlock, and binds routine
recovery to source-host or provider behavior. Those are deterministic gate
failures regardless of what happens to be installed on one host.

The passphrase prototype used only Node's accepted `crypto` and filesystem
APIs. It generated an independent random mapping key, derived a distinct
wrapping key with bounded scrypt parameters, authenticated mapping-set scope,
and stored only randomized salt, nonce, ciphertext, authentication tag, and
non-secret algorithm metadata. Correct unlock returned exactly 32 bytes;
wrong passphrase, tampering, noncanonical content, unsafe permissions,
incomplete writes, duplicates, and invalid bounds returned no key and left
existing state untouched.

Two consecutive isolated executions passed 8/8 declared tests each. The
compatibility case created a normal Sprint 26 schema-v1 mapping ciphertext,
unlocked its key from the moved custody envelope, read the exact mapping, and
verified that ciphertext bytes did not change. The same executions covered
additive rotation, multi-user directory modes, owner-lock contention, altered
scope/KDF parameters, truncation, oversize, corruption, noncanonical state,
wrong passphrase, duplicates, and incomplete writes. The executable assertions
are in `integrations/local-key-custody/test/local-key-custody.test.ts`.

## Host-specific availability observation

| Host fact                                   | Observation                                 |
| ------------------------------------------- | ------------------------------------------- |
| Runtime platform family                     | Linux                                       |
| Built-in Node scrypt and AES-256-GCM        | available; deterministic tests passed twice |
| OS credential-store tool or desktop session | deliberately not probed                     |
| Real credential/keychain records            | none used                                   |

This table is availability evidence only. It does not claim macOS or Windows
execution on this host and did not influence the deterministic rejection of
the OS candidate. Node's documented cross-platform crypto/filesystem contract
and platform-independent tests are the portable implementation boundary;
release testing on all supported operating systems remains required.

## Decision input

`PASSPHRASE_WRAPPING` is the only candidate that passes every frozen gate. The
bounded boundary is eligible for ADR acceptance with exact envelope, KDF,
failure, backup, recovery, and rotation semantics. This evidence by itself
does not authorize production rollout.
