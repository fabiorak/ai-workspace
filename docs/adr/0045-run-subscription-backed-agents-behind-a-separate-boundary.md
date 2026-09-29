# ADR-0045: Run subscription-backed agents behind a separate execution boundary

Status: proposed
Date: 2026-09-17

## Context

The operator may have ChatGPT and Claude subscriptions that authorize Codex CLI
and Claude Code, without separately billed OpenAI or Anthropic API access. Both
products expose non-interactive commands, but neither is a plain model endpoint.
They can add product instructions, discover local configuration, maintain agent
state and invoke tools.

The existing qualification corpora therefore classify managed-login Codex and
Claude Code as `SEPARATE_AGENT_BOUNDARY`. Treating either command as an
`OPENAI_RESPONSES` or `ANTHROPIC_MESSAGES` transport would falsely claim exact
model-visible input, API-like isolation and equivalent attempt semantics.

## Decision

Introduce a distinct `AGENT_EXECUTION` target class. It is never routed through
`ModelDelivery`, never presented as a provider API and never used as a silent
fallback. The same conversation may select a model-delivery, agent-execution or
local-model target, but the GUI must name the class and the resulting provenance.

Start with one Codex CLI adapter. Add Claude Code only after the first boundary
is qualified end to end. Each adapter must:

- reuse only the product's supported managed login and never read, copy, return
  or persist its credential files or keychain values;
- receive reviewed protected content through standard input, never through a
  shell command or user-controlled command-line argument;
- run in a new bounded temporary workspace with an allowlisted environment;
- disable writes, network and tools as far as the product supports, with an
  independent operating-system timeout and process-tree cancellation;
- reject tool, file-change, retry, duplicate-final, malformed, incomplete and
  oversized process evidence;
- expose that the reviewed supplied input is not necessarily the complete
  model-visible input, because product and agent instructions can still exist;
- persist separate non-content attempt evidence before process exposure and
  preserve `UNKNOWN_AFTER_EXPOSURE` without an automatic rerun;
- import any retained transcript through the existing untrusted historical
  ingestion boundary instead of treating it as active memory.

The first live probe is answer-only and read-only. Repository mutation remains a
later A7 capability requiring an isolated worktree, an explicit action approval
and independent verification of the resulting diff and tests.

Claude Code managed-login automation remains distinct from `--bare`: current
official documentation states that bare mode skips OAuth and keychain reads, so
it cannot provide subscription authentication. Its adapter must account for the
broader managed product context and for subscription Agent SDK credit limits.
The first Claude Code target defaults explicitly to the stable `sonnet` alias;
the chosen alias remains inspectable and may be changed by the operator.

Direct Responses and Messages adapters remain optional API capabilities. Their
absence must not prevent a subscription-backed agent target from being selected,
and an agent login must never be repurposed as an API credential.

## Consequences

- a person can eventually switch between Codex, Claude Code and a local model
  while preserving AI Workspace conversation context and provenance;
- target configuration needs an additive schema revision before agent targets
  can become enabled production configuration;
- model quality comparisons must not claim that agent and API inputs are
  identical;
- subscription quotas and product rate limits replace per-request API cost for
  the managed-login probes, but they still require explicit live authorization;
- the existing conversation simulation and OpenAI Responses opt-in remain
  unchanged until the separate agent coordinator is implemented and tested;
- the offline implementation may contain a dormant subprocess runner, but adds
  no application wiring, direct credential access or live agent execution.

## Amendment: routing the conversation turn by class

Date: 2026-09-28. The ADR remains proposed.

The conversation turn now routes each selected target to its own boundary.
`MODEL_DELIVERY` still goes through `ModelDelivery`; `AGENT_EXECUTION` goes
through the ADR-0049 coordinator, only when the host offers an executor for
that kind. Composition, policy, instructions, pseudonymization, the durable
turn identity, the reviewed-payload binding, restoration, screening and the
canonical writer are the same for both. A local-model target, or an agent kind
the host did not offer, is refused before exposure with the draft kept.

Answers keep their class in the canonical history. General answers carry an
optional `executionClass` and an optional `reportedModel` in their provenance;
their absence means a model delivery stored before this change. Project answers
from an agent use the source label `AGENT_EXECUTION:<name>` instead of
`MODEL_CONVERSATION:<name>`, and every reader recognizes both. The requested
model or alias is recorded as requested; nothing is deduced.

For an agent target, the payload preview states that it shows exactly the input
AI Workspace supplies and that the agent product adds instructions of its own.

The standard host offers no agent. `AI_WORKSPACE_AGENT_EXECUTION` is an exact
process-level opt-in with `AI_WORKSPACE_AGENT_RUN_ROOT`,
`AI_WORKSPACE_AGENT_PATH` and one dedicated login directory per product
(`AI_WORKSPACE_CODEX_LOGIN_DIR`, `AI_WORKSPACE_CLAUDE_LOGIN_DIR`). The host
compares the installed file's digest with the reviewed list before starting
anything; only a listed file is asked for its version, and only a matching
version is offered. With the shipped empty lists, no agent is offered and no
agent program is started. Synthetic executors used by tests and the offline
demo declare themselves simulated, and the GUI labels them so.
