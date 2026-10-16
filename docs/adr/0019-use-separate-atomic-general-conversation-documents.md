# ADR-0019: Use separate atomic General conversation documents

**Status:** accepted  
**Date:** 2026-07-15

Amended by proposed ADR-0042: the conversation turn retains a completed General user/model pair in
one atomic append. The additive schema-v1 event union records model output as
`AGENT_MESSAGE`, `MODEL_GENERATED`, `UNVERIFIED` evidence with attempt, target,
model, and validated display-name provenance. Manual General capture remains a
single `USER_MESSAGE` and still performs no model call.

## Context

ADR-0018 makes `GENERAL` a first-class conversation scope but deliberately
does not choose persistence. The General-conversation work needs immutable user-authored questions,
bounded local listing and lexical search, fail-closed integrity checks, and no
false project ownership.

The considered representations were: reuse the project session store, keep a
separate append-only JSON aggregate, or introduce a database/index. Reusing
sessions would require synthetic project identity or change their persisted
schema and trust contracts. A database would add lifecycle, migration, and
dependency decisions before the small local corpus has demonstrated a need.

## Decision

Store each General conversation as one schema-versioned JSON document below a
dedicated `general-conversations/` directory. It is never a Project Registry
entry and contains no project ID. The canonical document has an immutable
conversation identity, bounded title, explicit `GENERAL` scope, and an ordered
append-only sequence of `USER_MESSAGE` events.

Every event records an opaque ID, exact UTC timestamp, `LOCAL_USER` actor,
`USER_AUTHORED` origin, `UNVERIFIED` evidence state, `CONFIDENTIAL` data class,
exact UTF-8 byte length, SHA-256 content digest, and local-capture provenance.
The content and metadata remain inert historical evidence and grant no
instruction, memory, delivery, permission, or execution authority.

Create and append operations use an exclusive owner-token lock, restrictive
directory/file modes where supported, complete temporary writes, file flush,
atomic rename, and owner-only lock cleanup. Append requires the caller's exact
expected event count. Readers validate schema, exact keys, scope, ordering,
timestamps, bounds, byte counts, hashes, and canonical serialization before
returning any data. Corrupt requested scope fails closed without partial
results. There are no edit or delete operations.

The first adapter scans at most 1,000 conversation documents, 10,000 events,
1 MiB per document, and 16 MiB total. A conversation contains at most 1,000
events; titles are at most 200 UTF-8 bytes and event content 64 KiB. Restricted
high-confidence content is rejected before persistence without echoing it.

## Consequences

- General provenance remains truthful and project formats and IDs are unchanged;
- documents stay inspectable, portable, atomic, and rebuildable without a new
  runtime dependency;
- scan and snapshot-rewrite costs grow linearly and are explicitly bounded;
- stale locks require deliberate operator recovery after ownership is checked;
- FTS5 or another rebuildable index requires measured scale/function triggers
  and a later ADR; semantic retrieval remains governed by ADR-0018;
- encryption, multi-user access, synchronization, model delivery, and
  cross-scope promotion remain out of scope.

## Amendment: line breaks in message content

Date: 2026-10-16. The status is unchanged.

Message content refused every control character, line feed included, so a
question or an answer written on more than one line could not be stored. A
conversation turn already accepted such a question before sending, so a
multi-line message could be exposed and then fail to save.

Message content, both questions and answers, now keeps line feeds. A carriage
return immediately before a line feed is dropped before the content is hashed
and stored; any other control character, a tab or a lone carriage return
included, is still refused. Titles and identifiers stay on one line. Documents
written before this amendment contain no line feed and remain valid.

A turn in a General conversation checks its question against the same rule
before anything is sent, and is refused before exposure when the question
could not be stored.
