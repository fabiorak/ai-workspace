# ADR-0049: Record agent execution attempts separately

Status: proposed
Date: 2026-09-28

## Context

ADR-0045 routes subscription-backed agents outside `ModelDelivery` and requires
separate non-content attempt evidence before a process can be exposed to the
protected input. The model-attempt store cannot hold that evidence honestly: it
admits only `OPENAI_RESPONSES`, and its `ACKNOWLEDGED` state stands for a
provider receipt that a command-line process does not give. The durable turn
registry of ADR-0048 links a turn to one attempt, but its recovery could only
read model-delivery evidence.

## Decision

Add `packages/agent-execution`, which owns agent attempt records and the agent
execution coordinator, and `integrations/local-agent-attempts`, which stores the
records. No runtime, dependency or service is added.

An attempt has five states:

| State                      | Meaning                                              |
| -------------------------- | ---------------------------------------------------- |
| `PREPARED`                 | Evidence written; no process was started             |
| `REFUSED_BEFORE_EXECUTION` | The binding changed after preparation; nothing ran   |
| `EXECUTION_STARTED`        | The one execution claim; a process may have started  |
| `COMPLETED`                | The adapter validated one answer and it was recorded |
| `UNKNOWN_AFTER_EXECUTION`  | Anything else after the claim                        |

The only transitions are `PREPARED` to `EXECUTION_STARTED` or
`REFUSED_BEFORE_EXECUTION`, and `EXECUTION_STARTED` to `COMPLETED` or
`UNKNOWN_AFTER_EXECUTION`. There is no acknowledged state and no receipt is
invented for a process.

The coordinator validates the request and asks the executor for a pure plan,
the digests of the exact standard input and invocation, before any I/O. On
confirmation it spends the in-memory authorization once, checks its scope and
expiry, rereads the binding, links the attempt to the turn identity, prepares
the record, then checks the binding and the plan again, claims execution and
rereads the claim. Any failure up to that point starts no process. After the
claim, only a well-formed, bounded answer from the executor that is then
recorded as `COMPLETED` is an answer. An exception, a timeout, an adapter
rejection, a malformed, partial, duplicated or tool-bearing stream, or a failed
completion write all leave the attempt unknown. Nothing is executed again, and
there is no fallback to another executor or to model delivery. Process success
is therefore distinct from a validated answer, and a validated answer is
distinct from its save in the conversation, which remains the job of the
canonical writer.

A record holds the scope, authorization and attempt identities, class, kind,
target, the qualification the executor declares, the input, invocation and
binding digests, the preflight audit hash, preparation and update times, the
output digest and, when the product reports one, the reported model name. It
never holds the input, the answer, process streams, paths, environment,
credential references or tokens. A requested alias is never replaced with a
deduced model.

The store keeps one append-only, hash-chained document per scope under
`agent-attempts/`, 0600 in a 0700 directory, bounded to 256 records and 2 MiB.
It writes through a synchronized temporary file, rename and directory sync,
rereads what it wrote, accepts only its own byte-exact canonical form, and fails
closed on edits, temporary leftovers, unsafe permissions or a lock it does not
own. A contended lock refuses rather than waits, so two processes can never
both claim one attempt.

ADR-0048 is amended additively: the attempt reference linked to a turn may
carry `executionClass`. Its absence means model delivery, so existing registry
files keep their meaning. Recovery reads an agent reference only from the agent
store; without that store the turn stays unknown. `PREPARED` and
`REFUSED_BEFORE_EXECUTION` recover as refused before exposure; the claimed and
unknown states recover as unknown; `COMPLETED` is read back from the canonical
conversation and becomes withheld with `SAVE_FAILED` if it is not there.

## Consequences

- An agent turn has the same at-most-once and recovery guarantees as a
  model-delivery turn, without pretending the two boundaries are alike.
- The store does not route agent targets by itself: routing by class belongs to
  the conversation turn (see the ADR-0045 amendment) and confinement of the
  process and its workspace to ADR-0050.
- The qualification string is declared by the executor. Verifying an installed
  executable and its flags is still required before any real process runs.
- The store duplicates the proven structure of the model-attempt store instead
  of sharing it, so qualified model-delivery code is not changed. Extracting a
  shared store remains an open option.
- The 256-record bound is per scope; a scope that reaches it fails closed until
  a retention decision exists. No record is ever deleted automatically.

## Implementation status

The package, the store, the recovery link and their synthetic tests exist: real
child processes interrupted at every step, concurrent claims across processes,
and the existing Codex and Claude Code adapters behind a synthetic runner. No
agent process, login or credential is used.

The coordinator is wired into the conversation turn for agent targets whose kind
the host offers; see the ADR-0045 amendment. The turn and the store are
qualified with synthetic executors only.

## Amendment: why an outcome is unknown

Date: 2026-10-16. The ADR remains proposed.

An unknown outcome said nothing about which check failed, so finding the cause
of a real run needed evidence left on disk or another run. An unknown record now
carries two more fields: `unknownReason`, one value from a closed list
(`RUNNER_FAILED`, `TIMED_OUT`, `OUTPUT_LIMIT`, `STREAM_ENCODING`,
`LINGERING_PROCESS`, `WORKSPACE_WRITTEN`, `EXIT_CODE`, `MALFORMED_EVENT`,
`UNEXPECTED_EVENT`, `CONTEXT_LOADED`, `ERROR_RESULT`, `NO_ANSWER`,
`UNRESOLVED`), and `unexpectedEvent`, the product's event type such as
`system/status` when the reason is `UNEXPECTED_EVENT`, otherwise null.

Neither field holds content. The adapters name the first check that failed; the
coordinator accepts a reason only from the closed list and an event type only
as identifier-like segments joined by `/`, and records anything else as
`UNRESOLVED` or a null event. A thrown executor, an invalid answer or a failed
completion write is `UNRESOLVED`.

The fields appear only on an unknown record and always together. The schema
version is unchanged: a record written before this amendment has neither field
and stays valid, and its hash chain is untouched.
