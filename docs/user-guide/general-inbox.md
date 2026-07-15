# General Inbox

The General Inbox stores an extemporaneous question without attributing it to
the currently selected project. It is available in the foreground loopback GUI
even when the Project Registry is empty.

## Capture a question

1. Start the GUI with `npm run gui` and open its one-time loopback URL.
2. In **General Inbox / Posta generale**, enter a bounded title and create the
   conversation. The visible destination is always `GENERAL`.
3. Select that conversation, enter one question, and save it explicitly.
4. Inspect the immutable event, exact UTF-8 byte count, SHA-256 digest,
   timestamp, and provenance shown in the inbox.

Capture creates only a local `USER_MESSAGE`. It does not call a model, create
an assistant answer, run an agent or tool, promote active memory, build a
Context Pack, deliver data, or infer ownership from project selection.

Events are `LOCAL_USER`, `USER_AUTHORED`, `UNVERIFIED`, and `CONFIDENTIAL` by
default. These labels describe attribution and handling; they do not establish
truth, trust, instruction priority, or permission. A shared high-confidence
restricted-data detector blocks recognized categories before persistence and
does not echo the rejected value. It is not complete secret or PII detection.

## Find it later

Search offers three explicit scopes:

- **All registered projects and General** (`ALL_SCOPES`) validates and merges
  every requested scope before applying the one global result limit;
- **General only** (`GENERAL_ONLY`) works with no registered project;
- **Selected project only** preserves the existing project search contract and
  never includes General implicitly.

Matching is case-insensitive literal substring search over canonical full
content. It does not provide stemming, typo tolerance, synonyms, fuzzy or
semantic similarity, ranking, or completeness claims. The CLI remains
project-scoped.

## Storage and recovery

General uses separate schema-v1 JSON documents under the local workspace state,
not a hidden project. Documents are bounded, canonically validated, integrity
checked, locked, flushed, and atomically published with restrictive modes.
There are no edit or delete operations.

If listing or all-scope search reports corruption, no partial General result is
returned. Preserve the local state for diagnosis, confirm the affected file,
then move only that file aside before retrying. Remove a lock only after
confirming its recorded owner is inactive. General storage is local but not
encrypted; do not use this pre-release feature for restricted production data.
