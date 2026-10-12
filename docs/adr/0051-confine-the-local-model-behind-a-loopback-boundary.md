# ADR-0051: Confine the local model behind a loopback boundary

Status: proposed
Date: 2026-09-29

## Context

ADR-0045 routes subscription-backed agents outside `ModelDelivery`, and ADR-0049
records their attempts separately. The model-target catalogue already names a
`LLAMA_SERVER_LOOPBACK` kind in the `LOCAL_MODEL` class, whose boundary is
`LOCAL_ONLY` or `UNCLASSIFIED`, but nothing can run it. `ModelDelivery` and the
model-attempt store are bound to `OPENAI_RESPONSES`: their `ACKNOWLEDGED` state
stands for a provider receipt that a local server does not give, and widening
them would change qualified code.

A local model is the one target for which protected text need not leave the
machine. That is only true if the address really is the machine, so the boundary
must be checked where it can be checked and declared by the user where it
cannot.

## Decision

Add `packages/local-model-execution`, which owns the port, the limits, the
outcomes, the coordinator and the attempt contract, and
`integrations/llama-server-loopback`, which speaks only HTTP. `ModelDelivery` and
the API attempt store are not generalized. No runtime, dependency or service is
added; the adapter uses the Node.js HTTP client already available.

**Protocol.** One `POST /v1/chat/completions` to a `llama-server` the user has
started, without streaming, and one whole JSON response. The adapter is separate
from the Responses adapter and shares no code with it. AI Workspace starts and
stops no process and holds no model file path.

**Boundary.** `LOCAL_ONLY` is declared by the user in the target and verified as
far as it can be verified. The endpoint is refused unless it is a numeric
`127.0.0.1` or `::1` address with an explicit port, so no name is resolved. The
adapter ignores proxy variables of the environment, follows no redirect, and has
no fallback to another address, target, executor or `ModelDelivery`. A target
left `UNCLASSIFIED` stays unavailable. The declaration cannot prove that the
listening process is what the user believes it is; that remains the user's
statement and is shown as such.

**Endpoint.** The address comes from an environment variable read once at start
(proposed name `AI_WORKSPACE_LOCAL_MODEL_ENDPOINT`). Without it the local model
is not offered. No target schema changes.

**Attempts.** A separate append-only, hash-chained store, in
`integrations/local-model-run-attempts` (`local-model-attempts` already belongs
to the API), with the same care as
ADR-0049: a durable claim before the call, an unknown state after the call has
begun, no automatic retry, digests only. Its states are the five of ADR-0049,
with no acknowledged state. The attempt reference of ADR-0048 gains the value
`LOCAL_MODEL` for `executionClass`, additively, so existing files keep their
meaning. Recovery reads a local reference only from the local store.

**Answer.** An answer is valid only if the response is one well-formed JSON
document within the limits, has exactly one choice, a finish reason of `stop`,
and non-empty `message.content`. Any of the following leaves the attempt unknown
and is never retried: a finish reason of `length` or any other, malformed or
oversized JSON, an empty `content`, a redirect, a disconnection, a timeout.
Reasoning text returned beside the content is neither stored nor shown; a
response with reasoning and no content is not an answer.

**Protection.** Pseudonymization is skipped only for class `LOCAL_MODEL` with
boundary `LOCAL_ONLY`. The data policy and the block on reserved material stay
active. The exemption is written into provenance and into the attempt. For
agents and the API, protection is recomputed from the original text on every
send, as before.

**Limits.**

| Limit                      | Value   | Reason                                        |
| -------------------------- | ------- | --------------------------------------------- |
| Timeout for the whole call | 900 s   | A local model on a laptop can be slow         |
| Request body               | 1 MiB   | Bounds the reduced conversation context       |
| Response body              | 1 MiB   | The reasoning share is discarded              |
| Answer text                | 128 KiB | Same order as the agent answers               |
| `max_tokens`               | 8192    | Reasoning tokens count; leaves room to answer |

The limits are fixed in the request, not properties of the target, so the
target schema does not change. Every limit is refused before or during the call,
never truncated silently.

## Consequences

- A local turn has the same at-most-once and recovery guarantees as the other
  two boundaries, without pretending the three are alike.
- The check is a floor, not a proof: a loopback address can still be forwarded
  by another program on the machine. The user's declaration carries that part.
- The store duplicates the structure of the agent store, as ADR-0049 did, so
  qualified code is not touched. Extracting a shared store stays open.
- A response cut by `max_tokens` is unknown, not a shorter answer; the user
  asks again.
- Nothing here starts a server or reads a model file. A real run needs its own
  written card and the user's explicit go.
- The fixed values are a first estimate; the first real run may change them by
  a new decision.
