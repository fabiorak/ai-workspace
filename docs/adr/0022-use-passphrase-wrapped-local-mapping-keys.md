# ADR-0022: Use passphrase-wrapped local mapping keys

**Status:** accepted  
**Date:** 2026-07-16

## Context

ADR-0021 deliberately requires callers to import an exact volatile 32-byte
key. Sprint 27 froze and exercised a cross-platform custody corpus before any
production integration. Volatile import preserves portability but exposes
Restricted hexadecimal key material and makes its manual transport the only
recovery path. Operating-system credential stores lack one built-in Node
contract across Linux, macOS, Windows, and headless use; they also require
platform adapters or new dependencies and do not provide a portable offline
workspace-move recovery contract.

The isolated passphrase-wrapping candidate passed the frozen gates twice with
synthetic inputs. It restored the exact mapping key after a workspace move,
retained byte-identical schema-v1 mapping ciphertext, and failed closed for
wrong secrets, corruption, noncanonical state, bounds, permissions,
duplicates, and incomplete writes.

## Decision

For each new mapping-set identity, generate a random independent 32-byte
mapping key and persist it only in a separate schema-v1 authenticated custody
envelope. Derive a wrapping key from a user-supplied passphrase and fresh
16-byte salt with scrypt (`N=32768`, `r=8`, `p=1`, 32-byte output, 64-MiB
implementation memory ceiling). Wrap the mapping key with AES-256-GCM using a
fresh 12-byte nonce. Authenticate schema, algorithm, purpose, mapping-set
identity, KDF name, and exact KDF parameters as additional data.

Passphrases contain 16 through 1,024 UTF-8 bytes. They are caller input only:
never persisted, returned, logged, placed in browser-local state, included in
reports, or retained by the GUI field after an attempt. The derived wrapping
key is zeroed after use. The unwrapped mapping key exists only in process
memory for the bounded mapping operation and is never returned by the GUI or
route.

Custody envelopes are immutable, bounded to 16 KiB and 1,000 documents, named
by a SHA-256 of mapping-set identity, and stored separately from mapping
ciphertext with `0700` directories and `0600` files. Writes use an owner-token
lock, private complete temporary file, flush, atomic rename, and directory
flush. Unlock validates exact keys, canonical serialization, algorithms,
parameters, sizes, permissions, mapping-set scope, base64, and authentication
before returning any key. Existing state is never deleted or overwritten on
failure.

Backup and offline workspace-move recovery require both the encrypted mapping
and custody directories plus the passphrase. Losing the passphrase or custody
envelope is explicitly irrecoverable; ciphertext alone is never described as
recoverable. Ordinary workspace files do not grant another local user access
without the passphrase, while operating-system permissions remain a required
defense.

Rotation means creating a new mapping-set identity, random mapping key,
envelope, and mapping for future transformed content. This ADR does not
authorize overwriting an immutable envelope, re-encrypting an existing
mapping, changing its passphrase, exporting keys/mappings, synchronization, or
recovery escrow. Those require new evidence and an ADR.

The production GUI replaces raw hexadecimal key input with one non-echoing
passphrase input. The existing profile composition, privacy preflight,
reviewed spans, mapping schema-v1, byte-exact restoration, and fail-closed
checks remain unchanged.

## Consequences

- routine use no longer generates, displays, copies, or asks users to retain a
  raw mapping key;
- custody works through one local and headless Node contract without new
  runtime, native, package, framework, database, cloud, or network dependency;
- moving or backing up both encrypted directories preserves an offline
  recovery path, but passphrase loss remains irrecoverable;
- weak or exposed user passphrases remain a risk; the minimum length and
  memory-hard KDF raise cost but do not create identity assurance or recovery;
- one mapping key remains scoped to one mapping-set identity, limiting reuse
  and making rotation additive;
- schema-v1 mapping ciphertext remains migration-free and byte-compatible;
- OS credential stores may be reconsidered only with cross-platform/headless,
  dependency, label-privacy, and recovery evidence;
- this boundary grants no model, network, delivery, routing, permission,
  execution, automatic PII detection, export, sharing, synchronization, or
  cloud-recovery capability.
