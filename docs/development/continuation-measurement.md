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

## Evidence gate through the application

Run `npm run measure:continuation-quality` to import six synthetic scenarios in
an isolated temporary home, keep a restart point through the GUI application
facade, and inspect the actual privacy proposal. The report is stored in
`.ai-workspace/measurements/continuation-quality.json`. Temporary source data is
removed after the run. A report with `gate: "FAIL"` is a measured product defect;
a successful script exit only means the measurement completed.

The cases check a failed attempt outside the five recent moments, an older
motivating constraint, evidence in a second linked session, a separate work in
the same project, a dated snapshot, and decisive text beyond the inline payload
limit. Each case specifies required source phrases before preparation. The scope
case also forbids the unrelated work's constraint. Source phrases are searched
in the outgoing proposal, never in the user's question or the confirmed next
action. Missing evidence is reported explicitly. Repository drift detection and
reviewed removal of a synthetic customer name are separate checks, and do not
turn a failed evidence gate into a pass.

This is a prerequisite for response evaluation, not a response rubric: no model
judges answers, no assistant performs a repository action, and there is no live
FULL/BASE comparison. The original byte report's FULL value is an accounting
reference only. Both timing arrays execute the same corpus measurement routine;
their difference must not be interpreted as a preparation speedup.

Current inspection also shows that the GUI stops at the protected text preview.
The fake delivery journey invokes the delivery coordinator and response writer
from the test, and does not demonstrate a GUI send/receive journey. Before a
live probe, complete that integration and verify that a second preparation
actually carries the preceding answer, not just that preparation returns ready.
