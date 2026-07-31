# ADR-0033: Qualify rizzo-pii behind an interchangeable local detection port

**Status:** accepted

**Date:** 2026-07-31

## Context

[ADR-0021](0021-use-reviewed-spans-and-encrypted-local-pseudonym-mappings.md)
accepts only explicitly reviewed, item-scoped UTF-8 byte spans for reversible
pseudonymization. [ADR-0023](0023-use-transient-exact-customer-alias-suggestions.md)
adds transient exact suggestions without changing that boundary, and
[ADR-0025](0025-use-strict-local-pseudonymized-output-restoration.md) keeps
restoration local, strict, and all-or-nothing.

The product experience now targets a different preparation flow: local software
should propose a complete anonymized preview for human inspection instead of
requiring people to construct byte ranges. Detection remains advisory and cannot
be represented as a guarantee that every personal datum was found. Nothing may
leave the device until the exact transformed text has been inspected and
authorized.

Microsoft Presidio supplied the original product reference for automatic
personal-data detection. It is a general framework with configurable
recognizers, analysis, and anonymization. AI Workspace already owns the more
sensitive parts of that boundary: reviewed selections, encrypted mappings,
custody, strict restoration, privacy decisions, and model-delivery
authorization. Adopting a second anonymization and restoration protocol would
duplicate those controls and create conflicting sources of truth.

[`rizzo-pii`](https://github.com/Rizzo-AI-Academy/rizzo-pii) is an
Italian-first token-classification model and local application. At source commit
`360f4c514615fb7f65d0cc8729db14c555d385f1`, it combines a 307-million-parameter
mmBERT model with deterministic recognizers and checksum validation. Its
taxonomy has 22 categories, including Italian fiscal codes, VAT numbers,
cadastral references, document identifiers, and vehicle plates. The
[published model](https://huggingface.co/rizzoaiacademy/rizzo-pii-0.3B) at
revision `a7f1160d829c7b436a6d8f8ebdae523f83437edf` declares Italian entity-level
precision 0.9876, recall 0.9900, and F1 0.9888.

Those figures make the model a credible candidate, not a qualified privacy
boundary:

- the published metrics are self-reported and not independently verified by
  the model registry;
- validation is sentence-level, while the product must handle complete
  documents and mixed prose and code;
- the Italian legal identifiers without public real-world data are validated
  with generated values injected into held-out sentences;
- the published application chunks documents, merges neural and deterministic
  candidates, and restores a plain placeholder dictionary, but its contracts do
  not bind suggestions to AI Workspace item identity, content digests, UTF-8
  byte ranges, custody, or strict output restoration;
- the Python application brings Flask, PyTorch, Transformers, PyMuPDF, model
  weights of approximately 1.2 GB, and a separate desktop shell. None is an
  existing AI Workspace runtime dependency;
- the source repository has no merged automated test suite or continuous
  integration configuration at the inspected revision;
- the source and model declare the MIT license, and the mmBERT base model also
  declares MIT. Ai4Privacy, one training source, declares CC BY 4.0.
  [DeepMount00/pii-masking-ita](https://huggingface.co/datasets/DeepMount00/pii-masking-ita),
  another declared training source, exposes no license in its public dataset
  metadata. Redistribution therefore needs a documented provenance and license
  review rather than relying only on the repository-level MIT notice.

Italian is a primary product language, but language does not determine domain.
Repositories can contain prose, source code, credentials, customer aliases,
project names, and identifiers that are not part of the model taxonomy.
`rizzo-pii` therefore cannot replace restricted-secret screening, exact
customer/project suggestions, policy, or delivery authorization.

## Decision

Adopt a qualification-first direction for automatic personal-data detection.
`rizzo-pii` is the first Italian candidate to measure, behind an
interchangeable local detection port. This record does not adopt its runtime,
model weights, Flask application, desktop shell, mapping dictionary, or
restoration behavior as production dependencies.

The detection port is advisory and narrower than pseudonymization. It accepts
bounded text locally and returns candidate metadata only:

- an exact UTF-8 byte start and end;
- the detector's native category;
- bounded confidence and evidence source, distinguishing model inference from
  deterministic form or checksum evidence;
- detector, model, taxonomy, and artifact versions;
- no matched value, surrounding text, mapping, key, passphrase, local path, or
  source content in logs or durable evidence.

The caller binds accepted candidates to item identity and the current content
SHA-256. It validates byte boundaries and overlap before a candidate can enter
the reviewed-span workflow. Candidate categories remain separate from
pseudonym-mapping entity types. No `rizzo-pii` label may extend or reinterpret
mapping schema v1 or v2; any future taxonomy change requires an additive schema
decision and explicit reader dispatch.

AI Workspace remains the only owner of transformation, placeholder generation,
encrypted mappings, key custody, preview, authorization, and restoration.
`rizzo-pii` placeholders and its downloadable plain dictionary are not accepted
as mapping input. Its tolerant restoration is not used. Existing restricted-data
screening remains a separate fail-closed control for credentials and secrets,
and exact customer/project suggestions remain separate domain evidence.

Qualification must freeze a committable synthetic corpus and its scoring gates
before candidate execution. The same corpus must compare:

1. the current deterministic baseline;
2. a documented Italian Presidio configuration;
3. `rizzo-pii` model inference alone;
4. `rizzo-pii` combined with deterministic recognizers and checksums.

Results must be reported per category rather than only as a micro-average. The
corpus must include Italian prose, legal and administrative identifiers,
software text, mixed prose and code, hard negatives with identifier-like forms,
Unicode before and inside entities, repeated values, overlaps, long documents,
and unsupported-language cases. Measurements must cover exact-span precision
and recall, review burden from false positives, document-level misses, cold and
warm latency, peak memory, artifact size, startup failure, malformed output,
and proof that inference performs no network access.

Before any production adoption, a later decision must have:

- reproducible evidence that the candidate improves the declared Italian target
  categories without unacceptable review burden;
- explicit behavior for categories and languages not qualified by the corpus;
- a pinned model revision and digest, with no automatic download or implicit
  upgrade;
- a complete license and attribution record for source, weights, base model, and
  relevant training-data provenance;
- a packaging and process-isolation design that preserves local-first operation,
  least privilege, bounded inputs, and fail-closed unavailability;
- tests for byte conversion, overlap resolution, category policy, version
  dispatch, unavailable or corrupt artifacts, and absence of sensitive durable
  output;
- a GUI preview that shows proposed replacements and states once that automatic
  detection may be incomplete.

A detector failure, missing artifact, unsupported version, or malformed result
cannot authorize unchanged content for external delivery. The existing manual
reviewed-span path remains available until a production detector is separately
accepted.

## Consequences

- Italian-specific capability is evaluated directly instead of being inferred
  from a general framework's extensibility;
- Presidio remains a comparison baseline and possible future provider, not an
  adopted runtime dependency;
- the product can replace or supplement a detector without changing mapping,
  custody, restoration, or delivery semantics;
- the 22-category detector taxonomy does not leak into permanent mapping schemas
  by accident;
- candidate evidence gains explicit model and artifact provenance while matched
  personal values remain transient;
- deterministic recognizers can improve recall for structured identifiers, but
  hard negatives and review burden become required evidence because form-only
  rules can produce convincing false positives;
- a large Python and model distribution is not smuggled into the modular
  monolith through an application-level integration;
- license ambiguity in a training source blocks redistribution until it is
  resolved and documented, even though the source repository and published
  model declare MIT;
- qualification adds work before implementation, but keeps an unverified
  detector from becoming a privacy claim;
- automatic detection remains assistance. Human inspection of the exact outgoing
  text, encrypted local mappings, strict restoration, and explicit external
  authorization remain the security boundary.
