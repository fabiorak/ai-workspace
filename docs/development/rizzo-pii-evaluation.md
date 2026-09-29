# Rizzo PII evaluation protocol

**Frozen before measurement:** 2026-09-15\
**Scope:** development-only spike; all evaluated text and identifiers are synthetic

## Purpose and non-goals

This spike compares the existing `BuiltInPiiDetector`, Rizzo PII, and their
deterministic union behind the existing `PiiDetector` span contract. It does not
select a production sidecar, add a Python or model dependency, change the
default detector, call a remote provider, read a real workspace home, or make a
claim about real-world PII coverage.

Rizzo is pinned to application release `v2.0.0` (release commit `aa7d133`) and
model `v1.5.0`. The upstream source and model are separate artifacts. The
upstream source is MIT; its release documentation says complete desktop and PDF
bundles are AGPL-3.0 because they include PyMuPDF. Licensing, distribution,
updates, process isolation and resource limits therefore remain ADR questions
if the measurement justifies adoption.

Primary upstream references:

- https://github.com/Rizzo-AI-Academy/rizzo-pii/tree/v2.0.0
- https://github.com/Rizzo-AI-Academy/rizzo-pii/releases/tag/v2.0.0
- https://huggingface.co/rizzoaiacademy/rizzo-pii-0.3B/tree/v1.5.0

## Frozen corpus

`scripts/rizzo-pii-evaluation-corpus.ts` constructs 140 fixtures, ten in each
family. Seven positive families start predominantly in Italian and include
English pressure cases; all values are invented at run time from fixed literals
and algorithms.

The eleven positive families are person, organization, email, telephone,
Italian fiscal code, Italian VAT ID, Italian IBAN, address components, calendar
date, local path and URL. The three negative families are SHA-256-shaped text,
source code and logs. Code intentionally contains email and telephone-shaped
test literals. Logs intentionally contain ISO timestamps. These are pressure
cases for false positives, not hidden ground truth.

Fiscal codes, VAT IDs and IBANs use valid checksums so checksum-aware detectors
are measured on structurally valid but synthetic values. URLs use the reserved
`example.com` domain. Email addresses use the reserved `.invalid` top-level
domain. Corpus and ground truth hashes in the report make changes visible.

## Exact scoring and taxonomy bridge

A true positive requires the same fixture, normalized AI Workspace entity type,
UTF-8 byte start and UTF-8 byte end. Partial, wider, narrower and wrong-type
spans receive no credit. Precision and recall are reported overall and per
category. Code, log and hash false positives are reported separately.

Rizzo labels are mapped as follows:

- `FULLNAME` -> `PERSON`; `ORG` -> `ORGANIZATION`;
- `EMAIL`, `TELEPHONENUM`, `CF`, `PIVA`, `IBAN`, `URL` -> their corresponding
  AI Workspace deterministic types;
- `STREET`, `BUILDINGNUM`, `ZIPCODE`, `CITY`, `PROVINCE` -> `ADDRESS`;
- document, credit-card, plate and cadastral identifiers ->
  `BUSINESS_IDENTIFIER`;
- age, gender, time and amount -> `OTHER`.

Unknown upstream labels fail closed. The Rizzo 2.0 `/analyze` response exposes
ordered original segments when mapping is enabled, so the spike reconstructs
exact UTF-8 offsets locally. The concatenated segment text must be byte-identical
to the request; altered, missing or reordered content fails closed. It does not
expose the neural score. Validated regex/checksum segments therefore use
confidence `1`; neural segments use `0`
as an explicit "unavailable" sentinel. This is not a calibrated confidence and
is recorded as an adoption gap.

## Bounds and execution

The default command is safe and offline:

```bash
npm run measure:rizzo-pii
```

It measures only the current built-in detector and records Rizzo as `NOT_RUN`.
The report is written with mode 0600 to ignored
`.ai-workspace/measurements/rizzo-pii-evaluation.json` and contains only
aggregates, timings and digests.

For the optional Rizzo measurement, independently obtain and start the pinned
upstream sidecar on CPU, then run:

```bash
npm run measure:rizzo-pii -- --rizzo-endpoint=http://127.0.0.1:5005
```

The runner accepts only explicit numeric loopback HTTP endpoints, refuses
redirects, requires app 2.0.0, model 1.5.0 and CPU, limits each response to 2
MiB and each request to 30 seconds, and performs five warmups. It sends only the
synthetic corpus. It does not start, download or persist the sidecar itself.

## Predeclared decision gates

An ADR-0045 review is justified only when all of these hold for the hybrid:

- valid, duplicate-free UTF-8 spans;
- overall precision at least 90%;
- recall at least 80% for `PERSON`, `ORGANIZATION` and `ADDRESS`;
- at least 90% precision for deterministic types, with no recall regression
  from the built-in detector;
- at most two code false positives across ten fixtures;
- Rizzo CPU p95 at most 2,000 ms per bounded fixture.

Even if all numeric gates pass, the missing neural confidence remains an ADR
and adapter-contract issue. If Rizzo is unavailable, the only valid decision is
`RIZZO_NOT_RUN_DEFAULT_UNCHANGED`; absence is not a negative quality result.
The gate decision has a direct regression test for both the ADR-review and
do-not-adopt branches; changing a threshold or branch cannot silently reclassify
the frozen measurements.
