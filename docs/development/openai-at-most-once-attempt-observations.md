# OpenAI bounded at-most-once attempt observations

The frozen inputs, state meanings, forbidden fields, 28 cases, and adoption
gates are defined in the
[corpus](openai-at-most-once-attempt-corpus.md).

Reproduce the offline measurement with:

```bash
npm run measure:openai-at-most-once
```

## Reference result

The deterministic run on 2026-07-22 produced:

- corpus SHA-256
  `fcb26fdf327786d4a4e381ef1c0f1c0dd197d2b7af3265808b71e31bc4aed721`;
- 28 of 28 expected cases and zero incorrect cases;
- zero create calls for invalid, altered, stale, expired, malformed, and proved
  pre-exposure failures;
- at most one fake application-level create per authorization across replay,
  concurrency, crash, restart, duplicate callback, and late callback cases;
- zero automatic or queued retries;
- explicit `UNKNOWN_AFTER_EXPOSURE` for timeout, crash, acknowledgement loss,
  malformed/mismatched receipt, and incomplete restart evidence;
- inspection-only recovery with no resend;
- fresh authorization plus explicit duplicate-processing and cost warning for
  a possible later attempt;
- decision `ADOPT_BOUNDED_AT_MOST_ONCE_PROTOTYPE`.

The command executes the corpus twice and compares complete canonical reports.
It is offline, credential-free, cost-free, and deterministic. The harness and
state store are test-owned. They open no socket, resolve no DNS, read no auth
state, invoke no model, capture no provider response, and create no production
store or runtime artifact.

## Product consequence

ADR-0027 accepts only the truthful attempt semantics. It does not accept a
production OpenAI adapter or claim provider exactly-once behavior. A future
prototype must make the single exposure claim restart-visible before invoking
the provider and must preserve uncertain outcomes without retry.

M5 remains incomplete. No live probe was run or authorized, and no credential,
network, provider adapter, response handling, GUI action, routing, fallback,
delivery, or execution surface was added.
