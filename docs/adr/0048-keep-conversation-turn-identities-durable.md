# ADR-0048: Keep conversation-turn identities durable across restarts

Status: proposed
Date: 2026-09-23

## Context

ADR-0042 binds an idempotency identity to a conversation and exact request, but
an in-memory claim cannot prevent the same gesture from being exposed again
after the process restarts. The durable model-attempt store records the delivery
boundary and its outcome; it does not identify the user's turn or retain the
canonical conversation response. Those records need a durable link without
duplicating either store or retaining prompt and response content.

## Decision

Add the provider-neutral `local-conversation-turns` integration behind the
conversation-turn deduplication port. A turn identity is the SHA-256 digest of
the exact `conversationId` and `clientRequestId` pair. Its directory is claimed
with exclusive creation and the claim is permanent. It is not a lease. A
versioned `claim.json` binds the identity to the exact input digest and
server-resolved scope. The claim uses schema v1. `attempt.json` binds the turn
to `projectId`, `authorizationId`, and `attemptId` before preparation and before
the model-attempt exposure claim. `result.json`, when present, records only
result metadata: completion event ID, response digest, and protection count.
Both files are envelopes with checksums linked to the schema-v1 claim; they do
not declare independent schema versions. The registry never copies prompt or
response text.

Registry files are immutable after publication. The adapter publishes a
private temporary file by hard link, synchronizes the file and directory, and
rereads the published bytes. Directories use mode 0700 and files use mode 0600;
reads reject symlinks, enforce a 16 KiB maximum, and require exact checksums and
schemas. The adapter looks up one derived identity directly and does not scan
the registry or active projects. There is no automatic retention, TTL, or
re-execution window. Registry growth is therefore proportional to the number
of turn identities; disk-full and other persistence failures fail closed.

An identical duplicate waits up to 35 seconds for its owner, whether that owner
is in this process or another process. The recorded PID is only a hint for that
wait; it never grants execution rights. If a claim is incomplete, corrupt, or
still unresolved after the wait, it remains consumed and recovery is
conservative. The adapter does not reclaim it automatically.

Recovery consults the linked model attempt and the canonical General or project
conversation store. A saved response is read from that canonical store. If the
attempt says exposure began but has no conclusive result, recovery returns
`UNKNOWN_AFTER_EXPOSURE`. If the attempt completed but its response is missing,
recovery returns `RESPONSE_WITHHELD` with reason `SAVE_FAILED`. Recovery never
resends a request or appends a replacement answer. A replay remains bound to
the original completed result even if the Work Item or handoff advances later.
The conversation and authoritative project scope must still agree.

This registry records the durable identity of a user's turn. The model-attempt
store remains authoritative for exposure state, and conversation history
remains authoritative for the saved answer. Bound turns do not sweep other
attempts in the project for recovery while another process may be sending.
The attempt store links each transition to the current project log head while
validating the lifecycle against that attempt's own previous record; this
supports interleaved attempts without breaking the project hash chain. Deleting or manually rolling back
registry state removes the at-most-once guarantee for those identities. Turns
created before this change had only in-memory identities and cannot be migrated
retroactively.

## Consequences

- Exact duplicate gestures remain associated with one durable attempt across
  process restarts; changed input under the same identity conflicts.
- Ambiguous exposure, incomplete records, and lost answers do not trigger a
  second transport call or a reconstructed append.
- Local storage grows for as long as the application accepts new identities;
  there is no automatic cleanup that could make an old replay executable.
- Existing model-attempt and conversation stores retain their separate roles.
- Binding a reviewed preview to a later send, and revalidating target and scope,
  is a separate contract (see the amendment in ADR-0042). The legacy
  continuation path is unchanged.

## Implementation status

Controlled process termination is tested after the turn claim, after attempt
binding but before preparation, after preparation, and after the executor claim
but before send; these four cases observe zero exposures. Recovery stays unknown
if an attempt reference exists but its evidence is missing, or if an exposure
claim is present. Other tests cover competing processes, canonical response
recovery, HTTP replay after restart, and interleaved model attempts. These
checks cover controlled process termination and process restarts; they do not
qualify every power-loss timing or filesystem and hardware failure mode.

## Amendment: attempt class in the linked reference (ADR-0049)

Date: 2026-09-28. The ADR remains proposed.

`attempt.json` may now carry `executionClass` with `MODEL_DELIVERY` or
`AGENT_EXECUTION` next to `projectId`, `authorizationId` and `attemptId`. The
field is optional and its absence means model delivery, so references written
before agent execution existed are read unchanged; any other value is rejected
as unavailable. Recovery consults the store the class names and never reads an
agent reference from model-delivery evidence. The claim, result and envelope
formats are otherwise unchanged.
