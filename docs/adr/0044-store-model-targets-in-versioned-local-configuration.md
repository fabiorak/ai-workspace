# ADR-0044: Store model targets in versioned local configuration

Status: proposed
Date: 2026-09-14

## Context

The current continuation path receives a transient target assembled by the host or
synthetic demo. The redesigned conversation needs named targets in Settings, a
default, and a per-conversation choice that survives restart. This is new durable
configuration, so leaving its storage and authority implicit would let the browser
choose provider, privacy, policy, and instruction details independently.

Target metadata is not a credential. API keys and provider account state require
different custody and must not become browser-visible merely because display
configuration is persisted.

## Decision

Store model targets in a bounded, schema-versioned local configuration owned by a
provider-neutral package and implemented by a local adapter. Each enabled target
contains `targetId`, `displayName`, `providerKind`, `modelId`, declared execution
`boundary`, `profileRef`, `policyRef`, `instructionRefs`, explicit limits, and an
enabled flag. Persist global default selection separately from per-conversation
selection. Resolution precedence is conversation, explicitly linked project, then
global default. An unavailable or disabled selection fails visibly; the server
never chooses an alternative provider silently.

The browser exchanges only `targetId` and renders the validated `displayName`.
The server resolves all technical fields and revalidates them before exposure.
`LOCAL_ONLY` is an adapter guarantee under ADR-0036, not a value inferred from a
provider name, URL, or model ID. Unknown boundaries fail closed.

Use restrictive filesystem permissions, bounded canonical documents, owner-token
locking, and atomic publication consistent with existing local adapters. Do not
store API keys, bearer tokens, endpoint overrides, environment snapshots, local
paths containing secrets, or provider responses in this configuration. Credential
capabilities remain process-only and outside the target store. This decision adds
no provider SDK, runtime, database, network service, account discovery, or default
live target.

## Consequences

- model choices can survive restart without exposing provider configuration to the
  conversation route;
- target changes remain explicit and affect only the next message in the same
  conversation;
- local persistence needs corruption, concurrency, permissions, precedence, and
  migration tests before U2 can close;
- a configured target does not prove model availability and does not authorize
  delivery;
- the standard host continues with no real transport or credential unless an
  operator explicitly injects those separate capabilities.

## Implementation status

U2 implements the provider-neutral contract, local JSON adapter, authenticated
Settings and conversation routes, and persisted selection. The ADR remains
proposed while later increments connect no production provider and operational
review is still pending.
