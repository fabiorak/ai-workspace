# Claude Code headless qualification corpus

**Frozen:** 2026-07-22, against local Claude Code `2.1.215`

Sprint 35 measures two non-interactive Claude Code profiles separately. Normal
reproduction uses only a deterministic fake executable port. It does not
launch Claude, inspect login or settings, access a keychain, contact Anthropic,
read a real repository, invoke a model, or capture a real response.

## Dated official and local evidence

The [official headless-mode documentation](https://code.claude.com/docs/en/headless),
retrieved on 2026-07-22, documents print mode, JSON and stream-JSON output,
structured output, tool controls, and multi-turn/session behavior. Local
credential-free `claude --version` and `claude --help` inspection confirmed
version `2.1.215` and `--bare`, `--safe-mode`, `--tools ""`, disabled slash
commands, no session persistence, system-prompt replacement, setting-source
selection, strict MCP configuration, permission modes, and maximum cost.

The local help explicitly states that `--bare` skips OAuth/keychain reads and
requires `ANTHROPIC_API_KEY` or an API-key helper. It is stronger process
isolation, but not a subscription-auth fallback to API access. Omitting
`--bare` can reuse an existing managed login, but the product may retain a
broader coding-agent boundary than an exact Messages request.

## Frozen profiles and cases

Both synthetic invocations fix print mode, safe mode, no tools, no slash
commands, no persistence, stream JSON, a strict response schema, explicit
system prompt, empty setting sources, strict empty MCP input, non-interactive
permission denial, reviewed model, and a USD 0.05 ceiling. Only the bare profile
adds `--bare`; both pass exact transformed input on stdin.

The 14 cases cover valid bare and managed streams; tool, MCP, plugin, and retry
events; nonzero exit; killed timeout with process-tree cleanup; incomplete and
duplicate results; malformed and oversized output; altered argv; and failed
process-tree cleanup. Receipts contain only invocation/stdin/result digests and
aggregate event counts. Process success proves only local argv/stdin/output
handling.

## Decisions

- Bare: `API_EQUIVALENT_NOT_FALLBACK`, because it requires API-key
  authentication or an equivalent helper.
- Managed login: `SEPARATE_AGENT_BOUNDARY`, because exact reviewed-input
  isolation from product instructions and agent context is not established.

No real conformance run, production subprocess adapter, auth access, model
call, response capture, routing, fallback, delivery, or execution path is
added.
