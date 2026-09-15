# Rizzo PII evaluation observations

**Observed:** 2026-09-15  
**Corpus:** `U5_SYNTHETIC_IT_EN_V1`, 140 fixtures, 140 exact ground-truth spans  
**Decision:** `DO_NOT_ADOPT_RIZZO_DEFAULT_UNCHANGED`

## Result

The pinned Rizzo PII 2.0.0 application with model 1.5.0 was measured locally on
CPU through its loopback `/analyze` API. Five warmup requests preceded 140
measured requests. No provider, credential, real transcript or real workspace
home was used. The generated aggregate report is local and ignored at
`.ai-workspace/measurements/rizzo-pii-evaluation.json`.

| Detector                                    | Precision | Recall |   CPU p50 |   CPU p95 |
| ------------------------------------------- | --------: | -----: | --------: | --------: |
| Built-in after U5 telephone-span correction |    71.43% | 35.71% |  0.004 ms |  0.014 ms |
| Rizzo 2.0.0 / model 1.5.0                   |    64.02% | 75.00% | 37.793 ms | 54.033 ms |
| Rizzo plus built-in fallback                |    64.02% | 75.00% | 37.797 ms | 54.091 ms |

Rizzo found all ten exact person spans and raised overall recall substantially.
It also preserved 100% exact recall and precision for synthetic checksum-valid
fiscal codes, VAT IDs and IBANs, and found all ten reserved-domain URLs.

The hybrid nevertheless missed the predeclared adoption gates:

- overall precision was 64.02%, below 90%;
- organization precision/recall were 41.67%/50%;
- address precision/recall were 47.62%/50%;
- all ten code fixtures produced both an email and a telephone false positive;
- all ten log fixtures produced a date false positive;
- the upstream HTTP response omitted neural confidence, so the port cannot
  receive a calibrated score without an upstream or contract change.

The latency gate passed comfortably on this machine and short corpus, but a
single run over short synthetic texts does not establish long-document latency,
memory behavior, concurrency, packaging safety or real-data quality.

## What this decision does not say

The gates were adoption gates for a new model, runtime and distribution
dependency, not a certificate for the current default. Two consequences must be
read together with the result above.

**The built-in detector does not meet these gates either.** Its overall
precision is 71.43%, and its ten code fixtures produce twenty false positives
against a budget of two. The measured conclusion is therefore "Rizzo is not
enough better to justify the dependency", not "the built-in detector is
adequate".

**Automatic protection currently covers only deterministic categories.** On the
frozen corpus the built-in detector has 100% exact recall for email, telephone,
fiscal code, VAT ID and IBAN, and 0% recall for `PERSON`, `ORGANIZATION`,
`ADDRESS`, `DATE`, `PATH` and `URL`. In the daily conversation turn the only
span sources are values already present in the stable map and this detector, so
a person name, a company name or an address is never detected on first
occurrence. Rizzo reached 100% exact recall for `PERSON`, which is why the
coverage gap is a product question that outlives this negative result.

Until a detector covers those categories, the stable map needs a reviewed way
to receive a term chosen by the person, and the removal of the legacy manual
selection must not precede it.

## Built-in correction

The frozen exact-span corpus exposed that the built-in telephone expression
matched `333 ...` inside `+39 333 ...`, leaving the country prefix outside the
protected span. U5 replaces the leading ASCII word boundary with a Unicode
identifier boundary so the exact span includes `+39`. Telephone recall on the
ten positive fixtures changed from 0% to 100%. Code-shaped telephone and email
literals remain false positives; suppressing quoted content without syntax and
provenance would risk leaving real PII unprotected, so U5 records that limitation
instead of adding a broad contextual exception.

## Reproducibility note

The upstream tag resolved to commit
`aa7d13367766639666bca0b293956013b5ed782d`. Its Dockerfile initially failed in
this environment because the configured package resolver returned no
`huggingface_hub` candidate. The successful temporary build separated the
PyTorch layer and used `https://pypi.org/simple` explicitly for the remaining
Python packages. This workaround was not added to AI Workspace or to the
upstream source. The resulting local image manifest was
`sha256:32efebb50c3046f9d051521ba56e25ac389d768d10ee593acb6ebdcc2e002778`.

The container was published only on `127.0.0.1:5005`, ran with upstream
`HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`, and was stopped immediately
after the final run.

## Consequence

ADR-0045 is not created because the predeclared quality gates do not justify a
production runtime, service or distribution dependency. The production default
remains `BuiltInPiiDetector`. A future reconsideration needs a revised frozen
corpus that separates code/log policy, an upstream confidence contract or an
explicit port revision, and evidence that organization/address precision and
recall improve without weakening deterministic coverage.
