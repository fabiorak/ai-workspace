# ADR-0007: Use a local content-addressed artifact store

**Status:** accepted  
**Date:** 2026-07-10

## Context

Session sources and large event payloads must remain available as immutable
evidence without being duplicated in event documents. The store must detect
tampering, deduplicate identical content, survive interrupted writes, and keep
confidential local content outside the public repository.

Object storage or a database would add operational dependencies before remote
or multi-user requirements exist.

## Decision

Store artifacts below `AI_WORKSPACE_HOME/artifacts/sha256/`, partitioned by the
first two hexadecimal digest characters. An artifact ID has the form
`artifact://sha256/<64-lowercase-hex-digest>` and hashes the exact stored bytes.

The adapter must:

- enforce a documented maximum object size before writing;
- create directories with requested mode `0700`;
- write a mode `0600` temporary file in the target directory;
- publish with an exclusive atomic filesystem link so an existing object is
  never overwritten;
- treat identical existing bytes as an idempotent success;
- fail closed if existing bytes do not match their address;
- remove temporary files after success or failure;
- return sanitized errors without artifact content.

Ingestion screening occurs before the application calls the artifact store.
The artifact store itself enforces integrity and size, not data-classification
policy.

## Consequences

- identical source or payload bytes occupy one local object;
- event source references remain stable and independently verifiable;
- immutable artifacts may become unreferenced if a later session commit fails;
- garbage collection, quotas, encryption at rest, streaming writes, and remote
  object storage remain future decisions;
- filesystem confidentiality still depends on the host and requested POSIX
  permissions;
- callers must not interpret successful storage as proof that content is free
  of secrets or other confidential data.
