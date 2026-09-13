# ADR-0040: Coordinate explicit model delivery with durable attempts

Status: proposed
Date: 2026-09-08

## Context

Conversation preparation now resolves an immutable handoff and produces a reviewed
local payload. Delivery requires a separate permission and a durable record before
any possible external exposure. Provider request identifiers do not provide an
idempotency guarantee. The existing attempt store already defines the necessary
non-content states and crash recovery.

## Decision

Introduce a provider-neutral `model-delivery` use case with injected transport and
the existing `ModelAttempts` service. Its bounded transient preparations contain
the exact text, model, explicit external destination, output and timeout limits,
project/work/handoff scope, privacy-audit hash and a binding digest of the reviewed
configuration, instructions, policy, mapping and source state. Preparations expire
and disappear at restart. The privacy review accepts the passphrase once and keeps
only the derived mapping key in memory until the authorized send. The passphrase
and credentials never enter this contract.

Confirmation consumes one opaque authorization synchronously before asynchronous
work. The application revalidates the binding; a change requires recomposition
and another review. Persist PREPARED, then claim EXPOSURE_STARTED and inspect the
published claim before invoking transport. A duplicate click, concurrent request,
replay or consumed authorization cannot invoke transport again. Failures before
transport are use-case outcomes, not a new persisted attempt state.

Use one bounded request, without streaming, remote tools, automatic retry,
fallback, arbitrary endpoint or credential-forwarding redirect. OpenAI Responses
is the first candidate under ADR-0027. The adapter uses Node's existing HTTP
primitives, a fixed official endpoint and a process-only credential capability.
Model and limits are explicit configuration, never inferred from a model name.
Live tests require the separate reviewed synthetic probe and cost approval.

Conclusive rejection is recorded separately from an uncertain transport outcome.
After possible exposure, interruption, malformed response or unavailable evidence
means UNKNOWN_AFTER_EXPOSURE. Recovery runs during startup/coordinator setup,
never from a GET and never resends. A new deliberate request after an unknown
outcome requires new authorization and a duplication/cost warning. Provider IDs
are hashed correlation values. The attempt store retains neither request nor
response body, credential, raw provider ID, path nor endpoint. Completion of an
attempt does not claim that the answer was retained in conversation history.

The GUI previews the final serialized text after privacy substitutions. The
adapter must not append invisible prompts or transform text after confirmation.
The transient privacy projection adds the user's question to expanded context;
it is not a mutation or new version of the canonical Context Pack. All actual
outgoing text, including instructions and the question, is screened. Exact byte
counts include the envelope; they do not assert a model's token capacity.

## Consequences

The base route remains usable for local preparation without a provider. External
activation stays explicit and local HTTP authentication, Host/Origin, CSRF and
body bounds remain in force. Transient capacity and expiry are bounded; there is
no permanent prompt cache. Existing mapping schemas and encrypted custody remain
unchanged. Disk integrity errors fail closed. Offline contract and fault tests
precede a live probe; fake transport results are never presented as live evidence.
