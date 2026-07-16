# Scripts

Repository development and maintenance automation belongs here. Scripts should
be documented, deterministic where practical, and safe by default.

`npm run measure:general-links` runs the Sprint 25 development-only REFERENCE
evaluation twice. It creates synthetic canonical General and link documents in
a private temporary workspace through production services/stores, reports only
aggregate counts/bytes/timings/decisions, and removes the workspace. It changes
no runtime API, GUI, normal local state, or retrieval policy. See the frozen
[corpus and result](../docs/development/general-link-retrieval-scale-corpus.md).

`npm run measure:entity-candidates` runs the Sprint 28 development-only entity
candidate evaluation twice. It compares bounded standard syntax, exact
fictional aliases, and their deterministic union against frozen exact UTF-8
ground truth. Output contains aggregate counts, hashes, gates, and decisions,
never matched text. It changes no runtime package export, GUI, facade, mapping,
policy, delivery, or execution path. See the frozen
[corpus](../docs/development/entity-candidate-discovery-corpus.md).
