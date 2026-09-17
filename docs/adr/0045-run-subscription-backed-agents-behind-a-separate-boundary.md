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
