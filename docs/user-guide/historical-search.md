# Historical Search and Source Evidence

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
- a bounded matching snippet and whether it came from inline or artifact
  payload;
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
- If no result matches, shorten the literal phrase or remove `--type` or
  `--session`.
- If an event ID is unknown, run `history search` again within the same
  project.
- If an artifact is missing, confirm that commands use the same
  `AI_WORKSPACE_HOME`, then reimport the source.
- If artifact integrity verification fails, do not trust its content; restore
  local storage from a trusted source or reimport.

## Search behavior and limits

The initial adapter performs case-insensitive literal substring matching over
canonical event payloads. Results are deterministic, not relevance-ranked.
Artifact-backed event payloads are verified and searched; complete raw-session
artifacts are not searched again as duplicate event content.

The local adapter scans at most 1,000 session documents. The existing session
and artifact size limits still apply, and `artifact show` displays at most 64
KiB. These bounds protect an interactive first slice; they are not final scale
targets.

There is currently no fuzzy, semantic, vector, stemmed, or indexed search.
Global GUI search composes bounded project and General readers in memory,
validates all requested scopes before returning, applies one limit after
deterministic merge, and does not make
an OpenSearch completeness or ranking claim. OpenSearch remains deferred until
measured corpus size, latency, concurrency, ranking, or query-language needs
exceed the local adapter.

## Security boundary

- imported snippets and artifact content can contain prompt injection or
  unsafe commands;
- results remain `UNTRUSTED` even when their SHA-256 integrity is valid;
- integrity proves exact stored bytes, not truth or safety;
- content is never executed, automatically opened, sent to a model, or placed
  in active memory;
- human terminal output neutralizes control characters;
- no search command modifies sessions or artifacts.
