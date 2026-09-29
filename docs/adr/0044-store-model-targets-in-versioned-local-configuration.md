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
  migration tests before the implementation can be accepted;
- a configured target does not prove model availability and does not authorize
  delivery;
- the standard host continues with no real transport or credential unless an
  operator explicitly injects those separate capabilities.

## Implementation status

The implementation provides the provider-neutral contract, local JSON adapter, authenticated
Settings and conversation routes, and persisted selection. The ADR remains
proposed while later increments connect no production provider and operational
review is still pending.

## Amendment: schema v2 with execution classes

Date: 2026-09-28. Status of this ADR is unchanged: proposed.

ADR-0045 requires the target to name its execution class before any agent or
local-model target can be configured. Schema v2 replaces the free-text
`providerKind` with a discriminated union:

| `executionClass`  | `kind`                  | Admitted `boundary`          |
| ----------------- | ----------------------- | ---------------------------- |
| `MODEL_DELIVERY`  | `OPENAI_RESPONSES`      | `EXTERNAL_SERVICE`           |
| `AGENT_EXECUTION` | `CODEX_CLI`             | `EXTERNAL_SERVICE`           |
| `AGENT_EXECUTION` | `CLAUDE_CODE`           | `EXTERNAL_SERVICE`           |
| `LOCAL_MODEL`     | `LLAMA_SERVER_LOOPBACK` | `LOCAL_ONLY`, `UNCLASSIFIED` |

Every other field keeps its v1 meaning and limits. An unknown kind, a kind in
another class or a boundary the kind does not admit fails closed. The class
does not replace the privacy classification, and a declared `LOCAL_ONLY` is
still an adapter guarantee to be verified, not a fact derived from the kind.

Migration is additive and happens on the first explicit change. Reading a v1
document interprets it in memory and writes nothing, so opening Settings has no
side effect. Only `OPENAI_RESPONSES` with `EXTERNAL_SERVICE`, the combination v1
could deliver, becomes `MODEL_DELIVERY`. Any other v1 entry is kept with
`executionClass: null`, `kind: null`, its original `legacyProviderKind` and
boundary: it stays visible but can be neither selected nor resolved until it is
saved again with a kind. A provider name therefore never makes an entry an
executable agent, and a v1 `LOCAL_ONLY` entry never becomes a local endpoint.

Before the first v2 publication the store writes the exact v1 bytes to
`configuration.v1-<sha256>.json` with the same private permissions and reads
them back. The digest in the name lets an interrupted migration reuse its own
copy; a different file under that name is never overwritten and stops the write
with the v1 document unchanged. Revision numbers, default and selections carry
over unchanged, so optimistic concurrency spans the migration.

Configured, enabled, qualified offline and available for explicit launch are
separate facts. Only `enabled` is stored. The host declares which kinds it has
qualified offline and which it can launch, and the target surface derives one
state per target on every read, without login, probe or process. The standard
host qualifies Responses, Codex CLI and Claude Code offline, and launches only
Responses: `SIMULATED` without the explicit transport opt-in, `AVAILABLE` with
it. Agent targets report `NOT_CONNECTED`, local-model targets `NOT_QUALIFIED`.
The simulated state is shown next to the name, so a target named like a real
model remains recognisable. The conversation turn still accepts only
`MODEL_DELIVERY` through `OPENAI_RESPONSES`; any other selected class is refused
before exposure with the draft kept, and is never delivered through Responses in
its place.
