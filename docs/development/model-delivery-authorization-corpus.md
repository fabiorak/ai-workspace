# Model-delivery authorization corpus and gates

**Frozen:** 2026-07-22, before ADR-0027 or authorization implementation

Sprint 33 uses only fictional identifiers and request text. The corpus measures
whether an authorization mechanism can constrain a future delivery operation;
it does not contact a provider, resolve an endpoint, use credentials, invoke a
model, or capture a response.

## Candidate intent

The canonical schema-v1 candidate contains only:

- `schemaVersion`, `authorizationId`, `issuedAt`, and `expiresAt`;
- `projectId`, `workItemId`, `handoffId`, and `modelId`;
- `profileDigest`, `policyDigest`, `preflightReportDigest`,
  `preflightAuditEventId`, and `preflightAuditEventHash`;
- `contextPackSchemaVersion`, `transformedRequestDigest`, `mappingSetId`, and
  `mappingSchemaVersion`;
- `confirmation: EXPLICIT_USER_CONFIRMATION` and
  `effect: AUTHORIZATION_INTENT_NOT_DELIVERED`.

Every digest is lowercase SHA-256. The exact transformed request is transient
input to the synthetic consumer and is never part of canonical intent bytes,
logs, receipts, or errors. The intent excludes Context Pack content, item
hashes, detected values, mapping plaintext, keys, passphrases, policy/profile
paths, prompts, responses, endpoints, provider credentials, and real identity
or project data.

Authorization lifetime is fixed at **60 seconds**. Issue and expiry timestamps
must be exact UTC values, expiry must equal issue plus 60 seconds, and
consumption at the expiry instant is rejected. IDs and text identifiers are
bounded to 256 characters; canonical intent bytes are bounded to 4 KiB.

## Frozen fictional journeys

The valid schema-v1 journey uses project `project-a`, Work Item `work-a`,
handoff `handoff-a`, model `model-a`, mapping `mapping-v1`, Context Pack schema
2, mapping schema 1, issue time `2026-07-22T09:00:00.000Z`, and fictional
transformed request `Review [[AW_CUSTOMER_1111111111111111]].`.

The valid schema-v2 journey uses the same project/model policy boundary,
mapping `mapping-v2`, mapping schema 2, issue time one minute later, and
fictional transformed request
`Esamina [[AW_PROJECT_2222222222222222]].`.

All fixture digests are derived from synthetic canonical metadata or synthetic
request text. No fixture represents a real endpoint, provider, credential,
customer, project, prompt, response, mapping plaintext, or security material.

## Candidate mechanisms

1. `TRANSIENT_CONFIRMATION` keeps no consumable state. It minimizes persistence
   but cannot prove single use across a GUI/transport boundary or restart.
2. `PERSISTED_REUSABLE_GRANT` crosses that boundary but deliberately permits
   replay and therefore fails the single-use gate.
3. `TRANSACTION_COUPLED_SINGLE_USE` reserves and consumes one exact intent
   before exposing transient request bytes to a synthetic delivery port. It can
   prevent local replay but cannot prove external exactly-once acceptance when
   a process fails after byte exposure and before a provider receipt.

The third mechanism is measured only in memory. No production store, facade,
API, GUI action, or transport may be inferred from a passing local case.

## Frozen case matrix

The harness must cover two valid schema versions plus: blocked preflight,
missing audit event, changed audit hash, stale report digest, changed policy,
changed profile, changed handoff, wrong model, wrong mapping, raw/untransformed
request, altered transformed bytes, expired intent, malformed expiry,
duplicate identity, replay after success, two concurrent consumers,
cross-project use, failure before byte exposure, failure after byte exposure,
and failure after synthetic acceptance.

Validation failures expose no transient request or rejected metadata to the
synthetic adapter. A valid local consumption exposes bytes exactly once and
returns only authorization ID, request digest, synthetic receipt ID, local
state, and a non-authorizing effect. The adapter records counts and digests,
never request bytes.

## Crash semantics

- **Before exposure:** no bytes reached the adapter. The reservation may be
  released in the measurement, but a future durable implementation needs an
  explicit recovery protocol.
- **After exposure, before receipt:** external acceptance is unknowable. The
  intent stays consumed and must not be replayed automatically.
- **After synthetic acceptance:** local consumed state and synthetic receipt do
  not prove provider acceptance after a real process crash.

No candidate may claim exactly-once external delivery, rollback, provider
acceptance, or safe retry without a concrete provider idempotency protocol.

## Decision gates

The measurement selects production adoption only if one candidate binds exact
scope and transient bytes, rejects every stale/altered/replayed case, remains
safe across all crash windows, stores no forbidden data or bearer-equivalent
secret, and can constrain a real transport without relying on mock-only state.

If transaction-coupled consumption passes local integrity gates but the
after-exposure crash remains ambiguous without a transport protocol, the frozen
decision is `EVIDENCE_ONLY`. ADR-0027, production persistence, GUI authorization,
provider integration, and network access remain absent.
