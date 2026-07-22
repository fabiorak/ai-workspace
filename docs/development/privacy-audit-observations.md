# Privacy decision audit observations

The frozen Sprint 32 corpus is defined in
[privacy-audit-corpus.md](privacy-audit-corpus.md). Reproduce its deterministic
measurement with:

```bash
npm run measure:privacy-audit
```

The accepted reference run on 2026-07-22 produced two cases, 1,657 canonical
bytes, one reviewable and one blocked decision, a valid predecessor chain,
stable key-order-independent canonical bytes, zero forbidden event fields, and
the fixed 1,000-event bound. The event hashes were
`333e02ad23125f6591271cc231db3a2c611e5d544e26301b23da8e5d7e67cb44`
and
`82e87162e7ba52b5d139eba5b4ca4e49527e5d53757232c8ad87fe03871fd438`.

Decision: `ADOPT_SEPARATE_BOUNDED_JSON_AUDIT`. Timing is not a gate. Domain,
adapter, application, and loopback tests cover canonical bytes, append/reread,
both decisions, distinct repetition, chaining, ordering, pagination, bounds,
concurrency, incomplete/corrupt/unsafe state, scope, and non-echoing failure.
