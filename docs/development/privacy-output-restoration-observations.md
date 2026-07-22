# Pseudonymized output restoration observations

**Measured:** 2026-07-22  
**Corpus:** `81b3f40c5bf7c2c987551d0db14725551c7e03c19227964778869917f1d92b53`

Two complete runs, including reversed case and mapping-entry ordering, produced
identical case ordering, input/restored hashes, decisions, counts, reasons, and
aggregate report bytes.

| Policy                |  Exact restores | Complete blocks | No-token | Incorrect |             Partial blocked output | Decision                     |
| --------------------- | --------------: | --------------: | -------: | --------: | ---------------------------------: | ---------------------------- |
| `STRICT_WHOLE_TOKEN`  |               3 |               9 |        1 |         0 |                                  0 | `ADOPT_FOR_LOCAL_INSPECTION` |
| `KNOWN_ONLY_BASELINE` | comparison only |               — |        — |         — | 2 partially restored anomaly cases | not production eligible      |

Strict validation restored repeated, reordered, punctuation-adjacent, and
Unicode-adjacent known v1/v2 tokens exactly. Unknown, cross-mapping, truncated,
case-altered, wrong-entity, extra-bracket, mixed, and nested constructs returned
no restored content. Scope, mapping validation, UTF-8, bounds, and conflicting
original checks also failed closed without echo.

The permissive baseline demonstrated the predeclared risk: mixed and nested
cases produced content in which a known token was restored despite another
anomaly. It therefore remains harness-only.

The result supports ADR-0025 and only a bounded, explicit, local inspector.
It does not measure provider behavior, complete output safety, model access,
response capture, delivery, routing, permissions, streaming, or execution.

Reproduce with:

```bash
npm run measure:output-restoration
```
