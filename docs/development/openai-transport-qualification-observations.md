# OpenAI transport qualification observations

The frozen inputs and gates are defined in the
[Responses corpus](openai-responses-qualification-corpus.md) and
[Codex headless corpus](codex-headless-qualification-corpus.md).

Reproduce both offline measurements with:

```bash
npm run measure:openai-responses
npm run measure:codex-headless
```

## Reference results

The deterministic run on 2026-07-22 produced:

- Responses corpus SHA-256
  `d4f64436e8bdce9725a5b87a2dc53284246e679b119230c0db5f89ec94397444`;
- 13 of 13 Responses cases and zero incorrect cases;
- successful bounded local parsing for synchronous v1 and streamed v2 fixtures;
- zero exposure for invalid state, altered input, absent credential capability,
  and pre-exposure failure;
- ambiguous outcomes for post-exposure loss, malformed receipt, and duplicate
  create because request IDs are not documented idempotency keys;
- Responses decision `EVIDENCE_ONLY`;
- Codex headless corpus SHA-256
  `c72a155fe0a9e563bbaf356d849d624df6e1840459fb34b1a4c4117bde8f94ab`;
- 10 of 10 fake-executable cases and zero incorrect cases;
- bounded argv, stdin, JSONL, output-schema, exit, timeout, and event handling;
- Codex decision `SEPARATE_AGENT_BOUNDARY` because exact model-visible input
  isolation is not established by the coding-agent surface.

Both commands execute twice and compare complete reports. They are offline,
credential-free, cost-free, and deterministic. They do not invoke OpenAI,
ChatGPT, Codex, a model, DNS, HTTP, or a real subprocess executable. Output
contains only synthetic labels, digests, counts, documented capability booleans,
and decisions.

## Product consequence

No live conformance probe was authorized or run. ADR-0027 remains absent and M5
remains incomplete. A later Responses increment must obtain separate approval
for a bounded synthetic live probe and must predeclare cost, credential
injection, sanitization, retry, reconciliation, and cleanup. `codex exec` moves
out of the E7 fallback path and can return only through a separately planned E9
agent-execution boundary.
