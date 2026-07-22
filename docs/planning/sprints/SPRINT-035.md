# Sprint 35 — Qualify Anthropic Messages and Claude Code Headless Transports

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, second-provider qualification increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 34 completed; Sprint 33 single-use authorization remains
`EVIDENCE_ONLY`; no ADR-0027 or production delivery surface exists

## Sprint goal

Determine whether Anthropic Messages API can become a second bounded model
transport and whether Claude Code non-interactive mode can serve as a safe local
fallback through existing Claude authentication or instead belongs behind a
separate agent-execution boundary. Freeze provider, privacy, exact-input,
receipt, idempotency, retry, streaming, timeout, cancellation, cost, and process
evidence before any production adapter, credential access, model call, response
handling, routing, or GUI action.

## Evidence and problem statement

Sprint 34 established the reusable qualification method but did not authorize
model access. OpenAI Responses remains `EVIDENCE_ONLY`, while `codex exec` is a
`SEPARATE_AGENT_BOUNDARY`. Provider neutrality now requires applying the same
gates to a genuinely different provider rather than generalizing OpenAI
behavior.

The user selected Claude as the second provider family. The concrete candidates
are distinct:

1. Anthropic Messages API `POST /v1/messages` is the primary model-transport
   candidate. It supports stateless message input and optional SSE streaming.
2. Claude Code `claude -p` is a non-interactive coding-agent surface. The
   locally observed `2.1.215` CLI exposes JSON/stream-JSON, JSON Schema,
   no-session-persistence, tool controls, permission modes, safe mode, bare
   mode, system-prompt replacement, and a maximum-cost flag.
3. Claude Code `--bare` deliberately avoids OAuth/keychain reads and requires an
   Anthropic API key or configured helper. It may improve isolation, but cannot
   count as a subscription-auth fallback to the API it still uses.
4. Claude Code with existing managed login can be a genuine authentication
   fallback, but omitting `--bare` may load product/configuration context that
   must not be assumed equivalent to an exact Messages request.

Sprint 35 must keep Claude product access, Anthropic API credentials, Claude
Code login, third-party providers, and agent execution separate in contracts,
evidence, decisions, and user language.

## Committed backlog

### S35-01 — Freeze official Anthropic and Claude Code capability evidence

- record dated official-source evidence for Messages create and streaming,
  authentication headers, API versioning, request/message identifiers, rate
  limits, documented automatic SDK retries, timeout and overload behavior,
  storage/retention, cancellation or retrieval availability, tool blocks,
  stop reasons, and error semantics;
- mark create idempotency, exactly-once acceptance, post-timeout retrieval, and
  safe duplicate suppression absent unless current official documentation
  states them explicitly;
- record official and installed-CLI evidence for Claude Code `-p`, `--bare`,
  `--safe-mode`, `--tools ""`, `--disable-slash-commands`,
  `--no-session-persistence`, `--output-format`, `--json-schema`,
  `--system-prompt`, `--setting-sources`, `--strict-mcp-config`,
  `--permission-mode`, `--max-budget-usd`, signals, retries, and process exit;
- freeze the observed CLI version and feature flags by evidence date without
  copying account data, auth state, keychain content, settings, private paths,
  prompts, responses, or credential values;
- retain profile-governed exact model selection; introduce no mutable default,
  alias expansion, automatic fallback model, or provider routing.

### S35-02 — Freeze provider-specific request and failure gates

- bind every candidate to provider kind/version, single-use authorization,
  attempt identity, exact serialized body digest, transformed-request digest,
  reviewed model, policy/profile, project, Work Item, handoff, mapping identity,
  and privacy-audit event/hash;
- constrain Messages input to the exact reviewed system/input representation,
  one model, fixed bounded output, no client or server tools, no images/files,
  no cache controls, no batches, and no provider-specific beta behavior;
- cover failure before exposure, after headers/body transmission, after message
  start, during content deltas, after message stop, on overload/rate limit,
  timeout, malformed receipt, truncated stream, caller cancellation, duplicate
  create, and local crash;
- distinguish provider request/message IDs from idempotency keys and classify
  every outcome as safe retry, terminal, operator reconciliation, or never
  automatic retry;
- predeclare `ADOPT_FOR_PROTOTYPE`, `API_EQUIVALENT_NOT_FALLBACK`,
  `FALLBACK_ONLY`, `SEPARATE_AGENT_BOUNDARY`, `EVIDENCE_ONLY`, and `REJECT`
  independently for Messages, bare headless, and managed-login headless.

### S35-03 — Measure Anthropic Messages as the primary candidate

- add a test-only Anthropic protocol contract and deterministic fake adapter
  using only synthetic pseudonymized v1/v2 requests and sanitized metadata;
- validate canonical body construction, required header names without values,
  fixed API version, exact input binding, zero tools, bounded output,
  non-streaming response and typed SSE event parsing;
- cover unexpected tool use, refusal, pause, max-token termination, overload,
  retryable/non-retryable errors, malformed blocks, reordered or duplicated
  stream events, timeout, cancellation, and post-exposure ambiguity;
- return only digests, counts, safe status/stop classifications, attempt/message
  ID digests, and non-authorizing effects; never retain request/response bodies,
  error text, credential material, account IDs, or unrestricted headers;
- add no production API adapter if official evidence cannot prove safe create
  retry and externally reconcilable acceptance.

### S35-04 — Measure Claude Code headless profiles separately

- implement only test-owned process contracts against deterministic fake
  executables; normal tests must not launch Claude Code or a model;
- freeze a bare profile with explicit system prompt, no tools, disabled slash
  commands, no persistence, strict empty MCP configuration, structured output,
  bounded cost, and non-interactive permission denial;
- freeze a managed-login profile that never reads or copies auth material and
  compare its effective settings, startup events, tools, plugins, MCP servers,
  hooks, memory/instruction discovery, and model-visible context with the bare
  profile;
- test exact argv/stdin, JSON and stream-JSON, init/result metadata, tool or
  subagent events, built-in retry events, stderr, nonzero exit, timeout/SIGTERM,
  process-tree cleanup, truncation, bounds, schema failure, and non-echo errors;
- classify bare mode `API_EQUIVALENT_NOT_FALLBACK` if it requires the same API
  credential, and classify managed-login mode `SEPARATE_AGENT_BOUNDARY` unless
  exact reviewed-input isolation is demonstrated without unsafe auth handling;
- permit no real `claude -p` conformance run without separate approval, an
  isolated synthetic Git repository, explicit cost cap, and cleanup proof.

### S35-05 — Compare providers and close without implicit routing

- publish separate frozen corpora, source matrix, sanitized observations,
  reproduction commands, and decisions for Messages, bare headless, and
  managed-login headless;
- compare only protocol/security properties with Sprint 34; do not rank model
  quality, price, latency, or availability from offline evidence;
- update architecture, threat model, data classification, development docs,
  planning, roadmap, and public design with the measured result;
- keep the GUI unchanged and record the reviewed exception because there is no
  authorized send, provider selector, response, or truthful fallback action;
- run clean build/check/audit, all new measurements, Sprint 31–34 regressions,
  mapping v1/v2 compatibility, diff check, and public-safety scan; create one
  commit without push only in a separately authorized implementation turn.

## Stop and re-plan triggers

- current official Anthropic behavior cannot be established without inference;
- a live request, Claude Code session, account login, keychain/auth inspection,
  paid use, or credential access would occur without separate explicit approval;
- Messages retries may duplicate provider processing and no documented
  idempotency or post-timeout reconciliation closes the ambiguity;
- exact serialized input requires sending unreviewed system text, tool schemas,
  cache state, files, images, URLs, or provider-managed context;
- Claude Code managed-login isolation requires reading, exporting, copying, or
  persisting auth/configuration state;
- headless execution can load tools, hooks, plugins, MCP servers, skills,
  CLAUDE.md, memory, worktree content, or automatic fallback models outside the
  frozen boundary;
- safe qualification requires a production network/subprocess adapter,
  dependency, credential UI, provider selector, send/retry button, response
  viewer, routing, or execution.

## Out of scope

Live Messages calls; actual `claude -p`; API keys, setup tokens, OAuth or
keychain access; Amazon Bedrock, Google Vertex AI, Microsoft Foundry, or other
third-party Claude providers; production HTTP/subprocess adapters; prompt
caching; message batches; files/images/PDFs; tools, computer use, web search,
MCP, plugins, skills, hooks, subagents, worktrees, sessions, automatic model
fallback, provider routing, response persistence/restoration, streaming UI,
billing, quotas, migration, re-encryption, passphrase change/reset, databases,
services, frameworks, and new external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

Implementation must add separate deterministic measurement commands for the
Messages protocol corpus and Claude Code headless profiles. Normal gates remain
offline, credential-free, cost-free, and deterministic. Any live conformance
probe is optional, separately approved, excluded from `npm run check`, bounded
by synthetic input and maximum cost, and must leave no repository or runtime
artifact.

## Definition of done

- dated official evidence and frozen cases precede executable qualification;
- Messages, bare headless, and managed-login headless receive separate
  capability, privacy, failure, authentication, and adoption decisions;
- exact serialized request and transformed-byte binding are tested without
  storing content, error bodies, settings, auth state, or credentials;
- retries and every failure window have explicit conservative classifications;
- no headless profile is called a fallback when it merely uses the same API
  credential or introduces unreviewed agent context;
- no production provider, credential, network, subprocess, model invocation,
  response, routing, GUI, fallback, delivery, or execution path is added;
- OpenAI evidence, Sprint 33 authorization, mapping v1/v2, custody v1, strict
  restoration, and privacy audit remain unchanged;
- full repository gates pass, documentation is synchronized, and no commit or
  push occurs during planning.

## Risks and mitigations

| Risk                                                        | Mitigation                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Claude product login and Anthropic API access are conflated | Model API key, setup token, managed login, and third-party credentials separately                    |
| Bare mode is mislabeled as fallback                         | Classify it API-equivalent when it requires the same Anthropic API credential                        |
| SDK retry duplicates a create                               | Freeze documented retry behavior and never infer idempotency from backoff or request IDs             |
| Claude Code loads unreviewed context                        | Compare bare and managed profiles; disable tools/customizations and fail on unexpected init metadata |
| Headless mode incurs uncontrolled cost                      | Require fixed model, bounded output, `--max-budget-usd`, synthetic input, and separate live approval |
| JSON/stream metadata leaks identities or content            | Return only validated digests/counts and sanitize all errors                                         |
| Provider comparison becomes automatic routing               | Publish independent decisions and add no selector, fallback policy, or production consumer           |

## Planning decisions

- remain in E7/M5 and add Anthropic as the second concrete provider family;
- qualify Messages API before any production transport or provider-neutral
  generalization;
- evaluate Claude Code bare and managed-login headless profiles independently;
- treat authentication substitution as different from transport safety;
- keep all ordinary evidence offline and require new approval for any paid or
  authenticated call;
- defer GUI and routing because the sprint exposes no authorized model access.
