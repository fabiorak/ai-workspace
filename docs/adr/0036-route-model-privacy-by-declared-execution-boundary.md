# ADR-0036: Route model privacy by declared execution boundary

**Status:** accepted

**Date:** 2026-08-25

## Context

[ADR-0017](0017-require-an-inspectable-privacy-decision-before-model-delivery.md)
requires an inspectable, model-specific privacy decision before future model
delivery. [ADR-0034](0034-propose-a-complete-local-anonymization-for-one-approval.md)
makes anonymization a locally composed proposal and merges its approval with the
confirmation of the outbound operation.

Those records constrain external delivery but do not classify a model execution
boundary. Applying pseudonymization unconditionally to a model that executes
entirely inside the local trust boundary would reduce input fidelity and create
sensitive mapping and custody state without protecting an outbound operation.
Inferring locality from a model name, provider label, or configurable endpoint
would be unsafe: a loopback endpoint may proxy a remote service, and an adapter
may implement remote fallback.

## Decision

Classify every future model destination before choosing its privacy preparation:

- `LOCAL_ONLY` is an adapter capability whose contract guarantees local
  execution and local-only transport and forbids remote fallback. It is never
  inferred from a model identifier, provider name, user-supplied URL, or
  loopback address alone;
- `EXTERNAL` means that selected content may leave the computer;
- `UNCLASSIFIED` is the default for an unknown, unsupported, malformed, or
  insufficiently constrained destination.

The privacy path is determined from that class:

- `LOCAL_ONLY` retains the exact original content and requires neither
  pseudonymization nor outbound confirmation;
- `EXTERNAL` requires pseudonymization, inspection of the exact transformed
  text, and one outbound confirmation over that text;
- `UNCLASSIFIED` exposes no content and fails closed before privacy preflight.

Privacy preflight remains required for both permitted paths. Exact context
selection, provenance, integrity checks, model-policy binding, classification,
and fail-closed `RESTRICTED` detection are unchanged. Local execution is not an
exception to those controls; only the outbound transformation and confirmation
are absent.

An anonymization prepared for a later outbound purpose may remain local and,
as ADR-0034 already specifies, requires no separate confirmation. It is not a
mandatory gate for ordinary `LOCAL_ONLY` execution.

The initial production artifact is a provider-neutral, pure decision contract
in `@ai-workspace/privacy-gateway`. It performs no endpoint classification,
network access, credential access, model invocation, routing, fallback,
delivery, response handling, or execution. Its result explicitly authorizes
none of those effects. A future adapter must establish and enforce its own
declared boundary before it may supply `LOCAL_ONLY`.

ADR-0027 and ADR-0028 continue to govern evidence after possible external byte
exposure. They are not reinterpreted as local-model execution records. Mapping
schemas v1 and v2, custody, restoration, audit, and authorization semantics are
unchanged.

## Consequences

- local models receive faithful original context without an outbound ceremony;
- external delivery retains exact transformed-text review and one explicit
  authorization;
- generic configurable endpoints cannot acquire local trust merely by using a
  loopback address;
- destinations without sufficient evidence block instead of silently choosing
  the less restrictive path;
- privacy policy and restricted-data screening remain consistent across local
  and external models;
- a future local adapter and its execution evidence still require separate
  decisions and implementation;
- no runtime, framework, database, external dependency, provider adapter, or
  model access is introduced.
