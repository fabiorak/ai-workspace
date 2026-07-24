# Import Your Own Local Transcripts

The reviewed synthetic corpus proves that ingestion works, but it cannot tell you
whether AI Workspace is useful on your own history. This capability reads a real
local Claude Code JSONL transcript and turns it into the same untrusted
historical evidence as any other import, so you can search, curate, and hand off
work that actually happened.

Reading is local. Nothing is transmitted, no directory is scanned
automatically, and no default location is assumed.

> [!WARNING]
> Imported evidence is stored unencrypted under `AI_WORKSPACE_HOME`
> (`~/.ai-workspace` by default). Treat that directory as sensitive: never copy
> it into a repository, a public issue, or a test fixture. Restricted-data
> screening blocks a small set of high-confidence credential patterns and is a
> safety net, not a guarantee. Do not import credentials, third-party or customer
> confidential material, mapping material, or recovery secrets.

## Prerequisites

- build the workspace with `npm run build`;
- register the related repository so a project ID exists;
- know the directory that holds the transcripts you want to list. On many
  installations Claude Code keeps one directory per project under
  `~/.claude/projects/`, but no location is assumed: you name the directory.

## Import through the GUI

1. start the GUI with `npm run gui` and open the printed one-time URL;
2. open **Projects** and select the project the transcripts belong to;
3. in **Import your own sessions**, type the directory that holds the
   transcripts and list it;
4. read the result: file names, sizes, and modification times only, newest
   first. Listing a directory does not open any transcript;
5. choose one file and import it.

The report shows how many events were added, how many were already present, the
total, and how many records were not converted, grouped by reason.

## Import through the CLI

List one directory:

```bash
npm run cli -- session discover /path/to/transcripts
```

Import one file:

```bash
npm run cli -- session import \
  --project <project-id> \
  --source claude-code-local \
  --file /path/to/transcripts/<session>.jsonl
```

Add `--json` for machine-readable output. The `claude-code` source keeps reading
only the reviewed synthetic corpus; `claude-code-local` is the tolerant reader
for real transcripts.

## What the reader converts

Conversation turns become canonical events:

- user turns become `USER_MESSAGE`;
- assistant replies become `AGENT_MESSAGE`;
- assistant reasoning also becomes `AGENT_MESSAGE`, tagged as reasoning in its
  payload, so no canonical event type had to be invented for it;
- tool invocations become `TOOL_CALL` and their results `TOOL_RESULT`, or
  `ERROR` when the result is marked as failed;
- a block shape the reader does not recognize is preserved as `UNKNOWN` evidence
  instead of being dropped.

Every event keeps its 1-based position, the SHA-256 hash of its raw record, and
provenance metadata such as the record UUID and whether the record was a
sidechain or meta record. Sidechain and meta records are imported, not filtered:
the point of historical evidence is that you can see what happened.

## What the reader skips, and why you always see it

A real transcript contains records that are not conversation turns. They are
skipped deterministically, counted, and reported by reason:

- `BLANK_LINE` — an empty line;
- `NON_MESSAGE_RECORD_TYPE:<type>` — a record such as `mode`, `attachment`,
  `file-history-snapshot`, or `queue-operation`. An unusual or over-long type
  name collapses to `other` so a transcript cannot inject arbitrary text into
  the report;
- `MESSAGE_WITHOUT_CONTENT` — a turn with nothing convertible in it;
- `INCOMPLETE_TRAILING_RECORD` — the last line was still being written. This is
  accepted only at the end of the file. An unparsable record anywhere else fails
  the import.

Skipping adds no event, so importing the same transcript again after it has
grown adds only the new suffix. If a record you already imported changed, or the
file was truncated, the import fails without rewriting stored evidence.

## Limits

64 MiB per transcript, 4 MiB per record, 1,000 content blocks per record, and
200,000 events per import. Discovery lists at most 500 candidates from one
directory and is not recursive. Canonical payloads above 4 KiB are stored as
separate immutable artifacts.

## Troubleshooting

### That transcript directory does not exist

Only the directory you name is listed, and shells do not create missing paths.
Check the path; no other location is searched.

### The transcript location must be a directory

Point discovery at the directory, then select a file from the result. Point
`session import --file` at the file itself.

### The transcript declares no sessionId / mixes several sessionId values

The reader requires exactly one session identity per file, because a stable
session ID is what makes re-import idempotent. Import each transcript
separately.

### Import blocked: restricted data detected

Screening found a high-confidence credential pattern. The message reports the
detector category and where it matched, never the value. Nothing was persisted.
Remove the credential from your workflow — rotate it if it was real — and import
a transcript that does not carry it.

### Records not converted is higher than expected

That is the accounting working as intended: the number tells you exactly how
much of the file did not become evidence. Read the per-reason breakdown before
concluding that a search found nothing.

## Related

- [Session ingestion](session-ingestion.md) for the Codex subset and the local
  storage layout;
- [Historical search](historical-search.md) to query what you imported;
- ADR-0029 for the decision that introduced the tolerant reader.
