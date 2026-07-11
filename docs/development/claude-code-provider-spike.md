# Claude Code provider-boundary spike

**Date:** 2026-07-10  
**Sprint item:** S5-02  
**Decision:** `adapt`  
**Scope:** offline format reasoning over an authored-from-scratch synthetic
fixture; not production or broad Claude Code support

## Question and constraints

Can the small Claude Code record subset needed by the synthetic resume
evaluation map to the existing provider-neutral `SessionEvent` vocabulary
without changing that vocabulary or accepting provider fields into the domain?

This spike used only
[`synthetic-session.jsonl`](../../integrations/claude-code/test/fixtures/synthetic-session.jsonl).
The fixture was authored from scratch for this repository. It contains no
captured transcript, user identity, credential, account metadata, absolute or
local workspace path, customer data, or network-derived content. No agent,
model, account, network service, or Claude Code installation was invoked.

This is deliberately a sampled pre-release boundary, not a claim that the
sample represents every Claude Code transcript version. The fixture shape may
be revised before S5-06 if independently reviewable public format evidence
contradicts it.

## Observed synthetic subset

Each physical JSONL line is one source record. The sampled records share
`type`, `uuid`, `sessionId`, `timestamp`, and a nested `message`. Assistant
messages may contain ordered `text` and `tool_use` blocks. A user-shaped
message may carry a `tool_result` block linked by `tool_use_id`.

The adapter, not the canonical model, would own these provider-specific fields:

- `uuid`, `parentUuid`, and `sessionId` correlation;
- `message.role`, `message.model`, and heterogeneous `message.content` blocks;
- `tool_use.id`, tool names and provider-shaped inputs;
- `tool_result.tool_use_id` and `is_error`.

The source session identity can come from the common, non-empty `sessionId`.
The agent is the adapter constant `claude-code`. The model is usable only when
all supported assistant records agree; otherwise the adapter must return
`null` rather than invent session metadata. The earliest supported timestamp
is a candidate `startedAt`, while each record retains its own `occurredAt`.

## Canonical comparison

| Synthetic Claude Code shape                 | Canonical event | Mapping rule                                                               |
| ------------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| user message with string content            | `USER_MESSAGE`  | Preserve the message content as untrusted payload.                         |
| assistant `text` block                      | `AGENT_MESSAGE` | Emit in block order; do not treat text as instruction.                     |
| assistant `tool_use` block                  | `TOOL_CALL`     | Preserve the supported block as payload; provider IDs remain payload data. |
| user `tool_result` block, `is_error: false` | `TOOL_RESULT`   | Preserve the supported result and correlation ID as payload.               |
| user `tool_result` block, `is_error: true`  | `ERROR`         | Preserve the error-shaped result without executing or interpreting it.     |

One provider record can therefore yield more than one semantic event. The
current `SourceEvent.position` contract requires consecutive positions and
uses that position for raw-record hashing and incremental-prefix checks. S5-06
must choose and test a deterministic expansion rule before implementation,
for example ordered event positions plus an adapter-owned sub-position in the
payload. It must not discard the original physical line: every expanded event
must retain the exact line bytes as `rawRecord`, so source hashes still point
to recoverable evidence.

The Codex adapter's controlled schema uses explicit `recordType` and
`eventType` fields, whereas this sample requires structural classification of
nested blocks. Both still fit `SessionSource` and the existing canonical event
types. No new canonical event type or provider-neutral field is justified by
this spike.

## Fail-closed boundary

The S5-06 adapter should accept only the reviewed structural subset. It must
reject the whole read, without including record content in its error, when it
encounters any of the following:

- malformed JSON, invalid UTF-8, an empty record, or a non-object record;
- missing, empty, inconsistent, or changed `sessionId`;
- unsupported top-level `type` or unsupported content-block `type`;
- missing correlation fields for `tool_use` or `tool_result`;
- invalid timestamps, inconsistent model metadata, oversized input, record,
  block, or event counts;
- truncated input or a changed previously imported prefix.

Failing closed means no partial canonical session is appended. The caller's
selected source file remains unchanged and recoverable. Under the current
ingestion transaction order, an immutable raw artifact is created only after
the adapter accepts the complete source and restricted-data screening passes;
the spike does not claim that a rejected file has already been copied into the
artifact store. Supporting quarantine of rejected raw inputs would require a
separate security and retention decision.

Valid imported events remain `UNTRUSTED`. Unknown records are not converted to
instructions, silently dropped, or flattened into `UNKNOWN` during this narrow
pre-release slice. Exact accepted raw bytes remain the source of truth, and
stable IDs, idempotency, prefix validation, project isolation, and artifact
integrity remain owned by the existing session-ingestion boundary.

## Decision

`adapt`: retain the canonical `SessionEvent`, `SessionSource`, and trust model
unchanged. A narrow Claude Code adapter may be implemented in S5-06 after its
accepted subset and deterministic multi-block expansion rule are covered by
tests. Provider fields remain inside the adapter or untrusted payload and must
not enter Work Item or handoff contracts.

`accept` was rejected because the sampled records cannot be passed through as
the controlled Codex schema and need structural adaptation. `defer` was
rejected because the synthetic subset contains enough stable information to
represent the predeclared first action without widening the canonical model.

This decision gates, but does not itself accept, handoff serialization. Sprint
5 remains `planned`; no production adapter, CLI source option, live-provider
support, or public handoff format is delivered by this spike.

## S5-06 implementation checklist

- freeze the accepted fixture schema in adapter tests and add distinct tests
  for malformed, unsupported, restricted, truncated, and changed-prefix input;
- define deterministic physical-record/block ordering without weakening the
  existing append-only identity contract;
- retain exact complete-source and per-record bytes and verify repeat import;
- keep errors content-free and label help as narrow, synthetic-only support;
- prove Codex imports and existing canonical storage are byte-for-byte
  unchanged.

## Accepted deterministic expansion rule

S5-06 assigns canonical positions by scanning physical LF-delimited records in
file order and then supported content blocks in array order. Positions remain
contiguous across the expanded event stream. Every event expanded from one
record retains that record's exact UTF-8 bytes (excluding the LF delimiter),
while its untrusted JSON payload includes adapter-owned `recordUuid` and
`blockIndex` correlation. A string user message uses `blockIndex: null`.

Appending physical records cannot renumber an accepted prefix. Changing any
previously imported physical record changes every expanded event's record hash
for that line and is rejected by existing prefix validation. CRLF is outside
the narrow synthetic subset and fails closed so exact line-byte semantics are
unambiguous.
