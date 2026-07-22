# Model-delivery authorization observations

The frozen Sprint 33 corpus and decision gates are defined in
[model-delivery-authorization-corpus.md](model-delivery-authorization-corpus.md).
Reproduce the deterministic measurement with:

```bash
npm run measure:delivery-authorization
```

## Reference result

The accepted reference run on 2026-07-22 produced:

- corpus SHA-256
  `a5e856f6fca081341061e4c18e5ae76f51039d473c170d73d886bddf1ba70da6`;
- 22 of 22 expected cases and zero incorrect cases;
- exact schema-v1/v2 mapping-scope and transformed-request binding;
- zero byte exposures for blocked, stale, missing-audit, altered, expired,
  malformed, and cross-scoped cases;
- one exposure for the one successful consumer in replay and concurrent cases;
- local replay and concurrent-consumption prevention;
- an unambiguous no-exposure result for failure before the synthetic adapter;
- ambiguous external outcome after byte exposure and after synthetic acceptance.

Transient confirmation is `REJECT` because it cannot cross a process boundary
or restart. A persisted reusable grant is `REJECT` because it does not prevent
replay. Transaction-coupled single-use consumption passes local integrity gates
but cannot establish whether a real provider accepted bytes when the process
fails after exposure and before a durable provider receipt.

## Decision

Decision: `EVIDENCE_ONLY`.

No ADR-0027 is accepted. The measured contract, in-memory store, and synthetic
adapter remain test-only development evidence. No production package export,
store, application facade, API route, GUI action, provider, endpoint, credential,
socket, DNS lookup, HTTP client, model invocation, response, routing, delivery,
or execution path is added.

A later transport sprint must begin with a concrete provider protocol and
freeze its idempotency key, acceptance receipt, timeout, retry, cancellation,
and crash-recovery semantics. It must not reuse this mock as proof of external
exactly-once behavior.
