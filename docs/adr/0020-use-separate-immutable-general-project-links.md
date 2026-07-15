# ADR-0020: Use separate immutable General-to-project links

**Status:** accepted  
**Date:** 2026-07-15

## Context

ADR-0018 makes `GENERAL` a first-class scope and requires any later project
association to be explicit and additive. ADR-0019 keeps General conversations
in canonical documents that contain no project identity. A General event can
become relevant to a registered project, but embedding that association in the
conversation would rewrite canonical General evidence. Copying the event into
project session history would change its ownership, create divergent evidence,
and weaken source integrity.

The expected local corpus is bounded and does not justify a database,
migration, index, network service, model, or encryption store.

## Decision

Represent each association as a separate schema-versioned immutable JSON
document in a dedicated `general-project-links/` directory. The link is an
append-only provenance aggregate, never an embedded General field or copied
project event. Creating it does not mutate either referenced document.

Each link records an opaque stable ID; exact General conversation ID, event ID,
and content SHA-256; one explicit registered target project ID; a required
user-authored rationale; creation timestamp; `LOCAL_USER` actor,
`USER_AUTHORED` origin, `UNVERIFIED` verification, and `CONFIDENTIAL` data
class; and the effect `LINK_ONLY`. Its identity is generated independently;
the tuple `(General event ID, exact content hash, target project ID)` is unique.
There are no edit or delete operations.

Creation requires the caller to name the General conversation, event, exact
hash, and target project. The service re-reads both scopes, rejects missing or
cross-scoped references and stale hashes, screens the rationale for restricted
data before persistence, and never infers consent from GUI project selection.
Project removal makes the link invalid for retrieval and causes the requested
link set to fail closed; it does not delete or rewrite the link.

The local adapter scans at most 10,000 link documents, 64 KiB per document, and
16 MiB total. Documents use canonical schema-v1 JSON, exclusive owner-token
locks, complete temporary writes, file and directory flush where supported,
atomic rename, owner-only cleanup, and restrictive `0700`/`0600` permissions.
Readers validate exact keys, bounds, timestamps, identities, SHA-256 syntax,
canonical serialization, filenames, duplicates, and temporary state before
returning any links. Corruption yields no partial link set and no content echo.

All-scope and General-only retrieval may annotate General results with validated
link metadata. An explicit `associatedProjectId` filter returns matching
General evidence while preserving its `GENERAL` scope. Existing project-only
history remains project-only. Retrieval validates every link plus its General
event/hash and registered target before merging and applying the global limit.

A link is provenance metadata only. It is not ownership, active memory, a Work
Item, Context Pack input, instruction, permission, authorization, delivery,
model invocation, or execution.

## Consequences

- original General and project documents remain byte-identical and retain
  their scopes;
- relevance to a project is explicit, inspectable, attributable, and bound to
  the exact source hash;
- storage remains dependency-free, portable, bounded, and rebuildable;
- duplicate and stale associations fail before persistence;
- project removal or corrupt link state blocks linked retrieval without
  silently dropping invalid associations;
- link scans grow linearly and require a later ADR if measured scale or latency
  exceeds the declared bounds;
- encryption, synchronization, semantic search, promotion, editing, deletion,
  and execution remain out of scope.
