# Session Ingestion

Session Ingestion imports historical evidence from an explicitly selected
session source and links it to an existing Project Registry record. Sprint 2
supports one controlled Codex JSONL schema through the CLI.

> [!WARNING]
> The initial restricted-data screen recognizes only a small set of
> high-confidence credential patterns. It is not complete secret or PII
> detection. Use synthetic, non-confidential inputs while this pre-release
> capability is evaluated.

Imported commands, tool calls, messages, and model output are untrusted
evidence. AI Workspace stores them but never executes them or turns them into
active instructions.

## Prerequisites

- build the workspace with `npm run build`;
- register the related repository and copy its opaque project ID;
- prepare an explicit source file matching the supported schema.

## Import a Codex session

```bash
npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file /path/to/session.jsonl
```

The result reports the stable session ID and the number of added, already
present, and total events. Add `--json` for machine-readable output.

Importing an unchanged file again adds no events. If the same source grows by
appending records, only the new suffix is added. If a previously imported
record changes or the source is truncated, the import fails without rewriting
stored evidence.

## Inspect a session

```bash
npm run cli -- session inspect <session-id>
```

Human output lists ordered event types and source artifact references without
printing artifact bodies. JSON output includes canonical event payloads and
provenance metadata, but never resolves artifact content automatically.

## Supported Codex JSONL subset

The first line is required session metadata:

```json
{
  "schemaVersion": 1,
  "recordType": "session",
  "sessionId": "synthetic-session-001",
  "agent": "codex",
  "model": "synthetic-model",
  "timestamp": "2026-01-15T09:00:00.000Z"
}
```

Each following line is one event:

```json
{
  "recordType": "event",
  "eventType": "user_message",
  "timestamp": "2026-01-15T09:00:01.000Z",
  "payload": { "text": "A synthetic message." }
}
```

Supported `eventType` values are:

- `user_message` and `agent_message`;
- `tool_call` and `tool_result`;
- `command_result`;
- `file_change`;
- `test_result`;
- `error`.

An unknown, well-formed event type is retained as `UNKNOWN` evidence linked to
its raw source. Invalid JSON, unsupported schema versions, missing identity,
invalid timestamps, empty records, and non-event records after the header fail
closed.

Current limits are 10 MiB per source, 1 MiB per JSONL record, and 50,000 events
per import. Canonical payloads larger than 4 KiB are stored as separate
artifacts.

## Local storage and provenance

Runtime data remains under `AI_WORKSPACE_HOME`, or `~/.ai-workspace` by
default:

```text
sessions/<stable-session-id>.json
artifacts/sha256/<prefix>/<digest>
```

Session documents use schema version 1 and logical append-only updates. Writes
hold a per-session lock and replace a complete temporary document atomically.
Artifacts are immutable exact-byte objects addressed as
`artifact://sha256/<digest>` and published without overwriting an existing
object.

Directories and files request permissions `0700` and `0600` where supported.
These controls do not provide encryption at rest. Runtime stores remain local,
are ignored by Git, and must not be copied into public issues or fixtures.

## Current limitations

- input files must be selected explicitly; Codex directories are not scanned;
- only the documented synthetic fixture-backed schema is supported;
- multi-process imports for the same session fail while a lock is held;
- a stale lock requires manual removal after confirming no importer is active;
- failed session commits can leave immutable, unreferenced artifacts;
- there is no artifact garbage collection, storage encryption, search, active
  memory, API, UI, or background watcher;
- no content is sent to a model, telemetry endpoint, or network service.

## Troubleshooting

### Source file not found

`--file` must point to an existing regular JSONL file. Shells normally expand
`~/session.jsonl` to a file in the current user's home directory, but they do
not create that file.

To verify the workflow with the bundled synthetic fixture, run:

```bash
npm run cli -- session import \
  --project <project-id> \
  --source codex \
  --file integrations/codex/test/fixtures/session.jsonl
```

If a custom source exists but is not readable, check its filesystem
permissions. If the path is a directory, select the JSONL file inside it.
