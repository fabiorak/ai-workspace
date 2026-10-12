# Local model boundary

Status: **offline implementation gate**. The local model path is wired into the
conversation turn and qualified only against a synthetic server on loopback.
No real model has been contacted, and no real run is authorized by this
document.

## Why this path exists

A local model is the one target for which protected text need not leave the
machine. That holds only if the address really is the machine, so AI Workspace
checks what it can check and shows what the user has declared. The path is
separate from direct model delivery and from agents: it has its own class
(`LOCAL_MODEL`), its own adapter and its own attempt record. Changing the
selected target never changes its class silently.

The decision is recorded in
[ADR-0051](../adr/0051-confine-the-local-model-behind-a-loopback-boundary.md).

## What AI Workspace does and does not do

The target kind is `LLAMA_SERVER_LOOPBACK`, class `LOCAL_MODEL`. You start
`llama-server` yourself. AI Workspace does not start or stop it and does not
know which model file it serves.

Each answer takes one call: `POST /v1/chat/completions`, without streaming,
with one whole JSON response. The adapter ignores the proxy variables of the
environment, follows no redirect, and never falls back to another address,
target, executor or delivery.

## Offering the model

The local model is offered only when the process receives, at start, the
variable `AI_WORKSPACE_LOCAL_MODEL_ENDPOINT`:

| Variable                            | Meaning                                            |
| ----------------------------------- | -------------------------------------------------- |
| `AI_WORKSPACE_LOCAL_MODEL_ENDPOINT` | `http://127.0.0.1:<port>` or `http://[::1]:<port>` |

Any other value stops the start with a message: a host name such as
`localhost`, `0.0.0.0`, `https`, a path, credentials or a missing port. No name
is ever resolved. Without the variable nothing is offered and nothing is
contacted. When it is accepted, the terminal prints `Local model offered at
<origin>. AI Workspace does not start or stop that server.`

Setting the variable is not an authorization for a real run.

## States in Settings

| Situation                             | State in Settings                    |
| ------------------------------------- | ------------------------------------ |
| Variable not set                      | Qualified offline, not connected yet |
| Variable set, boundary `LOCAL_ONLY`   | Available                            |
| Variable set, boundary `UNCLASSIFIED` | Unclassified (not available)         |

The target must declare the `LOCAL_ONLY` boundary. That declaration is yours.
The numeric-address check is a minimum: another program on the same machine can
forward a loopback port, and the process that listens may not be the one you
believe it is. AI Workspace cannot prove either.

## Protection

Pseudonymization is skipped only for class `LOCAL_MODEL` with boundary
`LOCAL_ONLY`: the model receives the original text. The data policy and the
block on reserved material stay active.

For agents and for the API, protection is recomputed from the original text on
every send. Switching from a local target to an external one therefore never
reuses text that was left unprotected.

The exemption is written into the attempt, in the `protection` field, and the
answer is saved with class `LOCAL_MODEL` in the history. In **Show protections**
a local target shows a note: it receives the original text without
replacements, the policy and the block still apply, and that the address is
really the computer is the user's declaration. The review before sending is not
available for a local target, because there is no protected text to review; the
interface says so.

## Valid answer

An answer is valid only if the response is one whole JSON document within the
limits, has exactly one choice, a finish reason of `stop` and a non-empty
`message.content`. Reasoning text returned beside the content is neither stored
nor shown; a response with reasoning and no content is not an answer.

| Limit                      | Value   |
| -------------------------- | ------- |
| Timeout for the whole call | 900 s   |
| Request body               | 1 MiB   |
| Response body              | 1 MiB   |
| Answer text                | 128 KiB |
| `max_tokens`               | 8192    |

The limits are fixed in the request and are not properties of the target. A
limit is refused before or during the call and never truncated silently.

## Attempts and recovery

Local attempts are kept in a separate append-only store with a hash chain, in
the home directory under `local-model-run-attempts`. It holds digests only: no
text, answer, reasoning or address.

- A durable claim is written before the call.
- After the call has begun, every outcome that is not validated is unknown and
  is never rerun.
- The states are the five of the agent attempts. There is no receipt state,
  because a local server gives none.
- A response cut by `max_tokens` is unknown, not a shorter answer: ask again.

The turn reference carries class `LOCAL_MODEL`. Recovery after a restart reads
only this store, even when the restart happens without the variable.

## Modules

| Module                                  | Owns                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| `packages/local-model-execution`        | Port, limits, outcomes, coordinator and attempt contract |
| `integrations/llama-server-loopback`    | The HTTP call and nothing else                           |
| `integrations/local-model-run-attempts` | The file-backed attempt store                            |

## Live gate

Qualification is offline: tests use a synthetic server on loopback. A real run
needs its own written sheet and your explicit approval. The sheet states the
server and model in use, the exact input, the timeout, the stop procedure and
the expected result. The fixed limits are a first estimate and may change by a
new decision after a real run.
