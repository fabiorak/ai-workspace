# Anthropic transport qualification observations

The frozen inputs and gates are defined in the
[Messages corpus](anthropic-messages-qualification-corpus.md) and
[Claude headless corpus](claude-headless-qualification-corpus.md).

Reproduce both offline measurements with:

```bash
npm run measure:anthropic-messages
npm run measure:claude-headless
```

## Reference results

The deterministic run on 2026-07-22 produced:

- Messages corpus SHA-256
  `67f464eb7fd55928558538a1e981b0ce6a16a532bfea711d5d5df75f0defadee`;
- 19 of 19 Messages cases and zero incorrect cases;
- exact v1/v2 request and system binding, fixed version and output bound, zero
  tools, and typed stream-order enforcement;
- ambiguous outcomes for post-exposure loss, retryable provider failures,
  malformed streams, and duplicate create;
- Messages decision `EVIDENCE_ONLY`;
- Claude headless corpus SHA-256
  `c0de4a773637f1a7e5e5039ca1c84f1bd1d635931cd9276551ee0945d1b472c9`;
- 14 of 14 fake-executable cases and zero incorrect cases;
- bounded argv, stdin, stream JSON, init context, result, timeout, exit, and
  process-tree cleanup handling;
- bare decision `API_EQUIVALENT_NOT_FALLBACK`;
- managed-login decision `SEPARATE_AGENT_BOUNDARY`.

Both commands execute twice and compare complete reports. They are offline,
credential-free, cost-free, and deterministic. They do not invoke Anthropic,
Claude, Claude Code, DNS, HTTP, or a real subprocess executable. Output contains
only synthetic labels, digests, counts, documented capability booleans, and
decisions.

## Product consequence

No live conformance probe was authorized or run. ADR-0027 remains absent and M5
remains incomplete. Messages remains a provider candidate pending a separately
authorized bounded synthetic live probe and a safe external reconciliation
design. Bare Claude Code cannot solve missing API credentials; managed-login
Claude Code can return only through a separately planned E9 agent-execution
boundary.
