# ADR-0028: Use a separate local model-attempt evidence store

**Status:** accepted

**Date:** 2026-07-23

## Context

ADR-0027 requires a durable exposure claim before a future provider adapter is
invoked. Sprint 37 proved the ordering with a dependency-free test-owned JSON
candidate, but did not establish a reusable production contract.

Attempt evidence has different semantics from privacy-decision audit, active
memory, historical evidence, mappings, and artifacts. Combining these stores
would blur retention, integrity, authorization, and content boundaries.

## Decision

Use a provider-neutral `model-attempts` contract and a separate replaceable
local adapter:

- the contract owns state transitions, exact non-content schemas, validation,
  inspection, and recovery semantics;
- the local adapter owns restrictive permissions, owner-token locking, bounded
  canonical JSON, predecessor integrity, atomic publication, synchronization,
  and verified reread;
- exposure is eligible only after durable publication and reread;
- unfinished exposure or acknowledgement recovers as
  `UNKNOWN_AFTER_EXPOSURE` without retry;
- no request or response body, mapping, key, credential, endpoint, account
  data, private path, bearer-equivalent material, or raw provider identifier is
  stored;
- the store exposes no provider invocation, network, route, CLI command, or GUI
  action.

The initial adapter remains dependency-free. A different runtime, framework,
database, cloud service, or external dependency requires a separate ADR.

## Consequences

- attempt evidence has explicit ownership and can evolve independently;
- hash chaining detects internal corruption, gaps, and reordering, but not
  privileged replacement or truncation of the complete store;
- fixed capacity prefers fail-closed safety over unbounded retention;
- production infrastructure exists without implying model delivery or a user
  feature;
- any future user-facing workflow must be complete in the maintained,
  bilingual, self-explanatory GUI.
