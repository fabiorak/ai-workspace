# Privacy pseudonymization corpus and gates

This corpus was frozen before Sprint 26 implementation. All values are
fictional and synthetic.

## Cases

1. one ASCII customer label repeated in two included items;
2. one multibyte `résumé Δ` selection aligned to UTF-8 boundaries;
3. adjacent reviewed spans, applied without offset drift;
4. unchanged content outside reviewed spans;
5. stale content hash, dangling item, overlap, duplicate span, empty span, and
   split-code-point boundaries;
6. wrong key, modified ciphertext, modified authenticated metadata, truncated
   document, temporary document, stale owner lock, and non-owner permissions;
7. two saves of identical plaintext using distinct nonces and ciphertext;
8. byte-exact local restoration of every transformed item.

## Gates

- 100% exact restoration for valid cases;
- 100% unchanged bytes outside reviewed spans;
- identical reviewed value and entity type map to one pseudonym within a set;
- no selected plaintext, key, or local path appears in reports, errors, or the
  encrypted document;
- every invalid integrity, scope, identity, boundary, permission, or key case
  fails closed without partial output;
- mapping documents remain below 256 KiB, with at most 1,000 selections and
  1 MiB per transformed item;
- transformation remains local and adds no network, model, delivery,
  execution, database, framework, or external dependency.

Passing these gates authorizes only the bounded local preview and encrypted
mapping boundary described by ADR-0021.
