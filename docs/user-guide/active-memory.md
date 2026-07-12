# Curate active project memory

The primary local GUI supports this complete lifecycle. Start it with
`npm run gui`, inspect a canonical event, choose **Use this event as memory
evidence**, and follow the inline create, browse, verify, supersede, or
invalidate actions. The CLI below remains supported for automation,
diagnostics, and advanced workflows.

Active memory records the small set of decisions, constraints, and failures
that a local user currently considers relevant. It is separate from imported
history:

- imported events remain immutable `UNTRUSTED` evidence;
- `USER_CURATED` means a local user deliberately wrote the memory statement;
- `USER_CURATED` does not mean trusted, true, safe, or verified;
- validity (`ACTIVE`, `SUPERSEDED`, `INVALIDATED`) and verification
  (`UNVERIFIED`, `VERIFIED`) answer different questions;
- confidence remains `UNASSESSED` in the current slice.

No memory command executes evidence, invokes an agent, or sends data over a
network.

## Add memory from historical evidence

Search and inspect a canonical event first:

```bash
npm run cli -- history search "synthetic runtime constraint" \
  --project <project-id>
npm run cli -- history show <event-id> --project <project-id>
```

Then curate a statement explicitly:

```bash
npm run cli -- memory add --project <project-id> \
  --type constraint \
  --content "Synthetic example: keep runtime support on Node.js 24" \
  --source-event <event-id>
```

For content that should not appear in shell history, omit `--content` and read
it from standard input. The command reads until end-of-file and does not show
an interactive prompt:

```bash
npm run cli -- memory add --project <project-id> \
  --type constraint --content-stdin --source-event <event-id>
```

Use `--source-event` repeatedly to attach up to 20 unique same-project events.
Creation returns an `ACTIVE`, `UNVERIFIED`, `UNASSESSED`, `USER_CURATED` item.

## List and inspect memory

```bash
npm run cli -- memory list --project <project-id>
npm run cli -- memory show <memory-id> --project <project-id>
```

List defaults to active items only, newest creation first with memory ID as a
stable tie-break. Filters are explicit:

```bash
npm run cli -- memory list --project <project-id> \
  --type decision --verification verified
npm run cli -- memory list --project <project-id> \
  --validity superseded
```

Use `--limit 1` through `--limit 100` to choose a page size. If another page
exists, human output prints a copyable command and JSON output returns
`nextCursor`. A cursor is bound to the project and complete filter set; do not
change filters while continuing a listing.

`memory show` displays the complete lifecycle and gives explicit `history show`
and `artifact show` commands. Opening source bytes always remains a separate
user action.

## Verify once

Verification records an attributable check against independent canonical
evidence. It does not change evidence trust or curation:

```bash
npm run cli -- memory verify <memory-id> --project <project-id> \
  --note "Synthetic verification performed against the recorded test result" \
  --source-event <verification-event-id>
```

Use `--note-stdin` instead of `--note` for standard input. Verification is
allowed once and only while the item is active.

## Supersede or invalidate

Supersession creates a new item and preserves the previous statement and
provenance:

```bash
npm run cli -- memory supersede <memory-id> --project <project-id> \
  --content "Synthetic example: support Node.js 24 and 26" \
  --source-event <replacement-event-id>
```

Use `--content-stdin` when needed. The replacement starts `ACTIVE`,
`UNVERIFIED`, and `UNASSESSED`; it inherits no verification or assessment.

Invalidation records a terminal state without a replacement:

```bash
npm run cli -- memory invalidate <memory-id> --project <project-id> \
  --reason "Synthetic constraint no longer applies" \
  --source-event <invalidation-event-id>
```

Use `--reason-stdin` instead of `--reason` for standard input. Superseded and
invalidated items remain inspectable but cannot transition again.

## JSON and local storage

Add `--json` to any memory command for stable machine-readable fields. Human
output neutralizes terminal control characters; JSON preserves content as
escaped data.

Memory is stored below `AI_WORKSPACE_HOME/memory/` in schema-validated,
project-scoped operation logs. Writes use restrictive permissions, diagnostic
owner-token locks, temporary files, and atomic replacement. Do not edit these
documents or lock files manually. A lock should be removed only after
confirming that its recorded owner is no longer active. Corrupt state fails
closed and should be moved aside before rebuilding memory from canonical
evidence.

This pre-release capability is intended for synthetic evaluation. Active
memory is not encrypted and should not contain credentials, confidential
transcripts, or private customer data.
