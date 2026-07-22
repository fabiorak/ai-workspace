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

`npm run measure:delivery-authorization` runs the Sprint 33 frozen
development-only authorization corpus twice. It uses only test-owned synthetic
intent metadata, an in-memory single-use store, and a synthetic adapter; it
opens no socket and accepts no endpoint, credential, real prompt, or response.
The `EVIDENCE_ONLY` result adds no production export, ADR, GUI action, provider,
network, model call, delivery, or execution path. See the frozen
[corpus](../docs/development/model-delivery-authorization-corpus.md) and
[observations](../docs/development/model-delivery-authorization-observations.md).

`npm run measure:openai-responses` and `npm run measure:codex-headless` run the
Sprint 34 qualification corpora twice. Both are offline and credential-free.
The first uses a synthetic Responses protocol adapter; the second uses a
deterministic fake executable port and never launches Codex. Results contain
only synthetic labels, digests, counts, documented capability booleans, and
decisions. See the [Responses corpus](../docs/development/openai-responses-qualification-corpus.md),
[Codex corpus](../docs/development/codex-headless-qualification-corpus.md), and
[observations](../docs/development/openai-transport-qualification-observations.md).

`npm run measure:openai-at-most-once` runs the frozen Sprint 36 bounded
at-most-once OpenAI attempt corpus twice. It exercises only synthetic test-owned
state, restart, concurrency, receipt, and warning evidence. It opens no socket,
reads no credential, invokes no model, captures no response, and creates no
production store. See the
[corpus](../docs/development/openai-at-most-once-attempt-corpus.md).

`npm run measure:anthropic-messages` and `npm run measure:claude-headless` run
the Sprint 35 qualification corpora twice. The first models bounded Messages
serialization and typed events; the second uses two deterministic fake Claude
Code profiles and never launches the installed executable. Neither command
reads authentication, opens a socket, incurs cost, or returns content. See the
[Messages corpus](../docs/development/anthropic-messages-qualification-corpus.md),
[Claude corpus](../docs/development/claude-headless-qualification-corpus.md),
and [observations](../docs/development/anthropic-transport-qualification-observations.md).
