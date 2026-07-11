# ADR-0012: Store handoffs as immutable JSON files

**Status:** accepted  
**Date:** 2026-07-11

## Context

The guided CLI must create and inspect handoffs across independent invocations.
Handoffs are immutable snapshots, unlike Work Item lifecycle logs, and older
packets must never be refreshed or rewritten.

## Decision

Store each handoff as one schema-versioned JSON file in a local `handoffs/`
directory. The filename is a SHA-256 digest of explicit project, Work Item, and
handoff IDs rather than a caller-controlled path. Creation uses an exclusive
mode-`0600` file, flush, and close inside a mode-`0700` directory. Existing
identity conflicts fail without replacement.

Reads validate schema, repeated scope, required sections, metadata, and bounds
before returning a packet. Malformed, unsupported, or cross-scope documents
fail closed with recovery guidance. Successor links reference an existing
handoff in the same project and Work Item; no file is updated to add a reverse
link.

## Consequences

- handoffs remain independently portable and inspectable;
- immutable creation needs no mutable-document lock or optimistic revision;
- corruption is isolated to one packet;
- listing and indexed search remain outside the Core MVP;
- no database, service, framework, or external dependency is added.
