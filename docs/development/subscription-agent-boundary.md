# Subscription-backed agent boundary

Status: **offline implementation gate**. The dormant Codex and Claude Code
process runners are covered by synthetic executable tests. No Codex, Claude
Code, local model or provider API invocation is authorized by this document.

## Why this path exists

ChatGPT and Claude subscriptions can authorize their coding-agent products even
when separately billed API access is unavailable. AI Workspace will support
those products as agent targets, not disguise them as model APIs. The preserved
conversation and Context Pack remain provider-neutral; execution class,
permissions and provenance remain explicit.

Official references observed on 2026-09-17:

- OpenAI authentication documents ChatGPT sign-in for subscription-backed Codex
  access and `codex exec` as the stable non-interactive command:
  https://learn.chatgpt.com/docs/auth and
  https://learn.chatgpt.com/docs/developer-commands?surface=cli
- Claude Code documents `claude -p`, structured output and subscription Agent
  SDK credit. It also states that `--bare` skips OAuth/keychain reads and
  therefore needs API-key authentication:
  https://code.claude.com/docs/en/headless

## Execution classes

| Class             | Initial candidates                          | Meaning                                                              |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `MODEL_DELIVERY`  | OpenAI Responses; future Anthropic Messages | Exact application-supplied request through a provider API            |
| `AGENT_EXECUTION` | Codex CLI; later Claude Code                | Managed product process with its own instructions and agent boundary |
| `LOCAL_MODEL`     | Qwen through loopback llama-server          | Local inference adapter with no external exposure                    |

Changing the selected target never changes its class silently. The answer must
record target, model when reported, execution class and attempt identity.

## Increment A7.0 - offline Codex adapter qualification

Build one production-owned subprocess adapter behind an injectable process port,
but test it only with a deterministic fake executable. The intended real command
uses non-interactive ephemeral execution, JSONL output, read-only sandbox, no
approval prompts, ignored user config and rules, an isolated temporary working
directory, and exact input on stdin. The implementation must resolve supported
flags from the installed version before a live review; frozen 2026-07-22 flags
are evidence, not an eternal compatibility promise.

Gates:

- exact argv and stdin construction, without shell interpolation;
- bounded stdout and stderr, UTF-8 validation and strict event schema;
- one final answer and zero tool, command, file-change or retry events;
- timeout kills the complete process tree;
- nonzero, incomplete, duplicate, malformed and oversized results fail closed;
- environment allowlist excludes provider keys and unrelated process secrets;
- no read of `~/.codex/auth.json`, token output or auth discovery;
- separate durable attempt evidence and zero automatic retry after exposure.

## Increment A7.1 - offline Claude Code qualification

Apply the same port and evidence contract to managed-login `claude -p`. Do not
use `--bare`, because it disables the subscription login. Use an isolated empty
working directory, no tools, one agentic turn, structured output, no persistence,
strict empty MCP configuration and a bounded process timeout. Reject API-retry,
tool, MCP and plugin events rather than accepting them as a plain answer.

The initial Claude Code target uses the stable `sonnet` model alias by default.
The selected alias remains visible and configurable; no adapter may silently
replace it with another Claude model.

The review must state that managed login may still load product-owned context.
Only the supplied protected payload can be shown byte-for-byte; AI Workspace
cannot claim it is the complete model-visible prompt.

Gates, all met offline by `integrations/claude-code-agent`:

- exact argv and stdin construction, without shell interpolation, and without
  `--bare` in any branch;
- `sonnet` by default, carried verbatim into argv and replaceable by the
  operator;
- the one `system`/`init` event must load no tool, MCP server, plugin, hook,
  skill or memory; a non-empty list fails closed;
- assistant content must be text only: a `tool_use` or any other block fails
  closed;
- exactly one `result`/`success`, parsed against the supplied JSON schema, so
  prose in place of the object is a failure rather than an answer;
- a `retry` event, a second result, an unreviewed event type, a missing result,
  a nonzero exit, oversized or non-UTF-8 streams all fail closed;
- timeout kills the complete process tree, and an unverified tree keeps the
  outcome unknown;
- environment allowlist carries `HOME` and `CLAUDE_CONFIG_DIR` for the product's
  own managed login, and no provider key or unrelated process secret;
- no read of the credential file, keychain or token output by AI Workspace.

Still missing before any live probe, as for Codex: a separate agent attempt
store, a confined home and workspace, verification of the installed version and
its supported flags, and a reviewed authorization sheet. The frozen flags are
reviewed evidence, not a compatibility promise.

## Increment A7.2 - local-model rehearsal

Qualify the existing `qwen3.6-35b` loopback server through a separate
`LOCAL_MODEL` adapter. Do not add endpoint overrides to the OpenAI adapter.
Verify process ownership, loopback binding, response and reasoning limits,
cancellation and absence of fallback before exposing it in the target selector.

## Live gates

Each real agent probe needs a separate reviewed sheet containing executable
version, active login class, model selection, exact protected supplied input,
timeout, usage/quota impact, stop procedure and expected result. It must not read
credential files or run a task merely to discover whether an account works.

The first probe is answer-only in a temporary directory. A later repository
action requires a disposable worktree, explicit filesystem scope, reviewed tool
permissions, a predicted action and independent diff/test verification.
