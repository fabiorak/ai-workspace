# Sprint 34 — Qualify OpenAI Responses and Codex Headless Transports

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, provider-protocol qualification increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 33 completed with `EVIDENCE_ONLY`; no ADR-0027 or
production delivery surface exists

## Sprint goal

Determine whether OpenAI Responses API can become the first bounded model
delivery transport and whether stable non-interactive `codex exec`, authenticated
through an existing local ChatGPT/Codex login, is a safe fallback or instead a
separate agent-execution integration. Freeze protocol, privacy, receipt,
idempotency, timeout, cancellation, crash, and exact-input evidence before any
production adapter, credential flow, model call, response handling, or GUI send
action.

## Evidence and problem statement

Sprint 33 proves that transaction-coupled single-use authorization can prevent
local replay, expiry, alteration, and cross-scope use. It cannot determine
whether an external provider accepted a request after bytes were exposed and a
process crashed. M5 therefore remains incomplete and cannot advance through
another provider-neutral mock.

The user selected OpenAI as the first concrete provider family. The candidates
are not interchangeable:

1. OpenAI Responses API is a model API and the primary transport candidate.
2. `codex exec` is a stable non-interactive coding-agent surface. It can reuse
   saved CLI authentication, emit JSONL, run ephemerally, accept an output
   schema, and use a read-only sandbox, but it may load instructions, reason,
   inspect a workspace, and invoke tools beyond a plain model request.

Sprint 34 must establish the current documented contract and observable local
process boundary for each candidate without treating ChatGPT consumer UI,
ChatGPT authentication, OpenAI Platform API access, and Codex agent execution as
the same capability. Documentation claims are dated evidence and must be
revalidated during implementation.

## Committed backlog

### S34-01 — Freeze the OpenAI protocol and privacy matrix

- record dated official-source evidence for Responses API request lifecycle,
  authentication, storage/retention controls, streaming, request identifiers,
  idempotency, response retrieval, cancellation, timeout, error, and rate-limit
  semantics; mark undocumented guarantees as absent rather than inferred;
- record dated official-source and installed-CLI evidence for `codex exec`
  stability, authentication modes, `--ephemeral`, read-only sandbox, approval
  policy, JSONL events, output schema, exit status, session resume, working
  directory, instruction discovery, tools, network, and local state;
- freeze one versioned capability matrix that distinguishes provider
  acceptance from client receipt, response completion, local process exit, and
  durable recoverability after restart;
- pin evidence by retrieval date and document URL/version or local CLI version,
  without copying credentials, account identifiers, private headers, local
  paths, prompts, responses, or authentication state into the repository;
- avoid a model-name default: the exact model must continue to come from the
  reviewed profile and model policy, and availability must be checked at the
  transport boundary.

### S34-02 — Freeze provider-specific failure and decision gates

- extend the Sprint 33 matrix with failures before connect, before body
  exposure, after request transmission, after provider acknowledgement, during
  streaming, after response completion, during cancellation, and after local
  process termination;
- require exact binding to the consumed authorization, transformed request
  digest, model, policy, profile, project, Work Item, handoff, mapping identity,
  audit event/hash, provider kind, transport version, and attempt identity;
- distinguish safe retry, unsafe retry, operator reconciliation, terminal
  failure, and unknowable outcome without claiming exactly-once delivery;
- predeclare `ADOPT_FOR_PROTOTYPE`, `FALLBACK_ONLY`, `SEPARATE_AGENT_BOUNDARY`,
  `EVIDENCE_ONLY`, and `REJECT` outcomes for each candidate;
- require a new ADR only after one candidate can constrain a real transport
  without weakening the accepted privacy, mapping, custody, restoration, and
  decision-audit boundaries.

### S34-03 — Measure Responses API as the primary candidate

- add a test-only OpenAI transport contract and deterministic protocol harness
  using only synthetic pseudonymized requests and sanitized metadata;
- exercise serialization, headers-by-name without values, bounded response
  parsing, streaming termination, timeout, cancellation, duplicate attempt,
  malformed receipt, retry classification, and non-echoing errors without
  opening a socket;
- prove the harness stores no request body, response body, bearer material,
  mapping data, prompt, account identity, endpoint override, or unrestricted
  provider payload;
- permit at most a separately approved, opt-in live conformance probe after the
  offline gates pass; it must use synthetic transformed content, a process-local
  credential, an explicit cost bound, no repository persistence, and aggregate
  sanitized evidence only;
- if current official semantics or live evidence cannot close the
  after-exposure ambiguity, retain `EVIDENCE_ONLY` and add no production API
  adapter.

### S34-04 — Measure `codex exec` as a constrained fallback

- implement only a test-owned subprocess port against a deterministic fake
  executable; do not invoke Codex or a model during normal tests;
- freeze argv, stdin, stdout JSONL, stderr, exit-code, signal, timeout,
  truncation, malformed-event, output-schema, and child-process cleanup cases;
- require ephemeral operation, read-only sandbox, non-interactive approvals,
  bounded output, isolated working directory, and no credential or auth-file
  copying, logging, inspection, or persistence;
- measure whether project/user instructions, tools, workspace reads, session
  state, or additional model-visible context prevent exact reviewed-input
  binding; classify that result as `SEPARATE_AGENT_BOUNDARY` rather than
  silently weakening E7;
- permit an actual `codex exec` conformance run only after separate approval,
  using an isolated synthetic Git repository and existing local authentication;
  never run it against the AI Workspace repository or private project data.

### S34-05 — Document the decision without implying model access

- publish the frozen corpus, protocol evidence, limitations, sanitized
  observations, reproduction commands, and separate decision for each
  candidate;
- update architecture, threat model, data classification, development docs,
  planning, roadmap, and public design with the measured result;
- keep the GUI unchanged because a measurement-only provider qualification has
  no honest user action; record this as the reviewed GUI-delivery exception;
- preserve explicit labels for privacy review, authorization intent, local
  consumption, request transmission, provider acknowledgement, response
  completion, and local restoration;
- run clean build/check/audit, deterministic corpus reproduction, mapping v1/v2
  compatibility, custody/restoration/audit regression tests, diff check, and
  public-safety scan; create one commit without push only in a separately
  authorized implementation turn.

## Stop and re-plan triggers

- official documentation does not establish a required provider behavior and
  the plan would need to infer it;
- a live probe requires a credential, paid call, account/workspace access, or
  network use without separate explicit approval and a fixed cost/scope bound;
- safe behavior requires persisting request or response bodies, credentials,
  auth files, bearer-equivalent grants, mapping plaintext, keys, passphrases, or
  private identifiers;
- retries can duplicate externally visible work or provider acceptance cannot
  be reconciled after timeout/crash;
- `codex exec` cannot be prevented from loading unreviewed instructions,
  reading workspace data, invoking tools, persisting sessions, or adding
  model-visible content outside the reviewed request;
- qualification requires a production endpoint, provider SDK, credential UI,
  send button, response viewer, routing, fallback automation, or execution;
- either candidate is treated as generic ChatGPT access despite materially
  different authentication, billing, policy, state, and execution semantics.

## Out of scope

Production model access; API keys or access-token provisioning; copying or
reading Codex auth state; real customer/project content; provider selection
beyond OpenAI; ChatGPT UI automation; browser automation; production HTTP or
subprocess adapters; response persistence; streaming UI; model selector;
automatic retry, fallback, routing, billing, quota management, tool execution,
workspace mutation, session resume, output restoration after a real response;
mapping migration, re-encryption, passphrase change/reset, databases, services,
frameworks, and new external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

Implementation must add explicit deterministic measurement commands for the
Responses protocol corpus and the Codex subprocess corpus. Normal repository
gates must be credential-free, offline, cost-free, and deterministic. Any live
probe is optional, separately approved, excluded from `npm run check`, and must
leave no repository or runtime artifact behind.

## Definition of done

- dated official evidence and frozen cases precede provider-specific code;
- Responses API and `codex exec` receive separate capability, privacy, failure,
  and adoption decisions;
- exact authorization and transformed-byte binding are tested without storing
  content or secrets;
- every failure window has an explicit retry/reconciliation classification and
  no exactly-once claim exceeds provider evidence;
- the Codex candidate proves either strict isolation or that it belongs behind
  a later agent-execution boundary rather than E7 model delivery;
- no production provider, credential, endpoint override, model invocation,
  response capture, GUI send action, routing, fallback, or execution path is
  added;
- existing mapping v1/v2, custody v1, strict restoration, privacy audit, and
  Sprint 33 authorization evidence remain unchanged;
- full repository gates pass, documentation is synchronized, and no commit or
  push occurs during planning.

## Risks and mitigations

| Risk                                                | Mitigation                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ChatGPT, API, and Codex auth are conflated          | Model them as separate capabilities and never infer one entitlement from another                                    |
| A request ID is mistaken for durable acceptance     | Separate client send, provider acknowledgement, completion, and recoverability evidence                             |
| Retry duplicates external processing                | Default to no automatic retry after possible exposure unless provider evidence proves safe reconciliation           |
| Codex reads more than reviewed input                | Use an isolated synthetic repository and classify unavoidable extra context as a separate agent boundary            |
| Headless execution mutates files or invokes tools   | Require read-only sandbox, non-interactive approvals, fake-executable tests, and no production adapter              |
| Credentials leak through environment or diagnostics | Allow only process-local injection in separately approved probes; sanitize all outputs and persist no auth material |
| Documentation changes after qualification           | Date and cite evidence, record CLI version, and require revalidation before implementation                          |

## Planning decisions

- remain in E7/M5 because Sprint 33 did not complete enforceable model access;
- qualify a concrete OpenAI protocol before any production transport or ADR;
- treat Responses API as the primary model-delivery candidate;
- evaluate stable `codex exec` only as an optional local fallback and reject it
  from E7 if its agent behavior prevents exact reviewed-input isolation;
- make all routine evidence offline and deterministic; live calls require a
  later explicit approval even during implementation;
- defer GUI work because the sprint intentionally exposes no truthful model
  access action.

## Outcome and retrospective

Official OpenAI evidence was retrieved before the executable harness. The
Responses corpus then reproduced 13 of 13 cases with digest
`d4f64436e8bdce9725a5b87a2dc53284246e679b119230c0db5f89ec94397444`.
`store:false`, zero tools, exact transformed-byte binding, bounded typed events,
and pre-exposure blocking pass locally. `X-Client-Request-Id` supports provider
investigation but is not documented as create idempotency; post-exposure loss,
malformed receipt, and duplicate create therefore remain ambiguous. Responses
closes `EVIDENCE_ONLY` and ADR-0027 is not created.

The Codex fake-executable corpus reproduced 10 of 10 cases with digest
`c72a155fe0a9e563bbaf356d849d624df6e1840459fb34b1a4c4117bde8f94ab`.
The bounded ephemeral/read-only/JSONL process shape passes, but official and
local CLI evidence cannot prove that Codex's product instructions, repository
instructions, reasoning, and tool-capable agent context leave only the reviewed
request model-visible. Its decision is `SEPARATE_AGENT_BOUNDARY`, not an E7
fallback.

No live probe, credential read, auth inspection, DNS, socket, HTTP request,
Codex session, model call, response capture, production adapter, route, GUI,
routing, delivery, fallback, or execution was added. The reviewed GUI exception
was retained because there is no truthful user-facing model action.
