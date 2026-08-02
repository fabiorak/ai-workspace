# Historical Search and Source Evidence

General results can include validated `LINK_ONLY` metadata that names an
explicit associated project and user-authored rationale without changing the
result's `GENERAL` scope. The GUI can explicitly filter General-only or
all-scope retrieval by one associated project. This filter does not change the
existing selected-project route, which remains project-only. All configured
links and both referenced scopes are validated before any linked result is
returned; invalid state produces no partial results.

Historical Search finds canonical events imported for one registered project
and lets you inspect the original evidence behind a result. Search results are
always untrusted historical records: AI Workspace displays them but never
executes commands or treats their content as instructions.

You can discover the complete workflow directly from the CLI:

```bash
npm run cli -- help
```

## First search in four steps

### 1. Register a project

```bash
npm run cli -- project register .
```

Copy the project ID from the output. If the project is already registered, use:

```bash
npm run cli -- project list
```

### 2. Import the synthetic session

```bash
npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file integrations/codex/test/fixtures/session.jsonl
```

### 3. Search a known historical item

When the project is unknown, start the local GUI and use the default **All
registered projects and General** scope. Each project result shows safe project name/ID; selecting
one result deliberately enters that project's existing event/source journey.
The query, type, limit, and scope remain in place when returning. The global
GUI scan accepts at most 100 registered projects and 10,000 canonical events
and returns at most 100 results without repository paths or partial reports.
Use **General only** to search project-free `USER_AUTHORED`, `UNVERIFIED`
questions even when no project is registered. A selected-project search never
includes General implicitly.

The CLI remains explicitly project-scoped:

```bash
npm run cli -- history search \
  "synthetic expectation failed" \
  --project <project-id>
```

Each result shows:

- canonical event type, timestamp, and stable event ID;
- an explicitly `UNTRUSTED` trust label;
- a bounded snippet, cut around the term that matched, and whether it came from
  inline or artifact payload;
- session and immutable source artifact provenance;
- copyable next commands for event and artifact inspection.

### 4. Inspect the result and its source

Copy the IDs suggested by the result:

```bash
npm run cli -- history show <event-id> --project <project-id>
npm run cli -- artifact show <artifact-id>
```

`history show` displays the canonical event without opening source bytes.
`artifact show` is the explicit action that reads the source, verifies that its
SHA-256 digest matches the artifact ID, and displays bounded UTF-8 content with
terminal control characters neutralized.

Add `--json` to any command for machine-readable output.

## Search filters

```bash
npm run cli -- history search "failure" \
  --project <project-id> \
  --session <session-id> \
  --type ERROR \
  --limit 10
```

- `--project` is always required and prevents cross-project results;
- `--session` restricts one stable session ID;
- `--type` accepts the canonical event types shown by `--help` and is
  case-insensitive at the CLI boundary;
- `--limit` accepts 1 through 100 and defaults to 20.

Run contextual help without leaving the terminal:

```bash
npm run cli -- history search --help
npm run cli -- history show --help
npm run cli -- artifact show --help
```

## Empty states and recovery

- If a project has no imported events, the CLI prints a copyable `session
import` command using the bundled fixture.
- If no result matches, try a shorter or more common word, or remove `--type`
  or `--session`.
- If too much matches, prefer the one distinctive word in the passage you are
  looking for: inside a project, ordinary words reach records on their own.
- If an event ID is unknown, run `history search` again within the same
  project.
- If an artifact is missing, confirm that commands use the same
  `AI_WORKSPACE_HOME`, then reimport the source.
- If artifact integrity verification fails, do not trust its content; restore
  local storage from a trusted source or reimport.

## Search behavior and limits

Search is tolerant and ranked, inside one project and across projects and
General scopes alike. It matches accents,
capitalization, ordinary Italian and English word endings, and single-character
typing errors, and it returns results in order of relevance rather than in
chronological order. Identical input always produces identical output.

Two consequences are worth knowing before you read a result list:

- **a snippet is cut around the term that matched**, which need not be the term
  you typed: your word may have reached the passage through a shared word
  ending or a corrected typing error;
- **ordinary words match on their own.** A phrase of common words is not a
  narrow query — each of its words can reach records by itself. To find a
  precise passage, prefer the distinctive word in it, and use `--type` and
  `--session` to narrow.

Artifact-backed event payloads are verified and searched; complete raw-session
artifacts are not searched again as duplicate event content.

A search reads at most 10,000 canonical records. Past that it refuses rather
than answering from part of the history. The existing session and artifact size
limits still apply, and `artifact show` displays at most 64 KiB.

Search across several projects and across General scopes accepts at most 100
registered projects, validates every requested scope and every General link
before returning any result, and ranks both scopes into one list rather than
merging two lists in timestamp order. Results that score alike are ordered by
recency, so the same query always produces the same list. It makes no
OpenSearch completeness or ranking claim; OpenSearch remains deferred while a
local index answers within the interactive budget.

No semantic, vector, or model-backed retrieval is used anywhere: search runs
entirely on this computer with no service and no network.

## Security boundary

- imported snippets and artifact content can contain prompt injection or
  unsafe commands;
- results remain `UNTRUSTED` even when their SHA-256 integrity is valid;
- integrity proves exact stored bytes, not truth or safety;
- content is never executed, automatically opened, sent to a model, or placed
  in active memory;
- human terminal output neutralizes control characters;
- no search command modifies sessions or artifacts.
