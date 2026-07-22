# Codex headless transport qualification corpus

**Frozen:** 2026-07-22, against local `codex-cli 0.144.6`

Sprint 34 measures whether stable non-interactive `codex exec` can act as an E7
model-delivery fallback. Normal reproduction uses only a deterministic fake
executable port. It does not invoke Codex, inspect authentication, contact a
service, run a model, read a real repository, or capture a real response.

## Dated official and local evidence

The [official non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode),
retrieved on 2026-07-22, defines `codex exec` as a stable non-interactive surface.
It documents saved CLI authentication reuse, `--ephemeral`, explicit sandboxing,
JSONL events, structured output schemas, and session resume. Local credential-
free `codex --version`, `codex --help`, and `codex exec --help` inspection
confirmed version `0.144.6` and the planned flags without starting a session.

The frozen invocation requests `--ask-for-approval never`, `exec`,
`--ephemeral`, `--json`, `--sandbox read-only`, `--ignore-user-config`,
`--ignore-rules`, the reviewed model, an output schema, an isolated synthetic
repository, and exact stdin. It excludes dangerous sandbox bypass, writable
directories, search, resume, images, MCP configuration, and auth-file handling.

These controls bound the local process but do not make Codex a plain text model
API. Codex still has product instructions, agent behavior, repository
instruction discovery, reasoning, and tool-capable event types. Ignoring config
and execpolicy rules does not prove that the exact transformed request is the
only model-visible input.

## Frozen cases and gates

The 10 fake-executable cases cover valid bounded JSONL; command and file-change
events; nonzero exit; killed timeout; missing completion; duplicate final
message; malformed JSONL; oversized stdout; and altered argv. The harness
returns only invocation, stdin, and final-message digests plus aggregate counts.
Tool or file events block the result; timeout remains ambiguous; malformed,
oversized, incomplete, duplicated, or altered process evidence fails closed.

Passing the process harness proves argv/stdin/output handling only. E7 adoption
also requires exact reviewed-input isolation, which the documented agent surface
does not establish.

## Decision

Decision: `SEPARATE_AGENT_BOUNDARY`.

`codex exec` is not accepted as a fallback model-delivery transport. It may be
evaluated later as an E9 agent-execution adapter with its own instruction,
permission, tool, workspace, authentication, and provenance boundaries. No
production subprocess adapter, Codex invocation, auth access, model call,
response capture, routing, fallback, delivery, or execution path is added.
