# Continuation baseline measurement

The first baseline is deliberately local and synthetic. Run:

```bash
node scripts/continuation-measurement.ts
```

The report is written to `.ai-workspace/measurements/continuation-baseline.json`,
which is ignored and must not be committed. It uses the existing deterministic
Context Builder corpus (27 invented combinations of continuity, instructions and
budgets) and repeats the read three times.

`FULL` counts all candidate UTF-8 content bytes as included. `BASE` counts the
bytes included by the product Context Pack and reports exact omissions. The
report includes candidate, included and omitted bytes, estimated bytes-divided-by-
four tokens, and local preparation time. Retrieval, transport, generation,
cache, provider usage and cost are explicitly null because no provider is called.
The corpus is not a transcript baseline, quality gate, token billing measure or
claim about savings. A full real transcript that exceeds an external limit is
not silently truncated or declared executable. Add quality rubrics and a fixed
provider configuration only after a live probe is separately authorized.
