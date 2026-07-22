# Sprint 31 — Validate Safe Pseudonymized Output Restoration

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, output-restoration safety increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 30 completed; ADR-0021, ADR-0022, ADR-0023, and
ADR-0024 accepted

## Sprint goal

Determine whether arbitrary bounded local output containing exact mapping-owned
pseudonyms can be restored safely through an explicit fail-closed inspector,
using a frozen synthetic English/Italian corpus before any ADR or production
contract, without model access, delivery, routing, permission, or execution.

## Evidence and problem statement

Sprints 26–30 prove byte-exact restoration only for the unchanged transformed
Context Pack items whose hashes and pseudonym byte ranges are recorded in one
mapping. A future agent or model output is different: it may repeat, reorder,
omit, invent, truncate, reformat, or otherwise alter placeholders while adding
new text. Applying the existing position-based restore function to such output
would be invalid, while blindly replacing recognizable strings could restore
the wrong value or conceal an integrity failure.

The public design requires authorized responses to be safely deanonymized and
warns that a model may alter placeholders. This sprint addresses only the
model-free local validation boundary. Synthetic candidate output is neither a
model response nor evidence of delivery authorization.

## Committed backlog

### S31-01 — Freeze the output-integrity corpus and gates

- define bounded synthetic English/Italian candidate outputs derived from both
  permanent schema-v1 and explicit schema-v2 mappings;
- cover exact known tokens that are repeated, reordered, omitted, adjacent to
  Unicode or punctuation, and embedded in otherwise new output;
- cover unknown, malformed, truncated, case-altered, nested, split, ambiguous,
  cross-mapping, cross-scope, mixed-version, oversized, and no-token cases;
- pin exact input/output UTF-8 bytes, hashes, token counts, mapping identities,
  expected decisions, and unchanged-byte regions before implementation;
- require zero incorrect restorations, zero partial output on any blocked case,
  byte-exact preservation outside restored whole tokens, deterministic results,
  bounded scanning, and non-echoing failures.

### S31-02 — Compare bounded restoration policies

- compare strict whole-token restoration, which blocks the complete output on
  any unknown or malformed AI Workspace-shaped token, with a known-only
  substitution baseline that leaves anomalies untouched;
- resolve every token only from one authenticated, explicitly scoped mapping
  set and reject one pseudonym resolving to conflicting originals;
- distinguish `RESTORABLE_LOCAL_EVIDENCE`, `BLOCKED_INTEGRITY_FAILURE`, and
  `NO_PSEUDONYMS` without treating any result as privacy-policy approval;
- keep mapping schema v1 and v2 dispatch explicit and preserve current
  position-based Context Pack restoration unchanged;
- classify each policy `ADOPT_FOR_LOCAL_INSPECTION`, `REFINE`, or `NO_CHANGE`
  against the frozen gates.

### S31-03 — Decide the contract before production changes

- publish deterministic aggregate observations without candidate output,
  original values, mapping plaintext, passphrases, keys, or local paths;
- record `NO_CHANGE` if exact token integrity, scope binding, v1/v2
  compatibility, or all-or-nothing failure cannot be demonstrated;
- only after a passing decision, write ADR-0025 to define the local output
  restoration contract, authenticated mapping use, bounds, failure semantics,
  compatibility, GUI exposure, and separation from delivery authorization;
- require any future model adapter, outbound delivery, or response-ingestion
  path to receive a separate evidence gate and architecture decision.

### S31-04 — Roll out only an accepted local inspector

- add a pure provider-neutral output validator/restorer without changing
  mapping, review, custody-envelope, Context Pack, or privacy-policy schemas;
- add an authenticated project/Work Item/handoff-scoped loopback route that
  reads one existing encrypted mapping through its normal custody boundary;
- expose a bilingual, explicit local inspector with inert rendering, bounded
  input, restored preview only after complete validation, hashes, counts,
  limitations, and recovery guidance;
- never persist candidate or restored output, emit it to logs or audit events,
  return mapping plaintext, or accept caller-supplied scope/version overrides;
- preserve transformation and output restoration as separate user actions.

### S31-05 — Verify, document, and close

- test corpus bytes and hashes, v1/v2 dispatch, exact-token replacement,
  repeated/reordered tokens, Unicode boundaries, anomaly rejection,
  all-or-nothing behavior, bounds, scope, custody failures, and non-echoing
  errors;
- test facade, loopback authentication, CSRF/Origin/body limits, inert output,
  accessibility, English/Italian parity, and no-manual recovery;
- prove existing canonical v1/v2 mappings, encrypted documents, custody
  envelopes, Context Pack restoration, preflight, and review journeys remain
  unchanged;
- update ADR, architecture, threat model, user/developer documentation,
  planning, roadmap, and public design with the actual evidence and decision;
- run clean build/check/audit, deterministic corpus reruns, compatibility
  corpus, diff check, and public-safety scan; create one commit without push.

## Stop and re-plan triggers

- representative evidence would require a real response, identity, customer or
  project alias, mapping, key, passphrase, transcript, or recovery material;
- safe restoration requires changing or migrating mapping v1/v2, custody
  envelope v1, canonical Context Packs, or current exact restoration;
- an anomaly can produce partial restored output or echo selected plaintext in
  an error, report, log, fixture name, or persisted state;
- token ownership or mapping scope cannot be authenticated before replacement;
- the inspector would require a model, network, provider SDK, delivery path,
  routing, permission enforcement, execution, or a new external dependency.

## Out of scope

Model or agent invocation, outbound delivery, response capture, routing,
permissions, execution, claims about authorized responses, automatic
deanonymization, streaming output, audit-event persistence, mapping or key
export, sharing, sync, escrow, cloud recovery, migration, re-encryption,
passphrase change or reset, mapping/envelope schema changes, automatic entity
detection, standard-syntax rollout, dictionary persistence, databases,
services, frameworks, and external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The corpus command, exact fixtures, decisions, and thresholds must be frozen in
a development document before measurement or production implementation. All
inputs remain synthetic, bounded, local, and excluded from workspace state.

## Definition of done

- the corpus, exact expected bytes, anomaly matrix, and decision gates precede
  the measurement harness, ADR-0025, and production code in that order;
- schema-v1 and schema-v2 mappings are dispatched explicitly and remain
  byte-identical, immutable, encrypted, and permanently readable;
- every restored value comes from one exact whole token owned by the selected
  authenticated mapping and scope;
- every byte outside restored tokens is preserved exactly, while every blocked
  case returns no partial restored output and no sensitive echo;
- the existing position-based Context Pack restore path and custody-envelope
  schema v1 remain unchanged;
- a passing decision can authorize only a local inspector and never model
  access, delivery, routing, permission, execution, or automatic handling;
- full repository gates pass, documentation is synchronized, one commit is
  created, and no push is performed.

## Risks and mitigations

| Risk                                                   | Mitigation                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Token-shaped text is restored under the wrong mapping  | Bind one authenticated mapping and exact project/Work Item/handoff/model scope before scanning                 |
| Altered placeholders are silently left in a result     | Treat every unknown or malformed AI Workspace-shaped token as an all-output integrity failure                  |
| Partial restoration exposes a misleading mixed result  | Validate the complete bounded input before constructing any returned restored content                          |
| Existing exact restoration semantics regress           | Add compatibility gates and implement a separate output contract rather than generalizing the current function |
| A local preview is mistaken for delivery authorization | Use explicit non-authorizing decisions and add no model, network, routing, permission, or delivery consumer    |
| Synthetic evidence overstates provider behavior        | Claim only corpus-bounded token integrity; require separate provider and delivery evidence later               |

## Planning decisions

- Sprint 31 advances the remaining E7 response-restoration risk without
  crossing the separately governed model-delivery boundary;
- strict all-output failure is the initial safety candidate; known-only
  substitution exists only as an explicit comparison baseline;
- output restoration is a new contract because current mapping positions and
  transformed-content hashes describe original Context Pack items, not
  arbitrary output;
- v1/v2 mapping compatibility and custody-envelope v1 are invariants, not
  migration opportunities;
- GUI delivery is included only if the frozen corpus supports an ADR and a
  production-local contract; otherwise the sprint closes with evidence and
  `NO_CHANGE`.

## Execution log

### 2026-07-22

- S31-01 froze 13 bilingual synthetic cases, v1/v2 mapping fixtures, exact
  hashes, anomaly expectations, bounds, scope failures, all-or-nothing gates,
  and the strict-versus-known-only decision algorithm before implementation.
- S31-02 implemented a separate provider-neutral output contract and
  deterministic harness. Two runs, including reverse case order, produced the
  same corpus digest, case hashes, decisions, reasons, and counts.
- `STRICT_WHOLE_TOKEN` produced three exact restores, nine complete blocks,
  one no-token result, zero incorrect cases, and zero partial blocked outputs,
  yielding `ADOPT_FOR_LOCAL_INSPECTION`. The comparison baseline partially
  restored two anomaly cases and remains unexported from the package root.
- S31-03 accepted ADR-0025 only after the passing corpus. Permanent mapping v1,
  explicit mapping v2, custody-envelope v1, encrypted storage, canonical
  Context Packs, and position-based restoration remain unchanged.
- S31-04 added the strict package export, authenticated mapping/custody facade,
  project/Work Item/handoff-scoped loopback route, bilingual local GUI, inert
  rendering, complete-result blocking, and cleared passphrase fields. Schema
  and model come from authenticated state rather than caller overrides.
- S31-05 added unit, application, interaction-contract, localization, and
  loopback acceptance coverage plus corpus reproduction and public docs.

## Sprint review

Arbitrary output is now treated as a distinct integrity boundary. Known exact
mapping-owned tokens can repeat, reorder, and appear in new UTF-8 text, but one
unknown or altered placeholder blocks the complete result. This avoids
misusing original Context Pack byte positions and prevents the partially
restored states demonstrated by the permissive baseline.

The GUI action is deliberately narrower than response handling: users paste
bounded local text, select one existing mapping, and receive restored content
only after full validation. Candidate and restored output are transient and no
model, response-capture, persistence, audit, routing, permission, delivery, or
execution graph was added.

## Retrospective

What worked:

- freezing the mixed known-plus-anomaly case made all-or-nothing behavior a
  measurable gate rather than an implementation preference;
- keeping the permissive policy out of the package root prevented measurement
  code from becoming an accidental production option;
- deriving schema and model from authenticated mapping state reduced caller
  authority and kept the route contract small.

What changed during implementation:

- the pure domain bound remains 1 MiB, while the loopback server's existing
  32-KiB request cap and the GUI's 30,000-character cap provide a tighter web
  boundary;
- nested malformed input also demonstrated partial restoration in the baseline,
  so observations record two partial anomaly cases rather than only the
  predeclared mixed case;
- no mapping, custody, Context Pack, or persisted schema change was required.

Next-increment recommendation:

- select the next E7 boundary from observed user need; audit persistence and
  model delivery remain separate decisions;
- do not infer model-response authenticity or complete output safety from exact
  placeholder integrity;
- retain standard syntax and combined entity candidates as `REFINE` until new
  frozen evidence addresses the telephone false positive.

## Final verification

- formatting, lint, typecheck, clean composite build, full test suite, targeted
  v1/v2 compatibility, two-run corpus reproduction, and isolated loopback
  acceptance passed;
- the loopback journey passed all 18 scenarios outside the filesystem/network
  sandbox required for binding its local listener;
- dependency audit reported zero vulnerabilities;
- diff validation and public-safety scans passed with synthetic fixtures only;
- one commit is created without push as the final close action.
