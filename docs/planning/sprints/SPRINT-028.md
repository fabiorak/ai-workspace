# Sprint 28 — Measure Reviewed Entity Candidate Discovery

**Primary epics:** E0 — Product foundation; E7 — Privacy Gateway

**Milestone:** M5 privacy-ready beta, entity-discovery evidence increment

**Status:** completed

**Cadence:** two-week timebox

**Dependency:** Sprint 27 completed; ADR-0021 and ADR-0022 accepted

## Sprint goal

Measure whether bounded, local, deterministic recognizers can propose useful
exact UTF-8 entity spans for explicit human review, using a frozen synthetic
English/Italian corpus, without automatically selecting or transforming
content and without changing the production privacy journey.

## Evidence and problem statement

Sprint 26 deliberately requires users to identify every pseudonymized span.
This keeps false-positive and false-negative risk visible, but routine manual
byte-range discovery is not a usable long-term inspector workflow. Sprint 27
removed raw mapping-key handling without changing that review boundary.

The public design anticipates standard entities and project-specific aliases,
but no evidence currently shows which deterministic recognizers are precise
enough even to suggest review candidates across prose, structured text, and
source code. Adding detection directly to the GUI would silently turn an
unmeasured heuristic into a security boundary. This sprint therefore produces
development-only evidence; it does not authorize a production detector.

## Committed backlog

### S28-01 — Freeze the corpus and decision gates

- define exact reviewed-span ground truth over synthetic English and Italian
  prose, structured text, and source-code-like content;
- cover repeated values, aliases, case variants, Unicode, adjacent and
  overlapping-looking tokens, public terms, placeholders, and realistic
  detector-shaped negatives;
- separate standard syntax candidates from exact user-configured business
  aliases and keep existing high-confidence Restricted secret detection an
  independent blocking control;
- predeclare exact-span precision/recall, per-category miss, false-positive,
  UTF-8 boundary, determinism, boundedness, and no-echo gates before building
  the harness.

### S28-02 — Add isolated deterministic candidate adapters

- compare bounded standard syntax recognizers, exact alias-dictionary matching,
  and their deterministic union against the unchanged manual-review baseline;
- emit only proposed entity type, item identity, exact UTF-8 byte range, hashes,
  counts, and reason codes; never emit matched text in reports or errors;
- reject malformed dictionaries, ambiguous duplicate aliases, invalid Unicode
  boundaries, oversized inputs, and conflicting candidates without partial
  results;
- use only accepted platform APIs and repository code, with no model, network,
  external service, new runtime, native package, or production integration.

### S28-03 — Build a development-only measurement harness

- run every candidate over the frozen corpus in stable permutations and
  reconcile exact true-positive, false-positive, false-negative, collision,
  category, item, and byte counts;
- distinguish exact-span matches from partial, wider, narrower, or wrong-type
  matches instead of crediting substring overlap;
- verify repeated runs produce identical candidates, ordering, hashes, counts,
  and decisions;
- keep corpus generation, candidate adapters, and reports outside the facade,
  HTTP routes, GUI, persistence, Context Pack writer, and mapping stores.

### S28-04 — Decide from the frozen evidence

- publish aggregate deterministic observations separately from host timing;
- classify each candidate `ADOPT_FOR_REVIEW`, `REFINE`, or `NO_CHANGE` against
  the predeclared gates;
- retain explicit manual reviewed spans unchanged if no candidate passes;
- require a later ADR and sprint before any accepted candidate can influence a
  production review surface, policy decision, transformation, or delivery
  path.

### S28-05 — Verify, document, and close

- run clean build/check/audit, deterministic reruns, diff checks, and public
  safety scans;
- update development, architecture, security, planning, and public design
  documentation with measured results and limitations;
- plan the next increment from the decision rather than enabling delivery;
- create one commit without push.

## Stop and re-plan triggers

- representative evaluation would require real identities, customer aliases,
  transcripts, mappings, credentials, or recovery material;
- a candidate requires a model, network access, telemetry, external service,
  or a new dependency before an ADR;
- suggested spans cannot remain distinguishable from explicitly reviewed
  spans throughout the experiment;
- a report, error, fixture name, or snapshot would expose matched entity text;
- exact UTF-8 boundaries or deterministic conflict handling cannot be defined
  without changing mapping schema v1 or canonical Context Packs.

## Out of scope

Production or automatic entity detection, semantic/ML/LLM classification,
identity inference, complete PII or secret-detection claims, GUI changes,
automatic selection or transformation, custom-dictionary persistence,
correction or false-positive memory, mapping/envelope schema changes, password
reset or re-encryption, model/network access, delivery, response handling,
deanonymization of model output, routing, permissions, execution, audit-event
persistence, databases, services, frameworks, and external dependencies.

## Verification plan

```bash
npm ci --ignore-scripts
npx tsc -b tsconfig.build.json --clean
npm run check
npm audit --audit-level=high
git diff --check
```

The measurement command and exact decision thresholds will be fixed in the
corpus document before harness implementation. All generated inputs remain
synthetic, bounded, local, and excluded from ordinary workspace state.

## Definition of done

- corpus, exact ground truth, candidates, and decision gates precede
  measurement code;
- every reported match is scored by exact item, entity type, and UTF-8 byte
  range, with aggregate counts reconciling exactly;
- stable permutations and repeated runs produce identical candidates, hashes,
  counts, ordering, and decisions;
- invalid input fails closed without partial candidates or matched-text echo;
- existing Restricted blocking, reviewed-span transformation, mapping schema
  v1, envelope schema v1, and byte-exact restore remain unchanged;
- each candidate receives one evidence-backed decision and no decision is
  treated as production authorization;
- full repository gates pass, documentation is synchronized, one commit is
  created, and no push is performed.

## Risks and mitigations

| Risk                                              | Mitigation                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Synthetic data overstates real-world quality      | Include bilingual adversarial negatives and label results as corpus-bounded |
| Suggestions are mistaken for reviewed truth       | Keep candidate and reviewed states separate; add no production consumer     |
| Partial overlap inflates measured accuracy        | Score only exact item/type/UTF-8-range matches                              |
| Alias matching leaks business terminology         | Use fictional aliases and aggregate non-echoing reports                     |
| PII detection is confused with secret blocking    | Measure separately; preserve the existing Restricted detector unchanged     |
| A passing candidate silently expands E7 authority | Require a later ADR and sprint for any production rollout                   |

## Planning decisions

- Sprint 28 addresses the explicit evidence gate left by ADR-0021 before any
  automatic entity-detection scope;
- candidate discovery is limited to review assistance, not classification
  truth, policy approval, transformation, or transmission;
- deterministic standard syntax and exact fictional alias matching are the
  smallest dependency-free candidates aligned with the public design;
- model-based and semantic detection remain outside scope because they add
  dependency, privacy, reproducibility, and false-inference boundaries;
- GUI delivery is intentionally deferred because this sprint changes no
  user-facing capability; a later accepted production slice must include its
  bilingual GUI plan.

## Delivered outcome

- the bilingual synthetic corpus froze eight items, 12 exact ground-truth
  spans, five invalid cases, exact UTF-8 scoring, and structural and quality
  gates before the harness was implemented;
- the development-only harness compares bounded `STANDARD_SYNTAX`,
  `EXACT_ALIAS`, and `COMBINED` candidates without exporting a production
  recognizer or changing the facade, GUI, persistence, transformation, or
  delivery graph;
- two complete executions produced identical candidates, ordering, hashes,
  counts, gates, and decisions;
- `STANDARD_SYNTAX` produced 8 TP, 1 FP, and 0 FN, for 88.89% precision and
  100% recall; the code-like telephone false positive reduced `PHONE`
  precision to 50%, so the decision is `REFINE`;
- `EXACT_ALIAS` produced 4 TP, 0 FP, and 0 FN, for 100% precision and recall,
  so the corpus-bounded decision is `ADOPT_FOR_REVIEW`;
- `COMBINED` produced 12 TP, 1 FP, and 0 FN, for 92.31% precision and 100%
  recall, but inherits the failed telephone category gate and remains
  `REFINE`.

## Decision and retrospective

Only exact, explicitly configured aliases are recommended for a later
ADR-gated review-assistance increment. A match must remain
`SUGGESTED_NOT_REVIEWED` until the user confirms the current item hash, entity
type, and exact UTF-8 range; only that explicit action may create an unchanged
`USER_REVIEWED` span for the existing schema-v1 transformation contract.

Standard syntax and the combined candidate are not accepted for rollout. The
frozen code-like telephone case demonstrates why high overall recall cannot
substitute for per-category precision. Future refinement requires new frozen
evidence and must not claim semantic identity or complete PII detection.

Freezing adversarial negatives and per-category gates before implementation
made the false-positive pressure visible and prevented the stronger combined
headline metric from overriding the weaker telephone result. Sprint 29 is
therefore planned around the narrower exact-alias decision, with an ADR before
any production boundary and no delivery scope.

## Final verification

- clean locked install and clean composite build passed;
- formatting, lint, typecheck, build, and all 241 tests passed, including the
  targeted five-test measurement suite and authenticated loopback GUI
  acceptance;
- the two-run measurement command reproduced identical aggregate results and
  decisions;
- dependency audit reported zero vulnerabilities;
- diff validation and public-safety scans passed; the only secret-shaped
  values are deliberate synthetic Restricted-detector regression canaries;
- one commit is created without push as the final close action.
